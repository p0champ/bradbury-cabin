import { PAGE, SIZES, layout, placedPose } from "./core.js?v=7";
import {
  GestureEngine,
  menuButtons,
  menuHit,
  nearFacePalm,
  HOLD_MS,
  MIN_PINCH_MS,
  inView,
  facingPanel,
} from "./gestures.js?v=7";
import { renderer, identity, multiply, checkGl } from "./gl.js?v=7";
import { HandBadges } from "./hand-badges.js?v=7";
const $ = (id) => document.getElementById(id),
  canvas = $("page"),
  ctx = canvas.getContext("2d");
let preferences = {};
try {
  preferences = JSON.parse(localStorage.getItem("cabin-controls") || "{}");
  if (
    !preferences ||
    typeof preferences !== "object" ||
    Array.isArray(preferences)
  )
    preferences = {};
} catch {}
const savePreferences = () => {
  try {
    localStorage.setItem("cabin-controls", JSON.stringify(preferences));
  } catch {}
};
const state = {
  centering: false,
  attentionPaused: false,
  menuOpen: false,
  practice: false,
  swapped: !!preferences.swapped,
  headPointer: !!preferences.headPointer,
  handFeedbackError: null,
  practiceMarks: { next: false, prev: false, menu: false },
  feedback: "",
  feedbackUntil: 0,
  size: 1,
  night: false,
  page: 0,
  mode: "layer",
  session: null,
  hover: null,
  error: null,
  graphicsError: null,
  renderRoute: null,
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
  dirty = true,
  sessionGeneration = 0;
let projectionRoute = false,
  layerDirty = true;
const gestures = new GestureEngine();
let nativeQueue = [],
  lastFrameTime = 0;
let handBadges = null;
let menuPlacement = null,
  lastViewer = null,
  lastDisplay = null,
  pointerSource = null,
  ending = false;
const report = (message) => {
  $("status").textContent = message;
};
function paint() {
  canvas.dataset.view = state.centering
    ? "centering"
    : state.menuOpen
      ? "menu"
      : state.practice
        ? "practice"
        : "reading";
  canvas.dataset.target = state.hover || "";
  canvas.setAttribute(
    "aria-label",
    state.menuOpen
      ? "Cabin controls menu"
      : state.practice
        ? "Gesture practice: Next, Back and Menu"
        : "Public domain poem and short story excerpt",
  );
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
  if (state.centering) {
    ctx.fillStyle = ink;
    ctx.font = "82px Literata";
    ctx.fillText("Get comfortable.", 180, 650);
    ctx.font = "45px Arial";
    for (const [i, line] of [
      "Look where you want to read.",
      "Keep an open hand in view for a moment.",
      "Pinch once, then release to centre here.",
      "Nothing else is active until you confirm.",
    ].entries())
      ctx.fillText(line, 180, 830 + i * 110);
    ctx.font = "32px Arial";
    ctx.fillText("CENTRE HERE  ·  PINCH AND RELEASE", 180, 1500);
  } else if (state.menuOpen) {
    ctx.fillStyle = ink;
    ctx.font = "72px Literata";
    ctx.fillText("Make yourself comfortable.", 160, 440);
    ctx.fillStyle = muted;
    ctx.font = "36px Arial";
    ctx.fillText(
      state.headPointer
        ? "Look at a button, pinch, then release."
        : "Point until a button highlights, pinch, then release.",
      160,
      540,
    );
    for (const b of menuButtons) {
      ctx.fillStyle =
        state.hover === b.id ? muted : state.night ? "#29372f" : "#e8e6d7";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = state.hover === b.id ? bg : ink;
      ctx.font = "40px Arial";
      ctx.textAlign = "center";
      let label = b.label;
      if (b.id === "swap")
        label = state.swapped ? "Forward: left hand" : "Forward: right hand";
      if (b.id === "pointer")
        label = state.headPointer ? "Pointer: head" : "Pointer: hand";
      if (b.id === "night")
        label = state.night ? "Switch to paper" : "Switch to night";
      if (b.id === "size")
        label = "Text: " + ["Small", "Medium", "Large"][state.size];
      ctx.fillText(label, b.x + b.w / 2, b.y + 108);
    }
    ctx.textAlign = "left";
  } else if (state.practice) {
    ctx.fillStyle = ink;
    ctx.font = "76px Literata";
    ctx.fillText("A moment to find your rhythm.", 160, 450);
    ctx.fillStyle = muted;
    ctx.font = "38px Arial";
    ctx.fillText(
      "Rest your hands anywhere the headset can see them.",
      160,
      560,
    );
    const rows = [
      [
        "next",
        state.swapped
          ? "Left pinch, then release"
          : "Right pinch, then release",
        "Next page",
      ],
      [
        "prev",
        state.swapped
          ? "Right pinch, then release"
          : "Left pinch, then release",
        "Previous page",
      ],
      [
        "menu",
        "Hold either pinch for 1.4 seconds",
        "Open the menu (optional here)",
      ],
    ];
    rows.forEach(([id, title, detail], i) => {
      const y = 800 + i * 360;
      ctx.fillStyle = state.night ? "#29372f" : "#e8e6d7";
      ctx.fillRect(160, y - 110, 1720, 280);
      ctx.fillStyle = ink;
      ctx.font = "54px Literata";
      ctx.fillText(
        (state.practiceMarks[id] ? "✓  " : "0" + (i + 1) + "  ") + title,
        220,
        y,
      );
      ctx.fillStyle = muted;
      ctx.font = "38px Arial";
      ctx.fillText(detail, 320, y + 80);
    });
    ctx.fillStyle = muted;
    ctx.font = "36px Arial";
    ctx.fillText(
      "Practice never changes your reading page. Next + Back finish it.",
      160,
      1880,
    );
    ctx.fillText(
      "Holding a pinch also lets you leave this practice.",
      160,
      1950,
    );
  } else {
    for (const b of pages[state.page]) {
      ctx.fillStyle = b.kind === "meta" ? muted : ink;
      ctx.font = `${b.kind === "meta" ? "" : b.kind === "title" ? "italic " : ""}${b.font}px ${b.kind === "meta" ? "Arial" : "Literata, Georgia, serif"}`;
      ctx.fillText(b.text, 194, b.y);
    }
  }
  ctx.fillStyle = muted;
  ctx.font = "32px Arial";
  ctx.textAlign = "left";
  ctx.fillText(
    `${state.page + 1} / ${pages.length}  ·  ${state.mode === "layer" ? "A · COMPOSITOR LAYER" : "B · ORDINARY TEXTURE"}`,
    160,
    2175,
  );
  ctx.font = "36px Arial";
  ctx.fillText(
    (state.centering
      ? "Only centring is active · pinch and release to place the page."
      : state.attentionPaused
        ? "Paused · look toward the page, then open your hand."
        : state.feedback) ||
      (state.menuOpen
        ? "Hold a pinch to close the menu."
        : state.swapped
          ? "Left: next   ·   Right: back   ·   Hold: menu"
          : "Right: next   ·   Left: back   ·   Hold: menu"),
    160,
    2320,
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
  $("menu").textContent = state.menuOpen ? "Close menu" : "Open menu";
  $("pointer").textContent = state.headPointer
    ? "Menu pointer: head"
    : "Menu pointer: hand";
  $("compare").textContent =
    state.mode === "layer" ? "Compare: texture" : "Compare: layer";
  $("mode-label").textContent = state.session
    ? `${state.mode === "layer" ? "A · compositor layer" : "B · ordinary texture"} · ${state.blend}`
    : "PC preview · no headset quality claim";
  dirty = true;
  layerDirty = true;
}
function presentPose() {
  return state.menuOpen || state.practice
    ? menuPlacement || placement
    : placement;
}
function inFront() {
  return state.session && lastViewer
    ? new XRRigidTransform(
        placedPose(lastViewer.matrix).position,
        lastViewer.orientation,
      )
    : null;
}
function feedback(text) {
  state.feedback = text;
  state.feedbackUntil = performance.now() + 1800;
}
function toggleMenu(open = !state.menuOpen) {
  state.menuOpen = open;
  state.practice = false;
  state.hover = null;
  pointerSource = null;
  if (open) menuPlacement = inFront();
  gestures.setContext(open ? "menu" : "reading");
  paint();
}
// Practice is complete once Next and Back were both done, in any order. The
// menu hold is optional: it always leaves practice for the menu anyway.
function practiceDone() {
  const m = state.practiceMarks;
  if (!(m.next && m.prev)) return false;
  preferences.practised = true;
  savePreferences();
  return true;
}
// Returns what actually happened, so feedback never claims a turn that did
// not change the page: "turned", "first-page", "last-page", "practice",
// "menu" or "select".
function gestureEvent(event) {
  if (event.type === "center") {
    placement = new XRRigidTransform(
      placedPose(lastViewer.matrix).position,
      lastViewer.orientation,
    );
    state.centering = false;
    state.practice = false;
    state.menuOpen = false;
    menuPlacement = null;
    nativeQueue = [];
    gestures.setContext("reading");
    paint();
    return "centered";
  }
  if (state.centering) return "blocked-before-centering";
  if (!event) return null;
  if (event.type === "menu") {
    if (state.practice) {
      state.practiceMarks.menu = true;
      practiceDone();
    }
    feedback(state.menuOpen ? "Reading" : "Menu");
    toggleMenu();
    return "menu";
  }
  if (event.type === "select") {
    action(event.target);
    return "select";
  }
  const id = (event.hand === "right") !== state.swapped ? "next" : "prev";
  if (state.practice) {
    state.practiceMarks[id] = true;
    if (practiceDone()) {
      state.practice = false;
      menuPlacement = null;
      feedback("Practice complete · now reading · hold for the menu");
    } else
      feedback(
        (id === "next" ? "Next ✓" : "Back ✓") + "  ·  practice: pages stay put",
      );
    paint();
    return "practice";
  }
  const before = state.page;
  action(id);
  if (state.page !== before) {
    feedback(`Page ${state.page + 1} of ${pages.length}`);
    paint();
    return "turned";
  }
  feedback(
    id === "next"
      ? "Last page · nothing further"
      : "First page · nothing before",
  );
  paint();
  return id === "next" ? "last-page" : "first-page";
}
function action(id) {
  if (
    state.centering &&
    ["menu", "practice", "next", "prev", "recenter", "resume"].includes(id)
  )
    return;
  if (id === "menu") {
    toggleMenu();
    return;
  }
  if (id === "resume") {
    toggleMenu(false);
    return;
  }
  if (id === "practice") {
    state.practiceMarks = { next: false, prev: false, menu: false };
    state.practice = true;
    state.menuOpen = false;
    state.hover = null;
    menuPlacement = inFront();
    gestures.setContext("reading");
    paint();
    return;
  }
  if (id === "swap") {
    state.swapped = !state.swapped;
    preferences.swapped = state.swapped;
    savePreferences();
  }
  if (id === "pointer") {
    state.headPointer = !state.headPointer;
    preferences.headPointer = state.headPointer;
    savePreferences();
    gestures.setContext(state.menuOpen ? "menu" : "reading");
    state.hover = null;
  }
  if (id === "prev") state.page = Math.max(0, state.page - 1);
  if (id === "next") {
    if (state.page < pages.length - 1) {
      state.page++;
      state.turns++;
    }
  }
  if (id === "night") state.night = !state.night;
  if (id === "size") state.size = (state.size + 1) % 3;
  if (id === "recenter") {
    wantRecenter = true;
    toggleMenu(false);
  }
  if (id === "exit") {
    ending = true;
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
for (const id of [
  "prev",
  "next",
  "night",
  "recenter",
  "compare",
  "menu",
  "practice",
  "pointer",
])
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
    build: "gestures-007",
    phase: "1-gesture-trial",
    gestureTiming: { holdMs: HOLD_MS, minPinchMs: MIN_PINCH_MS },
    // Last 40 pinch attempts: what the recogniser decided, why, and what the
    // app then did. This is the evidence for "registered but did not turn".
    gestureLog: gestures.log.map((e) => ({ ...e, time: Math.round(e.time) })),
    ignoredPinches: gestures.ignored.map((e) => ({
      ...e,
      time: Math.round(e.time),
    })),
    nativeEvents: gestures.trace,
    inputState: [...gestures.hands.values()].map((h) => ({
      hand: h.hand,
      tracked: h.tracked,
      inView: h.inView,
      stable: h.stable,
      attentive: h.attentive,
      ready: h.armed,
      nativeDown: h.nativeDown,
    })),
    inputMode: "native-select-only",
    centering: state.centering,
    attentionPaused: state.attentionPaused,
    handFeedbackError: state.handFeedbackError,
    controls: {
      swapped: state.swapped,
      pointer: state.headPointer ? "head" : "hand",
      practiceMarks: state.practiceMarks,
    },
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
    graphicsError: state.graphicsError,
    renderRoute: state.renderRoute,
    questQuality:
      "Bastian confirmed Build 003 crispness; Build 006 controls need a Quest check",
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
  if (projectionRoute) {
    const primary = quad && state.mode === "layer" ? quad : base;
    try {
      session.updateRenderState({
        layers: [primary, ...(handBadges?.visible || [])],
      });
    } catch (error) {
      if (!handBadges?.visible.length) throw error;
      handBadges.failed = true;
      handBadges.clearVisible();
      state.handFeedbackError = error.message;
      report("Hand feedback unavailable: " + error.message);
      session.updateRenderState({ layers: [primary] });
    }
  } else session.updateRenderState({ baseLayer: base });
}
function hit(transform) {
  const display = presentPose();
  if (!state.menuOpen || !display || !transform) return null;
  const inv = display.inverse.matrix,
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
  return menuHit(
    ((origin.x + direction.x * t) / PAGE.metresWide + 0.5) * PAGE.width,
    (0.5 - (origin.y + direction.y * t) / PAGE.metresHigh) * PAGE.height,
  );
}
function cleanSession() {
  sessionGeneration++;
  state.session = null;
  nativeQueue = [];
  state.centering = false;
  state.attentionPaused = false;
  gestures.reset();
  handBadges?.dispose();
  handBadges = null;
  quad?.destroy();
  quad = null;
  if (projectionRoute) base?.destroy();
  projectionRoute = false;
  gpu?.dispose();
  gpu = null;
  placement = null;
  binding = null;
  ref = null;
  base = null;
  state.hover = null;
  state.menuOpen = false;
  menuPlacement = null;
  lastViewer = null;
  lastDisplay = null;
  ending = false;
  $("enter").disabled = false;
  $("enter").textContent = "Enter the cabin ↗";
  paint();
}
async function enter() {
  if (state.session) return;
  $("enter").disabled = true;
  state.error = null;
  state.graphicsError = null;
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
    gpu = await renderer($("xr"));
    ref = await session.requestReferenceSpace("local");
    projectionRoute = false;
    if (
      globalThis.XRWebGLBinding &&
      session.enabledFeatures?.includes("layers") !== false
    ) {
      try {
        binding = new XRWebGLBinding(session, gpu.gl);
        base = binding.createProjectionLayer({
          textureType: "texture",
          colorFormat: gpu.gl.RGBA,
          depthFormat: gpu.gl.DEPTH_COMPONENT24,
        });
        session.updateRenderState({ layers: [base] });
        projectionRoute = true;
      } catch (e) {
        base?.destroy();
        base = null;
        binding = null;
        if (session.enabledFeatures?.includes("layers")) throw e;
      }
    }
    if (!projectionRoute)
      base = new XRWebGLLayer(session, gpu.gl, {
        alpha: true,
        antialias: true,
      });
    state.renderRoute = projectionRoute
      ? "native projection + quad"
      : "legacy texture only";
    if ("fixedFoveation" in base) base.fixedFoveation = 0;
    checkGl(gpu.gl, "XR layer setup");
    try {
      if (!projectionRoute)
        throw Error("Native Layers is unavailable in this session.");
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
      checkGl(gpu.gl, "quad setup");
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
    ending = false;
    nativeQueue = [];
    state.centering = true;
    state.attentionPaused = false;
    state.menuOpen = false;
    state.practice = false;
    gestures.setContext("centering");
    state.handFeedbackError = null;
    if (quad)
      handBadges = new HandBadges(binding, ref, (error) => {
        state.handFeedbackError = error.message;
        report("Hand feedback unavailable: " + error.message);
      });
    wantRecenter = true;
    gestures.reset();
    paint();
    for (const kind of ["selectstart", "select", "selectend"])
      session.addEventListener(kind, (e) => {
        if (ending || state.session !== session) return;
        // Copy the event pose while the event frame is active. Viewer/joint
        // safety comes from the next animation frame, not this event frame.
        let ray = null;
        try {
          ray = e.frame.getPose(e.inputSource.targetRaySpace, ref)?.transform;
        } catch {}
        const time = Math.max(lastFrameTime, performance.now());
        gestures.trace.push({
          stage: "received",
          kind,
          eventSource: "native-select",
          hand: e.inputSource.handedness,
          time,
          visibility: session.visibilityState,
          context: gestures.context,
          profiles: Array.from(e.inputSource.profiles || []).slice(0, 4),
        });
        if (gestures.trace.length > 120) gestures.trace.shift();
        nativeQueue.push({ kind, source: e.inputSource, time, ray });
        if (nativeQueue.length > 60) {
          nativeQueue = [];
          gestures.reset("event-queue-overflow");
        }
      });
    session.addEventListener("inputsourceschange", (e) => {
      for (const source of e.removed) {
        gestures.cancel(source, "source-removed");
        nativeQueue = nativeQueue.filter((e) => e.source !== source);
      }
    });
    ref.addEventListener?.("reset", () => {
      wantRecenter = true;
      nativeQueue = [];
      gestures.reset("reference-reset");
    });
    session.addEventListener("visibilitychange", () => {
      nativeQueue = [];
      gestures.reset("visibility-change");
      if (handBadges?.clearVisible()) applyLayers();
    });
    const generation = ++sessionGeneration;
    session.requestAnimationFrame((t, f) => frame(t, f, generation));
  } catch (e) {
    state.error = e.message;
    state.graphicsError = e.graphics || null;
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
  const activeLayers = session.renderState.layers || [];
  lastFrameTime = time;
  try {
    const pose = xrFrame.getViewerPose(ref);
    if (!pose) {
      nativeQueue = [];
      gestures.reset("viewer-pose-lost");
      if (handBadges?.clearVisible()) applyLayers();
      if (state.hover) {
        state.hover = null;
        paint();
      }
    }
    if (pose) {
      if (wantRecenter || state.centering) {
        placement = new XRRigidTransform(
          placedPose(pose.transform.matrix).position,
          pose.transform.orientation,
        );
        wantRecenter = false;
      }
      lastViewer = pose.transform;
      const sessionVisible = session.visibilityState === "visible";
      const attentive =
        sessionVisible &&
        !pose.emulatedPosition &&
        (state.centering || facingPanel(pose.transform, presentPose()));
      if (state.attentionPaused === attentive) {
        state.attentionPaused = !attentive;
        paint();
      }
      if ((state.menuOpen || state.practice) && !menuPlacement)
        menuPlacement = inFront();
      const activeSources = new Set(session.inputSources);
      for (const source of gestures.hands.keys())
        if (!activeSources.has(source)) {
          gestures.cancel(source, "source-removed");
          gestures.hands.delete(source);
        }
      const targets = new Map(),
        samples = [];
      for (const source of session.inputSources) {
        if (!source.hand) continue;
        const joint = (name) => {
          const space = source.hand.get(name);
          return space ? xrFrame.getJointPose(space, ref) : null;
        };
        const a = joint("index-finger-tip"),
          b = joint("thumb-tip");
        const point = state.headPointer
          ? pose.transform
          : xrFrame.getPose(source.targetRaySpace, ref)?.transform;
        const target = state.menuOpen ? hit(point) : null;
        targets.set(source, target);
        const distance =
          a && b
            ? Math.hypot(
                a.transform.position.x - b.transform.position.x,
                a.transform.position.y - b.transform.position.y,
                a.transform.position.z - b.transform.position.z,
              )
            : null;
        const systemGesture =
          source.skipRendering ||
          nearFacePalm(
            joint("wrist")?.transform.position,
            joint("index-finger-metacarpal")?.transform.position,
            joint("pinky-finger-metacarpal")?.transform.position,
            pose.transform.position,
            source.handedness,
            {
              x: -pose.transform.matrix[8],
              y: -pose.transform.matrix[9],
              z: -pose.transform.matrix[10],
            },
          );
        const wrist = joint("wrist")?.transform.position,
          baseJoint = joint("index-finger-metacarpal")?.transform.position;
        const anchor =
          wrist && baseJoint
            ? {
                x: (wrist.x + baseJoint.x) / 2,
                y: (wrist.y + baseJoint.y) / 2,
                z: (wrist.z + baseJoint.z) / 2,
              }
            : wrist ||
              (a && b
                ? {
                    x: (a.transform.position.x + b.transform.position.x) / 2,
                    y: (a.transform.position.y + b.transform.position.y) / 2,
                    z: (a.transform.position.z + b.transform.position.z) / 2,
                  }
                : null);
        samples.push({
          source,
          hand: source.handedness,
          position: anchor,
          systemGesture,
        });
        const tracked =
          !!a && !!b && !a.emulatedPosition && !b.emulatedPosition;
        const handInView =
          tracked &&
          inView(a.transform.position, pose.transform) &&
          inView(b.transform.position, pose.transform);
        const button = source.gamepad?.buttons?.[0];
        const open = button
          ? !button.pressed && distance > 0.022
          : distance > 0.028;
        samples[samples.length - 1].systemGesture ||= !attentive || !handInView;
        if (!attentive || !handInView || systemGesture)
          targets.set(source, null);
        gestures.update(source, {
          tracked,
          inView: handInView,
          attentive,
          open,
          time,
          hand: source.handedness,
          target,
          systemGesture,
        });
      }
      const deliver = (event) => {
        if (!event) return;
        pointerSource = gestures.owner || pointerSource;
        const entry = gestures.lastEntry;
        gestures.lastEntry = null;
        const outcome = gestureEvent(event);
        if (entry) {
          entry.outcome = outcome;
          entry.page = state.page + 1;
        }
        if (outcome !== "centered")
          handBadges?.pulse(event.hand, time, outcome);
      };
      const queued = nativeQueue;
      nativeQueue = [];
      for (const input of queued) {
        if (ending) break;
        if (!activeSources.has(input.source) || time - input.time > 120) {
          gestures.cancel(input.source, "stale-native-event", time);
          gestures.note({
            result: "ignored",
            reason: "stale-or-removed-event",
            hand: input.source.handedness,
            kind: input.kind,
            time: input.time,
            eventSource: "native-select",
          });
          continue;
        }
        const target = state.menuOpen
          ? hit(state.headPointer ? pose.transform : input.ray)
          : null;
        pointerSource = input.source;
        deliver(gestures.handle(input.kind, input.source, input.time, target));
      }
      if (!ending) deliver(gestures.tick(time));
      if (ending || state.session !== session || !gpu) return;
      let hover = null;
      if (state.menuOpen && attentive) {
        if (state.headPointer) hover = hit(pose.transform);
        else if (gestures.owner) hover = targets.get(gestures.owner) || null;
        else
          hover =
            targets.get(pointerSource) ||
            [...targets.values()].find(Boolean) ||
            null;
      }
      if (hover !== state.hover) {
        state.hover = hover;
        paint();
      }
      if (state.feedback && performance.now() > state.feedbackUntil) {
        state.feedback = "";
        paint();
      }
      if (
        handBadges?.update(
          state.centering ? [] : samples,
          pose.transform,
          gestures,
          {
            swapped: state.swapped,
            menu: state.menuOpen,
            practice: state.practice,
            canForward: state.page < pages.length - 1,
            canBack: state.page > 0,
            time,
          },
        )
      )
        applyLayers();
      const display = presentPose();
      if (quad && display !== lastDisplay) {
        quad.transform = display;
        lastDisplay = display;
      }
      const { gl } = gpu;
      // The comparison texture is independent of the compositor upload. A
      // never needs its texImage2D/mipmap path; retain dirty until B uses it.
      if (drawMode === "texture" && dirty) {
        gpu.upload(canvas);
        checkGl(gl, "comparison source upload");
        dirty = false;
      }
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      if (drawMode === "texture") {
        const scale = new Float32Array(identity);
        scale[0] = PAGE.metresWide / 2;
        scale[5] = PAGE.metresHigh / 2;
        const model = multiply(display.matrix, scale);
        for (const view of pose.views) {
          let sub;
          if (projectionRoute) {
            sub = binding.getViewSubImage(base, view);
            gl.bindFramebuffer(gl.FRAMEBUFFER, gpu.fbo);
            gl.framebufferTexture2D(
              gl.FRAMEBUFFER,
              gl.COLOR_ATTACHMENT0,
              gl.TEXTURE_2D,
              sub.colorTexture,
              0,
            );
            if (sub.depthStencilTexture)
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.TEXTURE_2D,
                sub.depthStencilTexture,
                0,
              );
          } else gl.bindFramebuffer(gl.FRAMEBUFFER, base.framebuffer);
          try {
            checkGl(gl, "projection attachment");
            if (
              gl.checkFramebufferStatus(gl.FRAMEBUFFER) !==
              gl.FRAMEBUFFER_COMPLETE
            )
              throw Error("Comparison projection framebuffer is incomplete.");
            const v = sub?.viewport || base.getViewport(view);
            gl.viewport(v.x, v.y, v.width, v.height);
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(v.x, v.y, v.width, v.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gpu.draw(
              multiply(
                view.projectionMatrix,
                multiply(view.transform.inverse.matrix, model),
              ),
            );
            checkGl(gl, "comparison projection draw");
          } finally {
            gl.disable(gl.SCISSOR_TEST);
            if (projectionRoute) {
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                null,
                0,
              );
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.TEXTURE_2D,
                null,
                0,
              );
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          }
          checkGl(gl, "projection cleanup");
        }
      }
      if (drawMode === "layer" && quad && (layerDirty || quad.needsRedraw)) {
        const sub = binding.getSubImage(quad, xrFrame);
        state.actualPixels = [sub.viewport.width, sub.viewport.height];
        checkGl(gl, "quad subimage acquisition");
        gpu.copyPage(sub, canvas);
        layerDirty = false;
        if (state.layerStatus !== "drawn") {
          state.layerStatus = "drawn";
          report(
            `Compositor layer drawn at ${state.actualPixels.join(" × ")} pixels. Build 006: practise Next, Back and Menu.`,
          );
        }
      }
      if (handBadges?.draw(xrFrame, gpu, activeLayers)) applyLayers();
    }
  } catch (e) {
    state.error = e.message;
    state.graphicsError = e.graphics || null;
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
        ? "Enter the cabin ↗"
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
