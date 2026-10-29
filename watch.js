import { PoseFollower } from "./follow-pose.js?v=46";
import { UI } from "./theme.js?v=46";
// Wrist calendar: a small native quad on Bastian's RIGHT wrist that appears
// when the back of that wrist is turned toward the eyes, like checking a watch.
// It is locked to the right hand: only an input source whose handedness is
// "right" can ever show it. There is no fallback to the other or nearest hand
// (an earlier wrist feature that switched wrists was a real problem).
// A quiet glass glance: the date and today's three readings.
import {
  KINDS,
  addDays,
  dayStatus,
  overview,
  parseKey,
} from "./progress.js?v=46";

export const WATCH_HAND = "right";
export const WATCH_PIXELS = [512, 448];
export const WATCH_METRES = [0.088, 0.077];
export const WATCH_TIMING = { steady: 300, intentGrace: 80, maxGap: 100, hysteresis: 120, fade: 120 };
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const WEEKDAYS = "Sun Mon Tue Wed Thu Fri Sat".split(" ");

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

// True when the back of the RIGHT hand faces the eyes in a watch-checking
// posture. Anatomy (verified by hand): for a real right hand,
// cross(index-metacarpal − wrist, pinky-metacarpal − wrist) points OUT OF THE
// PALM. So the palm normal must point away from the eyes.
// Three further conditions keep ordinary page-turn poses from triggering it:
// the wrist is close to where the user looks, it is near (12–65 cm), and the
// hand runs across the body (fingers toward the user's left), as when the
// right forearm is raised to read a watch.
export const WATCH_LIMITS = { palm: -0.7, gazeDeg: 25, across: -0.4, near: 0.12, far: 0.65 };
// Measurements behind the decision, also exported for headset tuning.
export function watchMeasure({ wrist, index, pinky, middle, viewer, forward, right, hand }) {
  if (!wrist || !index || !pinky || !middle || !viewer || !forward || !right)
    return { ok: false, reason: "joints-missing" };
  if (hand !== WATCH_HAND) return { ok: false, reason: "not-right-hand" };
  if (![wrist, index, pinky, middle, viewer, forward, right].every(p =>
    [p.x, p.y, p.z].every(Number.isFinite))) return { ok: false, reason: "invalid-joints" };
  const palm = cross(sub(index, wrist), sub(pinky, wrist));
  const v = sub(viewer, wrist);
  const d = len(v),
    pl = len(palm);
  const along = sub(middle, wrist),
    al = len(along);
  if (pl < 1e-6 || al < 1e-6 || d < 1e-6) return { ok: false, reason: "degenerate" };
  const toWrist = { x: -v.x / d, y: -v.y / d, z: -v.z / d };
  const m = {
    distance: +d.toFixed(3),
    palm: +(dot(palm, v) / (pl * d)).toFixed(2),
    gazeDeg: +((Math.acos(Math.max(-1, Math.min(1, dot(toWrist, forward)))) * 180) / Math.PI).toFixed(1),
    across: +(dot(along, right) / al).toFixed(2),
  };
  const L = WATCH_LIMITS;
  const reason =
    d < L.near || d > L.far
      ? "distance"
      : m.palm > L.palm
        ? "palm-not-away"
        : m.gazeDeg > L.gazeDeg
          ? "not-looking"
          : m.across > L.across
            ? "not-across-body"
            : null;
  return { ok: !reason, reason, ...m };
}
// True when the back of the RIGHT hand faces the eyes in a watch-checking
// posture. Anatomy (verified by hand): for a real right hand,
// cross(index-metacarpal − wrist, pinky-metacarpal − wrist) points OUT OF THE
// PALM, so the palm normal must point away from the eyes. The wrist must be
// near and looked at, and the hand must run across the body (fingers toward
// the user's left), which keeps ordinary page-turn poses out.
export function watchPose(args) {
  return watchMeasure(args).ok;
}

// Where the watch face sits: a little up the forearm from the wrist joint,
// lifted toward the eyes so it floats just above the skin.
export function watchPosition({ wrist, middle, viewer }) {
  let along = { x: 0, y: 0, z: 0 };
  if (middle) {
    const u = sub(wrist, middle);
    const l = len(u);
    if (l > 1e-6) along = { x: (u.x / l) * 0.03, y: (u.y / l) * 0.03, z: (u.z / l) * 0.03 };
  }
  const v = sub(viewer, wrist);
  const d = len(v) || 1;
  return {
    x: wrist.x + along.x + (v.x / d) * 0.025,
    y: wrist.y + along.y + (v.y / d) * 0.025,
    z: wrist.z + along.z + (v.z / d) * 0.025,
  };
}

