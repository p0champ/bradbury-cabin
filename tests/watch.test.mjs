import test from "node:test";
import assert from "node:assert/strict";
import { watchPose, watchMeasure, watchPosition, watchSummary, WATCH_HAND, WristWatch, titleOnly } from "../watch.js";
import { seedProgress, toggleTick } from "../progress.js";
// Viewer at the origin looking down -z; +x is the viewer's right.
const viewer = { x: 0, y: 0, z: 0 },
  forward = { x: 0, y: 0, z: -1 },
  right = { x: 1, y: 0, z: 0 };
const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const crossv = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
// A real right hand: with fingers along f and the palm facing p, the thumb
// side is f × p (palm-down on a table: fingers -z, palm -y → thumb at -x).
function rightHand(wrist, f, p) {
  const t = crossv(f, p);
  return {
    wrist,
    index: add(add(wrist, f, 0.07), t, 0.02),
    pinky: add(add(wrist, f, 0.06), t, -0.02),
    middle: add(wrist, f, 0.08),
  };
}
test("anatomy check: palm-down right hand has its thumb to the left", () => {
  const h = rightHand({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: -1, z: 0 });
  assert.ok(h.index.x < h.pinky.x, "index (thumb side) is on the left");
});
const W = { x: 0, y: -0.03, z: -0.3 };
// Checking a watch: right forearm raised across the body, fingers toward the
// user's left, back of the hand toward the eyes (palm facing away).
const watching = rightHand(W, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
const pose = (h, extra = {}) => watchPose({ ...h, viewer, forward, right, hand: "right", ...extra });
test("the watch is locked to the right wrist", () => assert.equal(WATCH_HAND, "right"));
test("right wrist in the watch-checking pose shows it", () => {
  assert.equal(pose(watching), true);
});
test("the same pose with the palm toward the eyes does not", () => {
  assert.equal(pose(rightHand(W, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })), false);
});
test("the left hand never shows it, even in the exact watch geometry", () => {
  assert.equal(pose(watching, { hand: "left" }), false);
  assert.equal(pose(watching, { hand: "none" }), false);
});
test("ordinary page-turn postures do not show it", () => {
  const H = { x: 0.08, y: -0.12, z: -0.4 };
  // Raised, fingers forward, palm down (back of hand up).
  assert.equal(pose(rightHand(H, { x: 0, y: 0, z: -1 }, { x: 0, y: -1, z: 0 })), false);
  // Pinching in front, fingers up, palm away from the eyes.
  assert.equal(pose(rightHand(H, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 })), false);
  // Fingers pointing forward, palm away.
  assert.equal(pose(rightHand(W, { x: 0, y: 0.3, z: -1 }, { x: 0, y: 0, z: -1 })), false);
});
test("not looking at the wrist, or too far away, does not show it", () => {
  assert.equal(pose(watching, { forward: { x: 0.7, y: 0, z: -0.7 } }), false);
  const far = rightHand({ x: 0, y: -0.03, z: -0.8 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  assert.equal(pose(far), false);
});
test("the face floats toward the eyes and up the forearm", () => {
  const p = watchPosition({ wrist: W, middle: watching.middle, viewer });
  assert.ok(p.z > W.z, "toward the viewer");
  assert.ok(p.x > W.x, "toward the elbow, away from the fingers");
});
function fixture({ preload = true } = {}) {
  globalThis.XRRigidTransform ??= class { constructor(p, q) { this.position = p; this.orientation = q; } };
  const paint = { count: 0, labels: [], uploads: 0 };
  globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, {
    get: (t, k) => k in t ? t[k]
      : k === "clearRect" ? () => paint.count++
      : k === "createLinearGradient" ? () => ({ addColorStop() {} })
      : k === "fillText" ? (label) => paint.labels.push(label)
      : () => {},
    set: (t, k, v) => ((t[k] = v), true),
  }) }) };
  const layer = { opacity: 0, destroy() {} };
  const w = new WristWatch({ createQuadLayer: () => layer, getSubImage() {} }, {});
  const viewerT = { position: viewer, orientation: { x: 0, y: 0, z: 0, w: 1 }, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  const summary = watchSummary(seedProgress("2026-10-28"), "2026-10-28");
  const s = { hand: "right", ...watching };
  const step = (time, sample = s, nextSummary = summary) => w.update(sample, viewerT, { time, summary: nextSummary });
  const draw = () => w.draw({}, { copyPage() { paint.uploads++; } }, [layer]);
  w.prepare(summary);
  if (preload) draw();
  return { w, s, summary, layer, paint, step, draw, viewerT };
}

