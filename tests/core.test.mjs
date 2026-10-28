import test from "node:test";
import assert from "node:assert/strict";
import { placedPose } from "../core.js";
import { identity, multiply } from "../gl.js";
test("placement follows the initial view including lying on the back", () => {
  assert.deepEqual(placedPose(identity).position, { x: 0, y: 0, z: -1.1 });
  const lying = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0.7, 0, 1];
  assert.deepEqual(placedPose(lying).position, { x: 0, y: 1.8, z: 0 });
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
test("sampler excerpts are verbatim from the critic-accepted shelf editions", async () => {
  const { poem, poemIndents, opening, continuation } = await import("../core.js");
  const { LIBRARY } = await import("../library.js");
  const rose = LIBRARY.find((w) => w.id === "blake-sick-rose");
  const stanzas = [];
  let current = [];
  poem.forEach((text, i) => {
    if (text) current.push({ text, indent: poemIndents[i] });
    else { stanzas.push(current); current = []; }
  });
  stanzas.push(current);
  assert.deepEqual(stanzas, rose.blocks.map((b) => b.lines));
  const magi = LIBRARY.find((w) => w.id === "ohenry-magi").blocks.map((b) => b.text);
  assert.ok(magi.includes(opening), "opening is a whole paragraph of the edition");
  assert.ok(magi.includes(continuation), "continuation is a whole paragraph of the edition");
});
