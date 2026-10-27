import test from "node:test";
import assert from "node:assert/strict";
import { PinchGate, placedPose, controlAt } from "../core.js";
import { identity, multiply } from "../gl.js";
test("a pinch fires once, requires an opening, and disarms on tracking loss", () => {
  const g = new PinchGate();
  assert.equal(g.update(0.02), false);
  assert.equal(g.update(0.05), false);
  assert.equal(g.update(0.02), true);
  assert.equal(g.update(0.02), false);
  assert.equal(g.update(0.03), false);
  assert.equal(g.update(0.05), false);
  assert.equal(g.update(0.02), true);
  g.update(null);
  assert.equal(g.update(0.02), false);
});
test("placement follows the initial view including lying on the back", () => {
  assert.deepEqual(placedPose(identity).position, { x: 0, y: 0, z: -1.1 });
  const lying = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0.7, 0, 1];
  assert.deepEqual(placedPose(lying).position, { x: 0, y: 1.8, z: 0 });
});
test("controls use canvas coordinates and outside pinches fall through", () => {
  assert.equal(controlAt(150, 2280), "prev");
  assert.equal(controlAt(650, 2280), "next");
  assert.equal(controlAt(300, 1200), null);
});
test("column-major matrix composition preserves translation and scale", () => {
  const t = new Float32Array(identity);
  t[12] = 2;
  t[13] = 3;
  t[14] = -1;
  const s = new Float32Array(identity);
  s[0] = 0.36;
  s[5] = 0.45;
  const m = multiply(t, s);
  assert.equal(m[12], 2);
  assert.equal(m[13], 3);
  assert.equal(m[14], -1);
  assert.ok(Math.abs(m[0] - 0.36) < 1e-6);
});
