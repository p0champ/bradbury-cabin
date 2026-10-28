import test from "node:test";
import assert from "node:assert/strict";
import { bakeAmbience, AMBIENCE_KINDS } from "../ambience.js";
import { gazeZone, GazeDwell, DWELL_MS } from "../gaze.js";
test("ambience loops are generated, bounded and differ by kind", () => {
  assert.deepEqual(AMBIENCE_KINDS, ["off", "rain", "fire", "room"]);
  const loops = {};
  for (const k of ["rain", "fire", "room"]) {
    const a = bakeAmbience(k, 8000);
    assert.ok(a.length > 8000 * 7, k);
    let peak = 0;
    for (const x of a) peak = Math.max(peak, Math.abs(x));
    assert.ok(peak <= 1 + 1e-6 && peak > 0.5, k + " normalised");
    loops[k] = a;
  }
  assert.notDeepEqual(loops.rain.slice(0, 50), loops.room.slice(0, 50));
  // Deterministic: same input, same loop.
  assert.deepEqual(bakeAmbience("rain", 8000).slice(0, 100), loops.rain.slice(0, 100));
});
test("gaze zones are the two bottom corners only", () => {
  assert.equal(gazeZone(1900, 2450), "next");
  assert.equal(gazeZone(100, 2450), "prev");
  assert.equal(gazeZone(1024, 2450), null);
  assert.equal(gazeZone(1900, 1200), null);
  assert.equal(gazeZone(null, 2450), null);
  assert.equal(gazeZone(2100, 2450), null, "off the page");
});
test("gaze turns once per sustained look and re-arms after looking away", () => {
  const g = new GazeDwell();
  let fired = [];
  for (let t = 0; t <= DWELL_MS + 2000; t += 50) {
    const r = g.update("next", t);
    if (r.fire) fired.push(t);
  }
  assert.equal(fired.length, 1, "holding the look turns only once");
  assert.ok(fired[0] >= DWELL_MS);
  g.update(null, 4000);
  for (let t = 4050; t <= 4050 + DWELL_MS + 100; t += 50) if (g.update("prev", t).fire) fired.push(t);
  assert.equal(fired.length, 2, "looking away re-arms");
});
test("a brief glance never turns, and disabled never turns", () => {
  const g = new GazeDwell();
  for (let t = 0; t < DWELL_MS - 100; t += 50) assert.equal(g.update("next", t).fire, null);
  g.update(null, DWELL_MS);
  const off = new GazeDwell();
  for (let t = 0; t < 5000; t += 50) assert.equal(off.update("next", t, false).fire, null);
});
