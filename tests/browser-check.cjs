const volumeChecks = require("./volume-browser.cjs");
const guideChecks = require("./study-guide-browser.cjs");
const { chromium } = require(process.env.CABIN_PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const BASE_URL = process.env.CABIN_BASE_URL || "http://127.0.0.1:18140";
const out = path.resolve(process.env.CABIN_EVIDENCE_DIR || "evidence");
async function mock(
  page,
  scenario = "layer",
  lying = false,
  preferences = { practised: true, headPointer: true },
) {
  await page.addInitScript(
    ({ scenario, lying, preferences }) => {
      if (!sessionStorage.getItem("mock-preferences")) {
        localStorage.setItem(
          "cabin-controls",
          JSON.stringify({
            handMapRevision: 9,
            swapped: false,
            ...preferences,
          }),
        );
        sessionStorage.setItem("mock-preferences", "set");
      }
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
      session.visibilityState = "visible";
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
                  emulatedPosition: !!window.__mock.emulatedViewer,
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
            joint?.pose
              ? {
                  transform: new Transform(joint.pose),
                  emulatedPosition: !!joint.emulated,
                }
              : null,
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
      window.__headMatrix = () => head().matrix;
      window.__hand = (distance, handedness = "right") => {
        window.__mock.sources ||= {};
        let source = window.__mock.sources[handedness];
        if (!source) {
          const joints = new Map([
            ["index-finger-tip", {}],
            ["thumb-tip", {}],
          ]);
          source = {
            handedness,
            gamepad: { buttons: [{ pressed: false }] },
            targetRaySpace: { handedness },
            testJoints: joints,
            // XRHand is an iterable with get(); it is NOT a JavaScript Map.
            hand: Object.freeze({
              get: (key) => joints.get(key),
              values: () => joints.values(),
              keys: () => joints.keys(),
              entries: () => joints.entries(),
              get size() {
                return joints.size;
              },
              [Symbol.iterator]: () => joints[Symbol.iterator](),
            }),
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
        source.gamepad.buttons[0].pressed =
          distance != null && distance < 0.026;
        session.inputSources = [source];
        return source;
      };
      window.__pinch = (hand = "right", duration = 240) => {
        __hand(0.05, hand);
        __step(600);
        __hand(0.012, hand);
        __native("selectstart", hand);
        __step(duration);
        __hand(0.05, hand);
        __native("select", hand);
        __native("selectend", hand);
        __step(16);
      };
      window.__hold = (hand = "right") => {
        __hand(0.05, hand);
        __step(600);
        __hand(0.012, hand);
        __native("selectstart", hand);
        __step(1480);
        __hand(0.05, hand);
        __native("select", hand);
        __native("selectend", hand);
        __step(16);
      };
      window.__native = (kind, hand = "right") => {
        const source = __mock.sources[hand];
        source.gamepad.buttons[0].pressed = kind === "selectstart";
        const e = new Event(kind);
        e.inputSource = source;
        e.frame = {
          getPose: () => ({
            transform: new Transform(
              head().position,
              __mock.rayByHand?.[hand] || __mock.rayLook || head().orientation,
            ),
          }),
          getViewerPose() {
            throw Error("Cannot query viewer in event frame");
          },
        };
        session.dispatchEvent(e);
      };
      window.__center = () => {
        if (session.ended) return;
        __mock.clock = Math.max(__mock.clock, performance.now());
        __step();
        __pinch();
        __step(1240);
        __step(1000);
      };
      window.__welcomeScene = () => {
        document.querySelector("#welcome-scene")?.remove();
        const scene = document.createElement("div");
        scene.id = "welcome-scene";
        scene.style.cssText =
          "position:relative;width:1200px;height:1000px;perspective:1000px;perspective-origin:50% 50%;overflow:hidden;background:radial-gradient(ellipse at center,#efebe1,#b9c0b5);transform-style:preserve-3d";
        document.body.append(scene);
        for (const layer of session.renderState.layers || []) {
          const d = __mock.layerData.get(layer);
          if (!d || d.badge || !d.matrix || layer.opacity === 0) continue;
          const fb = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            d.tex,
            0,
          );
          const px = new Uint8Array(d.width * d.height * 4);
          gl.readPixels(0, 0, d.width, d.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.deleteFramebuffer(fb);
          // Native uploads are premultiplied; Canvas ImageData is straight alpha.
          for (let i = 0; i < px.length; i += 4)
            if (px[i + 3] > 0 && px[i + 3] < 255)
              for (let c = 0; c < 3; c++)
                px[i + c] = Math.min(
                  255,
                  Math.round((px[i + c] * 255) / px[i + 3]),
                );
          const flipped = new Uint8ClampedArray(px.length);
          for (let y = 0; y < d.height; y++)
            flipped.set(
              px.subarray(y * d.width * 4, (y + 1) * d.width * 4),
              (d.height - 1 - y) * d.width * 4,
            );
          const c = document.createElement("canvas");
          c.width = d.width;
          c.height = d.height;
          c.getContext("2d").putImageData(
            new ImageData(flipped, d.width, d.height),
            0,
            0,
          );
          const m = Array.from(
            new DOMMatrix(head().inverse.matrix)
              .multiply(new DOMMatrix(d.matrix))
              .toFloat64Array(),
          );
          const css = [
            m[0],
            -m[1],
            m[2],
            0,
            -m[4],
            m[5],
            -m[6],
            0,
            m[8],
            -m[9],
            m[10],
            0,
            m[12] * 1000,
            -m[13] * 1000,
            m[14] * 1000 + 1000,
            1,
          ];
          c.style.cssText = `position:absolute;left:600px;top:500px;width:${d.metresWide * 1000}px;height:${d.metresHigh * 1000}px;margin-left:${-d.metresWide * 500}px;margin-top:${-d.metresHigh * 500}px;opacity:${layer.opacity};transform:matrix3d(${css.join(",")});backface-visibility:hidden`;
          scene.append(c);
        }
        const label = document.createElement("div");
        label.textContent =
          "SYNTHETIC NATIVE-LAYER PREVIEW · NOT QUEST FOOTAGE";
        label.style.cssText =
          "position:absolute;left:24px;bottom:18px;color:#52604f;font:12px Arial";
        scene.append(label);
      };
      window.__aim = async (id, rayOnly = false) => {
        // Native ray target used by the menu fixture.
        const { menuButtons } = await import("./gestures.js?v=28");
        // A rectangle may be passed directly (calendar cells are dynamic).
        const button =
          typeof id === "object" ? id : menuButtons.find((b) => b.id === id);
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
          const arrival = init.viewPixelWidth === 384;
          const watch = init.viewPixelWidth === 512 && init.viewPixelHeight === 448;
          const gazeRing = init.viewPixelWidth === 192;
          const width = gazeRing
              ? 192
              : watch
              ? 512
              : arrival
              ? 384
              : badge
                ? 256
                : scenario === "clamped-layer"
                  ? 1024
                  : 2048,
            height = gazeRing
              ? 192
              : watch
              ? 448
              : arrival
              ? 960
              : badge
                ? 256
                : scenario === "clamped-layer"
                  ? 1280
                  : 2560;
          const tex = colorTexture(width, height),
            data = {
              tex,
              width,
              height,
              badge,
              arrival,
              watch,
              gazeRing,
              metresWide: init.width,
              metresHigh: init.height,
              matrix: null,
              history: [],
            };
          const layer = {
            opacity: 1,
            set transform(v) {
              data.matrix = Array.from(v.matrix);
              data.history.push(data.matrix);
              if (!badge && !arrival && !watch && !gazeRing) window.__mock.placed.push(data.matrix);
            },
            destroy() {
              gl.deleteTexture(tex);
              data.destroyed = true;
            },
          };
          window.__mock.layerData.set(layer, data);
          if (!badge && !arrival && !watch && !gazeRing) {
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
          if (!data.badge && !data.arrival && scenario === "draw-failure")
            throw Error("Deliberate layer draw failure");
          if (!data.badge && !data.arrival) window.__mock.draws++;
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
    if (process.env.CABIN_VOLUME_ONLY) {
      await volumeChecks(browser, { mock, BASE_URL, out, passed });
      console.log(`${checks} volume browser checks passed.`);
      return;
    }
    if (process.env.CABIN_GUIDE_ONLY) {
      await guideChecks(browser, { mock, BASE_URL, out, passed });
      console.log(`${checks} guide browser checks passed.`);
      return;
    }
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
    await page.goto(BASE_URL);
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
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").waitFor();
      await p.locator("#enter").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => __step());
      if (["layer", "clamped-layer", "stereo-layer"].includes(scenario)) {
        if (scenario === "layer" && !lying) {
          assert.equal(
            await p.evaluate(() => typeof __mock.sources.right.hand.has),
            "undefined",
          );
          passed(
            "entry and hand frames work with the actual XRHand get/iterable interface and no Map methods",
          );
        }
        if (
          (await p.locator("#page").getAttribute("data-view")) === "centering"
        ) {
          const waiting = p.waitForEvent("download");
          await p.locator("#export").click();
          const download = await waiting;
          const file = path.join(out, "center-debug.json");
          await download.saveAs(file);
          console.log(await fs.readFile(file, "utf8"));
          throw Error("Center confirmation failed");
        }
        assert.match(
          await p.locator("#status").textContent(),
          /Compositor layer drawn/,
        );
        const before = await p.evaluate(() => __mock.placed.at(-1));
        const placedCount = await p.evaluate(() => __mock.placed.length),
          uploadCount = await p.evaluate(() => __mock.uploads);
        await p.evaluate(() => __step());
        assert.equal(await p.evaluate(() => __mock.placed.length), placedCount);
        assert.equal(await p.evaluate(() => __mock.uploads), uploadCount);
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
        assert.equal(
          await p.evaluate(() => __mock.placed.length),
          placedCount + 1,
        );
        passed("re-centre applies only on request");
        if (!lying) {
          await p.evaluate(() => __hold());
          assert.match(await p.locator("#menu").textContent(), /Close/);
          assert.match(await p.locator("#place").textContent(), /Page 1/);
          await p.evaluate(() => {
            __hand(0.05);
            __step();
          });
          // Build 012: the A/B sharpness test left the headset menu; it stays
          // on the PC page and uses the same pending-frame switch.
          await p.locator("#compare").click();
          await p.evaluate(() => __step());
          assert.match(
            await p.locator("#mode-label").textContent(),
            /ordinary texture/,
          );
          await p.locator("#compare").click();
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
            "A to B to A switching applies at the next frame while XR is running",
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
          __native("selectstart");
          __step();
        });
        assert.match(await p.locator("#place").textContent(), /Page 1/);
        await p.evaluate(() => __step(240));
        assert.match(await p.locator("#place").textContent(), /Page 1/);
        await p.evaluate(() => {
          __hand(0.05);
          __native("select");
          __native("selectend");
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
        assert.equal(details.build, "gestures-028");
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
    // Startup must not depend on reading-hand readiness: the user may click
    // immediately, with missing/inferred joints, or using a controller.
    for (const controller of [false, true]) {
      const p = await browser.newPage(),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await mock(p);
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate((controller) => {
        __mock.clock = Math.max(__mock.clock, performance.now());
        __hand(0.012);
        if (controller) delete __mock.sources.right.hand;
        else __mock.sources.right.testJoints.clear();
        __step();
        __native("selectstart");
        __native("selectend");
        __step();
      }, controller);
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "centering",
      );
      await p.evaluate(() => {
        __mock.session.visibilityState = "visible-blurred";
        __native("select");
        __mock.session.visibilityState = "visible";
        __step();
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "centering",
      );
      await p.evaluate(() => {
        __mock.emulatedViewer = true;
        __native("select");
        __step();
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "centering",
      );
      await p.evaluate(() => {
        __mock.emulatedViewer = false;
        // Native events are stamped with the real clock. Keep the mock frame
        // clock in step so the tested event age is exact on any machine.
        __mock.clock = Math.max(__mock.clock, performance.now());
        __native("select");
        __mock.clock += 1100;
        __step();
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "centering",
      );
      await p.evaluate(() => {
        __mock.emulatedViewer = false;
        __native("select");
        __native("selectend");
        __native("selectstart");
        __native("select");
        __native("selectend");
        __mock.clock += 200;
        __step();
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "arrival",
      );
      await p.evaluate(() => __step(1240));
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      const startupDownload = p.waitForEvent("download");
      await p.locator("#export").click();
      const startupFile = path.join(
        out,
        `startup-${controller ? "controller" : "hand"}.json`,
      );
      await (await startupDownload).saveAs(startupFile);
      const startupDetails = JSON.parse(await fs.readFile(startupFile, "utf8"));
      const confirmations = startupDetails.gestureLog.filter(
        (e) => e.result === "center",
      );
      assert.equal(confirmations.length, 1);
      assert.equal(confirmations[0].outcome, "centered");
      assert.equal(confirmations[0].hasHand, !controller);
      assert.ok(
        startupDetails.ignoredPinches.some(
          (e) => e.reason === "stale-or-removed-event",
        ),
      );
      assert.ok(
        !startupDetails.ignoredPinches.some((e) => e.result === "center"),
      );
      assert.deepEqual(errors, []);
      passed(
        "startup accepts one completed native click without joint/open readiness; consumes duplicates: " +
          (controller ? "controller" : "hand"),
      );
      await p.close();
    }
    for (const lying of [false, true]) {
      const p = await browser.newPage({
          viewport: { width: 1440, height: 1100 },
        }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await mock(p, "layer", lying, { practised: true, headPointer: false });
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => {
        __mock.clock = Math.max(__mock.clock, performance.now());
        __step();
        __hand(0.05);
        __step(600);
        __hand(0.012);
        __step(1800);
        __hand(0.05);
        __step(600);
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "centering",
      );
      await p.locator("#menu").click();
      await p.locator("#practice").click();
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "centering",
      );
      await p.locator("#xr-preview").screenshot({
        path: path.join(out, `centering-${lying ? "lying" : "front"}.png`),
      });
      await p.evaluate(() => __welcomeScene());
      await p.locator("#welcome-scene").screenshot({
        path: path.join(
          out,
          `welcome-${lying ? "lying" : "front"}-waiting.png`,
        ),
      });
      await p.evaluate(() => {
        __native("selectstart");
        __step(1600);
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "centering",
      );
      const intendedPose = await p.evaluate(() => __mock.placed.at(-1));
      await p.evaluate(() => {
        __native("select");
        __native("selectend");
        __step(40);
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "arrival",
      );
      const initialWings = await p.evaluate(() =>
        [...__mock.layerData.values()]
          .filter((d) => d.arrival)
          .map((d) => d.matrix),
      );
      const frozenPage = await p.evaluate(() => __mock.placed.at(-1));
      await p.evaluate(() => {
        __mock.session.visibilityState = "visible-blurred";
        __mock.session.dispatchEvent(new Event("visibilitychange"));
        __step(800);
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "arrival",
      );
      assert.deepEqual(
        await p.evaluate(() => __mock.placed.at(-1)),
        frozenPage,
      );
      await p.evaluate(() => {
        __mock.session.visibilityState = "visible";
        __mock.session.dispatchEvent(new Event("visibilitychange"));
        __step(40);
      });
      const beforeEmulated = await p.evaluate(() => __mock.placed.at(-1));
      await p.evaluate(() => {
        __mock.emulatedViewer = true;
        __step(800);
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "arrival",
      );
      assert.deepEqual(
        await p.evaluate(() => __mock.placed.at(-1)),
        beforeEmulated,
      );
      await p.evaluate(() => {
        __mock.emulatedViewer = false;
        __step(40);
      });
      await p.evaluate(() => {
        __native("selectstart");
        __native("select");
        __native("selectend");
        __step(360);
        __welcomeScene();
      });
      await p.locator("#welcome-scene").screenshot({
        path: path.join(
          out,
          `welcome-${lying ? "lying" : "front"}-opening.png`,
        ),
      });
      const mid = await p.evaluate(() => ({
        wings: [...__mock.layerData.values()]
          .filter((d) => d.arrival)
          .map((d) => d.matrix),
        version: __mock.versions.get(__mock.texture),
      }));
      assert.notDeepEqual(mid.wings, initialWings);
      assert.ok(
        mid.wings.every(
          (m, i) => Math.abs(m[12]) > Math.abs(initialWings[i][12]),
        ),
      );
      await p.evaluate(() => {
        __mock.offsetX = 0.12;
        __step(320);
        __welcomeScene();
      });
      assert.equal(
        await p.evaluate(() => __mock.versions.get(__mock.texture)),
        mid.version,
      );
      await p.locator("#welcome-scene").screenshot({
        path: path.join(
          out,
          `welcome-${lying ? "lying" : "front"}-settling-side.png`,
        ),
      });
      await p.evaluate(() => {
        __mock.offsetX = 0;
        __step(520);
        __welcomeScene();
      });
      await p.locator("#welcome-scene").screenshot({
        path: path.join(
          out,
          `welcome-${lying ? "lying" : "front"}-reading.png`,
        ),
      });
      assert.equal(
        await p.evaluate(
          () =>
            [...__mock.layerData].filter(([l, d]) => d.arrival && l.opacity > 0)
              .length,
        ),
        0,
      );
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      assert.deepEqual(
        await p.evaluate(() => __mock.placed.at(-1)),
        intendedPose,
      );
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      passed(
        "startup blocks distance-only gestures, menu and practice; a completed native confirmation centres once" +
          (lying ? " lying" : ""),
      );
      passed(
        "native 3D welcome opens in depth, ignores clicks during arrival, leaves page pixels fixed and clears decoration" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hand(0.05);
        __step(600);
        __native("selectstart");
        __step(80);
        __native("selectend");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      await p.evaluate(() => __pinch("right", 40));
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      await p.evaluate(() => __pinch("left", 40));
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      passed(
        "native quick clicks work once each; cancelled native endings do nothing" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        const l = __hand(0.05, "left"),
          r = __hand(0.05, "right");
        __mock.session.inputSources = [l, r];
        __step(600);
        // No wide geometric release, no 600ms padding between clicks.
        for (const s of [l, r])
          s.hand.get("thumb-tip").pose.x =
            s.hand.get("index-finger-tip").pose.x + 0.02;
        for (let i = 0; i < 10; i++) {
          const hand = i % 2 ? "left" : "right";
          __native("selectstart", hand);
          __step(40);
          __native("select", hand);
          __native("selectend", hand);
          __step(40);
        }
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      await p.evaluate(() => {
        for (const hand of ["right", "left", "right"]) {
          __native("selectstart", hand);
          __native("select", hand);
          __native("selectend", hand);
        }
        __step(16);
      });
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      await p.evaluate(() => __pinch("left"));
      passed(
        "ten rapid native clicks and three packed cycles each turn once without per-click reopening" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hand(0.05);
        __step(600);
        __hand(0.012);
        __native("selectstart");
        __step(500);
        __mock.look = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
        __step(1600);
      });
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      await p.evaluate(() => {
        __mock.look = null;
        __hand(0.012);
        __step(600);
        __native("select");
        __native("selectend");
        __step(40);
        __native("selectstart");
        __step(200);
        __native("select");
        __native("selectend");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      await p.evaluate(() => __pinch());
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      passed(
        "looking away cancels native holds and returning closed cannot resume; fresh open restores clicks" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __mock.session.visibilityState = "visible-blurred";
        __mock.session.dispatchEvent(new Event("visibilitychange"));
        __pinch("left");
        __mock.session.visibilityState = "visible";
        __mock.session.dispatchEvent(new Event("visibilitychange"));
        __hand(0.012, "left");
        __step(600);
        __native("selectstart", "left");
        __step(100);
        __native("select", "left");
        __native("selectend", "left");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      await p.evaluate(() => __pinch("left"));
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      passed(
        "blurred visibility stays gated and needs fresh open on return" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hand(0.05);
        __step(600);
        __native("selectstart");
        __step(80);
        // Native events are stamped with the real clock. Keep the mock frame
        // clock in step so the tested event age is exact on any machine.
        __mock.clock = Math.max(__mock.clock, performance.now());
        __native("select");
        __native("selectend");
        __mock.clock += 250;
        __step(16);
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      await p.evaluate(() => __pinch());
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      await p.evaluate(() => __pinch("left"));
      passed(
        "stale native releases cannot act or strand the next deliberate click" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hand(0.05);
        __step(600);
        __mock.sources.right.skipRendering = true;
        __native("selectstart");
        __step(1800);
        __native("select");
        __native("selectend");
        __step(40);
        __mock.sources.right.skipRendering = false;
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      await p.evaluate(() => {
        __hand(0.05);
        __step(600);
        for (const joint of __mock.sources.right.hand.values())
          joint.pose.x += 3;
        __native("selectstart");
        __step(200);
        __native("select");
        __native("selectend");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      passed(
        "reserved system hand and tracked hands outside view cannot act" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        __hand(0.05);
        __step(600);
        __native("selectstart");
        __step(100);
        __mock.session.inputSources = [];
        __step(40);
        __native("select");
        __native("selectend");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      await p.evaluate(() => __hold());
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu");
      await p.evaluate(() => __aim("night", true));
      await p.evaluate(() => __pinch());
      assert.equal(
        await p.locator("#night").getAttribute("aria-pressed"),
        "true",
      );
      await p.locator("#xr-preview").screenshot({
        path: path.join(out, `native-menu-${lying ? "lying" : "front"}.png`),
      });
      await p.locator("#compare").click();
      await p.evaluate(() => __step());
      await p.evaluate(() => {
        __mock.offsetX = 0.25;
        __step();
      });
      await p.locator("#xr-preview").screenshot({
        path: path.join(
          out,
          `native-menu-${lying ? "lying" : "front"}-side.png`,
        ),
      });
      await p.evaluate(() => {
        __mock.offsetX = 0;
        __step();
      });
      await p.locator("#compare").click();
      await p.evaluate(() => __step());
      passed(
        "removed input cannot complete; native hold opens a world-still menu and native click selects" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => __aim("night", true));
      await p.evaluate(() => {
        __hand(0.05);
        __step(600);
        __native("selectstart");
        __step(120);
      });
      await p.evaluate(() => __aim("exit", true));
      await p.evaluate(() => {
        __native("select");
        __native("selectend");
        __step(40);
      });
      assert.equal(await p.locator("#enter").isEnabled(), false);
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu");
      passed(
        "a held menu press cannot drift from Night onto Exit across frames" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => __aim("resume", true));
      await p.evaluate(() => __pinch());
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      await p.evaluate(() => {
        __hand(0.05);
        __step(600);
        const l = __hand(0.05, "left"),
          r = __hand(0.05, "right");
        __mock.session.inputSources = [l, r];
        __step(600);
        __native("selectstart", "right");
        __native("selectstart", "left");
        __step(60);
        __native("select", "left");
        __native("selectend", "left");
        __native("select", "right");
        __native("selectend", "right");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      passed(
        "simultaneous native hand presses have only one owner" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => __hold());
      await p.evaluate(() => __aim("exit", true));
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#enter").isEnabled(), true);
      assert.equal(
        await p.evaluate(() =>
          [...__mock.layerData.values()]
            .filter((d) => d.arrival)
            .every((d) => d.destroyed),
        ),
        true,
      );
      await p.locator("#enter").click();
      await p.evaluate(() => __step());
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "centering",
      );
      assert.deepEqual(errors, []);
      passed(
        "native menu Exit is safe and every new entry requires centering" +
          (lying ? " lying" : ""),
      );
      await p.close();
    }
    {
      const p = await browser.newPage();
      await mock(p, "limited-layers");
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
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
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => {
        __step();
        const l = __hand(0.05, "left"),
          r = __hand(0.05, "right");
        __mock.session.inputSources = [l, r];
        __step(1200);
        window.badgeSnapshot = () => {
          const gl = __mock.gl,
            entries = [...__mock.layerData]
              .filter(([layer, d]) => d.badge && layer.opacity > 0)
              .sort(([, a], [, b]) => a.matrix[12] - b.matrix[12]);
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
        __native("selectstart");
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
    // Build 006: what "registered" means must agree with what the page did.
    for (const lying of [false, true]) {
      const p = await browser.newPage({
          viewport: { width: 1440, height: 1100 },
        }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await mock(p, "layer", lying);
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => {
        __step();
        window.uploadedMatchesCanvas = () => {
          const m = __mock,
            expected = document.createElement("canvas");
          expected.width = m.quadWidth;
          expected.height = m.quadHeight;
          expected
            .getContext("2d")
            .drawImage(
              document.querySelector("#page"),
              0,
              0,
              expected.width,
              expected.height,
            );
          const bytes = expected
            .getContext("2d")
            .getImageData(0, 0, expected.width, expected.height).data;
          let differences = 0,
            sum = 0;
          for (let y = 0; y < expected.height; y += 37)
            for (let x = 0; x < expected.width; x += 41) {
              const i = (y * expected.width + x) * 4;
              sum =
                (sum * 31 + m.latestPixels[i] + 7 * m.latestPixels[i + 1]) %
                1000000007;
              for (let c = 0; c < 4; c++)
                if (bytes[i + c] !== m.latestPixels[i + c]) differences++;
            }
          return { differences, sum };
        };
      });
      const first = await p.evaluate(() => uploadedMatchesCanvas());
      assert.equal(first.differences, 0);
      await p.evaluate(() => {
        // Reads every visible badge texture: lit-arrow and orange end-bar pixels.
        window.badgeStates = () => {
          const gl = __mock.gl,
            states = [];
          for (const [layer, d] of __mock.layerData) {
            if (!d.badge || layer.opacity <= 0) continue;
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(
              gl.FRAMEBUFFER,
              gl.COLOR_ATTACHMENT0,
              gl.TEXTURE_2D,
              d.tex,
              0,
            );
            const px = new Uint8Array(256 * 256 * 4);
            gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(fb);
            let lit = 0,
              bar = 0;
            for (let y = 90; y < 166; y++)
              for (let x = 70; x < 186; x++) {
                const i = (y * 256 + x) * 4;
                if (px[i] > 240 && px[i + 1] > 225 && px[i + 2] > 190) lit++;
                if (
                  px[i] > 220 &&
                  px[i + 1] > 160 &&
                  px[i + 1] < 200 &&
                  px[i + 2] < 160
                )
                  bar++;
              }
            states.push({ lit, bar });
          }
          return states;
        };
      });
      await p.evaluate(() => __pinch("left"));
      assert.match(await p.locator("#place").textContent(), /Page 1 of 2/);
      const blockedBadge = await p.evaluate(() => badgeStates());
      assert.equal(blockedBadge.length, 1);
      assert.equal(
        blockedBadge[0].lit,
        0,
        "a blocked Back never lights the arrows",
      );
      assert.ok(blockedBadge[0].bar > 300, "a blocked Back shows the end bar");
      await p.evaluate(() => __pinch("right"));
      assert.match(await p.locator("#place").textContent(), /Page 2 of 2/);
      const turnBadge = await p.evaluate(() => badgeStates());
      assert.ok(
        turnBadge[0].lit > 300 && turnBadge[0].bar === 0,
        "a real turn flashes the arrows",
      );
      const turned = await p.evaluate(() => uploadedMatchesCanvas());
      assert.equal(turned.differences, 0, "displayed quad shows the new page");
      assert.notEqual(
        turned.sum,
        first.sum,
        "quad pixels changed with the page",
      );
      await p.evaluate(() => __pinch("right"));
      assert.match(await p.locator("#place").textContent(), /Page 2 of 2/);
      await p.evaluate(() => __pinch("left"));
      assert.match(await p.locator("#place").textContent(), /Page 1 of 2/);
      assert.equal(
        (await p.evaluate(() => uploadedMatchesCanvas())).differences,
        0,
      );
      const download = p.waitForEvent("download");
      await p.locator("#export").click();
      const file = path.join(
        out,
        `gesture-log-${lying ? "lying" : "front"}.json`,
      );
      await (await download).saveAs(file);
      const details = JSON.parse(await fs.readFile(file, "utf8"));
      const pages = details.gestureLog.filter((e) => e.result === "page");
      assert.deepEqual(
        pages.map((e) => [e.hand, e.outcome, e.page]),
        [
          ["left", "first-page", 1],
          ["right", "turned", 2],
          ["right", "last-page", 2],
          ["left", "turned", 1],
        ],
      );
      assert.ok(pages.every((e) => e.ms >= 160));
      assert.deepEqual(errors, []);
      passed(
        "page gestures report first/last-page boundaries honestly and every real turn re-uploads the displayed quad" +
          (lying ? " lying" : ""),
      );
      await p.close();
    }
    {
      const p = await browser.newPage();
      await mock(p, "layer", false, { headPointer: true });
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => __step());
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      await p.evaluate(() => __hold());
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu");
      await p.evaluate(() => __aim("more"));
      await p.evaluate(() => __pinch());
      await p.evaluate(() => __aim("practice"));
      await p.evaluate(() => __pinch());
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "practice",
      );
      await p.evaluate(() => __pinch("right"));
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "practice",
      );
      await p.evaluate(() => __pinch("left"));
      assert.equal(
        await p.locator("#page").getAttribute("data-view"),
        "reading",
      );
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      assert.equal(
        await p.evaluate(
          () => JSON.parse(localStorage.getItem("cabin-controls")).practised,
        ),
        true,
      );
      await p.evaluate(() => __pinch("right"));
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      passed(
        "practice completes in any order and hands straight back to reading",
      );
      const icons = await p.evaluate(async () => {
        const { paintHandBadge } = await import("./hand-badges.js?v=28");
        const bright = (opts) => {
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          paintHandBadge(c, opts);
          const d = c.getContext("2d").getImageData(70, 90, 50, 76).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4)
            if (d[i] > 240 && d[i + 1] > 225) n++;
          return n;
        };
        return {
          turn: bright({ ready: true, flash: true }),
          blocked: bright({ ready: true, blocked: true }),
          unavailable: bright({ ready: true, available: false }),
        };
      });
      assert.ok(icons.turn > 500, "turn flash lights the arrows");
      assert.equal(
        icons.blocked,
        0,
        "a blocked attempt never lights the arrows",
      );
      assert.equal(icons.unavailable, 0, "an unavailable direction is dimmed");
      passed(
        "hand icons distinguish a turn, a blocked end-of-text attempt and an unavailable direction",
      );
      await p.close();
    }
    for (const lying of [false, true]) {
      const p = await browser.newPage();
      await mock(p, "layer", lying, {
        practised: true,
        headPointer: false,
        handMapRevision: 8,
        swapped: false,
      });
      await p.goto(BASE_URL);
      assert.equal(
        await p.evaluate(
          () => JSON.parse(localStorage.getItem("cabin-controls")).swapped,
        ),
        true,
      );
      await p.reload();
      assert.equal(
        await p.evaluate(
          () => JSON.parse(localStorage.getItem("cabin-controls")).swapped,
        ),
        true,
      );
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => __pinch("left"));
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      await p.evaluate(() => __pinch("right"));
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      passed(
        "saved mapping flips once across reload and left NEXT/right BACK work" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        const source = __hand(0.05, "left"),
          p = source.hand.get("index-finger-tip").pose;
        source.testJoints.set("wrist", {
          pose: { x: p.x, y: p.y - 0.06, z: p.z },
        });
        source.testJoints.set("index-finger-metacarpal", {
          pose: { x: p.x, y: p.y - 0.02, z: p.z },
        });
        __step(600);
        __native("selectstart", "left");
        __step(80);
        source.hand.get("thumb-tip").emulated = true;
        __step(80);
        __native("select", "left");
        __native("selectend", "left");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 2/);
      await p.evaluate(() => {
        const source = __hand(0.05, "right"),
          p = source.hand.get("index-finger-tip").pose;
        source.testJoints.set("wrist", {
          pose: { x: p.x, y: p.y - 0.06, z: p.z },
        });
        source.testJoints.set("index-finger-metacarpal", {
          pose: { x: p.x, y: p.y - 0.02, z: p.z },
        });
        __step(600);
        __native("selectstart", "right");
        __step(80);
        source.hand.get("index-finger-tip").emulated = true;
        source.hand.get("thumb-tip").emulated = true;
        __step(80);
        __native("select", "right");
        __native("selectend", "right");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      passed(
        "native pinch survives one or both occluded tips when wrist tracking remains valid" +
          (lying ? " lying" : ""),
      );
      await p.evaluate(() => {
        const s = __mock.sources.right;
        __native("selectstart", "right");
        __step(80);
        for (const joint of s.hand.values()) joint.pose = null;
        __step(80);
        __native("select", "right");
        __native("selectend", "right");
        __step(40);
      });
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      const wait = p.waitForEvent("download");
      await p.locator("#export").click();
      const file = path.join(
        out,
        `physical-anchor-${lying ? "lying" : "front"}.json`,
      );
      await (await wait).saveAs(file);
      const details = JSON.parse(await fs.readFile(file, "utf8"));
      assert.equal(details.entryAudio.plays, 1);
      assert.equal(details.entryAudio.error, null);
      assert.ok(
        details.gestureLog.some(
          (e) =>
            e.result === "page" && e.anchorKind === "wrist" && !e.tipsTracked,
        ),
      );
      passed(
        "loss of physical palm cancels and diagnostics preserve native anchor and one entry chime" +
          (lying ? " lying" : ""),
      );
      await p.close();
    }
    for (const lying of [false, true]) {
      const p = await browser.newPage();
      await mock(p, "layer", lying, {
        handMapRevision: 8,
        swapped: false,
        practised: true,
      });
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => {
        __mock.clock = Math.max(__mock.clock, performance.now());
        __step();
        __pinch();
        __step(1240);
        const l = __hand(0.05, "left"),
          r = __hand(0.05, "right");
        __mock.session.inputSources = [l, r];
        __step(160);
        window.handWelcome = () => {
          const entries = [...__mock.layerData]
            .filter(([layer, d]) => d.badge && layer.opacity > 0)
            .sort(([, a], [, b]) => a.matrix[12] - b.matrix[12]);
          const c = document.createElement("canvas");
          c.width = 560;
          c.height = 290;
          const x = c.getContext("2d");
          x.fillStyle = "#e7e4d8";
          x.fillRect(0, 0, 560, 290);
          for (const [i, [layer, d]] of entries.entries()) {
            const g = __mock.gl,
              fb = g.createFramebuffer();
            g.bindFramebuffer(g.FRAMEBUFFER, fb);
            g.framebufferTexture2D(
              g.FRAMEBUFFER,
              g.COLOR_ATTACHMENT0,
              g.TEXTURE_2D,
              d.tex,
              0,
            );
            const px = new Uint8Array(256 * 256 * 4);
            g.readPixels(0, 0, 256, 256, g.RGBA, g.UNSIGNED_BYTE, px);
            g.bindFramebuffer(g.FRAMEBUFFER, null);
            g.deleteFramebuffer(fb);
            const image = document.createElement("canvas");
            image.width = image.height = 256;
            image
              .getContext("2d")
              .putImageData(
                new ImageData(new Uint8ClampedArray(px), 256, 256),
                0,
                0,
              );
            x.save();
            x.translate(12 + i * 280, 268);
            x.scale(1, -1);
            x.drawImage(image, 0, 0);
            x.restore();
          }
          return {
            image: c.toDataURL(),
            versions: entries.map(([, d]) => __mock.versions.get(d.tex)),
            matrices: entries.map(([, d]) => d.matrix),
            page: __mock.versions.get(__mock.texture),
            layers: __mock.session.renderState.layers.length,
          };
        };
      });
      const a = await p.evaluate(() => handWelcome());
      assert.equal(a.layers, 3);
      assert.equal(a.versions.length, 2);
      await fs.writeFile(
        path.join(out, `hand-entry-${lying ? "lying" : "front"}-start.png`),
        Buffer.from(a.image.split(",")[1], "base64"),
      );
      await p.evaluate(() => __step(300));
      const b = await p.evaluate(() => handWelcome());
      assert.ok(b.versions.every((v, i) => v > a.versions[i]));
      assert.notDeepEqual(b.matrices, a.matrices);
      assert.equal(b.page, a.page);
      await fs.writeFile(
        path.join(out, `hand-entry-${lying ? "lying" : "front"}-glow.png`),
        Buffer.from(b.image.split(",")[1], "base64"),
      );
      await p.evaluate(() => __step(1000));
      const c = await p.evaluate(() => handWelcome());
      await p.evaluate(() => __step(300));
      assert.deepEqual(
        (await p.evaluate(() => handWelcome())).versions,
        c.versions,
      );
      await fs.writeFile(
        path.join(out, `hand-entry-${lying ? "lying" : "front"}-settled.png`),
        Buffer.from(c.image.split(",")[1], "base64"),
      );
      await p.evaluate(() => {
        __mock.session.inputSources = [];
        __step(80);
        const l = __mock.sources.left,
          r = __mock.sources.right;
        __mock.session.inputSources = [l, r];
        __step(700);
      });
      assert.deepEqual(
        (await p.evaluate(() => handWelcome())).matrices,
        c.matrices,
      );
      passed(
        "labelled hand-entry orbit animates native textures and transforms once without repainting the page or exceeding three layers" +
          (lying ? " lying" : ""),
      );
      await p.close();
    }
    {
      const p = await browser.newPage();
      await mock(p, "layer");
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => {
        const l = __hand(0.05, "left"),
          r = __mock.sources.right;
        __mock.session.inputSources = [l, r];
        __step(160);
      });
      const a = await p.evaluate(() =>
        [...__mock.layerData.values()]
          .filter((d) => d.badge)
          .sort((a, b) => a.matrix[12] - b.matrix[12])
          .map((d) => d.matrix),
      );
      await p.evaluate(() => __step(300));
      const b = await p.evaluate(() =>
        [...__mock.layerData.values()]
          .filter((d) => d.badge)
          .sort((a, b) => a.matrix[12] - b.matrix[12])
          .map((d) => d.matrix),
      );
      assert.notDeepEqual(b[0], a[0]);
      assert.deepEqual(b[1], a[1]);
      await p.evaluate(() => __step(1200));
      const settled = await p.evaluate(() =>
        [...__mock.layerData.values()]
          .filter((d) => d.badge)
          .sort((a, b) => a.matrix[12] - b.matrix[12])
          .map((d) => d.matrix),
      );
      await p.evaluate(() => {
        __mock.session.inputSources = [];
        __step(80);
        __mock.session.inputSources = [
          __mock.sources.left,
          __mock.sources.right,
        ];
        __step(180);
      });
      assert.deepEqual(
        await p.evaluate(() =>
          [...__mock.layerData.values()]
            .filter((d) => d.badge)
            .sort((a, b) => a.matrix[12] - b.matrix[12])
            .map((d) => d.matrix),
        ),
        settled,
      );
      passed(
        "a late-visible second hand gets its welcome once, and reacquiring hands does not replay it",
      );
      await p.close();
    }
    {
      const p = await browser.newPage();
      await mock(p, "layer", false, { practised: true, entrySound: false });
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      const wait = p.waitForEvent("download");
      await p.locator("#export").click();
      const file = path.join(out, "muted-entry.json");
      await (await wait).saveAs(file);
      assert.equal(
        JSON.parse(await fs.readFile(file, "utf8")).entryAudio.plays,
        0,
      );
      const sound = await p.evaluate(async () => {
        const { scheduleEntryChime } = await import("./entry-sound.js?v=28");
        const c = new OfflineAudioContext(1, 96000, 48000);
        scheduleEntryChime(c, c.destination, 0);
        const result = await c.startRendering();
        const samples = result.getChannelData(0);
        let peak = 0,
          power = 0,
          tail = 0;
        for (let i = 0; i < samples.length; i++) {
          peak = Math.max(peak, Math.abs(samples[i]));
          power += samples[i] * samples[i];
          if (i > 85000) tail = Math.max(tail, Math.abs(samples[i]));
        }
        return {
          samples: Array.from(samples),
          peak,
          rms: Math.sqrt(power / samples.length),
          tail,
        };
      });
      // Build 018: louder so it is heard over background sound, still gentle.
      assert.ok(sound.peak > 0.05 && sound.peak < 0.2, "chime peak " + sound.peak);
      assert.ok(sound.rms < 0.05, "chime rms " + sound.rms);
      assert.equal(sound.tail, 0);
      const wav = Buffer.alloc(44 + sound.samples.length * 2);
      wav.write("RIFF");
      wav.writeUInt32LE(wav.length - 8, 4);
      wav.write("WAVEfmt ", 8);
      wav.writeUInt32LE(16, 16);
      wav.writeUInt16LE(1, 20);
      wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(48000, 24);
      wav.writeUInt32LE(96000, 28);
      wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34);
      wav.write("data", 36);
      wav.writeUInt32LE(wav.length - 44, 40);
      sound.samples.forEach((s, i) =>
        wav.writeInt16LE(Math.round(s * 32767), 44 + i * 2),
      );
      await fs.writeFile(path.join(out, "entry-chime-preview.wav"), wav);
      passed(
        "entry mute prevents playback; real offline audio renders a quiet bounded chime and silent tail",
      );
      await p.close();
    }
    // Build 012: a short main menu, rarely used settings one level down.
    for (const night of [false, true]) {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await mock(p, "layer", false);
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      if (night) {
        await p.evaluate(() => __hold());
        await p.evaluate(() => __aim("night"));
        await p.evaluate(() => __pinch());
        await p.evaluate(() => __hold());
      }
      await p.evaluate(() => __hold());
      assert.equal(await p.locator("#page").getAttribute("data-view"), "menu");
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "main");
      const ids = await p.evaluate(async () => {
        const { MENU_PAGES } = await import("./gestures.js?v=28");
        return MENU_PAGES;
      });
      assert.deepEqual(ids.main, ["resume", "library", "calendar", "night", "mood", "size", "more", "exit", "volume"]);
      await p.evaluate(() => __aim("night"));
      assert.equal(await p.locator("#page").getAttribute("data-target"), "night");
      await p.locator("#page").screenshot({
        path: path.join(out, `menu-main-${night ? "night" : "paper"}.png`),
      });
      await p.evaluate(() => __aim("more"));
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "more");
      // The same spot on the second page is a different, page-specific button.
      await p.evaluate(() => __aim("sound"));
      assert.equal(await p.locator("#page").getAttribute("data-target"), "sound");
      // Where Exit sits on the main page, this page has its own button.
      await p.evaluate(() => __aim("exit"));
      assert.equal(await p.locator("#page").getAttribute("data-target"), "recenter");
      await p.locator("#page").screenshot({
        path: path.join(out, `menu-more-${night ? "night" : "paper"}.png`),
      });
      await p.evaluate(() => __aim("back"));
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "main");
      await p.evaluate(() => __aim("more"));
      await p.evaluate(() => __pinch());
      await p.evaluate(() => __hold());
      assert.equal(await p.locator("#page").getAttribute("data-view"), "reading");
      await p.evaluate(() => __hold());
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "main", "menu reopens on its main page");
      await p.locator("#page").screenshot({ path: path.join(out, `menu-reopened-${night ? "night" : "paper"}.png`) }).catch(() => {});
      assert.deepEqual(errors, []);
      passed("two-page menu: main essentials, More settings and Back, page-specific targets" + (night ? " night" : ""));
      await p.close();
    }
    // Build 013: the Bradbury Challenge calendar.
    {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.clock.setFixedTime(new Date(2026, 9, 28, 20, 0, 0));
      await mock(p, "layer", false);
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => __hold());
      await p.evaluate(() => __aim("calendar"));
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "calendar");
      await p.locator("#page").screenshot({ path: path.join(out, "calendar-october.png") });
      const cell = (page, id) =>
        p.evaluate(
          async ({ page, id }) => {
            const { calendarButtons } = await import("./calendar.js?v=28");
            const { loadProgress } = await import("./progress.js?v=28");
            const prog = loadProgress(localStorage, "2026-10-28");
            return (
              calendarButtons(page, { year: 2026, month: 9 }, prog, "2026-10-28").find(
                (b) => b.id === id,
              ) || null
            );
          },
          { page, id },
        );
      // Future days have no target.
      assert.equal(await cell("calendar", "day:2026-10-29"), null);
      // Open the missed day: its stated picks are shown.
      await p.evaluate(async (b) => await __aim(b), await cell("calendar", "day:2026-10-21"));
      assert.equal(await p.locator("#page").getAttribute("data-target"), "day:2026-10-21");
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "day");
      await p.locator("#page").screenshot({ path: path.join(out, "calendar-day-missed.png") });
      await p.evaluate(async (b) => await __aim(b), await cell("day", "cal-back"));
      await p.evaluate(() => __pinch());
      // Tick today's poem, story and essay.
      await p.evaluate(async (b) => await __aim(b), await cell("calendar", "day:2026-10-28"));
      await p.evaluate(() => __pinch());
      // An immediate repeat pinch right after opening the day ticks nothing,
      // even though a tick row now sits under the pointer.
      await p.evaluate(async (b) => await __aim(b), await cell("day", "tick:story"));
      await p.evaluate(() => {
        // Open just long enough to re-arm (180 ms settle), then click: the
        // whole repeat lands well inside the 600 ms guard.
        __hand(0.05);
        __step(250);
        __hand(0.012);
        __native("selectstart");
        __step(80);
        __hand(0.05);
        __native("select");
        __native("selectend");
        __step(16);
      });
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "day");
      assert.equal(
        (await p.evaluate(() => JSON.parse(localStorage.getItem("cabin-progress")))).days["2026-10-28"],
        undefined,
        "repeat pinch must not tick",
      );
      for (const k of ["poem", "story", "essay"]) {
        await p.evaluate(async (b) => await __aim(b), await cell("day", "tick:" + k));
        await p.evaluate(() => __pinch());
      }
      await p.evaluate(async (b) => await __aim(b), await cell("day", "weekly"));
      await p.evaluate(() => __pinch());
      await p.locator("#page").screenshot({ path: path.join(out, "calendar-day-today.png") });
      const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("cabin-progress")));
      assert.deepEqual(saved.days["2026-10-28"], { poem: true, story: true, essay: true });
      assert.equal(saved.weeks["2026-11-01"].submitted, true);
      assert.equal(saved.days["2026-10-18"].essay, true);
      assert.equal(saved.trackingSince, "2026-10-28");
      await p.evaluate(async (b) => await __aim(b), await cell("day", "cal-back"));
      await p.evaluate(() => __pinch());
      await p.locator("#page").screenshot({ path: path.join(out, "calendar-after-ticks.png") });
      // Page turns were never triggered by calendar pinches.
      assert.match(await p.locator("#place").textContent(), /Page 1/);
      {
        const dl = p.waitForEvent("download");
        await p.locator("#export").click();
        const f = path.join(out, "calendar-test-details.json");
        await (await dl).saveAs(f);
        const details = JSON.parse(await fs.readFile(f, "utf8"));
        assert.equal(details.pageTurns, 0);
        assert.ok(details.gestureLog.every((e) => e.outcome !== "turned"));
      }
      await p.evaluate(() => __hold());
      assert.equal(await p.locator("#page").getAttribute("data-view"), "reading");
      // Export contains the same progress.
      const download = p.waitForEvent("download");
      await p.locator("#progress-export").click();
      const file = path.join(out, "progress-export.json");
      await (await download).saveAs(file);
      const exported = JSON.parse(await fs.readFile(file, "utf8"));
      assert.deepEqual(exported.days["2026-10-28"], saved.days["2026-10-28"]);
      // Import rejects junk and keeps the current progress.
      const junk = path.join(out, "junk.json");
      await fs.writeFile(junk, '{"hello":1}');
      await p.locator("#progress-file").setInputFiles(junk);
      await p.waitForFunction(() => /Could not import/.test(document.querySelector("#status").textContent));
      assert.equal(
        (await p.evaluate(() => JSON.parse(localStorage.getItem("cabin-progress")))).days["2026-10-28"].poem,
        true,
      );
      assert.deepEqual(errors, []);
      passed("challenge calendar: stated history, ticks, weekly story, saved progress, export and safe import");
      await p.close();
    }
    {
      // An unreadable saved record is backed up, never silently replaced.
      const p = await browser.newPage();
      await p.addInitScript(() => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem("cabin-progress", "{not json");
          sessionStorage.setItem("seeded", "1");
        }
      });
      await p.goto(BASE_URL);
      await p.waitForFunction(() => document.querySelector("#place").textContent.includes("Page"));
      const keys = await p.evaluate(() => Object.keys(localStorage));
      const backup = keys.find((k) => k.startsWith("cabin-progress.bak-"));
      assert.ok(backup, "backup kept");
      assert.equal(await p.evaluate((k) => localStorage.getItem(k), backup), "{not json");
      assert.equal(await p.evaluate(() => localStorage.getItem("cabin-progress")), "{not json", "not overwritten at startup");
      await p.locator("#calendar").click();
      await p.locator("#page").screenshot({ path: path.join(out, "calendar-recovered-notice.png") });
      passed("an unreadable progress record is kept as a backup and flagged");
      await p.close();
    }
    {
      // Blocked storage: the calendar says plainly that it is not saving.
      const p = await browser.newPage();
      await p.addInitScript(() => {
        Object.defineProperty(window, "localStorage", { get() { throw Error("blocked"); } });
      });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(BASE_URL);
      await p.waitForFunction(() => document.querySelector("#place").textContent.includes("Page"));
      await p.locator("#calendar").click();
      await p.locator("#page").screenshot({ path: path.join(out, "calendar-not-saving.png") });
      assert.deepEqual(errors, []);
      passed("blocked storage keeps the app working and is reported");
      await p.close();
    }
    // Build 014: wrist calendar, locked to the RIGHT wrist.
    for (const night of [false, true]) {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.clock.setFixedTime(new Date(2026, 9, 28, 20, 0, 0));
      await mock(p, "layer", false, night ? { practised: true, headPointer: true } : undefined);
      if (!night)
        // Test data only: a day with stored picks, to show titles on the card.
        await p.addInitScript(() =>
          localStorage.setItem(
            "cabin-progress",
            JSON.stringify({
              version: 1,
              start: "2026-10-18",
              trackingSince: "2026-10-28",
              days: {
                "2026-10-18": { poem: true, story: true, essay: true },
                "2026-10-28": {
                  story: true,
                  picks: {
                    poem: "Ozymandias — Percy Bysshe Shelley",
                    story: "The Story of an Hour — Kate Chopin",
                    essay: "The Death of the Moth — Virginia Woolf",
                  },
                },
              },
              weeks: {},
            }),
          ),
        );
      await p.goto(BASE_URL);
      if (night) await p.locator("#night").click();
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => {
        // Place wrist + metacarpals in head space using real right-hand
        // anatomy: thumb side = fingers × palm-normal. pose "watch" = forearm
        // across the body, fingers to the left, back of hand to the eyes;
        // "palm" = the same with the palm to the eyes; "turn" = a raised
        // page-turn pinch with fingers forward and palm down.
        window.__wrist = (hand, kind) => {
          const s = __hand(0.05, hand);
          const H = new DOMMatrix(__headMatrix());
          const at = (q) => {
            const r = new DOMPoint(q.x, q.y, q.z).matrixTransform(H);
            return { x: r.x, y: r.y, z: r.z };
          };
          const add = (a, b, k) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
          const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
          const [w, f, n] =
            kind === "turn"
              ? [{ x: 0.08, y: -0.12, z: -0.4 }, { x: 0, y: 0, z: -1 }, { x: 0, y: -1, z: 0 }]
              : [{ x: 0.03, y: -0.08, z: -0.35 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: kind === "palm" ? 1 : -1 }];
          const th = cross(f, n);
          s.testJoints.set("wrist", { pose: at(w) });
          s.testJoints.set("index-finger-metacarpal", { pose: at(add(add(w, f, 0.07), th, 0.02)) });
          s.testJoints.set("pinky-finger-metacarpal", { pose: at(add(add(w, f, 0.06), th, -0.02)) });
          s.testJoints.set("middle-finger-metacarpal", { pose: at(add(w, f, 0.08)) });
          return s;
        };
        window.__watchLayer = () => {
          for (const [layer, d] of __mock.layerData)
            if (d.watch && !d.destroyed)
              return {
                opacity: layer.opacity,
                listed: __mock.session.renderState.layers.includes(layer),
              };
          return null;
        };
      });
      // The LEFT hand in the exact right-hand watch geometry never shows it.
      await p.evaluate(() => {
        __wrist("left", "watch");
        __step(600);
      });
      const left = await p.evaluate(() => __watchLayer());
      assert.ok(!left || !left.listed, "left wrist must never show the calendar");
      // Right wrist palm toward the eyes, or a normal page-turn pose: no.
      for (const kind of ["palm", "turn"]) {
        await p.evaluate((kind) => {
          __wrist("right", kind);
          __step(600);
        }, kind);
        const w = await p.evaluate(() => __watchLayer());
        assert.ok(!w || !w.listed, kind + " must not show it");
      }
      // Right wrist turned like a watch: shows after a short settle.
      await p.evaluate(() => {
        __wrist("right", "watch");
        __step(100);
      });
      const early = await p.evaluate(() => __watchLayer());
      assert.ok(!early || !early.listed, "brief turns do not flash it");
      await p.evaluate(() => __step(300));
      const shown = await p.evaluate(() => __watchLayer());
      assert.ok(shown && shown.listed && shown.opacity === 1, "right wrist shows it");
      const pixels = await p.evaluate(() => {
        const gl = __mock.gl;
        const d = [...__mock.layerData.values()].find((x) => x.watch);
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d.tex, 0);
        const px = new Uint8Array(512 * 448 * 4);
        gl.readPixels(0, 0, 512, 448, gl.RGBA, gl.UNSIGNED_BYTE, px);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(fb);
        let opaque = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 200) opaque++;
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 448;
        const g = c.getContext("2d");
        g.fillStyle = "#7d8a80";
        g.fillRect(0, 0, 512, 448);
        const tmp = document.createElement("canvas");
        tmp.width = 512;
        tmp.height = 448;
        tmp.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(px), 512, 448), 0, 0);
        g.save();
        g.scale(1, -1);
        g.drawImage(tmp, 0, -448);
        g.restore();
        return { opaque, corner: px[3], image: c.toDataURL("image/png") };
      });
      assert.ok(pixels.opaque > 100000, "watch face uploaded");
      assert.equal(pixels.corner, 0, "rounded transparent corners");
      await fs.writeFile(
        path.join(out, `wrist-calendar-${night ? "night" : "paper"}.png`),
        Buffer.from(pixels.image.split(",")[1], "base64"),
      );
      // While glancing, a right-hand click never acts.
      await p.evaluate(() => {
        __mock.clock = Math.max(__mock.clock, performance.now());
        __native("selectstart", "right");
        __step(120);
        __native("select", "right");
        __native("selectend", "right");
        __step(40);
      });
      // Turning the palm back hides it again.
      await p.evaluate(() => {
        __wrist("right", "palm");
        __step(500);
      });
      const hidden = await p.evaluate(() => __watchLayer());
      assert.ok(!hidden.listed, "hidden after turning away");
      // Both hands present: with the LEFT in the watch pose and the right
      // resting, nothing shows; then only the right shows; removing the
      // right source hides it at once.
      await p.evaluate(() => {
        const l = __wrist("left", "watch");
        const r = __wrist("right", "palm");
        __mock.session.inputSources = [l, r];
        __step(600);
      });
      assert.ok(!(await p.evaluate(() => __watchLayer())).listed, "two hands: left watch pose ignored");
      await p.evaluate(() => {
        const l = __wrist("left", "palm");
        const r = __wrist("right", "watch");
        __mock.session.inputSources = [l, r];
        __step(600);
      });
      assert.ok((await p.evaluate(() => __watchLayer())).listed, "two hands: right shows");
      await p.evaluate(() => {
        __mock.session.inputSources = [__mock.sources.left];
        __step(16); // layer list changes apply at the next frame boundary
        __step(16);
      });
      assert.ok(!(await p.evaluate(() => __watchLayer())).listed, "right removed: hidden at once");
      // After glancing, the right hand turns pages again.
      const before = await p.locator("#place").textContent();
      await p.evaluate(() => {
        __mock.sources.right.testJoints.delete("wrist");
        __mock.sources.right.testJoints.delete("index-finger-metacarpal");
        __mock.sources.right.testJoints.delete("pinky-finger-metacarpal");
        __mock.sources.right.testJoints.delete("middle-finger-metacarpal");
        __mock.sources.left.testJoints.clear();
        __mock.sources.left.testJoints.set("index-finger-tip", {});
        __mock.sources.left.testJoints.set("thumb-tip", {});
        __pinch("left");
        __pinch("right");
      });
      void before;
      const dl = p.waitForEvent("download");
      await p.locator("#export").click();
      const f = path.join(out, `wrist-details-${night ? "night" : "paper"}.json`);
      await (await dl).saveAs(f);
      const details = JSON.parse(await fs.readFile(f, "utf8"));
      assert.equal(details.wristCalendar.hand, "right");
      assert.equal(details.wristCalendar.error, null);
      const shownLog = details.wristCalendar.decisions.filter((d) => d.shown);
      assert.ok(shownLog.length >= 1 && shownLog.every((d) => d.palm <= -0.7 && d.across <= -0.4));
      assert.ok(details.wristCalendar.decisions.some((d) => !d.shown && d.reason));
      // Exactly one right-hand page action: the one made after the glance.
      const rightPages = details.gestureLog.filter((e) => e.hand === "right" && e.result === "page");
      assert.equal(rightPages.length, 1, "no right-hand action while glancing, one afterwards");
      assert.ok(["turned", "first-page", "last-page"].includes(rightPages[0].outcome));
      assert.deepEqual(errors, []);
      passed("wrist calendar appears only on the right wrist, settles, blocks that hand, and hides" + (night ? " night" : ""));
      await p.close();
    }
    await guideChecks(browser, { mock, BASE_URL, out, passed });
    await volumeChecks(browser, { mock, BASE_URL, out, passed });
    // Build 016: Library, full-work pagination and saved place.
    {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await mock(p, "layer", false);
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      const row = (i) => ({ x: 274, y: 700 + i * 124, w: 1500, h: 112 });
      const details = async (name) => {
        const dl = p.waitForEvent("download");
        await p.locator("#export").click();
        const f = path.join(out, name);
        await (await dl).saveAs(f);
        return JSON.parse(await fs.readFile(f, "utf8")).reading;
      };
      await p.evaluate(() => __hold());
      await p.evaluate(() => __aim("library"));
      await p.evaluate(() => __pinch());
      // With no picks for today the row is Your shelf; the whole Library is one step on.
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "shelf");
      await p.locator("#page").screenshot({ path: path.join(out, "shelf-empty.png") });
      await p.evaluate(async () => await __aim({ x: 274, y: 1880, w: 760, h: 120 }));
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "library");
      await p.locator("#page").screenshot({ path: path.join(out, "library.png") });
      // Open Désirée's Baby (row 5).
      await p.evaluate(async (b) => await __aim(b), row(5));
      assert.equal(await p.locator("#page").getAttribute("data-target"), "work:chopin-desiree");
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-view"), "reading");
      let r = await details("reading-1.json");
      assert.equal(r.work, "chopin-desiree");
      assert.equal(r.page, 1);
      assert.ok(r.pages >= 5, "a full story spans several pages: " + r.pages);
      await p.locator("#page").screenshot({ path: path.join(out, "reading-story-p1.png") });
      // Turn three pages with the PC Next button (same action as a gesture).
      for (let i = 0; i < 3; i++) await p.locator("#next").click();
      r = await details("reading-2.json");
      assert.equal(r.page, 4);
      const before = r.anchor;
      await p.locator("#page").screenshot({ path: path.join(out, "reading-story-p4.png") });
      // Larger text: the place is kept (same first line or the page holding it).
      await p.evaluate(() => __hold());
      await p.evaluate(() => __aim("size"));
      await p.evaluate(() => __pinch());
      await p.evaluate(() => __hold());
      r = await details("reading-3.json");
      assert.ok(
        r.anchor.block < before.block || (r.anchor.block === before.block && r.anchor.word <= before.word),
        "new page starts at or before the saved words",
      );
      assert.ok(r.page >= 4, "larger text means the place is further in");
      const kept = r;
      // Reload: the last work and its place come back.
      await p.reload();
      await p.waitForFunction(() => document.querySelector("#place").textContent.includes("Page"));
      const resumed = await details("reading-4.json");
      assert.equal(resumed.work, "chopin-desiree");
      assert.deepEqual(resumed.anchor, kept.anchor);
      // A poem keeps its stanza layout on one page.
      await p.locator("#page").screenshot({ path: path.join(out, "reading-after-reload.png") });
      // Size and paper/night survive the reload too.
      assert.equal(
        await p.evaluate(() => JSON.parse(localStorage.getItem("cabin-controls")).size),
        2,
      );
      assert.deepEqual(errors, []);
      passed("Library opens a full work; pages, text size and reload keep the reading place");
      await p.close();
    }
    {
      // Corrupt or foreign reading data never stops the app from starting.
      const p = await browser.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.addInitScript(() =>
        localStorage.setItem(
          "cabin-reading",
          JSON.stringify({ last: "sampler", places: { sampler: { anchor: { block: 2, word: 1 }, page: 1 }, "bacon-truth": { anchor: "x" } } }),
        ),
      );
      await p.goto(BASE_URL);
      await p.waitForFunction(() => document.querySelector("#place").textContent.includes("Page"));
      assert.deepEqual(errors, []);
      passed("stored reading data with sampler or malformed anchors loads safely");
      await p.close();
    }
    {
      // From the Library, "‹ Menu" then an immediate repeat pinch never exits.
      const p = await browser.newPage();
      await mock(p, "layer", false);
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      await p.evaluate(() => __hold());
      await p.evaluate(() => __aim("library"));
      await p.evaluate(() => __pinch());
      await p.evaluate(async () => await __aim({ x: 1394, y: 380, w: 380, h: 120 }));
      await p.evaluate(() => __pinch());
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "main");
      // Now aim at Exit and pinch at once: ignored for 600 ms.
      await p.evaluate(() => __aim("exit"));
      await p.evaluate(() => {
        __hand(0.05);
        __step(200);
        __hand(0.012);
        __native("selectstart");
        __step(60);
        __hand(0.05);
        __native("select");
        __native("selectend");
        __step(16);
      });
      assert.equal(await p.locator("#enter").isEnabled(), false, "still in the cabin");
      passed("Library Menu button and the Exit guard prevent an accidental exit");
      await p.close();
    }
    {
      // Poem and essay screenshots for visual review.
      const p = await browser.newPage();
      for (const [id, name] of [["whitman-captain", "reading-poem.png"], ["bacon-studies", "reading-essay.png"]]) {
        await p.addInitScript((id) => localStorage.setItem("cabin-reading", JSON.stringify({ last: id, places: {} })), id);
        await p.goto(BASE_URL);
        await p.waitForFunction(() => document.querySelector("#place").textContent.includes("Page"));
        await p.locator("#page").screenshot({ path: path.join(out, name) });
      }
      passed("poem and essay pages render");
      await p.close();
    }
    // Build 017: moods, look-to-turn (off by default) and ambience.
    {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await mock(p, "layer", false);
      await p.goto(BASE_URL);
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      const details = async (name) => {
        const dl = p.waitForEvent("download");
        await p.locator("#export").click();
        const f = path.join(out, name);
        await (await dl).saveAs(f);
        return JSON.parse(await fs.readFile(f, "utf8"));
      };
      const corner = (which) => ({ x: which === "next" ? 1880 : 40, y: 2420, w: 120, h: 100 });
      // Off by default: a long look at the corner does nothing.
      await p.evaluate(async (b) => await __aim(b), corner("next"));
      await p.evaluate(() => __step(2000));
      assert.match(await p.locator("#place").textContent(), /Page 1 of 2/);
      // Style: switch to clean modern.
      await p.evaluate(() => {
        __mock.look = null;
        __hold();
      });
      await p.evaluate(() => __aim("mood"));
      await p.evaluate(() => __pinch());
      // More settings: turn on look-to-turn and background sound.
      await p.evaluate(() => __aim("more"));
      await p.evaluate(() => __pinch());
      await p.evaluate(() => __aim("gaze"));
      await p.evaluate(() => __pinch());
      await p.evaluate(() => __aim("ambience"));
      await p.evaluate(() => __pinch());
      await p.locator("#page").screenshot({ path: path.join(out, "menu-more-017.png") });
      await p.evaluate(() => {
        __mock.look = null;
        __hold();
      });
      assert.equal(await p.locator("#page").getAttribute("data-view"), "reading");
      let d = await details("settings-017.json");
      assert.equal(d.mood, "modern");
      assert.equal(d.gazeTurn.enabled, true);
      assert.equal(d.ambience.setting, "rain");
      assert.equal(d.ambience.kind, "rain");
      assert.equal(d.ambience.error, null);
      assert.equal(d.ambience.playing, true, "the background sound is actually playing");
      assert.equal(d.ambience.context, "running");
      await p.locator("#page").screenshot({ path: path.join(out, "reading-modern.png") });
      // After closing the menu, look at the page (which re-arms), then at the
      // bottom-right corner: the ring fills, then one page turn.
      await p.evaluate(() => {
        __mock.look = null;
        __step(100);
      });
      await p.evaluate(async (b) => await __aim(b), corner("next"));
      await p.evaluate(() => __step(600));
      const ring = await p.evaluate(() => {
        for (const [layer, d] of __mock.layerData)
          if (d.gazeRing) return __mock.session.renderState.layers.includes(layer);
        return false;
      });
      assert.ok(ring, "gaze ring shows while looking at the corner");
      assert.match(await p.locator("#place").textContent(), /Page 1 of 2/, "no turn before the dwell");
      await p.evaluate(() => __step(900));
      assert.match(await p.locator("#place").textContent(), /Page 2 of 2/);
      await p.evaluate(() => __step(2000));
      assert.match(await p.locator("#place").textContent(), /Page 2 of 2/, "one turn per look");
      // Look away, then at the bottom-left corner: back.
      await p.evaluate(() => {
        __mock.look = null;
        __step(300);
      });
      await p.evaluate(async (b) => await __aim(b), corner("prev"));
      await p.evaluate(() => __step(1500));
      assert.match(await p.locator("#place").textContent(), /Page 1 of 2/);
      d = await details("gaze-017.json");
      const gazeTurns = d.gestureLog.filter((e) => e.eventSource === "gaze");
      assert.deepEqual(gazeTurns.map((e) => e.outcome), ["turned", "turned"]);
      assert.deepEqual(gazeTurns.map((e) => e.direction), ["next", "prev"]);
      const gazeCount = async (name) =>
        (await details(name)).gestureLog.filter((e) => e.eventSource === "gaze").length;
      // Guard 1: with the menu open, and right after closing it while still
      // looking at the corner, nothing turns.
      await p.evaluate(() => {
        __mock.look = null;
        __step(300);
        __hold();
      });
      await p.evaluate(async (b) => await __aim(b), corner("next"));
      await p.evaluate(() => __step(2000));
      await p.evaluate(() => __hold());
      await p.evaluate(() => __step(2000));
      assert.match(await p.locator("#place").textContent(), /Page 1 of 2/, "menu pauses gaze");
      assert.equal(await gazeCount("gaze-guard-1.json"), 2);
      // Guard 2: headset not visible (system UI over the view): no turn.
      await p.evaluate(() => {
        __mock.look = null;
        __step(300);
      });
      await p.evaluate(async (b) => await __aim(b), corner("next"));
      await p.evaluate(() => {
        __mock.session.visibilityState = "visible-blurred";
        __step(2000);
        __mock.session.visibilityState = "visible";
        __step(16);
      });
      assert.match(await p.locator("#place").textContent(), /Page 1 of 2/, "blurred pauses gaze");
      assert.equal(await gazeCount("gaze-guard-2.json"), 2);
      // Guard 3: a hand pinch while looking at the corner ends that look, so
      // the page can never turn twice.
      await p.evaluate(() => {
        __mock.look = null;
        __step(300);
      });
      await p.evaluate(async (b) => await __aim(b), corner("next"));
      await p.evaluate(() => __step(300));
      await p.evaluate(() => __pinch("right"));
      await p.evaluate(() => __step(2500));
      assert.equal(await gazeCount("gaze-guard-3.json"), 2, "no gaze turn after a hand action");
      // Preferences persist.
      const prefs = await p.evaluate(() => JSON.parse(localStorage.getItem("cabin-controls")));
      assert.equal(prefs.mood, "modern");
      assert.equal(prefs.gazeTurn, true);
      assert.equal(prefs.ambience, "rain");
      assert.deepEqual(errors, []);
      passed("Style, look-to-turn (off by default, one turn per look) and background sound");
      await p.close();
    }
    {
      // A full work in the clean modern style, for visual review.
      const p = await browser.newPage();
      await p.addInitScript(() => {
        localStorage.setItem("cabin-reading", JSON.stringify({ last: "ohenry-magi", places: {} }));
        localStorage.setItem("cabin-controls", JSON.stringify({ mood: "modern" }));
      });
      await p.goto(BASE_URL);
      await p.waitForFunction(() => document.querySelector("#place").textContent.includes("Page"));
      await p.locator("#page").screenshot({ path: path.join(out, "reading-modern-story.png") });
      await p.close();
    }
    // Build 019: today's three and progress through Google Drive (faked).
    {
      const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.clock.setFixedTime(new Date(2026, 9, 28, 20, 0, 0));
      await mock(p, "layer", false);
      await p.addInitScript(() => localStorage.setItem("cabin-google-client", "test-client.apps.googleusercontent.com"));
      const today = {
        version: 2,
        date: "2026-10-28",
        picks: {},
      };
      const { SOURCE_CATALOGUE } = await import("../source-catalogue.js");
      const originals = ["poem", "story", "essay"].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'].includes(w.id)));
      for (const w of originals) today.picks[w.kind] = { catalogueId: w.id, text: "FORGED LITERARY TEXT MUST NEVER APPEAR" };
      const writes = [];
      let consent = 0;
      await p.route("https://accounts.google.com/gsi/client", (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body: `window.google = { accounts: { oauth2: { initTokenClient: (o) => ({ requestAccessToken: () => { window.__consent = (window.__consent || 0) + 1; setTimeout(() => o.callback({ access_token: "fake-token", expires_in: 3600 }), 10); } }) } } };`,
        }),
      );
      await p.route("https://www.googleapis.com/**", async (r) => {
        const url = decodeURIComponent(r.request().url()),
          method = r.request().method();
        assert.equal(r.request().headers().authorization, "Bearer fake-token");
        const json = (b) => r.fulfill({ contentType: "application/json", body: JSON.stringify(b) });
        if (url.includes("files?q=") && url.includes("Bradbury Cabin")) return json({ files: [{ id: "F" }] });
        if (url.includes("files?q=") && url.includes("progress.json")) return json({ files: writes.length ? [{ id: "P" }] : [] });
        if (url.includes("files?q=") && url.includes("in parents"))
          return json({ files: [{ id: "T", name: "picks-2026-10-28.json", size: "900" }] });
        if (url.includes("/files/T?alt=media")) return r.fulfill({ contentType: "application/json", body: JSON.stringify(today) });
        if (method !== "GET") {
          writes.push({ method, url, body: r.request().postData() });
          return json({ id: "P" });
        }
        return r.fulfill({ status: 404, body: "" });
      });
      await p.goto(BASE_URL);
      await p.locator("#drive-sync:not([disabled])").click();
      await p.waitForFunction(() => /Today's three are ready/.test(document.querySelector("#status").textContent));
      assert.ok((await p.locator("#status").textContent()).includes(originals.map(w => w.title).join(", ")));
      assert.equal(writes.filter((w) => w.method === "POST").length, 1, "progress.json created once");
      const created = writes.find((w) => w.method === "POST").body;
      assert.match(created, /"2026-10-28"/);
      assert.ok(created.includes(originals[0].title + " — " + originals[0].author), "today's picks recorded in progress");
      assert.ok(created.includes(`"ids":{"poem":"${originals[0].id}"`), "catalogue IDs saved for Your shelf");
      assert.ok(created.includes('cabinPickerInstructions'), "source instructions travel to Claude automatically");
      assert.ok(created.includes('catalogueId'), "Claude gets selectable source references without a manual import");
      // In the cabin: Today appears by itself with today's poem first; open it, then tick it.
      await p.locator("#enter:not([disabled])").click();
      await p.evaluate(() => __center());
      assert.equal(await p.locator("#page").getAttribute("data-menu-page"), "today");
      await p.locator("#page").screenshot({ path: path.join(out, "library-today.png") });
      await p.evaluate(async () => await __aim({ x: 274, y: 660, w: 1500, h: 260 }));
      assert.match(await p.locator("#page").getAttribute("data-target"), /^today:today-2026-10-28-poem-/);
      await p.evaluate(() => __pinch());
      await p.locator("#page").screenshot({ path: path.join(out, "reading-today-poem.png") });
      await p.evaluate(() => __hold());
      await p.evaluate(() => __aim("calendar"));
      await p.evaluate(() => __pinch());
      const cell = await p.evaluate(async () => {
        const { calendarButtons } = await import("./calendar.js?v=28");
        const { loadProgress } = await import("./progress.js?v=28");
        return calendarButtons("calendar", { year: 2026, month: 9 }, loadProgress(localStorage, "2026-10-28"), "2026-10-28").find((b) => b.id === "day:2026-10-28");
      });
      await p.evaluate(async (b) => await __aim(b), cell);
      await p.evaluate(() => __pinch());
      await p.locator("#page").screenshot({ path: path.join(out, "calendar-day-with-picks.png") });
      await p.evaluate(async () => await __aim({ x: 274, y: 640, w: 1500, h: 186 }));
      await p.evaluate(() => __pinch());
      // The tick is pushed to Drive shortly after.
      await p.evaluate(() => {
        __mock.clock = Math.max(__mock.clock, performance.now());
      });
      await p.waitForTimeout(2200);
      const patch = writes.filter((w) => w.method === "PATCH").at(-1);
      assert.ok(patch, "tick saved back to Drive");
      assert.equal(JSON.parse(patch.body).days["2026-10-28"].poem, true);
      assert.equal(await p.evaluate(() => window.__consent), 1, "one Google sign-in for the session");
      // Reading one of today's works when midnight passes: it stays open.
      const exportReading = async (name) => {
        const dl = p.waitForEvent("download");
        await p.locator("#export").click();
        const f = path.join(out, name);
        await (await dl).saveAs(f);
        return JSON.parse(await fs.readFile(f, "utf8")).reading;
      };
      if ((await p.locator("#page").getAttribute("data-view")) === "menu") await p.evaluate(() => __hold());
      const before = await exportReading("before-midnight.json");
      assert.match(before.work, /^today-2026-10-28-/);
      await p.clock.setFixedTime(new Date(2026, 9, 29, 0, 0, 5));
      // Any repaint after midnight (here: opening and closing the menu).
      await p.evaluate(() => __hold());
      await p.evaluate(() => __hold());
      const after = await exportReading("after-midnight.json");
      assert.equal(after.work, before.work, "the same work stays open after midnight");
      assert.equal(after.page, before.page);
      assert.deepEqual(errors, []);
      passed("Drive: today's three appear in the Library, calendar and wrist; ticks sync back");
      await p.close();
    }
    {
      // Without Google setup the button says so, and nothing breaks.
      const p = await browser.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(BASE_URL);
      await p.waitForFunction(() => document.querySelector("#place").textContent.includes("Page"));
      // Build 020: Bastian's (public) client ID is configured.
      assert.match(await p.locator("#drive-sync").textContent(), /^Sync with Drive/);
      assert.equal(await p.locator("#drive-sync").isEnabled(), true);
      assert.deepEqual(errors, []);
      passed("Drive button is ready with the configured Google client");
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
