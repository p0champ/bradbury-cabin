import test from "node:test";
import assert from "node:assert/strict";
import { chooseSnapshot, LOOK_BACK } from "../pointer.js";

// Synthetic traces at 90 Hz; page y in px, gap in mm. Targets are rows 120 px tall.
const row = y => (y >= 900 && y < 1020 ? "A" : y >= 1040 && y < 1160 ? "B" : null);
function trace(n, f, revision = 1) {
  return Array.from({ length: n }, (_, i) => {
    const t = i * 11.1, { y, gap } = f(t, i);
    return { t, hit: { y }, target: row(y), px: { x: 300, y }, gapMm: gap, revision };
  });
}
const end = h => h.at(-1).t;

test("drift during closure returns the aim from before closing", () => {
  const h = trace(40, t => t < 300 ? { y: 1000, gap: 60 } : { y: 1000 + Math.min(1, (t - 300) / 120) * 82, gap: 60 - Math.min(1, (t - 300) / 120) * 45 });
  const r = chooseSnapshot(h, end(h), 1);
  assert.equal(r.reason, "lookback"); assert.equal(r.sample.target, "A");
  assert.ok(r.shiftedMs <= LOOK_BACK.maxMs);
});
test("a steady-gap sweep is never rolled back", () => {
  const h = trace(40, t => ({ y: 900 + t * .7, gap: 55 }));
  const r = chooseSnapshot(h, end(h), 1);
  assert.equal(r.sample, h.at(-1)); assert.equal(r.reason, "no-closure");
});
test("a slow 600 ms pinch looks back at most the bound", () => {
  const h = trace(60, t => ({ y: 1000 + t * .05, gap: 60 - t * .075 }));
  const r = chooseSnapshot(h, end(h), 1);
  assert.ok(end(h) - r.sample.t <= LOOK_BACK.maxMs + 1e-9);
});
test("a dip beyond the bound uses the press-time aim", () => {
  const h = trace(40, t => t < 300 ? { y: 950, gap: 60 } : { y: 950 + Math.min(1, (t - 300) / 120) * 130, gap: 60 - Math.min(1, (t - 300) / 120) * 45 });
  const r = chooseSnapshot(h, end(h), 1);
  assert.equal(r.reason, "too-far"); assert.equal(r.sample, h.at(-1));
});
test("samples from another screen are never chosen", () => {
  const h = trace(40, t => t < 300 ? { y: 1000, gap: 60 } : { y: 1080, gap: 60 - Math.min(1, (t - 300) / 120) * 45 });
  for (const s of h) if (s.t < 400) s.revision = 0;
  const r = chooseSnapshot(h, end(h), 1);
  assert.equal(r.sample.revision, 1);
  assert.equal(chooseSnapshot(h, end(h), 2).sample, null);
});
test("untracked tips (no gap) use the press-time aim", () => {
  const h = trace(40, t => ({ y: 1000 + t * .2, gap: null }));
  assert.equal(chooseSnapshot(h, end(h), 1).reason, "no-gap");
});
test("±3 mm tracking jitter is not mistaken for a closing pinch", () => {
  const h = trace(40, (t, i) => ({ y: 1000 + i * 2, gap: 40 + (i % 2 ? 3 : -3) }));
  const r = chooseSnapshot(h, end(h), 1);
  assert.equal(r.sample, h.at(-1));
});
test("an empty gap row steps forward to the first aimed sample", () => {
  const h = trace(40, t => t < 300 ? { y: 1030, gap: 60 } : { y: 1030 + Math.min(1, (t - 300) / 120) * 60, gap: 60 - Math.min(1, (t - 300) / 120) * 45 });
  const r = chooseSnapshot(h, end(h), 1);
  assert.ok(r.sample.target, "chose a sample without a target while a later one had one");
});
test("events before any sample have no history", () => {
  assert.equal(chooseSnapshot([], 100, 1).sample, null);
});