test("glance preloads once, paints only date and dots, and ignores nonvisual summary changes", () => {
  const { w, layer, summary, paint, step, draw } = fixture();
  assert.deepEqual(paint.labels, ["Wednesday", "28"]);
  assert.equal(layer.opacity, 0);
  assert.deepEqual(w.pendingPreloads(), []);
  w.prepare(summary);
  step(0);
  step(20, undefined, { ...summary, streak: 100, weekly: "unrelated" });
  draw();
  assert.equal(paint.count, 1);
  assert.equal(paint.uploads, 1);
  step(40, undefined, { ...summary, ticks: [true, false, false] });
  draw();
  assert.equal(paint.count, 2);
  assert.equal(paint.uploads, 2);
});

test("glance requires 300ms intentional posture, fades in, and locks only the right hand through departure", () => {
  const { w, step, layer } = fixture();
  for (let t = 0; t <= 280; t += 20) step(t);
  assert.equal(w.visible.length, 0);
  step(300);
  assert.equal(w.shown, true);
  assert.ok(layer.opacity > 0 && layer.opacity < 1);
  for (let t = 320; t <= 440; t += 20) step(t);
  assert.equal(layer.opacity, 1);
  assert.equal(w.showingFor("right"), true);
  assert.equal(w.showingFor("left"), false);
  step(460, null);
  step(560, null);
  assert.equal(w.shown, true, "short posture loss has grace");
  step(580, null);
  assert.equal(w.shown, false);
  assert.equal(w.showingFor("right"), true, "still locked while fading");
  for (let t = 600; t <= 740; t += 20) step(t, null);
  assert.equal(w.visible.length, 0);
  assert.equal(w.showingFor("right"), false);
});

test("lost tracking holds the last pose, fades safely, and permits a later glance", () => {
  const { w, s, step, layer } = fixture();
  for (let t = 0; t <= 440; t += 20) step(t);
  const last = JSON.parse(JSON.stringify(layer.transform));
  step(460, { ...s, wrist: null });
  assert.equal(w.failed, false);
  assert.equal(w.visible.length, 1);
  assert.deepEqual(layer.transform, Object.assign(new XRRigidTransform(), last));
  for (let t = 480; t <= 760; t += 20) step(t, null);
  assert.equal(w.visible.length, 0);
  for (let t = 780; t <= 1240; t += 20) step(t);
  assert.equal(layer.opacity, 1);
});

test("left geometry never reveals a glance and explicit disable hides immediately", () => {
  const { w, s, step, summary } = fixture();
  for (let t = 0; t <= 600; t += 20) step(t, { ...s, hand: "left" });
  assert.equal(w.visible.length, 0);
  for (let t = 620; t <= 1080; t += 20) step(t);
  assert.equal(w.visible.length, 1);
  w.update(s, { position: viewer }, { time: 1100, summary, enabled: false });
  assert.equal(w.visible.length, 0);
  assert.equal(w.showingFor("right"), false);
});

test("changed reading state paints and uploads while the wrist follows movement", () => {
  const { w, s, step, summary, paint, draw } = fixture();
  for (let t = 0; t <= 440; t += 20) step(t);
  const shifted = Object.fromEntries(Object.entries(s).map(([k, p]) => [k, typeof p === "object" ? { ...p, x: p.x + .03 } : p]));
  const updated = { ...summary, ticks: [true, false, false] };
  step(460, shifted, updated);
  assert.equal(w.moving, true);
  draw();
  assert.equal(paint.count, 2);
  assert.equal(paint.uploads, 2);
  for (let t = 480; t <= 2000; t += 20) step(t, shifted, updated);
  draw();
  assert.equal(w.moving, false);
  assert.equal(paint.count, 2);
  assert.equal(paint.uploads, 2);
});

// Parameterized synthetic traces, not measurements of Quest tracking. A hand
// wandering 6–10 mm at 1.3–2 Hz remains anatomically in the watch posture.
const translateHand = (s, x, y = 0) => Object.fromEntries(Object.entries(s).map(([k, p]) =>
  [k, typeof p === "object" ? { ...p, x: p.x + x, y: p.y + y } : p]));
for (const [hz, amplitude, frequency] of [[72, .006, 1.3], [90, .008, 1.7], [120, .010, 2]]) {
  test(`intentional glance survives continuous synthetic ${amplitude * 1000}mm motion at ${hz}Hz`, () => {
    const { w, s, step, draw, layer, summary, paint } = fixture();
    let firstShown = null, movingFrames = 0;
    for (let frame = 0; frame <= hz * 3; frame++) {
      const time = frame * 1000 / hz, phase = time / 1000 * frequency * 2 * Math.PI;
      const sample = translateHand(s, amplitude * Math.sin(phase), amplitude * Math.cos(phase));
      step(time, sample, { ...summary, ticks: [time >= 800, false, false] });
      movingFrames += Number(w.moving);
      if (w.shown && firstShown === null) firstShown = time;
      draw();
    }
    assert.ok(movingFrames > hz, "trace actually exercises follower motion");
    assert.ok(firstShown !== null && firstShown <= 350, `glance appeared by 350ms (actual ${firstShown})`);
    assert.equal(layer.opacity, 1);
    assert.equal(paint.uploads, 2, "changed dots upload despite continuous movement");
  });
}

