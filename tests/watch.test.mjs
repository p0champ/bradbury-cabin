import test from "node:test";
import assert from "node:assert/strict";
import { watchPose, watchPosition, watchSummary, WATCH_HAND, WristWatch } from "../watch.js";
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
test("a dropped wrist joint hides the face but never disables the feature", () => {
  globalThis.XRRigidTransform ??= class { constructor(p, q) { this.position = p; this.orientation = q; } };
  globalThis.document ??= { createElement: () => ({ getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) }) }) };
  const layer = { opacity: 0, destroy() {} };
  const w = new WristWatch({ createQuadLayer: () => layer }, {});
  const viewerT = { position: viewer, orientation: { x: 0, y: 0, z: 0, w: 1 }, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  const summary = watchSummary(seedProgress("2026-10-28"), "2026-10-28");
  const s = { hand: "right", ...watching };
  for (let t = 0; t <= 300; t += 20) w.update(s, viewerT, { time: t, summary });
  assert.equal(w.visible.length, 1, "shown");
  w.update({ ...s, wrist: null }, viewerT, { time: 320, summary });
  assert.equal(w.failed, false);
  assert.equal(w.visible.length, 0, "hidden while the wrist is lost");
  for (let t = 340; t <= 700; t += 20) w.update(s, viewerT, { time: t, summary });
  assert.equal(w.visible.length, 1, "comes back");
});
test("summary shows today's ticks, this week and the streak", () => {
  const p = seedProgress("2026-10-28");
  toggleTick(p, "2026-10-28", "story", "2026-10-28");
  const s = watchSummary(p, "2026-10-28");
  assert.equal(s.title, "Wed 28 Oct");
  assert.deepEqual(s.ticks, [false, true, false]);
  assert.deepEqual(s.week.map((d) => d.status), ["unrecorded", "unrecorded", "partial", "future", "future", "future", "future"]);
  assert.match(s.weekly, /due in 4d/);
});
