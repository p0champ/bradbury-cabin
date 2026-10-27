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
test("a release bounce restarts settling but turns exactly once", () => {
  const r = rig();
  r.open();
  r.close();
  r.frame({ right: 0.05 });
  r.frame({ right: 0.028 });
  assert.equal(r.events.length, 0);
  r.release();
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("re-pinching after the hand has opened cancels instead of turning", () => {
  const r = rig();
  r.open();
  r.close();
  r.frame({ right: 0.05 });
  r.close("right", 200);
  r.release();
  assert.deepEqual(r.events, []);
  assert.ok(r.g.log.some((e) => e.reason === "re-pinched"));
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
  assert.ok(r.g.holdCharge(r.time) > 0.45 && r.g.holdCharge(r.time) < 0.55);
  const shown = r.g.progress(r.time);
  assert.ok(shown > 0.3 && shown < 0.4, "ring starts late but still fills");
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

// ---- Build 006 regressions for "registered but did not turn" ----
import { RING_DELAY_MS, OPEN_DISTANCE } from "../gestures.js";
function trace(keys, { hz = 72, noise = 0, seed = 1, hand = "right", g = new GestureEngine() } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647), s / 2147483647 - 0.5);
  const events = [], end = keys.at(-1)[0];
  let ringSeen = false;
  for (let t = 0; t <= end; t += 1000 / hz) {
    let i = keys.findIndex((k) => k[0] >= t);
    if (i <= 0) i = 1;
    const [t0, d0] = keys[i - 1], [t1, d1] = keys[i];
    const d = d0 + (d1 - d0) * Math.min(1, (t - t0) / (t1 - t0 || 1));
    const e = g.update(hand, { distance: Math.max(0, d + noise * rnd() * 2) / 1000, time: t, hand });
    if (g.progress(t) > 0) ringSeen = true;
    if (e) events.push(e.type);
  }
  return { events, ringSeen, g };
}
const tap = (contact, open) => [[0, open], [300, open], [380, contact], [650, contact], [750, open], [1500, open]];
test("a relaxed hand resting at 34 mm can still arm and release", () => {
  assert.ok(OPEN_DISTANCE < 0.034);
  assert.deepEqual(trace(tap(12, 34)).events, ["page"]);
});
test("Quest-like tracking noise does not silently cancel deliberate pinches", () => {
  for (const [contact, open, noise] of [[12, 45, 5], [16, 40, 4], [14, 60, 5]]) {
    let ok = 0;
    for (let seed = 1; seed <= 200; seed++)
      if (trace(tap(contact, open), { noise, seed: seed * 977 }).events.join() === "page") ok++;
    // 16 mm ±4 mm is a borderline-firm pinch; ~4% may need a second try.
    assert.ok(ok >= (contact === 16 ? 188 : 196), `${contact}/${open}/±${noise}: ${ok}/200 turned`);
  }
});
test("noise never produces double turns or a menu from a quarter-second pinch", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const { events } = trace(tap(14, 45), { noise: 6, seed: seed * 131 });
    assert.ok(events.length <= 1 && !events.includes("menu"), events.join());
  }
});
test("casual near-pinches with noise still never act", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const keys = [[0, 45], [300, 45], [380, 25], [1600, 25], [1700, 45], [2200, 45]];
    assert.deepEqual(trace(keys, { noise: 2, seed }).events, []);
  }
});
test("short pinches never show the hold ring; holds show it after the delay", () => {
  assert.equal(trace(tap(12, 50)).ringSeen, false);
  const g = new GestureEngine();
  trace([[0, 50], [300, 50], [310, 12], [310 + RING_DELAY_MS - 30, 12]], { g });
  assert.equal(g.progress(310 + RING_DELAY_MS - 30), 0);
  assert.ok(g.holdCharge(310 + RING_DELAY_MS - 30) > 0);
});
test("a brief wobble keeps the pinch but restarts hold charge", () => {
  const r = rig();
  r.open();
  r.close("right", 1000);
  r.frame({ right: 0.028 }, 40);
  r.close("right", 600);
  assert.equal(r.events.length, 0, "hold restarted, so no menu yet");
  r.release();
  assert.deepEqual(r.events, [{ type: "page", hand: "right" }]);
});
test("every firm pinch ends in a logged outcome with a reason", () => {
  const r = rig();
  r.open();
  r.close("right", 120);
  r.release();
  assert.equal(r.g.log.at(-1).reason, "too-short");
  r.open();
  r.close();
  r.release();
  assert.equal(r.g.log.at(-1).result, "page");
  r.close("right", 200);
  assert.equal(r.g.ignored.at(-1).reason, "hand-not-open-first");
  r.release();
  r.open();
  r.close("right", 400);
  r.frame({ right: null });
  assert.equal(r.g.log.at(-1).reason, "tracking-lost");
});
test("a near-pinch that never gets firm is logged with its closest distance", () => {
  const r = rig();
  r.open();
  r.run({ right: 0.021 }, 300);
  r.release();
  const last = r.g.ignored.at(-1);
  assert.equal(last.reason, "not-firm-enough");
  assert.equal(last.minMm, 21);
  assert.deepEqual(r.events, []);
});

// ---- Build 006 review round 1 regressions ----
const brush = (level) => [[0, 45], [300, 45], [380, level], [880, level], [980, 45], [1500, 45]];
test("noisy resting near-pinches (20-22 mm) do not latch into turns", () => {
  for (const [level, noise, allowed] of [[21, 4, 0], [22, 5, 0], [20, 3, 4]]) {
    let acted = 0;
    for (let seed = 1; seed <= 200; seed++)
      if (trace(brush(level), { noise, seed: seed * 977 }).events.length) acted++;
    assert.ok(acted <= allowed, `${level} mm ±${noise}: ${acted}/200 acted`);
  }
});
test("noisy releases to a 33-35 mm resting gap still turn", () => {
  for (const rest of [33, 34, 35]) {
    let ok = 0;
    for (let seed = 1; seed <= 200; seed++)
      if (trace(tap(12, rest), { noise: 3, seed: seed * 977 }).events.join() === "page") ok++;
    assert.ok(ok >= 196, `rest ${rest} mm: ${ok}/200`);
  }
});
test("a pinch begun during cooldown never starts later; the hand must reopen", () => {
  const g = new GestureEngine();
  const keys = [[0, 50], [300, 50], [380, 12], [650, 12], [700, 50], [900, 50], [950, 12], [2000, 12], [2100, 50], [2600, 50]];
  const { events } = trace(keys, { g });
  assert.deepEqual(events, ["page"]);
  assert.equal(g.ignored.at(-1)?.reason, "cooldown");
});
test("lingering half-pinched after a firm pinch cancels instead of acting", () => {
  for (const [level, noise] of [[25, 0], [25, 2], [26, 2], [24, 2], [22, 2]]) {
    for (let seed = 1; seed <= 100; seed++) {
      const g = new GestureEngine();
      const keys = [[0, 50], [300, 50], [380, 12], [650, 12], [700, level], [3000, level], [3100, 50], [3600, 50]];
      assert.deepEqual(trace(keys, { noise, seed: seed * 31, g }).events, [], `${level}±${noise}`);
    }
  }
});
test("a menu hold logs one menu entry and no spurious cancellation", () => {
  const r = rig();
  r.open();
  r.close("right", 1500);
  r.g.setContext("menu");
  r.release();
  assert.deepEqual(r.g.log.map((e) => e.result), ["menu"]);
  assert.equal(r.g.lastEntry.result, "menu");
});