export function watchSummary(progress, today) {
  const o = overview(progress, today);
  const t = parseKey(today);
  const monday = addDays(today, -((t.getDay() + 6) % 7));
  const d = progress.days[today] || {};
  return {
    title: `${WEEKDAYS[t.getDay()]} ${t.getDate()} ${MONTHS[t.getMonth()]}`,
    weekday: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][t.getDay()],
    day: t.getDate(),
    streak: o.streak,
    ticks: KINDS.map((k) => !!d[k]),
    // Titles of the day's readings when they are known (stored picks).
    picks: KINDS.map((k) => (typeof d.picks?.[k] === "string" ? d.picks[k] : null)),
    week: DAYS.map((label, i) => {
      const key = addDays(monday, i);
      return { label, today: key === today, status: dayStatus(progress, key, today) };
    }),
    weekly: o.weekSubmitted ? "Story handed in ✎" : o.daysToSunday === 0 ? "Story due today ✎" : `Story due in ${o.daysToSunday}d ✎`,
  };
}

function rounded(c, x, y, w, h, r) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}

export function titleOnly(pick) {
  return typeof pick === "string" ? pick.split(/\s+[—–-]\s+/)[0].trim() : "";
}
// Deliberately simulated frosting: no promise of live passthrough blur.
export function paintWatch(canvas, s, night = false) {
  const c = canvas.getContext("2d");
  const [W, H] = WATCH_PIXELS;
  c.clearRect(0, 0, W, H);
  const glass = c.createLinearGradient(0, 0, W, H);
  glass.addColorStop(0, night ? "rgba(45,51,57,.88)" : "rgba(249,250,251,.88)");
  glass.addColorStop(1, night ? "rgba(25,31,38,.82)" : "rgba(224,230,234,.80)");
  c.fillStyle = glass;
  rounded(c, 8, 8, W - 16, H - 16, 58);
  c.fill();
  const rim = c.createLinearGradient(0, 8, 0, H - 8);
  rim.addColorStop(0, "rgba(255,255,255,.70)");
  rim.addColorStop(1, "rgba(255,255,255,.10)");
  c.strokeStyle = rim;
  c.lineWidth = 2;
  rounded(c, 10, 10, W - 20, H - 20, 56);
  c.stroke();
  c.textAlign = "center";
  c.fillStyle = night ? "rgba(244,246,249,.74)" : "rgba(32,39,48,.70)";
  c.font = `500 37px ${UI}`;
  c.fillText(s.weekday || s.title?.split(" ")[0] || "", W / 2, 93);
  c.fillStyle = night ? "#f4f6f9" : "#202730";
  c.font = `400 184px ${UI}`;
  c.fillText(String(s.day ?? s.title?.split(" ")[1] ?? ""), W / 2, 285);
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(W / 2 + (i - 1) * 48, 359, 11, 0, Math.PI * 2);
    if (s.ticks?.[i]) {
      c.fillStyle = night ? "rgba(244,246,249,.90)" : "rgba(32,39,48,.88)";
      c.fill();
    } else {
      c.strokeStyle = night ? "rgba(244,246,249,.42)" : "rgba(32,39,48,.34)";
      c.lineWidth = 3;
      c.stroke();
    }
  }
}

const visualKey = (s, night) => JSON.stringify([s.weekday, s.day, s.title, s.ticks, night]);

