import test from "node:test";
import assert from "node:assert/strict";
import { bakeAmbience, AMBIENCE_KINDS, AMBIENCE_LEVEL } from "../ambience.js";
import { gazeZone, GazeDwell, DWELL_MS } from "../gaze.js";
import { Ambience, ambienceVolume } from "../ambience.js";
import { NAV } from "../theme.js";

test("navigation secondary labels retain normal-text contrast on idle and hovered surfaces", () => {
  const luminance = hex => {
    const v = hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255)
      .map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
    return v[0]*.2126+v[1]*.7152+v[2]*.0722;
  };
  for(const bg of [NAV.bg,NAV.card,NAV.hover]) {
    const a=luminance(NAV.muted),b=luminance(bg);
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5, `secondary text on ${bg}`);
  }
});

function audioContext() {
  const calls = [];
  const param = { setValueAtTime: (...a) => calls.push(["set", ...a]),
    linearRampToValueAtTime: (...a) => calls.push(["ramp", ...a]),
    cancelScheduledValues: (...a) => calls.push(["cancel", ...a]) };
  const context = { currentTime: 0, destination: {}, state: "running",
    createBuffer: () => ({ copyToChannel() {} }),
    createGain: () => ({ gain: param, connect() {}, disconnect() {} }),
    createBufferSource: () => ({ context, connect() {}, disconnect() {}, start() {}, stop() {} }) };
  return { context, calls };
}
test("volume restores a safe default and bounds valid numbers", () => {
  for (const v of [undefined, null, false, "0.5", NaN, Infinity, {}]) assert.equal(ambienceVolume(v), 1);
  assert.equal(ambienceVolume(-1), 0); assert.equal(ambienceVolume(3), 1);
  assert.equal(ambienceVolume(0.37), 0.37);
});
test("all sounds start at remembered volume, and adjustments ramp without replacing their source", () => {
  for (const kind of ["rain", "fire", "room"]) {
    const {context,calls} = audioContext(), a = new Ambience(0.5);
    a.kind = kind; a.start(context,kind);
    assert.deepEqual(calls.at(-1), ["ramp", 0.5, 2]);
    const source = a.source;
    context.currentTime = 1;
    a.setVolume(context,0.75);
    assert.equal(a.source,source);
    assert.deepEqual(calls.slice(-3), [["cancel",1],["set",0.25,1],["ramp",0.75,1.18]]);
    context.currentTime = 1.09;
    a.setVolume(context,0);
    assert.ok(Math.abs(calls.at(-2)[1] - 0.5) < 1e-10, "second adjustment starts at interpolated gain, not old target");
    assert.equal(calls.at(-1)[1],0);
    assert.equal(a.status().targetGain,0);
    assert.equal(a.status().playing,true);
    a.setVolume(context,1);
    assert.equal(a.source,source);
    assert.equal(a.status().targetGain,1);
  }
});
test("pending sound starts use the latest volume, and stopped sounds stay stopped", async () => {
  const {context,calls} = audioContext(), a = new Ambience();
  a.set(context,"rain"); a.setVolume(context,0.25);
  await new Promise(r => setTimeout(r,10));
  assert.deepEqual(calls.at(-1),["ramp",0.25,2]);
  a.stop(context);
  a.setVolume(context,0.75);
  assert.equal(a.source,null);
  assert.equal(a.status().volume,0.75);
});
test("native cancel-and-hold still anchors a new ramp at the actual current level", () => {
  const {context,calls} = audioContext(), a = new Ambience();
  a.kind="rain"; a.start(context,"rain");
  a.gain.gain.cancelAndHoldAtTime = t => calls.push(["hold",t]);
  context.currentTime=2.5; a.setVolume(context,0.25);
  assert.deepEqual(calls.slice(-3),[["hold",2.5],["set",1,2.5],["ramp",0.25,2.68]]);
});
test("ambience loops are generated, bounded and differ by kind", () => {
  assert.deepEqual(AMBIENCE_KINDS, ["off", "rain", "fire", "room"]);
  const loops = {};
  for (const k of ["rain", "fire", "room"]) {
    const a = bakeAmbience(k, 8000);
    assert.ok(a.length > 8000 * 7, k);
    let peak = 0;
    for (const x of a) peak = Math.max(peak, Math.abs(x));
    assert.ok(peak <= 0.9 + 1e-6 && peak > 0.2, k + " bounded");
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

test("a hand action or a pause ends the current look; looking away re-arms", () => {
  const g = new GazeDwell();
  for (let t = 0; t < 1000; t += 50) g.update("next", t);
  g.consume(); // a pinch turned the page at 1.0 s
  for (let t = 1000; t < 4000; t += 50) assert.equal(g.update("next", t).fire, null, "no second turn");
  g.update(null, 4000);
  let fired = 0;
  for (let t = 4050; t < 4050 + DWELL_MS + 100; t += 50) if (g.update("next", t).fire) fired++;
  assert.equal(fired, 1);
  // Pausing (menu, attention) while looking never re-arms by itself.
  const h = new GazeDwell();
  h.update("next", 0);
  h.update("next", 500, false);
  for (let t = 550; t < 3000; t += 50) assert.equal(h.update("next", t).fire, null);
});

test("after a hand action, looking at the middle of the page re-arms", () => {
  const g = new GazeDwell();
  g.update(null, 0);
  g.consume();
  g.update(null, 50);
  let fired = 0;
  for (let t = 100; t < 100 + DWELL_MS + 100; t += 50) if (g.update("next", t).fire) fired++;
  assert.equal(fired, 1);
});

test("each background sound is audible on small speakers (energy above 200 Hz) without clipping", async () => {
  const { highPass } = await import("../ambience.js");
  for (const k of ["rain", "fire", "room"]) {
    const a = bakeAmbience(k, 22050);
    let s = 0;
    for (const x of highPass(a, 22050)) s += x * x;
    const db = 20 * Math.log10(Math.sqrt(s / a.length) * AMBIENCE_LEVEL[k]);
    assert.ok(db > -28 && db < -18, `${k}: ${db.toFixed(1)} dBFS above 200 Hz`);
    let peak = 0;
    for (const x of a) peak = Math.max(peak, Math.abs(x));
    assert.ok(peak * AMBIENCE_LEVEL[k] <= 0.9, `${k} peak ${peak}`);
  }
});
