import {
  PAGE,
  SIZES,
  layout,
  controls,
  controlAt,
  placedPose,
  PinchGate,
} from "./core.js";
import { renderer, identity, multiply } from "./gl.js";
const $ = (id) => document.getElementById(id),
  canvas = $("page"),
  ctx = canvas.getContext("2d");
const state = {
  size: 1,
  night: false,
  page: 0,
  mode: "layer",
  session: null,
  hover: null,
  error: null,
  layerStatus: "not tested",
  actualPixels: null,
  blend: null,
  turns: 0,
};
let pages = [],
  gpu,
  ref,
  base,
  binding,
  quad,
  placement,
  wantRecenter = true,
  lastAction = -Infinity,
  dirty = true,
  sessionGeneration = 0;
const hands = new Map();
const report = (message) => {
  $("status").textContent = message;
};
function paint() {
  pages = layout(ctx, state.size);
  state.page = Math.min(state.page, pages.length - 1);
  const bg = state.night ? "#1a211e" : "#f7f0df",
    ink = state.night ? "#e4dfd0" : "#293b32",
    muted = state.night ? "#a8b9aa" : "#637569";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PAGE.width, PAGE.height);
  ctx.fillStyle = muted;
  ctx.font = "28px Arial";
  ctx.fillText("B / C     BRADBURY CABIN", 180, 155);
  ctx.textAlign = "right";
  ctx.fillText("THE FIRST LEAF", 1868, 155);
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = "74px Literata";
  ctx.fillText("A little room for reading.", 180, 270);
  ctx.strokeStyle = muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(180, 312);
  ctx.lineTo(1868, 312);
  ctx.stroke();
  for (const b of pages[state.page]) {
    ctx.fillStyle = b.kind === "meta" ? muted : ink;
    ctx.font = `${b.kind === "meta" ? "" : b.kind === "title" ? "italic " : ""}${b.font}px ${b.kind === "meta" ? "Arial" : "Literata, Georgia, serif"}`;
    ctx.fillText(b.text, 194, b.y);
  }
  ctx.fillStyle = muted;
  ctx.font = "29px Arial";
  ctx.fillText(
    `${state.page + 1} / ${pages.length}     ·     ${["Small", "Medium", "Large"][state.size]}     ·     ${state.mode === "layer" ? "A · COMPOSITOR LAYER" : "B · ORDINARY TEXTURE"}`,
    110,
    2175,
  );
  for (const c of controls) {
    ctx.fillStyle =
      state.hover === c.id ? muted : state.night ? "#29372f" : "#e8e6d7";
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = state.hover === c.id ? bg : ink;
    ctx.font = "34px Arial";
    ctx.textAlign = "center";
    ctx.fillText(c.label, c.x + c.w / 2, c.y + 62);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.font = "27px Arial";
  ctx.fillText(
    "Look at a control + pinch. Pinch elsewhere to turn. Hold no pose.",
    110,
    2520,
  );
  $("place").textContent = `Page ${state.page + 1} of ${pages.length}`;
  $("prev").disabled = state.page === 0;
  $("next").disabled = state.page === pages.length - 1;
  $("night").setAttribute("aria-pressed", String(state.night));
  document.body.classList.toggle("night", state.night);
  document
    .querySelectorAll("[data-size]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(+b.dataset.size === state.size)),
    );
  $("compare").textContent =
    state.mode === "layer" ? "Compare: texture" : "Compare: layer";
  $("mode-label").textContent = state.session
    ? `${state.mode === "layer" ? "A · compositor layer" : "B · ordinary texture"} · ${state.blend}`
    : "PC preview · no headset quality claim";
  dirty = true;
}
function action(id) {
  if (id === "prev") state.page = Math.max(0, state.page - 1);
  if (id === "next") {
    if (state.page < pages.length - 1) {
      state.page++;
      state.turns++;
    }
  }
  if (id === "night") state.night = !state.night;
  if (id === "size") state.size = (state.size + 1) % 3;
  if (id === "recenter") wantRecenter = true;
  if (id === "exit") {
    state.session?.end();
    return;
  }
  if (id === "compare") {
    if (state.session && !quad) {
      report("No compositor layer available. A/B comparison is blocked.");
      return;
    }
    state.mode = state.mode === "layer" ? "texture" : "layer";
    if (state.session) applyLayers();
  }
  paint();
}
for (const id of ["prev", "next", "night", "recenter", "compare"])
  $(id).onclick = () => action(id);
