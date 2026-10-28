import test from "node:test";
import assert from "node:assert/strict";
import {
  GestureEngine,
  nearFacePalm,
  menuHit,
  HOLD_MS,
  inView,
  facingPanel,
} from "../gestures.js";
function rig(context = "reading") {
  const g = new GestureEngine();
  g.setContext(context);
  let time = 0;
  const events = [];
  const sample = (hand = "right", extra = {}, ms = 20) => {
    time += ms;
    g.update(hand, {
      time,
      hand,
      tracked: true,
      inView: true,
      attentive: true,
      open: true,
      ...extra,
    });
  };
  const run = (ms, extra = {}, hand = "right") => {
    while (ms > 0) {
      const step = Math.min(ms, 20);
      sample(hand, extra, step);
      ms -= step;
    }
  };
  const event = (kind, hand = "right", target = null) => {
    const e = g.handle(kind, hand, time, target);
    if (e) events.push(e);
    return e;
  };
  return {
    g,
    events,
    sample,
    run,
    event,
    get time() {
      return time;
    },
    ready(hand = "right") {
      run(600, {}, hand);
    },
    start(hand = "right", target = null) {
      event("selectstart", hand, target);
    },
    release(hand = "right", target = null) {
      event("select", hand, target);
      event("selectend", hand, target);
    },
    tick() {
      const e = g.tick(time);
      if (e) events.push(e);
      return e;
    },
  };
}
test("native successful sequence emits exactly one page, including duplicate success/end", () => {
  const r = rig();
  r.ready();
  r.start();
  r.run(60, { open: false });
  r.release();
  r.release();
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("bare select and cancellation-only end never turn", () => {
  const r = rig();
  r.ready();
  r.event("select");
  r.start();
  r.event("selectend");
  r.event("select");
  assert.equal(r.events.length, 0);
});
test("joint distances alone never authorize a click or hold", () => {
  const r = rig();
  r.ready();
  r.run(2000, { open: false, distance: 0.001 });
  r.tick();
  r.run(500);
  assert.equal(r.events.length, 0);
});
test("native click needs no app pinch distance or minimum duration", () => {
  const r = rig();
  r.ready();
  r.start();
  r.release();
  assert.equal(r.events.length, 1);
});
test("new and reappearing closed hands cannot arm", () => {
  const r = rig();
  r.run(1000, { open: false });
  r.start();
  r.release();
  assert.equal(r.events.length, 0);
  r.ready();
  r.start();
  r.release();
  assert.equal(r.events.length, 1);
});
test("tracking must be steady for 400ms even if the hand opens", () => {
  const r = rig();
  r.run(300);
  r.start();
  r.release();
  assert.equal(r.events.length, 0);
});
test("a native hold uses the same start clock as its ring and fires once", () => {
  const r = rig();
  r.ready();
  r.start();
  r.run(700, { open: false });
  assert.equal(r.g.holdCharge(r.time), 0.5);
  assert.equal(r.g.progress(r.time), 1 / 3);
  assert.equal(r.tick(), null);
  r.run(700, { open: false });
  assert.equal(r.tick().type, "menu");
  r.release();
  r.tick();
  assert.equal(r.events.length, 1);
});
test("release before threshold is not inflated by a later render tick", () => {
  const r = rig();
  r.ready();
  r.start();
  r.run(1380, { open: false });
  r.release();
  r.run(60);
  r.tick();
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("completed release at the threshold is a menu, not a page", () => {
  const r = rig();
  r.ready();
  r.start();
  r.run(HOLD_MS, { open: false });
  r.release();
  assert.equal(r.events[0].type, "menu");
});
test("centering confirms only on successful native release and never holds a menu", () => {
  const r = rig("centering");
  r.ready();
  r.start();
  r.run(1800, { open: false });
  assert.equal(r.g.progress(r.time), 0);
  assert.equal(r.tick(), null);
  r.release();
  assert.deepEqual(r.events, [{ type: "center", hand: "right" }]);
});
test("context changes consume the old press and require fresh open", () => {
  const r = rig();
  r.ready();
  r.start();
  r.g.setContext("menu");
  r.run(800, { open: false });
  r.release("right", "exit");
  assert.equal(r.events.length, 0);
});
for (const [name, gate] of [
  ["lookaway", { attentive: false }],
  ["out-of-view", { inView: false }],
  ["tracking-loss", { tracked: false }],
  ["system-pinch", { systemGesture: true }],
]) {
  test(name + " cancels hold and requires fresh open", () => {
    const r = rig();
    r.ready();
    r.start();
    r.run(600, { open: false });
    r.sample("right", { ...gate, open: false });
    assert.equal(r.g.progress(r.time), 0);
    r.run(1000, { open: false });
    r.release();
    assert.equal(r.events.length, 0);
    r.ready();
    r.start();
    r.release();
    assert.equal(r.events.length, 1);
  });
}
test("a tracking gap cancels the native transaction", () => {
  const r = rig();
  r.ready();
  r.start();
  r.sample("right", { open: false }, 200);
  r.release();
  assert.equal(r.events.length, 0);
});
test("other hand cannot steal a press or act later without reopening", () => {
  const r = rig();
  r.ready("left");
  r.ready();
  r.start();
  r.sample("left", { open: false });
  r.start("left");
  r.release("left");
  r.release();
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("menu click must finish over its starting target", () => {
  const r = rig("menu");
  r.ready();
  r.start("right", "night");
  r.release("right", "exit");
  assert.equal(r.events.length, 0);
  r.ready();
  r.start("right", "night");
  r.release("right", "night");
  assert.deepEqual(r.events, [
    { type: "select", target: "night", hand: "right" },
  ]);
});
test("stale event safety snapshot cannot start a transaction", () => {
  const r = rig();
  r.ready();
  r.g.handle("selectstart", "right", r.time + 200);
  assert.equal(r.g.owner, null);
});
test("successful native cycles rearm immediately without a new geometric opening", () => {
  const r = rig();
  r.ready();
  r.start();
  r.release();
  r.sample();
  r.start();
  r.run(700, { open: false });
  r.release();
  assert.equal(r.events.length, 2);
});
for (const spacing of [0, 80, 120, 200])
  test(`ten native cycles at ${spacing}ms spacing each emit once without wide finger opening`, () => {
    const r = rig();
    r.ready();
    for (let i = 0; i < 10; i++) {
      r.start();
      r.release();
      if (spacing) r.run(spacing, { open: false });
    }
    assert.equal(r.events.length, 10);
  });
test("duplicate selectstart cannot restart a hold or duplicate a click", () => {
  const r = rig();
  r.ready();
  r.start();
  r.run(100, { open: false });
  const started = r.g.hands.get("right").started;
  r.start();
  assert.equal(r.g.hands.get("right").started, started);
  r.release();
  r.release();
  assert.equal(r.events.length, 1);
});
test("diagnostics distinguish native rejection, cancellation and successful action", () => {
  const r = rig();
  r.event("selectstart");
  r.ready();
  r.start();
  r.event("selectend");
  r.ready();
  r.start();
  r.release();
  assert.equal(r.g.log.at(-1).result, "page");
  assert.equal(r.g.log.at(-1).eventSource, "native-select");
  assert.ok(r.g.ignored.length);
  assert.ok(r.g.trace.length);
});
test("menu target remains locked across animation-frame updates", () => {
  const r = rig("menu");
  r.ready();
  r.start("right", "night");
  r.run(100, { target: "exit", open: false });
  r.release("right", "exit");
  assert.equal(r.events.length, 0);
});
test("cancelled press with a missing native ending recovers after fresh open", () => {
  const r = rig();
  r.ready();
  r.start();
  r.sample("right", { open: false }, 200);
  r.ready();
  r.start();
  r.release();
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("view gates use viewer-local axes including lying down", () => {
  const v = {
    matrix: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  };
  assert.ok(inView({ x: 0.2, y: -0.2, z: -0.5 }, v));
  assert.equal(inView({ x: 2, y: 0, z: -0.5 }, v), false);
  assert.equal(inView({ x: 0, y: 0, z: 0.5 }, v), false);
  const p = { matrix: new Float32Array(v.matrix) };
  p.matrix[14] = -1.1;
  assert.ok(facingPanel(v, p));
  p.matrix[12] = 3;
  assert.equal(facingPanel(v, p), false);
});
test("near-face palm guard distinguishes palm direction and resting distance", () => {
  const wrist = { x: 0, y: 0, z: -0.3 },
    index = { x: -0.03, y: 0.05, z: -0.3 },
    pinky = { x: 0.03, y: 0.04, z: -0.3 };
  assert.equal(
    nearFacePalm(wrist, index, pinky, { x: 0, y: 0, z: 0 }, "right"),
    true,
  );
  assert.equal(
    nearFacePalm(wrist, index, pinky, { x: 0, y: 0, z: 0 }, "left"),
    false,
  );
  assert.equal(
    nearFacePalm(wrist, index, pinky, { x: 0, y: 0, z: 1 }, "right"),
    false,
  );
  assert.equal(
    nearFacePalm(null, index, pinky, { x: 0, y: 0, z: 0 }, "right"),
    false,
  );
  assert.equal(
    nearFacePalm(wrist, index, pinky, { x: 0, y: 0, z: 0 }, "right", {
      x: 0,
      y: 0,
      z: -1,
    }),
    true,
  );
  assert.equal(
    nearFacePalm(wrist, index, pinky, { x: 0, y: 0, z: 0 }, "right", {
      x: 0,
      y: 1,
      z: 0,
    }),
    false,
  );
});
test("only visible menu buttons have targets", () => {
  // Main: 7 rows from y=580, 186 high, every 222.
  assert.equal(menuHit(1000, 673), "resume");
  assert.equal(menuHit(1000, 895), "calendar");
  assert.equal(menuHit(1000, 784), null, "gap between buttons");
  assert.equal(menuHit(200, 673), null, "left margin");
  assert.equal(menuHit(1000, 2005), "exit");
  // Back on More sits exactly where More settings is on the main page.
  assert.equal(menuHit(1000, 1561, "main"), "more");
  assert.equal(menuHit(1000, 1561, "more"), "back");
  assert.equal(menuHit(1000, 673, "more"), "swap");
  assert.equal(menuHit(1000, 1339, "more"), "watch");
  assert.equal(menuHit(1000, 1783, "more"), "practice");
  assert.equal(menuHit(1000, 2005, "more"), null, "More has six items");
});

// ---- Build 006 regressions for "registered but did not turn" ----

test("physical palm anchors survive fingertip occlusion without using a target ray", async () => {
  const { handAnchor } = await import("../gestures.js");
  const p = {
    transform: { position: { x: 0.2, y: -0.2, z: -0.4 } },
    emulatedPosition: false,
  };
  assert.equal(handAnchor({ wrist: p, palmDeclared: true }).kind, "wrist");
  assert.equal(handAnchor({ palm: p, palmDeclared: true }).kind, "palm");
  assert.equal(
    handAnchor({
      wrist: { ...p, emulatedPosition: true },
      index: p,
      thumb: p,
      palmDeclared: true,
    }).position,
    null,
  );
  assert.equal(handAnchor({ index: p, thumb: p }).kind, "tips-compatibility");
  assert.equal(handAnchor({}).position, null);
});
test("native success is not vetoed by missing tips while a physical anchor is tracked", () => {
  const r = rig();
  r.ready();
  r.start();
  r.run(100, { open: false, tipsTracked: false, anchorKind: "wrist" });
  r.release();
  assert.equal(r.events.length, 1);
  assert.equal(r.g.log.at(-1).anchorKind, "wrist");
  assert.equal(r.g.log.at(-1).tipsTracked, false);
});
