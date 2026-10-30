import test from "node:test";
import assert from "node:assert/strict";
import { ARRIVAL_MS, ARRIVAL_REDUCED_MS, ARRIVAL_SKIP_AFTER_MS, LAMP_RISE_PX, lampFrame } from "../arrival.js";

test("lamp on: glow first, then header in place, then readings a beat apart", () => {
  const glow = lampFrame(900), header = lampFrame(2500), rows = lampFrame(3250);
  assert.ok(glow.glow > .4 && glow.header === 0 && glow.rows.every(r => r.alpha === 0));
  assert.ok(header.header > .5 && header.rows[0].alpha === 0);
  assert.ok(rows.rows[0].alpha > 0 && rows.rows[1].alpha < rows.rows[0].alpha && rows.rows[2].alpha === 0);
});

test("lamp on: the glow rises gently, peaks softly and settles before the words", () => {
  const samples = Array.from({ length: 60 }, (_, i) => lampFrame(i * 50).glow);
  const peak = Math.max(...samples);
  assert.ok(peak <= .55 + 1e-9 && peak > .5, "no bright flash");
  for (let i = 1; i < 22; i++) assert.ok(samples[i] >= samples[i - 1] - 1e-9, "rises without dipping");
  assert.equal(lampFrame(2600).glow, 0);
  assert.equal(lampFrame(0).opacity, 0);
});

test("lamp on: the header never moves; readings rise about 1 cm and land exactly", () => {
  const start = lampFrame(2700).rows[0], end = lampFrame(ARRIVAL_MS);
  assert.equal(start.lift, LAMP_RISE_PX);
  assert.ok(end.rows.every(r => r.alpha === 1 && r.lift === 0));
  assert.equal(end.header, 1);
  assert.equal(end.footer, 1);
  assert.equal(end.glow, 0);
  assert.equal(end.opacity, 1);
});

test("lamp on: about five seconds, a short reduced-motion fade, and a skip guard", () => {
  assert.ok(ARRIVAL_MS >= 5000 && ARRIVAL_MS <= 8000);
  assert.equal(ARRIVAL_REDUCED_MS, 300);
  assert.ok(ARRIVAL_SKIP_AFTER_MS > 0 && ARRIVAL_SKIP_AFTER_MS < 1000);
  const settled = Array.from({ length: 3 }, (_, i) => lampFrame(4400 + i * 300));
  assert.ok(settled.at(-1).footer === 1, "everything is in place before the arrival ends");
});