document.querySelectorAll("[data-size]").forEach(
  (b) =>
    (b.onclick = () => {
      state.size = +b.dataset.size;
      state.page = 0;
      paint();
    }),
);
$("export").onclick = () => {
  const data = {
    build: "phase0-002",
    phase: 0,
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    layerStatus: state.layerStatus,
    requestedPixels: [PAGE.width, PAGE.height],
    actualPixels: state.actualPixels,
    pageMetres: [PAGE.metresWide, PAGE.metresHigh],
    distance: PAGE.distance,
    textPixels: SIZES[state.size],
    mode: state.mode,
    blend: state.blend,
    page: state.page + 1,
    pageTurns: state.turns,
    error: state.error,
    questQuality: "Requires Bastian’s judgement",
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "bradbury-phase-0.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function applyLayers() {
  const session = state.session;
  const layers = quad && state.mode === "layer" ? [base, quad] : [base];
  // XRWebGLLayer is allowed inside the Layers list. Do not also send the
  // legacy baseLayer property: Quest rejects its presence even when null.
  if (quad || session.enabledFeatures?.includes("layers")) {
    session.updateRenderState({ layers });
    return;
  }
  if (session.enabledFeatures) {
    session.updateRenderState({ baseLayer: base });
    return;
  }
  // Older browsers may not expose enabledFeatures. Probe Layers first;
  // only use the legacy route if that API rejects the list entirely.
  try {
    session.updateRenderState({ layers });
  } catch {
    session.updateRenderState({ baseLayer: base });
  }
}
function hit(transform) {
  if (!placement || !transform) return null;
  const inv = placement.inverse.matrix,
    m = transform.matrix;
  const origin = new DOMPoint(m[12], m[13], m[14]).matrixTransform(
    new DOMMatrix(inv),
  );
  const direction = new DOMPoint(-m[8], -m[9], -m[10], 0).matrixTransform(
    new DOMMatrix(inv),
  );
  if (direction.z >= -0.0001) return null;
  const t = -origin.z / direction.z;
  if (t < 0) return null;
  return controlAt(
    ((origin.x + direction.x * t) / PAGE.metresWide + 0.5) * PAGE.width,
    (0.5 - (origin.y + direction.y * t) / PAGE.metresHigh) * PAGE.height,
  );
}
function trigger(id, time = performance.now()) {
  if (time - lastAction < 450) return;
  lastAction = time;
  action(id || "next");
}
function cleanSession() {
  sessionGeneration++;
  state.session = null;
  hands.clear();
  quad?.destroy();
  quad = null;
  gpu?.dispose();
  gpu = null;
  placement = null;
  binding = null;
  ref = null;
  base = null;
  state.hover = null;
  $("enter").disabled = false;
  $("enter").textContent = "Enter the crispness test ↗";
  paint();
}
async function enter() {
  if (state.session) return;
  $("enter").disabled = true;
  state.error = null;
  state.actualPixels = null;
  state.layerStatus = "not tested";
  let session;
  try {
    session = await navigator.xr.requestSession("immersive-ar", {
      optionalFeatures: ["local", "layers", "hand-tracking"],
    });
    state.session = session;
    session.addEventListener("end", cleanSession, { once: true });
    state.blend = session.environmentBlendMode;
    if (state.blend !== "alpha-blend")
      throw Error("This session does not provide passthrough alpha blending.");
    gpu = renderer($("xr"));
    await gpu.gl.makeXRCompatible();
    ref = await session.requestReferenceSpace("local");
    base = new XRWebGLLayer(session, gpu.gl, { alpha: true, antialias: true });
    if ("fixedFoveation" in base) base.fixedFoveation = 0;
    try {
      if (!globalThis.XRWebGLBinding) throw Error("XRWebGLBinding is missing.");
      binding = new XRWebGLBinding(session, gpu.gl);
      quad = binding.createQuadLayer({
        space: ref,
        viewPixelWidth: PAGE.width,
        viewPixelHeight: PAGE.height,
        width: PAGE.metresWide,
        height: PAGE.metresHigh,
        layout: "mono",
        isStatic: false,
        clearOnAccess: false,
      });
      state.layerStatus = "created; awaiting first draw";
      state.mode = "layer";
      applyLayers();
    } catch (e) {
      quad?.destroy();
      quad = null;
      state.layerStatus = "unavailable: " + e.message;
      state.mode = "texture";
      applyLayers();
      report(
        "Layer unavailable. Texture fallback only: " +
          e.message +
          " This cannot pass the crispness gate.",
      );
    }
    wantRecenter = true;
    lastAction = -Infinity;
    hands.clear();
    paint();
    session.addEventListener("select", (e) => {
      const h = hands.get(e.inputSource);
      if (e.inputSource.hand && h && performance.now() - h.lastJoint < 300)
        return;
      const pose = e.frame.getPose(e.inputSource.targetRaySpace, ref);
      trigger(hit(pose?.transform) || state.hover);
    });
    session.addEventListener("inputsourceschange", (e) => {
      for (const source of e.removed) hands.delete(source);
    });
    ref.addEventListener?.("reset", () => {
      wantRecenter = true;
      hands.clear();
    });
    session.addEventListener("visibilitychange", () => {
      hands.clear();
      lastAction = performance.now();
    });
    const generation = ++sessionGeneration;
    session.requestAnimationFrame((t, f) => frame(t, f, generation));
  } catch (e) {
    state.error = e.message;
    report("Could not open the passthrough test: " + e.message);
    if (session) {
      await session.end();
    } else {
      state.session = null;
      $("enter").disabled = false;
      $("enter").textContent = "Try entering again ↗";
    }
  }
}
function frame(time, xrFrame, generation) {
  if (generation !== sessionGeneration || !state.session) return;
  const session = state.session;
  // Render-state layer changes take effect at the next XR frame boundary.
  // A pinch may request a new mode below; finish this frame using its old mode.
  const drawMode = state.mode;
  try {
    const pose = xrFrame.getViewerPose(ref);
    if (!pose) {
      hands.clear();
      if (state.hover) {
        state.hover = null;
        paint();
      }
    }
    if (pose) {
      if (wantRecenter) {
        placement = new XRRigidTransform(
          placedPose(pose.transform.matrix).position,
          pose.transform.orientation,
        );
        if (quad) quad.transform = placement;
        wantRecenter = false;
      }
      const hover = hit(pose.transform);
      if (hover !== state.hover) {
        state.hover = hover;
        paint();
      }
      for (const source of session.inputSources) {
        if (!source.hand) continue;
        let h = hands.get(source);
        if (!h) {
          h = { gate: new PinchGate(), lastJoint: -Infinity };
          hands.set(source, h);
        }
        const index = source.hand.get("index-finger-tip"),
          thumb = source.hand.get("thumb-tip");
        const a = index && xrFrame.getJointPose(index, ref),
          b = thumb && xrFrame.getJointPose(thumb, ref);
        let distance = null;
        if (a && b) {
          distance = Math.hypot(
            a.transform.position.x - b.transform.position.x,
            a.transform.position.y - b.transform.position.y,
            a.transform.position.z - b.transform.position.z,
          );
          h.lastJoint = performance.now();
        }
        if (h.gate.update(distance)) trigger(hover, time);
      }
      const { gl } = gpu;
      if (dirty) {
        gpu.upload(canvas);
        dirty = false;
      }
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, base.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (drawMode === "texture") {
        const scale = new Float32Array(identity);
        scale[0] = PAGE.metresWide / 2;
        scale[5] = PAGE.metresHigh / 2;
        const model = multiply(placement.matrix, scale);
        for (const view of pose.views) {
          const v = base.getViewport(view);
          gl.viewport(v.x, v.y, v.width, v.height);
          gpu.draw(
            multiply(
              view.projectionMatrix,
              multiply(view.transform.inverse.matrix, model),
            ),
          );
        }
      }
      if (drawMode === "layer" && quad) {
        const sub = binding.getSubImage(quad, xrFrame);
        state.actualPixels = [sub.viewport.width, sub.viewport.height];
        gl.bindFramebuffer(gl.FRAMEBUFFER, gpu.fbo);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          sub.colorTexture,
          0,
        );
        try {
          if (
            gl.checkFramebufferStatus(gl.FRAMEBUFFER) !==
            gl.FRAMEBUFFER_COMPLETE
          )
            throw Error("Compositor framebuffer is incomplete.");
          gl.viewport(
            sub.viewport.x,
            sub.viewport.y,
            sub.viewport.width,
            sub.viewport.height,
          );
          gpu.draw(identity);
        } finally {
          gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            null,
            0,
          );
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        if (gl.getError() !== gl.NO_ERROR)
          throw Error("WebGL reported an error drawing the compositor layer.");
        if (state.layerStatus !== "drawn") {
          state.layerStatus = "drawn";
          report(
            `Compositor layer drawn at ${state.actualPixels.join(" × ")} pixels. Headset crispness still needs your check.`,
          );
        }
      }
    }
  } catch (e) {
    state.error = e.message;
    state.layerStatus = "failed: " + e.message;
    report(
      "The layer test stopped: " +
        e.message +
        " Return to the browser to read the test details.",
    );
    session.end();
    return;
  }
  session.requestAnimationFrame((t, f) => frame(t, f, generation));
}
await document.fonts.load("54px Literata");
$("enter").onclick = enter;
paint();
if (!isSecureContext) {
  report(
    "Use HTTPS on Quest. A file or an ordinary local-network HTTP page cannot start WebXR.",
  );
  $("enter").textContent = "HTTPS needed on Quest";
} else if (navigator.xr) {
  navigator.xr
    .isSessionSupported("immersive-ar")
    .then((ok) => {
      $("enter").disabled = !ok;
      $("enter").textContent = ok
        ? "Enter the crispness test ↗"
        : "Headset needed for passthrough";
      report(
        ok
          ? "Lie down, then enter. Allow hand tracking when asked."
          : "This browser can show the page preview. Run the actual test in Quest Browser.",
      );
    })
    .catch((e) => {
      report(e.message);
    });
} else {
  $("enter").textContent = "Open in Quest Browser";
  report(
    "PC preview is ready. The compositor comparison happens in your headset.",
  );
}