export class WristWatch {
  constructor(binding, space, onError = () => {}) {
    Object.assign(this, { binding, space, onError, entry: null, visible: [], failed: false,
      shown: false, since: null, hand: null, log: [], opacity: 0, lastTime: null,
      moving: false, pending: null, intentMs: 0, intentSince: null,
      intentValid: false, lastMeasure: null, lastRejectionTime: null });
    this.follower = new PoseFollower();
  }
  pendingPreloads() {
    return this.entry && !this.entry.uploaded && !this.failed ? [this.entry.layer] : [];
  }
  showingFor(hand) {
    return hand === WATCH_HAND && (this.shown || this.opacity > 0);
  }
  clearVisible() {
    if (this.entry) this.entry.layer.opacity = 0;
    const changed = this.visible.length > 0;
    this.visible = [];
    this.shown = false;
    this.opacity = 0;
    this.since = null;
    this.lastTime = null;
    this.intentMs = 0;
    this.intentSince = null;
    this.intentValid = false;
    this.moving = false;
    this.follower.reset();
    return changed;
  }
  // Call before welcome. The caller may list the returned, transparent layer
  // to upload its first texture before the wrist is ever revealed.
  prepare(summary, night = false) {
    if (this.failed) return null;
    try {
      if (!this.entry) {
        const canvas = document.createElement("canvas");
        [canvas.width, canvas.height] = WATCH_PIXELS;
        const layer = this.binding.createQuadLayer({
          space: this.space, layout: "mono", textureType: "texture",
          viewPixelWidth: WATCH_PIXELS[0], viewPixelHeight: WATCH_PIXELS[1],
          width: WATCH_METRES[0], height: WATCH_METRES[1],
          isStatic: false, clearOnAccess: false,
        });
        layer.blendTextureSourceAlpha = true;
        layer.opacity = 0;
        this.entry = { canvas, layer, key: "", dirty: true };
      }
      this.pending = { summary, night, key: visualKey(summary, night) };
      this.paintPending();
      return this.entry.layer;
    } catch (error) {
      this.failed = true;
      this.clearVisible();
      this.onError(error);
      return null;
    }
  }
  paintPending() {
    if (!this.entry || !this.pending) return;
    const p = this.pending;
    if (p.key !== this.entry.key) {
      paintWatch(this.entry.canvas, p.summary, p.night);
      this.entry.key = p.key;
      this.entry.dirty = true;
    }
    this.pending = null;
  }
  // A transient lost joint holds the last safe pose through grace + fade.
  update(sample, viewer, { time, summary, night = false, enabled = true }) {
    const before = this.visible.length;
    if (this.failed || !enabled || !viewer) return this.clearVisible();
    const elapsed = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    // A suspended callback is not evidence of holding an intentional glance.
    if (elapsed > WATCH_TIMING.maxGap) this.clearVisible();
    const dt = Math.min(50, elapsed);
    this.lastTime = time;
    const m = viewer.matrix;
    const forward = { x: -m[8], y: -m[9], z: -m[10] },
      right = { x: m[0], y: m[1], z: m[2] };
    if (sample?.hand !== WATCH_HAND) sample = null;
    const measured = sample ? watchMeasure({ ...sample, viewer: viewer.position, forward, right })
      : { ok: false, reason: "no-right-hand" };
    this.lastMeasure = measured;
    const position = sample?.wrist && sample?.middle
      ? watchPosition({ ...sample, viewer: viewer.position }) : null;
    // Follow valid poses only while glancing; turning away holds the final
    // pose so the departing glass never chases an ordinary page-turn hand.
    const pose = this.follower.update(measured.ok ? position : null,
      measured.ok ? viewer.orientation : null, time);
    this.moving = !!pose?.moving;
    const want = measured.ok;
    const wasShown = this.shown;
    if (!this.shown) {
      // Accumulate valid posture time, independently of filtered pose motion.
      // Brief boundary noise pauses acquisition; at most 80ms total can be
      // tolerated in one attempt. Ordinary movement must not demand stillness.
      if (want) {
        if (this.intentSince === null) this.intentSince = time;
        else if (this.intentValid) this.intentMs += elapsed > WATCH_TIMING.maxGap ? 0 : elapsed;
      }
      if (this.intentSince !== null && time - this.intentSince - this.intentMs > WATCH_TIMING.intentGrace) {
        this.intentSince = want ? time : null;
        this.intentMs = 0;
      }
      this.intentValid = want;
      if (want && this.intentMs >= WATCH_TIMING.steady) this.shown = true;
    } else {
      if (!want) {
        this.since ??= time;
        if (time - this.since >= WATCH_TIMING.hysteresis) this.shown = false;
      } else this.since = null;
    }
    if (this.shown !== wasShown) {
      this.log.push({ time: Math.round(time), shown: this.shown, ...measured });
      this.since = null;
      this.intentSince = null;
      this.intentMs = 0;
      this.intentValid = false;
    } else if (!want && !this.shown && (this.lastRejectionTime === null || time - this.lastRejectionTime >= 500)) {
      // A watch that never appears still leaves useful, bounded diagnostics.
      this.log.push({ time: Math.round(time), shown: false, ...measured });
      this.lastRejectionTime = time;
    }
    if (this.log.length > 20) this.log.shift();
    const previousOpacity = this.opacity;
    this.opacity = Math.max(0, Math.min(1, this.opacity + (this.shown ? 1 : -1) * dt / WATCH_TIMING.fade));
    try {
      if (!this.entry) this.prepare(summary, night);
      if (this.failed) return before !== 0;
      this.pending = { summary, night, key: visualKey(summary, night) };
      this.paintPending();
      const e = this.entry;
      if (pose) e.layer.transform = new XRRigidTransform(pose.position, pose.orientation);
      this.hand = WATCH_HAND;
      // A newly created texture must be uploaded before its first reveal.
      e.layer.opacity = e.uploaded ? this.opacity : 0;
      this.visible = this.opacity > 0 && pose ? [e.layer] : [];
      if (previousOpacity > 0 && !this.shown && this.opacity === 0) this.follower.reset();
    } catch (error) {
      this.failed = true;
      this.clearVisible();
      this.onError(error);
    }
    return before !== this.visible.length;
  }
  draw(frame, gpu, activeLayers) {
    const e = this.entry;
    if (!e || !activeLayers.includes(e.layer)) return false;
    if (!e.dirty && !e.layer.needsRedraw) return false;
    try {
      gpu.copyPage(this.binding.getSubImage(e.layer, frame), e.canvas, { premultiplied: true });
      e.dirty = false;
      e.uploaded = true;
    } catch (error) {
      this.failed = true;
      this.clearVisible();
      this.onError(error);
      return true;
    }
    return false;
  }
  dispose() {
    this.entry?.layer.destroy();
    this.entry = null;
    this.clearVisible();
  }
}
