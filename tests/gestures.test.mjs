import test from "node:test";
import assert from "node:assert/strict";
import {
  GestureEngine,
  nearFacePalm,
  menuHit,
  HOLD_MS,
  MIN_PINCH_MS,
} from "../gestures.js";
function rig() {
  const g = new GestureEngine();
  let time = 0;
  const events = [];
  const frame = (samples, ms = 40) => {
    time += ms;
    for (const [hand, value] of Object.entries(samples)) {
      const data =
        typeof value === "number" || value === null
          ? { distance: value }
          : value;
      const event = g.update(hand, { time, hand, ...data });
      if (event) events.push(event);
    }
    return events.at(-1);
  };
  const run = (samples, ms) => {
    while (ms > 0) {
      const step = Math.min(40, ms);
      frame(samples, step);
      ms -= step;
    }
  };
  return {
    g,
    events,
    frame,
    run,
    get time() {
      return time;
    },
    open(hand = "right") {
      run({ [hand]: 0.05 }, 200);
    },
    close(hand = "right", ms = 240) {
      run({ [hand]: 0.012 }, ms);
    },
    release(hand = "right") {
      run({ [hand]: 0.05 }, 140);
    },
  };
}
test("a casual 25mm near-pinch never registers, even when held", () => {
  const r = rig();
  r.open();
  r.run({ right: 0.025 }, 1800);
  r.release();
  assert.deepEqual(r.events, []);
});
test("firm pinch acts only after a settled release, never on contact", () => {
  const r = rig();
  r.open();
  r.close();
  assert.equal(r.events.length, 0);
  r.frame({ right: 0.05 });
  r.frame({ right: 0.05 });
  assert.equal(r.events.length, 0);
  r.run({ right: 0.05 }, 100);
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("brief contact is ignored instead of turning a page", () => {
  const r = rig();
  r.open();
  r.close("right", 80);
  r.release();
  assert.deepEqual(r.events, []);
});
test("half-open bounce interrupts release settling and cancels the action", () => {
  const r = rig();
  r.open();
  r.close();
  r.frame({ right: 0.05 });
  r.frame({ right: 0.028 });
  r.release();
  assert.deepEqual(r.events, []);
});
test("half-open separation before full release cannot cross the hold threshold", () => {
  const r = rig();
  r.open();
  r.close("right", 1360);
  r.frame({ right: 0.028 });
  r.release();
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("a natural gradual release still turns once after firm contact", () => {
  const r = rig();
  r.open();
  r.close();
  for (const distance of [0.02, 0.026, 0.032, 0.04, 0.05, 0.05, 0.05])
    r.frame({ right: distance });
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("gradual release can select a menu target without adding hold time", () => {
  const r = rig();
  r.g.setContext("menu");
  r.open();
  r.run({ right: { distance: 0.012, target: "night" } }, 240);
  for (const distance of [0.02, 0.026, 0.032, 0.04, 0.05, 0.05, 0.05])
    r.frame({ right: { distance, target: "night" } });
  assert.deepEqual(r.events, [
    { type: "select", target: "night", hand: "right" },
  ]);
});
test("one frame of open noise cannot release or recharge a pinch", () => {
  const r = rig();
  r.open();
  r.close();
  r.frame({ right: 0.05 });
  r.run({ right: 0.012 }, 1600);
  r.release();
  assert.deepEqual(r.events, []);
});
test("a cooldown rejects rapid repeats and then allows a fresh deliberate pinch", () => {
  const r = rig();
  r.open();
  r.close();
  r.release();
  assert.equal(r.events.length, 1);
  r.open();
  r.close();
  r.release();
  assert.equal(r.events.length, 1);
  r.open();
  r.close();
  r.release();
  assert.equal(r.events.length, 2);
});
test("a sustained hold fills over 1.4 seconds and fires Menu once", () => {
  const r = rig();
  r.open();
  r.close("right", 720);
  assert.equal(r.events.length, 0);
  assert.ok(r.g.progress(r.time) > 0.45 && r.g.progress(r.time) < 0.55);
  r.close("right", 760);
  assert.deepEqual(r.events, [{ type: "menu", hand: "right" }]);
  r.close("right", 800);
  r.release();
  assert.equal(r.events.length, 1);
});
test("a threshold-crossing release is a hold in reading and menu contexts", () => {
  for (const context of ["reading", "menu"]) {
    const r = rig();
    r.g.setContext(context);
    r.open();
    r.frame({ right: { distance: 0.012, target: "exit" } });
    r.run({ right: { distance: 0.012, target: "exit" } }, HOLD_MS - 20);
    r.run({ right: { distance: 0.05, target: "exit" } }, 160);
    assert.deepEqual(r.events, [{ type: "menu", hand: "right" }]);
  }
});
test("release settling never stretches an under-threshold pinch into a menu hold", () => {
  const r = rig();
  r.open();
  r.frame({ right: 0.012 });
  r.run({ right: 0.012 }, HOLD_MS - 80);
  r.release();
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("a loosened partial pinch cancels instead of charging a hidden hold", () => {
  const r = rig();
  r.open();
  r.close("right", 600);
  r.run({ right: 0.028 }, 180);
  assert.equal(r.g.progress(r.time), 0);
  r.close("right", 1400);
  r.release();
  assert.deepEqual(r.events, []);
});
test("newly seen or reacquired pinched hands must settle open before acting", () => {
  const r = rig();
  r.close("right", 1600);
  r.release();
  assert.equal(r.events.length, 0);
  r.open();
  r.close();
  r.frame({ right: null });
  r.close("right", 1600);
  r.release();
  assert.equal(r.events.length, 0);
});
test("a tracking sample gap cannot be counted as a hold", () => {
  const r = rig();
  r.open();
  r.close();
  r.frame({ right: 0.012 }, 600);
  r.close("right", 1600);
  r.release();
  assert.deepEqual(r.events, []);
});
test("simultaneous hands have one gesture owner and cannot fire opposite turns", () => {
  const r = rig();
  r.run({ right: 0.05, left: 0.05 }, 200);
  r.run({ right: 0.012, left: 0.012 }, 240);
  r.run({ right: 0.05, left: 0.012 }, 140);
  r.run({ left: 0.05 }, 140);
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("menu selection requires the same starting and release target", () => {
  const r = rig();
  r.g.setContext("menu");
  r.open();
  r.run({ right: { distance: 0.012, target: "night" } }, 240);
  r.run({ right: { distance: 0.05, target: "exit" } }, 140);
  assert.deepEqual(r.events, []);
  r.open();
  r.run({ right: { distance: 0.012, target: "night" } }, 240);
  r.run({ right: { distance: 0.05, target: "night" } }, 140);
  assert.deepEqual(r.events, [
    { type: "select", target: "night", hand: "right" },
  ]);
});
test("opening the menu consumes the hold release even over Exit", () => {
  const r = rig();
  r.open();
  r.close("right", 1500);
  r.g.setContext("menu");
  r.run({ right: { distance: 0.05, target: "exit" } }, 160);
  assert.deepEqual(r.events, [{ type: "menu", hand: "right" }]);
});
test("system gestures cancel app actions and the hand progress ring", () => {
  const r = rig();
  r.open();
  r.close("right", 600);
  r.frame({ right: { distance: 0.012, systemGesture: true } });
  assert.equal(r.g.progress(r.time), 0);
  r.release();
  assert.deepEqual(r.events, []);
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
  assert.equal(menuHit(200, 700), "resume");
  assert.equal(menuHit(1100, 700), "recenter");
  assert.equal(menuHit(1000, 600), null);
});
