import test from "node:test";
import assert from "node:assert/strict";
import { GestureEngine, nearFacePalm, menuHit } from "../gestures.js";

const input = (g, key, distance, time, extra = {}) =>
  g.update(key, { distance, time, hand: key, ...extra });
test("short pinches act on release, never on contact or a held frame", () => {
  const g = new GestureEngine();
  input(g, "right", 0.05, 0);
  assert.equal(input(g, "right", 0.015, 20), null);
  assert.equal(input(g, "right", 0.02, 100), null);
  assert.deepEqual(input(g, "right", 0.05, 150), {
    type: "page",
    hand: "right",
  });
  assert.equal(input(g, "right", 0.05, 160), null);
});
test("a hold emits Menu once, suppresses page turning and does not select on release", () => {
  const g = new GestureEngine();
  input(g, "left", 0.05, 0);
  input(g, "left", 0.015, 20);
  assert.equal(input(g, "left", 0.015, 769), null);
  assert.deepEqual(input(g, "left", 0.015, 770), {
    type: "menu",
    hand: "left",
  });
  assert.equal(input(g, "left", 0.015, 1800), null);
  g.setContext("menu");
  assert.equal(input(g, "left", 0.015, 1810, { target: "exit" }), null);
  assert.equal(input(g, "left", 0.05, 1900, { target: "exit" }), null);
});
test("a newly visible closed hand cannot act until it opens", () => {
  const g = new GestureEngine();
  assert.equal(input(g, "right", 0.015, 0), null);
  assert.equal(input(g, "right", 0.015, 2000), null);
  assert.equal(input(g, "right", 0.05, 2200), null);
  input(g, "right", 0.015, 2300);
  assert.equal(input(g, "right", 0.05, 2400)?.type, "page");
});
test("a release that crosses the hold threshold opens the menu, never a page or button", () => {
  for (const context of ["reading", "menu"]) {
    const g = new GestureEngine();
    g.setContext(context);
    input(g, "right", 0.05, 0);
    input(g, "right", 0.015, 20, { target: "exit" });
    assert.equal(input(g, "right", 0.015, 760, { target: "exit" }), null);
    assert.deepEqual(input(g, "right", 0.05, 780, { target: "exit" }), {
      type: "menu",
      hand: "right",
    });
  }
});
test("brief contact and threshold jitter do not produce multiple actions", () => {
  const g = new GestureEngine();
  input(g, "right", 0.05, 0);
  input(g, "right", 0.015, 10);
  assert.equal(input(g, "right", 0.05, 30), null);
  input(g, "right", 0.015, 100);
  assert.equal(input(g, "right", 0.03, 200), null);
  assert.equal(input(g, "right", 0.026, 210), null);
  assert.equal(input(g, "right", 0.05, 220)?.type, "page");
});
test("tracking loss cancels an armed pinch and requires a fresh open-close-open", () => {
  const g = new GestureEngine();
  input(g, "right", 0.05, 0);
  input(g, "right", 0.015, 20);
  input(g, "right", null, 100);
  input(g, "right", 0.015, 900);
  assert.equal(input(g, "right", 0.05, 1000), null);
});
test("the first hand owns a gesture; simultaneous hands cannot fire opposite turns", () => {
  const g = new GestureEngine();
  input(g, "right", 0.05, 0);
  input(g, "left", 0.05, 0);
  input(g, "right", 0.015, 20);
  assert.equal(input(g, "left", 0.015, 21), null);
  assert.equal(input(g, "right", 0.05, 150)?.hand, "right");
  assert.equal(input(g, "left", 0.015, 160), null);
  assert.equal(input(g, "left", 0.05, 250), null);
});
test("menu selection locks its starting target and cancels when released on another", () => {
  const g = new GestureEngine();
  g.setContext("menu");
  input(g, "right", 0.05, 0);
  input(g, "right", 0.015, 20, { target: "night" });
  assert.equal(input(g, "right", 0.05, 150, { target: "exit" }), null);
  input(g, "right", 0.015, 200, { target: "night" });
  assert.deepEqual(input(g, "right", 0.05, 300, { target: "night" }), {
    type: "select",
    hand: "right",
    target: "night",
  });
});
test("an un-targeted menu pinch cannot turn a page or gain a target halfway through", () => {
  const g = new GestureEngine();
  g.setContext("menu");
  input(g, "left", 0.05, 0);
  input(g, "left", 0.015, 20);
  assert.equal(input(g, "left", 0.05, 150, { target: "next" }), null);
});
test("reserved system posture cancels app actions and hold progress", () => {
  const g = new GestureEngine();
  input(g, "right", 0.05, 0);
  input(g, "right", 0.015, 20);
  assert.ok(g.progress(395) > 0.4);
  assert.equal(input(g, "right", 0.015, 800, { systemGesture: true }), null);
  assert.equal(g.progress(900), 0);
  assert.equal(input(g, "right", 0.05, 1000), null);
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
