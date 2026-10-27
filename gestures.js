export const HOLD_MS = 750;
export const MIN_PINCH_MS = 60;

// Reading, menu selection and a menu hold are mutually exclusive outcomes.
// A newly visible or cancelled hand must first open before it can act.
export class GestureEngine {
  constructor() {
    this.hands = new Map();
    this.owner = null;
    this.context = "reading";
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
  progress(time) {
    const h = this.hands.get(this.owner);
    return h?.closed && !h.held ? Math.min(1, (time - h.started) / HOLD_MS) : 0;
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
    if (!h) {
      h = { armed: false, closed: false, held: false };
      this.hands.set(key, h);
    }
    if (distance > 0.04) {
      let event = null;
      if (h.closed && !h.held && time - h.started >= MIN_PINCH_MS) {
        // A threshold-crossing release may be the first sampled frame after
        // the hold duration. It must never fall back to a page or button.
        if (time - h.started >= HOLD_MS) event = { type: "menu", hand };
        else if (this.context === "menu") {
          if (h.target && target === h.target)
            event = { type: "select", target: h.target, hand };
        } else if (hand === "left" || hand === "right")
          event = { type: "page", hand };
      }
      h.armed = true;
      h.closed = false;
      h.held = false;
      this.owner = null;
      return event;
    }
    if (distance < 0.025 && h.armed && !h.closed) {
      h.closed = true;
      h.started = time;
      h.target = target;
      h.held = false;
      this.owner = key;
    }
    if (h.closed && !h.held && time - h.started >= HOLD_MS) {
      h.held = true;
      return { type: "menu", hand };
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
