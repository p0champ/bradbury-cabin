export const HOLD_MS = 1400;
export const MIN_PINCH_MS = 160;
export const OPEN_SETTLE_MS = 140;
export const RELEASE_SETTLE_MS = 90;
export const COOLDOWN_MS = 450;
export const CLOSE_DISTANCE = 0.018;
export const OPEN_DISTANCE = 0.038;
const CONTACT_DISTANCE = 0.024;
const RELEASE_TRAVEL_MS = 220;
const MAX_SAMPLE_GAP = 220;

// Deliberate open -> firm pinch -> settled release. A loosened half-pinch
// cannot continue charging a hold; time without tracking is never counted.
export class GestureEngine {
  constructor() {
    this.hands = new Map();
    this.owner = null;
    this.context = "reading";
    this.cooldownUntil = 0;
  }
  reset() {
    this.hands.clear();
    this.owner = null;
  }
  cancel(key) {
    this.hands.delete(key);
    if (this.owner === key) this.owner = null;
  }
  setContext(context) {
    this.context = context;
    this.reset();
  }
  progress(time, key = this.owner) {
    const h = this.hands.get(key);
    return h?.closed && !h.held && h.releaseAt == null && h.looseAt == null
      ? Math.min(1, (time - h.started) / HOLD_MS)
      : 0;
  }
  update(
    key,
    { distance, time, hand = "none", target = null, systemGesture = false },
  ) {
    if (distance == null || !Number.isFinite(distance) || systemGesture) {
      this.cancel(key);
      return null;
    }
    if (this.owner !== null && this.owner !== key) {
      this.cancel(key);
      return null;
    }
    let h = this.hands.get(key);
    if (h && time - h.lastTime > MAX_SAMPLE_GAP) {
      this.cancel(key);
      h = null;
    }
    if (!h) {
      h = {
        armed: false,
        closed: false,
        held: false,
        openSince: null,
        lastTime: time,
        releaseAt: null,
        looseAt: null,
      };
      this.hands.set(key, h);
    }
    h.lastTime = time;
    if (distance > OPEN_DISTANCE) {
      if (h.closed) {
        if (
          h.releaseAt == null &&
          h.looseAt != null &&
          time - h.looseAt > RELEASE_TRAVEL_MS
        ) {
          this.cancel(key);
          return null;
        }
        h.releaseAt ??= time;
        if (time - h.releaseAt < RELEASE_SETTLE_MS) return null;
        const duration =
          Math.min(h.releaseAt, h.looseAt ?? h.releaseAt) - h.started;
        let event = null;
        if (!h.held && duration >= MIN_PINCH_MS) {
          if (duration >= HOLD_MS) event = { type: "menu", hand };
          else if (this.context === "menu") {
            if (h.target && target === h.target)
              event = { type: "select", target: h.target, hand };
          } else if (hand === "left" || hand === "right")
            event = { type: "page", hand };
        }
        h.closed = false;
        h.held = false;
        h.armed = false;
        h.openSince = h.releaseAt;
        h.releaseAt = null;
        h.looseAt = null;
        this.owner = null;
        if (event && event.type !== "menu")
          this.cooldownUntil = time + COOLDOWN_MS;
        return event;
      }
      h.openSince ??= time;
      h.armed =
        time - h.openSince >= OPEN_SETTLE_MS && time >= this.cooldownUntil;
      return null;
    }
    h.openSince = null;
    if (h.closed && h.releaseAt != null) {
      this.cancel(key);
      return null;
    }
    if (!h.closed) {
      if (distance < CLOSE_DISTANCE && h.armed && time >= this.cooldownUntil) {
        h.closed = true;
        h.started = time;
        h.target = target;
        h.held = false;
        h.releaseAt = null;
        h.looseAt = null;
        this.owner = key;
      } else if (!h.armed) return null;
    }
    if (h.closed) {
      if (distance > CONTACT_DISTANCE) {
        h.looseAt ??= time;
        if (time - h.looseAt >= RELEASE_TRAVEL_MS) this.cancel(key);
        return null;
      }
      // Any separation during a hold cancels its accumulated charge. This
      // deliberately favours missed gestures over surprise menu/page actions.
      if (h.looseAt != null || h.releaseAt != null) {
        this.cancel(key);
        return null;
      }
      if (!h.held && time - h.started >= HOLD_MS) {
        h.held = true;
        return { type: "menu", hand };
      }
    }
    return null;
  }
}

export const menuButtons = [
  ["resume", "Return to reading"],
  ["recenter", "Re-centre page"],
  ["prev", "Previous page"],
  ["next", "Next page"],
  ["night", "Paper / Night"],
  ["size", "Text size"],
  ["swap", "Swap reading hands"],
  ["pointer", "Menu pointer"],
  ["practice", "Practise gestures"],
  ["compare", "A / B comparison"],
  ["exit", "Exit to browser"],
].map(([id, label], i) => ({
  id,
  label,
  x: 160 + (i % 2) * 880,
  y: 650 + Math.floor(i / 2) * 240,
  w: 840,
  h: 180,
}));
export function menuHit(x, y) {
  return (
    menuButtons.find(
      (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h,
    )?.id || null
  );
}

// Best-effort guard for the near-face palm pinch reserved by Quest Browser.
// WebXR does not expose the native SDK's system-gesture flag.
export function nearFacePalm(wrist, index, pinky, viewer, hand, forward) {
  if (!wrist || !index || !pinky || !viewer) return false;
  const a = {
    x: index.x - wrist.x,
    y: index.y - wrist.y,
    z: index.z - wrist.z,
  };
  const b = {
    x: pinky.x - wrist.x,
    y: pinky.y - wrist.y,
    z: pinky.z - wrist.z,
  };
  const sign = hand === "right" ? -1 : hand === "left" ? 1 : 0;
  const n = {
    x: (a.y * b.z - a.z * b.y) * sign,
    y: (a.z * b.x - a.x * b.z) * sign,
    z: (a.x * b.y - a.y * b.x) * sign,
  };
  const v = {
    x: viewer.x - wrist.x,
    y: viewer.y - wrist.y,
    z: viewer.z - wrist.z,
  };
  const distance = Math.hypot(v.x, v.y, v.z),
    length = Math.hypot(n.x, n.y, n.z);
  if (
    forward &&
    distance > 0.001 &&
    -(v.x * forward.x + v.y * forward.y + v.z * forward.z) / distance < 0.9
  )
    return false;
  return (
    distance > 0.001 &&
    distance < 0.5 &&
    length > 0.00001 &&
    (n.x * v.x + n.y * v.y + n.z * v.z) / (length * distance) > 0.7
  );
}