test("head rotation during a deliberate glance cannot starve acquisition", () => {
  const { w, s, summary, viewerT, draw, layer } = fixture();
  let movingFrames = 0;
  for (let frame = 0; frame <= 216; frame++) {
    const time = frame * 1000 / 72, yaw = .06 * Math.sin(time / 1000 * 2 * Math.PI * 2);
    const matrix = [Math.cos(yaw), 0, -Math.sin(yaw), 0, 0, 1, 0, 0,
      Math.sin(yaw), 0, Math.cos(yaw), 0, 0, 0, 0, 1];
    w.update(s, { ...viewerT, matrix,
      orientation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) } }, { time, summary });
    movingFrames += Number(w.moving);
    draw();
    if (time >= 450) assert.equal(layer.opacity, 1);
  }
  assert.ok(movingFrames > 40, "head motion actually trips follower movement");
});

test("one brief threshold miss pauses valid intent instead of restarting or counting the miss", () => {
  const { w, s, step } = fixture();
  const away = rightHand(W, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  for (let time = 0; time <= 320; time += 20) step(time, time === 220 ? { hand: "right", ...away } : s);
  assert.equal(w.shown, false, "invalid interval must not count toward 300ms");
  step(340);
  assert.equal(w.shown, true, "short interruption retained earlier valid intent");
});

test("repeated invalid poses cannot accumulate enough stale intent to reveal", () => {
  const { w, s, step } = fixture();
  for (let time = 0; time <= 2000; time += 20) step(time, time % 60 === 40 ? null : s);
  assert.equal(w.shown, false);
  assert.equal(w.visible.length, 0);
  for (let time = 2020; time <= 2460; time += 20) step(time);
  assert.equal(w.shown, true, "fresh consistent intent recovers");
});

test("a long tracking interruption and a callback gap each require fresh intent", () => {
  const { w, step } = fixture();
  for (let time = 0; time <= 200; time += 20) step(time);
  for (let time = 220; time <= 340; time += 20) step(time, null);
  for (let time = 360; time <= 640; time += 20) step(time);
  assert.equal(w.shown, false);
  step(660);
  assert.equal(w.shown, true);
  step(1000);
  assert.equal(w.shown, false, "unobserved time is not a held glance");
  for (let time = 1020; time <= 1280; time += 20) step(time);
  assert.equal(w.shown, false);
  step(1300);
  assert.equal(w.shown, true);
});

test("initial texture upload proceeds during follower movement and gates first reveal", () => {
  const { w, s, step, layer, draw, paint } = fixture({ preload: false });
  step(0);
  step(20, translateHand(s, .03));
  assert.equal(w.moving, true);
  assert.equal(layer.opacity, 0);
  draw();
  assert.equal(paint.uploads, 1);
  assert.deepEqual(w.pendingPreloads(), []);
  for (let time = 40; time <= 460; time += 20) step(time, translateHand(s, .03));
  assert.equal(layer.opacity, 1);
});

test("malformed joints reject instead of allowing NaN comparisons to pass", () => {
  for (const value of [NaN, Infinity, -Infinity, undefined]) {
    const measured = watchMeasure({ ...watching, wrist: { ...W, x: value }, viewer, forward, right, hand: "right" });
    assert.equal(measured.ok, false);
    assert.equal(measured.reason, "invalid-joints");
  }
});

test("never-revealed posture exports bounded rejection measurements", () => {
  const { w, step } = fixture();
  const palmFacing = { hand: "right", ...rightHand(W, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }) };
  for (let time = 0; time <= 20000; time += 20) step(time, palmFacing);
  assert.equal(w.visible.length, 0);
  assert.equal(w.lastMeasure.reason, "palm-not-away");
  assert.ok(w.log.length > 0 && w.log.length <= 20);
  assert.ok(w.log.every(d => d.reason === "palm-not-away" && d.palm > .9 && !d.shown));
});

test("summary shows today's ticks, this week and the streak", () => {
  const p = seedProgress("2026-10-28");
  toggleTick(p, "2026-10-28", "story", "2026-10-28");
  const s = watchSummary(p, "2026-10-28");
  assert.equal(s.title, "Wed 28 Oct");
  assert.deepEqual(s.ticks, [false, true, false]);
  assert.deepEqual(s.picks, [null, null, null], "no invented titles");
  const missed = watchSummary(p, "2026-10-21");
  assert.match(missed.picks[0], /Guest House/);
  assert.deepEqual(s.week.map((d) => d.status), ["unrecorded", "unrecorded", "partial", "future", "future", "future", "future"]);
  assert.match(s.weekly, /due in 4d/);
});

test("wrist titles drop the author and never invent one", () => {
  assert.equal(titleOnly("The Guest House — Rumi"), "The Guest House");
  assert.equal(titleOnly("The Guest House - Rumi"), "The Guest House");
  assert.equal(titleOnly(" — Rumi"), "");
  assert.equal(titleOnly(null), "");
});
