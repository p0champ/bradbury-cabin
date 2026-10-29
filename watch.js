import { UI } from "./theme.js?v=37";
// Wrist calendar: a small native quad on Bastian's RIGHT wrist that appears
// when the back of that wrist is turned toward the eyes, like checking a watch.
// It is locked to the right hand: only an input source whose handedness is
// "right" can ever show it. There is no fallback to the other or nearest hand
// (an earlier wrist feature that switched wrists was a real problem).
// Placeholder visual design; Bastian will restyle the whole UI later.
import {
  KINDS,
  addDays,
  dayStatus,
  overview,
  parseKey,
} from "./progress.js?v=37";

export const WATCH_HAND = "right";
export const WATCH_PIXELS = [512, 448];
export const WATCH_METRES = [0.088, 0.077];
const SHOW_MS = 200,
  HIDE_MS = 350;
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
export function paintWatch(canvas, s, night = false) {
  const c = canvas.getContext("2d");
  const [W, H] = WATCH_PIXELS;
  const bg = night ? "#1d2621" : "#f4ecd8",
    ink = night ? "#ece5d2" : "#243c32",
    muted = night ? "#a8b9aa" : "#5f7265",
    done = night ? "#7f9a83" : "#5f8068",
    warn = night ? "#d39a77" : "#a5603d",
    faint = night ? "#73857a" : "#9e9a86";
  c.clearRect(0, 0, W, H);
  c.fillStyle = bg;
  rounded(c, 8, 8, W - 16, H - 16, 44);
  c.fill();
  c.textAlign = "left";
  c.fillStyle = ink;
  c.font = "38px Literata, Georgia, serif";
  c.fillText(s.title, 40, 70);
  c.textAlign = "right";
  c.fillStyle = muted;
  c.font = `28px ${UI}`;
  c.fillText(`Streak ${s.streak}`, W - 40, 68);
  // Today's three readings, each with its tick and title.
  const fit = (text, max) => {
    if (c.measureText(text).width <= max) return text;
    while (text.length > 1 && c.measureText(text + "…").width > max) text = text.slice(0, -1);
    return text.trimEnd() + "…";
  };
  ["Poem", "Story", "Essay"].forEach((label, i) => {
    const cx = 64,
      cy = 124 + i * 72;
    c.beginPath();
    c.arc(cx, cy, 22, 0, Math.PI * 2);
    if (s.ticks[i]) {
      c.fillStyle = done;
      c.fill();
      c.strokeStyle = bg;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(cx - 10, cy + 1);
      c.lineTo(cx - 2, cy + 9);
      c.lineTo(cx + 11, cy - 8);
      c.stroke();
    } else {
      c.strokeStyle = muted;
      c.lineWidth = 4;
      c.stroke();
    }
    c.textAlign = "left";
    c.fillStyle = muted;
    c.font = `22px ${UI}`;
    c.fillText(label.toUpperCase(), 102, cy - 10);
    // Title only on the wrist; the author is on the calendar day page.
    const title = titleOnly(s.picks?.[i]);
    c.fillStyle = title ? ink : faint;
    c.font = title ? "italic 28px Literata, Georgia, serif" : `26px ${UI}`;
    c.fillText(fit(title || "not picked yet", W - 140), 102, cy + 22);
  });
  // This week, Monday to Sunday
  s.week.forEach((d, i) => {
    const x = 40 + i * 64,
      y = 334;
    if (d.status === "complete") {
      c.fillStyle = done;
      rounded(c, x, y, 48, 48, 10);
      c.fill();
    } else {
      c.strokeStyle =
        d.status === "missed" ? warn : d.status === "partial" || d.status === "open" ? muted : faint;
      c.lineWidth = d.status === "missed" ? 4 : 3;
      c.setLineDash(d.status === "unrecorded" ? [5, 5] : []);
      rounded(c, x + 2, y + 2, 44, 44, 10);
      c.stroke();
      c.setLineDash([]);
      if (d.status === "partial") {
        c.fillStyle = muted;
        c.beginPath();
        c.arc(x + 39, y + 39, 5, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.textAlign = "center";
    c.fillStyle = d.status === "complete" ? bg : d.status === "future" ? faint : muted;
    c.font = `${d.today ? "bold " : ""}28px ${UI}`;
    c.fillText(d.label, x + 24, y + 32);
    if (d.today) {
      c.fillStyle = ink;
      c.fillRect(x + 12, y + 56, 24, 4);
    }
  });
  c.textAlign = "left";
  c.fillStyle = muted;
  c.font = `24px ${UI}`;
  c.fillText(s.weekly, 40, H - 28);
}

export class WristWatch {
  constructor(binding, space, onError = () => {}) {
    this.binding = binding;
    this.space = space;
    this.onError = onError;
    this.entry = null;
    this.visible = [];
    this.failed = false;
    this.shown = false;
    this.since = null;
    this.hand = null;
    this.log = [];
  }
  showingFor(hand) {
    return this.shown && this.hand === hand;
  }
  clearVisible() {
    if (this.entry) this.entry.layer.opacity = 0;
    const changed = this.visible.length > 0;
    this.visible = [];
    this.shown = false;
    this.since = null;
    return changed;
  }
  // sample: {hand, wrist, index, pinky, middle} positions for the watch hand,
  // or null when unavailable. Returns true when the layer list must change.
  update(sample, viewer, { time, summary, night = false, enabled = true }) {
    const before = this.visible.length;
    if (this.failed || !enabled || !viewer) {
      this.clearVisible();
      return before !== 0;
    }
    const m = viewer.matrix;
    const forward = { x: -m[8], y: -m[9], z: -m[10] },
      right = { x: m[0], y: m[1], z: m[2] };
    if (sample && sample.hand !== WATCH_HAND) sample = null;
    const measured = sample
      ? watchMeasure({ ...sample, viewer: viewer.position, forward, right })
      : { ok: false, reason: "no-right-hand" };
    const want = measured.ok;
    if (want !== this.shown) {
      this.since ??= time;
      if (time - this.since >= (want ? SHOW_MS : HIDE_MS)) {
        this.shown = want;
        this.since = null;
        this.log.push({ time: Math.round(time), shown: want, ...measured });
        if (this.log.length > 20) this.log.shift();
      }
    } else this.since = null;
    // A dropped or emulated wrist joint simply hides the face for now; it
    // must never disable the feature for the rest of the session.
    if (!this.shown || !sample?.wrist) {
      if (this.entry) this.entry.layer.opacity = 0;
      this.visible = [];
      this.shown = this.shown && !!sample?.wrist;
      return before !== 0;
    }
    try {
      if (!this.entry) {
        const canvas = document.createElement("canvas");
        [canvas.width, canvas.height] = WATCH_PIXELS;
        const layer = this.binding.createQuadLayer({
          space: this.space,
          layout: "mono",
          textureType: "texture",
          viewPixelWidth: WATCH_PIXELS[0],
          viewPixelHeight: WATCH_PIXELS[1],
          width: WATCH_METRES[0],
          height: WATCH_METRES[1],
          isStatic: false,
          clearOnAccess: false,
        });
        layer.blendTextureSourceAlpha = true;
        this.entry = { canvas, layer, key: "", dirty: true };
      }
      const e = this.entry;
      const key = JSON.stringify([summary, night]);
      if (key !== e.key) {
        paintWatch(e.canvas, summary, night);
        e.key = key;
        e.dirty = true;
      }
      this.hand = WATCH_HAND;
      e.layer.transform = new XRRigidTransform(
        watchPosition({ ...sample, viewer: viewer.position }),
        viewer.orientation,
      );
      e.layer.opacity = 1;
      this.visible = [e.layer];
    } catch (error) {
      this.failed = true;
      this.clearVisible();
      this.onError(error);
      return true;
    }
    return before !== this.visible.length;
  }
  draw(frame, gpu, activeLayers) {
    const e = this.entry;
    if (!e || !this.visible.length || !activeLayers.includes(e.layer)) return false;
    if (!e.dirty && !e.layer.needsRedraw) return false;
    try {
      gpu.copyPage(this.binding.getSubImage(e.layer, frame), e.canvas, {
        premultiplied: true,
      });
      e.dirty = false;
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
    this.visible = [];
  }
}
