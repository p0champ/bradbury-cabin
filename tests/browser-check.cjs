const { chromium } = require(process.env.CABIN_PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const out = path.resolve(process.env.CABIN_EVIDENCE_DIR || "evidence");
async function mock(page, scenario = "layer", lying = false) {
  await page.addInitScript(
    ({ scenario, lying }) => {
      WebGL2RenderingContext.prototype.makeXRCompatible = async () => {};
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
      window.__mock = { scenario, lying, placed: [], draws: 0 };
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
                  views: [{ projectionMatrix: projection, transform: head() }],
                },
          getJointPose: (joint) =>
            joint?.pose ? { transform: new Transform(joint.pose) } : null,
          getPose: () => ({ transform: head() }),
        };
        const cb = callback;
        callback = null;
        if (cb) cb(performance.now(), frame);
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
      window.XRWebGLLayer = class {
        constructor(s, g) {
          gl = g;
          g.canvas.width = 1200;
          g.canvas.height = 1000;
          this.framebuffer = null;
          this.fixedFoveation = 1;
        }
        getViewport() {
          return { x: 0, y: 0, width: 1200, height: 1000 };
        }
      };
      window.XRWebGLBinding = class {
        constructor() {}
        createQuadLayer() {
          if (scenario.startsWith("no-layer"))
            throw Error("Deliberate unsupported layer fixture");
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 2048, 2560);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.bindTexture(gl.TEXTURE_2D, null);
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
            viewport: { x: 0, y: 0, width: 2048, height: 2560 },
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
      ["no-layer", false],
      ["no-layers-feature", false],
      ["no-layer-unreported", false],
      ["no-layers-feature-unreported", false],
      ["draw-failure", false],
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
      if (scenario === "layer") {
        assert.match(
          await p.locator("#status").textContent(),
          /Compositor layer drawn/,
        );
        const before = await p.evaluate(() => __mock.placed[0]);
        await p.evaluate(() => __step());
        assert.equal(await p.evaluate(() => __mock.placed.length), 1);
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
        await p.locator("#xr").screenshot({
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
        await p.evaluate(() => {
          __mock.offsetX = 0.25;
          __step();
        });
        await p.locator("#xr").screenshot({
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
