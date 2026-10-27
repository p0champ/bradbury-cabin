const { chromium } = require(process.env.CABIN_PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const out = path.resolve(process.env.CABIN_EVIDENCE_DIR || "evidence");
async function mock(page, scenario = "layer", lying = false) {
  await page.addInitScript(
    ({ scenario, lying }) => {
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
      window.__step = () => {
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
          getPose: () => ({ transform: head() }),
        };
        const cb = callback;
        callback = null;
        if (cb) {
          window.__mock.inFrame = true;
          cb(performance.now(), frame);
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
          if (!session.ended && tex) {
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
            preview.getContext("2d").drawImage(staging, 0, 0, 1200, 1000);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(fbo);
          }
        }
      };
      window.__hand = (distance) => {
        const jointA = {
            pose: distance == null ? null : { x: 0, y: 0.4, z: -0.3 },
          },
          jointB = {
            pose: distance == null ? null : { x: distance, y: 0.4, z: -0.3 },
          };
        const source = {
          hand: new Map([
            ["index-finger-tip", jointA],
            ["thumb-tip", jointB],
          ]),
        };
        session.inputSources = [source];
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
        createQuadLayer() {
          if (scenario.startsWith("no-layer"))
            throw Error("Deliberate unsupported layer fixture");
          const width = scenario === "clamped-layer" ? 1024 : 2048,
            height = scenario === "clamped-layer" ? 1280 : 2560;
          const tex = colorTexture(width, height);
          window.__mock.quadWidth = width;
          window.__mock.quadHeight = height;
          window.__mock.texture = tex;
          const layer = {
            set transform(v) {
              window.__mock.placed.push(Array.from(v.matrix));
            },
            destroy() {
              gl.deleteTexture(tex);
            },
          };
          window.__mock.quad = layer;
          return layer;
        }
        getSubImage() {
          if (scenario === "draw-failure")
            throw Error("Deliberate layer draw failure");
          if (!session.renderState.layers?.includes(window.__mock.quad))
            throw Error("getSubImage used before active layers changed");
          window.__mock.draws++;
          return {
            colorTexture: window.__mock.texture,
            viewport: {
              x: 0,
              y: 0,
              width: window.__mock.quadWidth,
              height: window.__mock.quadHeight,
            },
          };
        }
      };
      Object.defineProperty(navigator, "xr", {
        value: {
          isSessionSupported: async () => true,
          requestSession: async () => {
            if (scenario === "deny")
              throw Error("Deliberate permission denial");
            return session;
          },
        },
      });
    },
    { scenario, lying },
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
          await p
            .locator("#xr-preview")
            .screenshot({
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
          await p.evaluate(() => {
            __mock.look = {
              x: -0.15,
              y: -0.035,
              z: 0,
              w: Math.sqrt(1 - 0.15 ** 2 - 0.035 ** 2),
            };
            __hand(0.05);
            __step();
            __mock.session.inputSources[0].hand.get("thumb-tip").pose.x = 0.015;
            __step();
          });
          assert.match(
            await p.locator("#mode-label").textContent(),
            /ordinary texture/,
          );
          await p.evaluate(() => __step());
          await p.waitForTimeout(480);
          await p.evaluate(() => {
            __mock.session.inputSources[0].hand.get("thumb-tip").pose.x = 0.05;
            __step();
            __mock.session.inputSources[0].hand.get("thumb-tip").pose.x = 0.015;
            __step();
            __step();
          });
          assert.match(
            await p.locator("#mode-label").textContent(),
            /compositor layer/,
          );
          assert.doesNotMatch(
            await p.locator("#status").textContent(),
            /stopped/,
          );
          passed(
            "gaze + hand A to B to A respects next-frame render-state changes",
          );
          await p.waitForTimeout(480);
          await p.evaluate(() => {
            __mock.look = null;
            __mock.session.inputSources = [];
            __step();
            __hand(0.05);
            __step();
            __mock.poseLost = true;
            __step();
            __mock.session.inputSources[0].hand.get("thumb-tip").pose.x = 0.015;
            __mock.poseLost = false;
            __step();
          });
          assert.match(await p.locator("#place").textContent(), /Page 1/);
          passed("viewer pose loss disarms a previously open hand");
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
          __hand(0.05);
          __step();
        });
        await p.evaluate(() => {
          __mock.session.inputSources[0].hand.get("thumb-tip").pose.x = 0.015;
          __step();
        });
        assert.match(await p.locator("#place").textContent(), /Page 2/);
        await p.evaluate(() => __step());
        assert.match(await p.locator("#place").textContent(), /Page 2/);
        passed("hand away from page turns once and hold does not repeat");
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
        assert.equal(details.build, "phase0-003");
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
