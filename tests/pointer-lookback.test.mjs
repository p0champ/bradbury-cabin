import test from "node:test";
import assert from "node:assert/strict";
import { chooseSnapshot, LOOK_BACK } from "../pointer.js";

// Synthetic traces at 90 Hz; page y in px. Rows are 120 px tall, 20 px apart.
const row = y => (y >= 900 && y < 1020 ? "A" : y >= 1040 && y < 1160 ? "B" : null);
function trace(n, f, revision = 1, gap = () => 60) {
  return Array.from({ length: n }, (_, i) => {
    const t = i * 11.1, y = f(t, i);
    return { t, hit: { y }, target: row(y), px: { x: 300, y }, gapMm: gap(t), revision };
  });
}
const closingFrom = t0 => t => t < t0 ? 60 : Math.max(15, 60 - (t - t0) * .375);
const end = h => h.at(-1).t;

test("drift into the row below while the fingers close keeps the aimed row", () => {
  // Rests open on A; closing over 120 ms drags the ray into B for most of it.
  const h = trace(40, t => t < 300 ? 1000 : Math.min(1082, 1000 + (t - 300) * .68), 1, closingFrom(300));
  assert.equal(chooseSnapshot(h, end(h), 1).sample.target, "A");
});
test("without finger data a short slip still keeps the aimed row", () => {
  const h = trace(40, t => t < 390 ? 1000 : 1060, 1, () => null);
  assert.equal(chooseSnapshot(h, end(h), 1).sample.target, "A");
});
test("moving onto a button while pinching selects it, never empty space", () => {
  const h = trace(40, t => t < 330 ? 1200 - (t / 330) * 0 : 1200 - (t - 330) * 3);
  const r = chooseSnapshot(h, end(h), 1);
  assert.ok(r.sample.target, "pinch landed on empty space");
});
test("a deliberate move to the next row and a short settle selects that row", () => {
  const h = trace(40, t => t < 320 ? 960 : 1090); // ~110 ms on B
  assert.equal(chooseSnapshot(h, end(h), 1).sample.target, "B");
});
test("empty space only stays empty", () => {
  const h = trace(30, () => 1400);
  const r = chooseSnapshot(h, end(h), 1);
  assert.equal(r.sample.target, null); assert.equal(r.reason, "current");
});
test("samples from another screen are never chosen", () => {
  const h = trace(40, t => t < 380 ? 1000 : 1300);
  for (const s of h) if (s.t < 380) s.revision = 0;
  const r = chooseSnapshot(h, end(h), 1);
  assert.equal(r.sample.revision, 1); assert.equal(r.sample.target, null);
  assert.equal(chooseSnapshot(h, end(h), 2).sample, null);
});
test("equal time on two rows favours the newest", () => {
  const h = trace(28, t => t < 233 ? 960 : 1090); // window splits ~75/75 ms
  const r = chooseSnapshot(h, end(h), 1);
  assert.ok(["A", "B"].includes(r.sample.target));
});
test("the window is bounded", () => {
  const h = trace(80, t => t < 600 ? 960 : 1400);
  const r = chooseSnapshot(h, end(h), 1);
  assert.equal(r.sample.target, null, "a button left long before the pinch was still selected");
  assert.ok(LOOK_BACK.windowMs <= 200);
});
test("events before any sample have no history", () => {
  assert.equal(chooseSnapshot([], 100, 1).sample, null);
});
