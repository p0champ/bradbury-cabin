const { chromium } = require(process.env.CABIN_PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const out = path.resolve(process.env.CABIN_EVIDENCE_DIR || "evidence");
async function mock(
  page,
  scenario = "layer",
  lying = false,
  preferences = { practised: true, headPointer: true },
) {
  await page.addInitScript(
    ({ scenario, lying, preferences }) => {
      localStorage.setItem("cabin-controls", JSON.stringify(preferences));
      const compatible = new WeakSet();
      WebGL2RenderingContext.prototype.makeXRCompatible = async function () {
        compatible.add(this);
      };
      const createShader = WebGL2RenderingContext.prototype.createShader;
      WebGL2RenderingContext.prototype.createShader = function (...args) {
        if (!compatible.has(this))
          throw Error("GPU resources created before XR compatibility");
        return createShader.apply(this, args);
      };
      class Transform {
        constructor(p = {}, q = { x: 0, y: 0, z: 0, w: 1 }) {
          this.position = { x: p.x || 0, y: p.y || 0, z: p.z || 0, w: 1 };
          this.orientation = q;
          const { x, y, z, w } = q;
          const m = new DOMMatrix([
            1 - 2 * y * y - 2 * z * z,
            2 * x * y + 2 * w * z,
            2 * x * z - 2 * w * y,
            0,
            2 * x * y - 2 * w * z,
            1 - 2 * x * x - 2 * z * z,
            2 * y * z + 2 * w * x,
            0,
            2 * x * z + 2 * w * y,
            2 * y * z - 2 * w * x,
            1 - 2 * x * x - 2 * y * y,
            0,
            this.position.x,
            this.position.y,
            this.position.z,
            1,
          ]);
          this.matrix = m.toFloat32Array();
          this.inverse = { matrix: m.inverse().toFloat32Array() };
        }
      }
      window.XRRigidTransform = Transform;
      window.__mock = {
        scenario,
        lying,
        placed: [],
        layerData: new Map(),
        versions: new Map(),
        draws: 0,
        projectionDraws: 0,
        uploads: 0,
      };
      const head = () => {
        const angle = Math.atan((window.__mock.offsetX || 0) / 1.1) / 2,
          c = Math.cos(angle),
          s = Math.sin(angle);
        const q =
          window.__mock.look ||
          (lying
            ? {
                x: Math.SQRT1_2 * c,
                y: Math.SQRT1_2 * s,
                z: Math.SQRT1_2 * s,
                w: Math.SQRT1_2 * c,
              }
            : { x: 0, y: s, z: 0, w: c });
        return new Transform(
          { x: window.__mock.offsetX || 0, y: lying ? 0.7 : 1.6, z: 0 },
          q,
        );
      };
      let gl, callback;
      const session = new EventTarget();
      const layersEnabled = !scenario.startsWith("no-layers-feature");
      if (!scenario.endsWith("-unreported"))
        session.enabledFeatures = layersEnabled
          ? ["local", "layers"]
          : ["local"];
      window.__mock.renderUpdates = [];
      session.environmentBlendMode =
        scenario === "opaque" ? "opaque" : "alpha-blend";
      session.inputSources = [];
      session.requestReferenceSpace = async () => new EventTarget();
      session.updateRenderState = (s) => {
        if (scenario === "limited-layers" && s.layers?.length > 1)
          throw Error("Compositor layer budget exceeded");
        // Quest rejects even baseLayer:null when Layers was negotiated.
        if (layersEnabled && Object.hasOwn(s, "baseLayer"))
          throw Error("Can't use baseLayer with layers feature requested");
        if (!layersEnabled && Object.hasOwn(s, "layers"))
          throw Error("Layers feature was not enabled");
        if (Object.hasOwn(s, "baseLayer") && Object.hasOwn(s, "layers"))
          throw Error("Cannot supply both render-state layer properties");
        window.__mock.renderUpdates.push(Object.keys(s));
        session.pendingState = s;
      };
      session.end = async () => {
        session.ended = true;
        session.dispatchEvent(new Event("end"));
      };
      session.requestAnimationFrame = (fn) => {
        callback = fn;
      };
      const projection = new Float32Array([
        1.1, 0, 0, 0, 0, 1.32, 0, 0, 0, 0, -1.002, -1, 0, 0, -0.2, 0,
      ]);
      window.__mock.clock = performance.now();
      window.__step = (advance = 16) => {
        if (advance > 40) {
          while (advance > 0) {
            const piece = Math.min(40, advance);
            __step(piece);
            advance -= piece;
          }
          return;
        }
        window.__mock.clock += advance;
        if (session.pendingState) {
          session.renderState = session.pendingState;
          session.pendingState = null;
        }
        const frame = {
          getViewerPose: () =>
            window.__mock.poseLost
              ? null
              : {
                  transform: head(),
                  views:
                    scenario === "stereo-layer"
                      ? ["left", "right"].map((eye) => ({
                          eye,
                          projectionMatrix: projection,
                          transform: new Transform(
                            {
                              x:
                                head().position.x +
                                (eye === "left" ? -0.032 : 0.032),
                              y: head().position.y,
                              z: head().position.z,
                            },
                            head().orientation,
                          ),
                        }))
                      : [{ projectionMatrix: projection, transform: head() }],
                },
          getJointPose: (joint) =>
            joint?.pose ? { transform: new Transform(joint.pose) } : null,
          getPose: (space) => ({
            transform: new Transform(
              head().position,
              window.__mock.rayByHand?.[space?.handedness] ||
                window.__mock.rayLook ||
                head().orientation,
            ),
          }),
        };
        const cb = callback;
        callback = null;
        if (cb) {
          window.__mock.inFrame = true;
          cb(window.__mock.clock, frame);
          window.__mock.inFrame = false;
          if (!session.ended && gl.getParameter(gl.TEXTURE_BINDING_2D) !== null)
            throw Error("Layer texture remains bound after XR callback");
          if (window.__mock.attachments?.some(Boolean))
            throw Error("Projection texture remained attached after callback");
          // Synthetic preview only; the real browser compositor owns this step.
          const tex = session.renderState.layers?.includes(
            window.__mock.projection,
          )
            ? window.__mock.projectionTexture
            : window.__mock.texture;
          const previewKey = session.renderState.layers?.includes(
            window.__mock.projection,
          )
            ? "projection:" + window.__mock.clock
            : "page:" + window.__mock.versions.get(tex);
          if (
            !session.ended &&
            tex &&
            previewKey !== window.__mock.previewKey
          ) {
            window.__mock.previewKey = previewKey;
            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(
              gl.READ_FRAMEBUFFER,
              gl.COLOR_ATTACHMENT0,
              gl.TEXTURE_2D,
              tex,
              0,
            );

            const projection = session.renderState.layers?.includes(
              window.__mock.projection,
            );
            const width = projection ? 1200 : window.__mock.quadWidth,
              height = projection ? 1000 : window.__mock.quadHeight;
            const pixels = new Uint8Array(width * height * 4);
            gl.readPixels(
              0,
              0,
              width,
              height,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels,
            );
            const flipped = new Uint8ClampedArray(pixels.length);
            for (let y = 0; y < height; y++)
              flipped.set(
                pixels.subarray(y * width * 4, (y + 1) * width * 4),
                (height - 1 - y) * width * 4,
              );
            window.__mock.latestPixels = flipped;
            let preview = document.querySelector("#xr-preview");
            if (!preview) {
              preview = document.createElement("canvas");
              preview.id = "xr-preview";
              document.body.append(preview);
            }
            preview.width = 1200;
            preview.height = 1000;
            const staging = document.createElement("canvas");
            staging.width = width;
            staging.height = height;
            staging
              .getContext("2d")
              .putImageData(new ImageData(flipped, width, height), 0, 0);
            const shownWidth = projection ? 1200 : (1000 * width) / height;
            preview
              .getContext("2d")
              .drawImage(staging, (1200 - shownWidth) / 2, 0, shownWidth, 1000);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(fbo);
          }
        }
      };
      window.__hand = (distance, handedness = "right") => {
        window.__mock.sources ||= {};
        let source = window.__mock.sources[handedness];
        if (!source) {
          source = {
            handedness,
            targetRaySpace: { handedness },
            hand: new Map([
              ["index-finger-tip", {}],
              ["thumb-tip", {}],
            ]),
          };
          window.__mock.sources[handedness] = source;
        }
        const local = new DOMPoint(
          handedness === "left" ? -0.22 : 0.22,
          -0.25,
          -0.45,
        ).matrixTransform(new DOMMatrix(head().matrix));
        source.hand.get("index-finger-tip").pose =
          distance == null ? null : { x: local.x, y: local.y, z: local.z };
        source.hand.get("thumb-tip").pose =
          distance == null
            ? null
            : { x: local.x + distance, y: local.y, z: local.z };
        session.inputSources = [source];
        return source;
      };
      window.__pinch = (hand = "right", duration = 240) => {
        __hand(0.05, hand);
        __step(520);
        __hand(0.012, hand);
        __step(duration);
        for (const distance of [0.02, 0.026, 0.032, 0.04, 0.05, 0.05, 0.05]) {
          __hand(distance, hand);
          __step(40);
        }
      };
      window.__hold = (hand = "right") => {
        __hand(0.05, hand);
        __step(520);
        __hand(0.012, hand);
        __step(1480);
      };
      window.__aim = async (id, rayOnly = false) => {
        const { menuButtons } = await import("./gestures.js?v=5");
        const button = menuButtons.find((b) => b.id === id);
        const matrix = __mock.placed.at(-1);
        const target = new DOMPoint(
          ((button.x + button.w / 2) / 2048 - 0.5) * 0.72,
          (0.5 - (button.y + button.h / 2) / 2560) * 0.9,
          0,
        ).matrixTransform(new DOMMatrix(matrix));
        const p = head().position;
        let x = target.x - p.x,
          y = target.y - p.y,
          z = target.z - p.z;
        const length = Math.hypot(x, y, z);
        x /= length;
        y /= length;
        z /= length;
        const norm = Math.hypot(y, -x, 1 - z),
          q = { x: y / norm, y: -x / norm, z: 0, w: (1 - z) / norm };
        if (typeof rayOnly === "string") {
          __mock.rayByHand ||= {};
          __mock.rayByHand[rayOnly] = q;
        } else if (rayOnly) __mock.rayLook = q;
        else __mock.look = q;
        __step();
      };
      window.__select = () => {
        const e = new Event("select");
        e.inputSource = { targetRaySpace: {} };
        e.frame = { getPose: () => ({ transform: head() }) };
        session.dispatchEvent(e);
      };
      window.__mock.session = session;
      function setupGL(g) {
        gl = g;
        window.__mock.gl = g;
        g.canvas.width = 1200;
        g.canvas.height = 1000;
        if (window.__mock.glReady) return;
        window.__mock.glReady = true;
        const opaque = new Set();
        window.__mock.opaque = opaque;
        let injected = 0;
        const getError = g.getError.bind(g);
        g.getError = () => {
          if (injected) {
            const code = injected;
            injected = 0;
            return code;
          }
          return getError();
        };
        const texImage = g.texImage2D.bind(g);
        g.texImage2D = (...args) => {
          if (opaque.has(g.getParameter(g.TEXTURE_BINDING_2D)))
            throw Error("Opaque texture was reallocated");
          return texImage(...args);
        };
        const subImage = g.texSubImage2D.bind(g);
        g.texSubImage2D = (...args) => {
          const destination = g.getParameter(g.TEXTURE_BINDING_2D);
          window.__mock.versions.set(
            destination,
            (window.__mock.versions.get(destination) || 0) + 1,
          );
          if (g.getParameter(g.TEXTURE_BINDING_2D) === window.__mock.texture) {
            window.__mock.uploads++;
            if (scenario === "quad-gl-error") {
              injected = g.INVALID_OPERATION;
              return;
            }
          }
          return subImage(...args);
        };
        const mipmap = g.generateMipmap.bind(g);
        g.generateMipmap = (...args) => {
          if (opaque.has(g.getParameter(g.TEXTURE_BINDING_2D)))
            throw Error("Opaque texture mipmaps generated");
          if (scenario === "source-gl-error") {
            injected = g.INVALID_VALUE;
            return;
          }
          return mipmap(...args);
        };
        const attach = g.framebufferTexture2D.bind(g);
        g.framebufferTexture2D = (...args) => {
          if (window.__mock.inFrame) {
            const slot = args[1] === g.COLOR_ATTACHMENT0 ? 0 : 1;
            window.__mock.attachments ||= [null, null];
            window.__mock.attachments[slot] = args[3];
          }
          if (
            window.__mock.inFrame &&
            args[3] &&
            args[3] === window.__mock.texture
          )
            throw Error("A attached its quad texture instead of direct upload");
          return attach(...args);
        };
        const draw = g.drawArrays.bind(g);
        g.drawArrays = (...args) => {
          if (window.__mock.inFrame) window.__mock.projectionDraws++;
          if (scenario === "projection-gl-error") {
            injected = g.INVALID_FRAMEBUFFER_OPERATION;
            return;
          }
          return draw(...args);
        };
      }
      function colorTexture(width, height) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
        window.__mock.opaque.add(tex);
        return tex;
      }
      window.XRWebGLLayer = class {
        constructor(s, g) {
          if (layersEnabled)
            throw Error("Legacy eye buffer created in a Layers session");
          setupGL(g);
          this.framebuffer = null;
          this.fixedFoveation = 1;
        }
        getViewport() {
          return { x: 0, y: 0, width: 1200, height: 1000 };
        }
      };
      window.XRWebGLBinding = class {
        constructor(s, g) {
          setupGL(g);
        }
        createProjectionLayer(init) {
          if (!layersEnabled) throw Error("Layers not enabled");
          if (init.textureType !== "texture")
            throw Error("Expected 2D projection texture");
          const tex = colorTexture(1200, 1000);
          const depth = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, depth);
          gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 1200, 1000);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.bindTexture(gl.TEXTURE_2D, null);
          window.__mock.opaque.add(depth);
          window.__mock.depthTexture = depth;
          window.__mock.projectionTexture = tex;
          const layer = {
            fixedFoveation: 1,
            destroy() {
              gl.deleteTexture(tex);
              gl.deleteTexture(depth);
            },
          };
          window.__mock.projection = layer;
          return layer;
        }
        getViewSubImage(layer, view) {
          if (!session.renderState.layers?.includes(layer))
            throw Error("Projection not active yet");
          return {
            colorTexture: window.__mock.projectionTexture,
            depthStencilTexture: window.__mock.depthTexture,
            viewport: {
              x: view.eye === "right" ? 600 : 0,
              y: 0,
              width: view.eye ? 600 : 1200,
              height: 1000,
            },
          };
        }
        createQuadLayer(init) {
          if (scenario.startsWith("no-layer"))
            throw Error("Deliberate unsupported layer fixture");
          const badge = init.viewPixelWidth === 256;
          const width = badge
              ? 256
              : scenario === "clamped-layer"
                ? 1024
                : 2048,
            height = badge ? 256 : scenario === "clamped-layer" ? 1280 : 2560;
          const tex = colorTexture(width, height),
            data = { tex, width, height, badge, matrix: null };
          const layer = {
            opacity: 1,
            set transform(v) {
              data.matrix = Array.from(v.matrix);
              if (!badge) window.__mock.placed.push(data.matrix);
            },
            destroy() {
              gl.deleteTexture(tex);
              data.destroyed = true;
            },
          };
          window.__mock.layerData.set(layer, data);
          if (!badge) {
            window.__mock.quadWidth = width;
            window.__mock.quadHeight = height;
            window.__mock.texture = tex;
            window.__mock.quad = layer;
          }
          return layer;
        }
        getSubImage(layer) {
          const data = window.__mock.layerData.get(layer);
          if (!session.renderState.layers?.includes(layer))
            throw Error("getSubImage used before active layers changed");
          if (!data || data.destroyed) throw Error("Invalid layer texture");
          if (!data.badge && scenario === "draw-failure")
            throw Error("Deliberate layer draw failure");
          if (!data.badge) window.__mock.draws++;
          return {
            colorTexture: data.tex,
            viewport: { x: 0, y: 0, width: data.width, height: data.height },
          };
        }
      };
      Object.defineProperty(navigator, "xr", {
        value: {
          isSessionSupported: async () => true,
          requestSession: async () => {
            if (scenario === "deny")
              throw Error("Deliberate permission denial");
            session.ended = false;
            return session;
          },
        },
      });
    },
    { scenario, lying, preferences },
  );
}
(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CABIN_CHROMIUM_PATH
      ? { executablePath: process.env.CABIN_CHROMIUM_PATH }
      : {}),
  });
  let checks = 0;
  const passed = (name) => {
    checks++;
    console.log("PASS " + name);
  };
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    await page.addInitScript(() =>
      localStorage.setItem(
        "cabin-controls",
        JSON.stringify({ practised: true, headPointer: true }),
      ),
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:18140");
    await page.waitForFunction(() =>
      document.querySelector("#place").textContent.includes("Page"),
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: path.join(out, "desktop.png"),
      fullPage: true,
    });
    await page
      .locator("#page")
      .screenshot({ path: path.join(out, "paper-medium.png") });
    await page.waitForFunction(() => document.fonts.check("54px Literata"));
    assert.ok(await page.evaluate(() => document.fonts.check("54px Literata")));
    passed("bundled font loaded");
    const sizes = [];
    for (let size = 0; size < 3; size++) {
      await page.locator(`[data-size="${size}"]`).click();
      const metrics = await page.evaluate(async (size) => {
        const { layout } = await import("./core.js");
        const ctx = document.querySelector("#page").getContext("2d");
        const pages = layout(ctx, size);
        return {
          count: pages.length,
          maxY: Math.max(...pages.flat().map((x) => x.y)),
          maxWidth: Math.max(
            ...pages.flat().map((x) => {
              ctx.font = `${x.font}px ${x.kind === "meta" ? "Arial" : "Literata"}`;
              return ctx.measureText(x.text).width;
            }),
          ),
          poemLines: pages.flat().filter((x) => x.kind === "line").length,
        };
      }, size);
      assert.ok(metrics.count >= 2);
      assert.ok(metrics.maxY < 2120);
      assert.ok(metrics.maxWidth < 1700);
      sizes.push(metrics);
      await page
        .locator("#page")
        .screenshot({ path: path.join(out, `paper-size-${size}.png`) });
    }
    passed("all three sizes paginate within margins");
    await page.locator("#night").click();
    await page
      .locator("#page")
      .screenshot({ path: path.join(out, "night-large.png") });
    assert.equal(
      await page.locator("#night").getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#next").click();
    assert.match(await page.locator("#place").textContent(), /Page 2/);
    passed("night and next buttons work");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(out, "mobile.png"),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    passed("mobile viewport has no horizontal overflow");
    assert.deepEqual(errors, []);
    passed("desktop has no uncaught browser errors");
    await page.close();
    for (const [scenario, lying] of [
      ["layer", false],
      ["layer", true],
      ["clamped-layer", false],
      ["stereo-layer", false],
      ["no-layer", false],
      ["no-layers-feature", false],
      ["no-layer-unreported", false],
      ["no-layers-feature-unreported", false],
      ["draw-failure", false],
      ["source-gl-error", false],
      ["quad-gl-error", false],
      ["projection-gl-error", false],
      ["opaque", false],
      ["deny", false],
    ]) {
      const p = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
      });
      const es = [];
      p.on("pageerror", (e) => es.push(e.message));
      await mock(p, scenario, lying);
      await p.goto("http://127.0.0.1:18140");
      await p.locator("#enter:not([disabled])").waitFor();
      await p.locator("#enter").click();
      await p.evaluate(() => __step());
      if (["layer", "clamped-layer", "stereo-layer"].includes(scenario)) {
        assert.match(
          await p.locator("#status").textContent(),
          /Compositor layer drawn/,
        );
        const before = await p.evaluate(() => __mock.placed[0]);
        await p.evaluate(() => __step());
        assert.equal(await p.evaluate(() => __mock.placed.length), 1);
        assert.equal(await p.evaluate(() => __mock.uploads), 1);
        assert.equal(await p.evaluate(() => __mock.projectionDraws), 0);
        const differences = await p.evaluate(() => {
          const m = __mock,
            source = document.querySelector("#page"),
            expected = document.createElement("canvas");
          expected.width = m.quadWidth;
          expected.height = m.quadHeight;
          expected
            .getContext("2d")
            .drawImage(source, 0, 0, expected.width, expected.height);
          const bytes = expected
            .getContext("2d")
            .getImageData(0, 0, expected.width, expected.height).data;
          let differences = 0;
          for (let y = 0; y < expected.height; y += 61)
            for (let x = 0; x < expected.width; x += 59) {
              const i = (y * expected.width + x) * 4;
              for (let c = 0; c < 4; c++)
                if (bytes[i + c] !== m.latestPixels[i + c]) differences++;
            }
          return differences;
        });
        assert.equal(differences, 0);
        await p.locator("#xr-preview").screenshot({
          path: path.join(
            out,
            `quad-buffer-${scenario}-${lying ? "lying" : "front"}.png`,
          ),
        });
        passed(
          "A uploads pixels directly with correct orientation and skips unchanged uploads: " +
            scenario +
            (lying ? " lying" : ""),
        );
        if (lying) {
          assert.ok(Math.abs(before[13] - 1.8) < 1e-5);
          assert.ok(Math.abs(before[14]) < 1e-5);
        } else assert.ok(Math.abs(before[14] + 1.1) < 1e-5);
        passed("world placement stays fixed" + (lying ? " lying down" : ""));
        await p.locator("#compare").click();
        await p.evaluate(() => {
          __step();
          document.querySelector("#xr").hidden = false;
        });
        await p.locator("#xr-preview").screenshot({
          path: path.join(
            out,
            lying
              ? "simulated-lying-texture.png"
              : "simulated-front-texture.png",
          ),
        });
        assert.match(
          await p.locator("#mode-label").textContent(),
          /ordinary texture/,
        );
        if (scenario === "stereo-layer") {
          assert.equal(await p.evaluate(() => __mock.projectionDraws), 2);
          const inkPerEye = await p.evaluate(() =>
            [0, 600].map((start) => {
              let count = 0;
              for (let y = 100; y < 900; y += 2)
                for (let x = start; x < start + 600; x += 2) {
                  const i = (y * 1200 + x) * 4;
                  if (
                    __mock.latestPixels[i] < 200 &&
                    __mock.latestPixels[i + 3] > 200
                  )
                    count++;
                }
              return count;
            }),
          );
          await p.locator("#xr-preview").screenshot({
            path: path.join(out, "simulated-stereo-texture.png"),
          });
          assert.ok(inkPerEye.every((count) => count > 10));
          passed(
            "both eye atlas viewports contain text and real depth attachments are detached",
          );
        }
        await p.evaluate(() => {
          __mock.offsetX = 0.25;
          __step();
        });
        await p.locator("#xr-preview").screenshot({
          path: path.join(
            out,
            lying ? "simulated-lying-side.png" : "simulated-side-texture.png",
          ),
        });
        await p.evaluate(() => {
          __mock.offsetX = 0;
          __step();
        });
        await p.locator("#compare").click();
        await p.evaluate(() => __step());
        passed("A/B paths draw with real WebGL" + (lying ? " lying down" : ""));
        await p.locator("#recenter").click();
        await p.evaluate(() => __step());
        assert.equal(await p.evaluate(() => __mock.placed.length), 2);
        passed("re-centre applies only on request");
        if (!lying) {
          await p.evaluate(() => __hold());
          assert.match(await p.locator("#menu").textContent(), /Close/);
          assert.match(await p.locator("#place").textContent(), /Page 1/);
          await p.evaluate(() => {
            __hand(0.05);
            __step();
          });
          await p.evaluate(() => __aim("compare"));
          await p.evaluate(() => __pinch());
          await p.evaluate(() => __step());
          assert.match(
            await p.locator("#mode-label").textContent(),
            /ordinary texture/,
          );
          await p.evaluate(() => __pinch());
          await p.evaluate(() => __step());
          assert.match(
            await p.locator("#mode-label").textContent(),
            /compositor layer/,
          );
          assert.doesNotMatch(
            await p.locator("#status").textContent(),
            /stopped/,
          );
          passed(
            "release selects A to B to A only inside the menu, with pending frame changes",
          );
          await p.evaluate(() => {
            __mock.look = null;
            __hold();
            __hand(0.05);
            __step();
          });
          await p.evaluate(() => {
            __mock.session.inputSources = [];
            __step();
            __hand(0.05);
            __step();
            __hand(0.015);
            __step();
            __mock.poseLost = true;
            __step();
            __mock.poseLost = false;
            __step(240);
            __hand(0.05);
            __step();
          });
          assert.match(await p.locator("#place").textContent(), /Page 1/);
          passed(
            "viewer pose loss cancels a pending pinch without turning on release",
          );
          await p.locator("#compare").click();
          await p.evaluate(() => __step());
          await p.locator("#night").click();
          await p.evaluate(() => __step());
          const uploads = await p.evaluate(() => __mock.uploads);
          await p.locator("#compare").click();
          await p.evaluate(() => __step());
          assert.ok(await p.evaluate((n) => __mock.uploads > n, uploads));
          assert.deepEqual(
            await p.evaluate(() => Array.from(__mock.latestPixels.slice(0, 3))),
            [26, 33, 30],
          );
          await p.locator("#night").click();
          await p.evaluate(() => __step());
          passed("A refreshes after paper style changes in B");
        }
        await p.evaluate(() => {
          __mock.look = null;
          __hand(0.05);
          __step(520);
          __hand(0.012);
          __step();
        });
        assert.match(await p.locator("#place").textContent(), /Page 1/);
        await p.evaluate(() => __step(240));
        assert.match(await p.locator("#place").textContent(), /Page 1/);
        await p.evaluate(() => {
          __hand(0.05);
          __step(140);
        });
        assert.match(await p.locator("#place").textContent(), /Page 2/);
        await p.evaluate(() => __step());
        assert.match(await p.locator("#place").textContent(), /Page 2/);
        await p.evaluate(() => __pinch("left"));
        assert.match(await p.locator("#place").textContent(), /Page 1/);
        passed(
          "resting right/left pinches turn only on release and never by head target",
        );
        const downloadWait = p.waitForEvent("download");
        await p.locator("#export").click();
        const dl = await downloadWait;
        await dl.saveAs(
          path.join(
            out,
            lying
              ? "mock-lying-diagnostics.json"
              : "mock-front-diagnostics.json",
          ),
        );
        passed("diagnostics export downloads");
      } else if (scenario.startsWith("no-layer")) {
        assert.match(
          await p.locator("#status").textContent(),
          /Layer unavailable/,
        );
        assert.match(
          await p.locator("#mode-label").textContent(),
          /ordinary texture/,
        );
        await p.locator("#compare").click();
        assert.match(
          await p.locator("#status").textContent(),
          /comparison is blocked/,
        );
        passed("unsupported layer is honestly labelled and cannot enter A");
      } else if (scenario.endsWith("gl-error")) {
        if (
          scenario === "projection-gl-error" ||
          scenario === "source-gl-error"
        ) {
          await p.locator("#compare").click();
          await p.evaluate(() => __step());
        }
        const stage =
          scenario === "source-gl-error"
            ? "comparison source upload"
            : scenario === "quad-gl-error"
              ? "quad page upload"
              : "comparison projection draw";
        assert.ok((await p.locator("#status").textContent()).includes(stage));
        const download = p.waitForEvent("download");
        await p.locator("#export").click();
        const dl = await download;
        const file = path.join(out, scenario + ".json");
        await dl.saveAs(file);
        const details = JSON.parse(await fs.readFile(file, "utf8"));
        assert.equal(details.build, "gestures-005");
        assert.equal(details.graphicsError.stage, stage);
        assert.deepEqual(details.graphicsError.codes, [
          scenario === "source-gl-error"
            ? 1281
            : scenario === "quad-gl-error"
              ? 1282
              : 1286,
        ]);
        passed("injected GL error is named and exported: " + stage);
      } else if (scenario === "draw-failure") {
        assert.match(await p.locator("#status").textContent(), /test stopped/);
        passed("draw failure ends XR and reports reason");
      } else if (scenario === "opaque") {
        assert.match(
          await p.locator("#status").textContent(),
          /does not provide passthrough/,
        );
        passed("opaque XR is rejected");
      } else {
        assert.match(
          await p.locator("#status").textContent(),
          /permission denial/,
        );
        assert.equal(await p.locator("#enter").isEnabled(), true);
        passed("permission denial permits retry");
      }
      assert.deepEqual(es, []);
      if (scenario === "layer" || scenario.startsWith("no-layer")) {
        const keys = await p.evaluate(() => __mock.renderUpdates);
        assert.ok(keys.length > 0);
        assert.ok(
          keys.every(
            (k) =>
              k.length === 1 &&
              k[0] ===
                (scenario.startsWith("no-layers-feature")
                  ? "baseLayer"
                  : "layers"),
          ),
        );
        passed(
          "exclusive negotiated render-state route: " +
            scenario +
            (lying ? " lying" : ""),
        );
      }
      await p.close();
    }
    for (const lying of [false, true]) {
      const p = await browser.newPage({
          viewport: { width: 1440, height: 1100 },
        }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await mock(p, "layer", lying, {});
      await p.goto("http://127.0.0.1:18140");
      await p.locator("#enter:not([disabled])").waitFor();
      await p.locator("#enter").click();
      await p.evaluate(() => __step());
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "practice",
      );
      await p.locator("#xr-preview").screenshot({
        path: path.join(
          out,
          lying ? "practice-lying.png" : "practice-front.png",
        ),
      });
      await p.evaluate(() => {
        __pinch("right");
        __pinch("left");
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      await p.evaluate(() => __hold());
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu");
      assert.equal(
        await p.evaluate(
          () => JSON.parse(localStorage.getItem("cabin-controls")).practised,
        ),
        true,
      );
      await p.evaluate(() => {
        __hand(0.05);
        __step();
      });
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu");
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      passed(
        "first-use practice recognises Next / Back / Menu, without changing pages or selecting on hold release" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => __aim("exit", "left"));
      await p.evaluate(() => __aim("resume", "right"));
      await p.evaluate(() => {
        const l = __hand(0.05, "left"),
          r = __hand(0.05, "right");
        __mock.session.inputSources = [l, r];
        __step(520);
        r.hand.get("thumb-tip").pose.x =
          r.hand.get("index-finger-tip").pose.x + 0.012;
        __step();
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-target"),
        "resume",
      );
      await p.evaluate(() => {
        __step(240);
        __mock.sources.right.hand.get("thumb-tip").pose.x =
          __mock.sources.right.hand.get("index-finger-tip").pose.x + 0.05;
        __step(240);
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      assert.equal(await p.locator("#enter").isEnabled(), false);
      await p.evaluate(() => {
        __mock.rayByHand = {};
        __hold();
        __hand(0.05);
        __step();
      });
      passed(
        "the pinching owner controls highlight and selection even when the idle hand points at Exit" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __mock.rayLook = { x: 0, y: 1, z: 0, w: 0 };
        __pinch();
      });
      assert.equal(
        await p.locator("#night").getAttribute("aria-pressed"),
        "false",
      );
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu");
      await p.evaluate(() => __aim("night", true));
      await p.locator("#xr-preview").screenshot({
        path: path.join(
          out,
          lying ? "menu-lying-pointed.png" : "menu-front-pointed.png",
        ),
      });
      await p.locator("#compare").click();
      await p.evaluate(() => __step());
      await p.locator("#xr-preview").screenshot({
        path: path.join(
          out,
          lying ? "menu-world-lying.png" : "menu-world-front.png",
        ),
      });
      await p.evaluate(() => {
        __mock.offsetX = 0.25;
        __step();
      });
      await p.locator("#xr-preview").screenshot({
        path: path.join(
          out,
          lying ? "menu-world-lying-side.png" : "menu-world-side.png",
        ),
      });
      await p.evaluate(() => {
        __mock.offsetX = 0;
        __step();
      });
      await p.locator("#compare").click();
      await p.evaluate(() => __step());
      await p.evaluate(() => __pinch());
      assert.equal(
        await p.locator("#night").getAttribute("aria-pressed"),
        "true",
      );
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      passed(
        "menu uses the hand ray; an un-targeted pinch never follows head direction or turns a page" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hold("left");
        __hand(0.05, "left");
        __step();
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      const readingPose = await p.evaluate(() => __mock.placed.at(-1));
      await p.evaluate(() => {
        __mock.offsetX = 0.45;
        __hold();
        __hand(0.05);
        __step();
      });
      const menuPose = await p.evaluate(() => __mock.placed.at(-1));
      assert.notDeepEqual(menuPose, readingPose);
      await p.evaluate(() => {
        __mock.offsetX = 0.6;
        __step();
      });
      assert.deepEqual(await p.evaluate(() => __mock.placed.at(-1)), menuPose);
      await p.evaluate(() => {
        __hold("left");
        __hand(0.05, "left");
        __step();
      });
      assert.deepEqual(
        await p.evaluate(() => __mock.placed.at(-1)),
        readingPose,
      );
      passed(
        "menu is summoned into current view, stays still, and restores the original reading placement" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hold();
        __hand(0.05);
        __step();
      });
      await p.evaluate(() => __aim("swap", true));
      await p.evaluate(() => __pinch());
      await p.evaluate(() => {
        __hold("left");
        __hand(0.05, "left");
        __step();
        __pinch("left");
      });
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      await p.evaluate(() => __pinch("right"));
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      assert.equal(
        await p.evaluate(
          () => JSON.parse(localStorage.getItem("cabin-controls")).swapped,
        ),
        true,
      );
      passed(
        "swapping hands changes both reading directions and saves the preference" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hold();
        __hand(0.05);
        __step();
      });
      await p.evaluate(() => __aim("recenter", true));
      await p.evaluate(() => {
        __pinch();
        __step();
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      assert.notDeepEqual(
        await p.evaluate(() => __mock.placed.at(-1)),
        readingPose,
      );
      passed(
        "only explicit Re-centre moves the reading page to the current view" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hold();
        __hand(0.05);
        __step();
      });
      await p.evaluate(() => __aim("exit", true));
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#enter").isEnabled(), true);
      assert.deepEqual(errors, []);
      passed(
        "menu Exit safely ends the active XR callback" +
          (lying ? " lying" : ""),
      );
      await p.locator("#enter").click();
      await p.evaluate(() => __step());
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      assert.deepEqual(errors, []);
      passed(
        "completed practice is remembered on XR re-entry" +
          (lying ? " lying" : ""),
      );
      await p.close();
    }
    {
      const p = await browser.newPage();
      await mock(p, "limited-layers");
      await p.goto("http://127.0.0.1:18140");
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => {
        __step();
        __hand(0.05);
        __step(520);
      });
      assert.equal(await p.locator("#enter").isEnabled(), false);
      assert.match(
        await p.locator("#status").textContent(),
        /Hand feedback unavailable/,
      );
      assert.equal(
        await p.evaluate(() => __mock.session.renderState.layers.length),
        1,
      );
      await p.evaluate(() => __pinch());
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      passed(
        "limited compositor budget disables optional hand badges and preserves reader and gestures",
      );
      await p.close();
    }
    for (const lying of [false, true]) {
      const p = await browser.newPage();
      await mock(p, "layer", lying);
      await p.goto("http://127.0.0.1:18140");
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => {
        __step();
        const l = __hand(0.05, "left"),
          r = __hand(0.05, "right");
        __mock.session.inputSources = [l, r];
        __step(520);
        window.badgeSnapshot = () => {
          const gl = __mock.gl,
            entries = [...__mock.layerData].filter(
              ([layer, d]) => d.badge && layer.opacity > 0,
            );
          const canvas = document.createElement("canvas");
          canvas.width = 560;
          canvas.height = 290;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#d2d7cf";
          ctx.fillRect(0, 0, 560, 290);
          const counts = [],
            poses = [];
          for (const [i, [layer, d]] of entries.entries()) {
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(
              gl.FRAMEBUFFER,
              gl.COLOR_ATTACHMENT0,
              gl.TEXTURE_2D,
              d.tex,
              0,
            );
            const pixels = new Uint8Array(256 * 256 * 4);
            gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(fb);
            let gold = 0;
            for (let k = 0; k < pixels.length; k += 4)
              if (
                pixels[k] > 180 &&
                pixels[k + 1] > 140 &&
                pixels[k + 2] < 220 &&
                Math.hypot(
                  ((k / 4) % 256) - 128,
                  Math.floor(k / 4 / 256) - 128,
                ) > 90
              )
                gold++;
            counts.push(gold);
            poses.push(d.matrix.slice(12, 15));
            if (pixels[3] !== 0)
              throw Error("Badge corners must be transparent");
            const c = document.createElement("canvas");
            c.width = c.height = 256;
            c.getContext("2d").putImageData(
              new ImageData(new Uint8ClampedArray(pixels), 256, 256),
              0,
              0,
            );
            ctx.save();
            ctx.translate(12 + i * 280, 268);
            ctx.scale(1, -1);
            ctx.drawImage(c, 0, 0);
            ctx.restore();
          }
          return {
            counts,
            poses,
            image: canvas.toDataURL(),
            pageVersion: __mock.versions.get(__mock.texture),
            layers: __mock.session.renderState.layers.length,
          };
        };
      });
      const idle = await p.evaluate(() => badgeSnapshot());
      assert.equal(idle.layers, 3);
      assert.equal(idle.counts.length, 2);
      assert.ok(idle.counts.every((n) => n < 20));
      await fs.writeFile(
        path.join(out, `hands-${lying ? "lying" : "front"}-idle.png`),
        Buffer.from(idle.image.split(",")[1], "base64"),
      );
      await p.evaluate(() => {
        __mock.sources.right.hand.get("thumb-tip").pose.x =
          __mock.sources.right.hand.get("index-finger-tip").pose.x + 0.012;
        __step(720);
      });
      const half = await p.evaluate(() => badgeSnapshot());
      assert.ok(half.counts[1] > 2000);
      assert.ok(half.counts[0] < 20);
      assert.equal(half.pageVersion, idle.pageVersion);
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      await fs.writeFile(
        path.join(out, `hands-${lying ? "lying" : "front"}-half.png`),
        Buffer.from(half.image.split(",")[1], "base64"),
      );
      await p.evaluate(() => __step(560));
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      const late = await p.evaluate(() => badgeSnapshot());
      assert.ok(late.counts[1] > half.counts[1] * 1.4);
      await p.evaluate(() => __step(200));
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu");
      const full = await p.evaluate(() => badgeSnapshot());
      assert.ok(full.counts[1] > late.counts[1]);
      await fs.writeFile(
        path.join(out, `hands-${lying ? "lying" : "front"}-full.png`),
        Buffer.from(full.image.split(",")[1], "base64"),
      );
      await p.evaluate(() => {
        __mock.session.inputSources = [];
        __step(80);
      });
      assert.equal(
        await p.evaluate(() => __mock.session.renderState.layers.length),
        1,
      );
      passed(
        "two native hand badges animate only the owning ring, preserve page pixels, wait 1.4 seconds, and hide on tracking loss" +
          (lying ? " lying" : ""),
      );
      await p.close();
    }
    await fs.writeFile(
      path.join(out, "ui-results.json"),
      JSON.stringify(
        {
          checks,
          sizes,
          allPassed: true,
          evidence:
            "Desktop Chromium with synthetic XR API; real WebGL, no Quest hardware",
        },
        null,
        2,
      ),
    );
    console.log(`${checks} PC browser checks passed.`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
