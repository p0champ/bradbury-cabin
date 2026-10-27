export const HOLD_MS = 1400;
export const MIN_PINCH_MS = 160;
export const OPEN_SETTLE_MS = 140;
export const RELEASE_SETTLE_MS = 80;
export const COOLDOWN_MS = 400;
export const CLOSE_DISTANCE = 0.018;
// Build 006: a relaxed Quest hand often rests below 38 mm, so the old open
// threshold could leave a release (and the next arming) unrecognised.
export const OPEN_DISTANCE = 0.032;
export const CONTACT_DISTANCE = 0.026;
// The hold ring stays hidden for short pinches, so a tap never looks like a
// registered click. It still completes exactly at HOLD_MS.
export const RING_DELAY_MS = 350;
const RELEASE_TRAVEL_MS = 300;
const MAX_SAMPLE_GAP = 220;
// Upward excursions shorter than this during contact are hand-tracking noise
// (one or two frames at 72 Hz) and must not cancel a deliberate pinch.
const SPIKE_MS = 30;
// A brief loosening that firmly re-closes keeps the pinch but loses hold charge.
const WOBBLE_MS = 120;
const LOG_SIZE = 40;

// Deliberate open -> firm pinch -> settled release. A loosened half-pinch
// cannot continue charging a hold; time without tracking is never counted.
// Every pinch that reached firm contact ends with a recorded outcome, so a
// silently cancelled attempt can be told apart from a page that did not turn.
export class GestureEngine {
  constructor() {
    this.hands = new Map();
    this.owner = null;
    this.context = "reading";
    this.cooldownUntil = 0;
    this.log = [];
  }
  record(entry) {
    this.log.push(entry);
    if (this.log.length > LOG_SIZE) this.log.shift();
    return entry;
  }
  reset(reason = "reset") {
    for (const [key, h] of this.hands)
      if (h.closed) this.record({ result: "cancelled", reason, hand: h.hand, time: h.lastTime });
    this.hands.clear();
    this.owner = null;
  }
  cancel(key, reason = "cancelled", time) {
    const h = this.hands.get(key);
    if (h?.closed)
      this.record({ result: "cancelled", reason, hand: h.hand, time: time ?? h.lastTime });
    this.hands.delete(key);
    if (this.owner === key) this.owner = null;
  }
  setContext(context) {
    this.context = context;
    this.reset("context-change");
  }
  holdCharge(time, key = this.owner) {
    const h = this.hands.get(key);
    return h?.closed && !h.held && h.releaseAt == null && h.looseAt == null
      ? Math.min(1, (time - h.holdStart) / HOLD_MS)
      : 0;
  }
  // Visible ring fraction: zero for the first RING_DELAY_MS, full at HOLD_MS.
  progress(time, key = this.owner) {
    const charge = this.holdCharge(time, key);
    if (!charge) return 0;
    const shown = (charge * HOLD_MS - RING_DELAY_MS) / (HOLD_MS - RING_DELAY_MS);
    return Math.max(0, Math.min(1, shown));
  }
  update(
    key,
    { distance, time, hand = "none", target = null, systemGesture = false },
  ) {
    if (distance == null || !Number.isFinite(distance)) {
      this.cancel(key, "tracking-lost", time);
      return null;
    }
    if (systemGesture) {
      this.cancel(key, "system-gesture", time);
      return null;
    }
    if (this.owner !== null && this.owner !== key) {
      this.hands.delete(key);
      return null;
    }
    let h = this.hands.get(key);
    if (h && time - h.lastTime > MAX_SAMPLE_GAP) {
      this.cancel(key, "tracking-gap", time);
      h = null;
    }
    if (!h) {
      h = {
        hand,
        armed: false,
        closed: false,
        held: false,
        openSince: null,
        lastTime: time,
        releaseAt: null,
        looseAt: null,
        recent: [],
        ignoredPinch: false,
      };
      this.hands.set(key, h);
    }
    h.lastTime = time;
    h.hand = hand;
    h.recent.push([time, distance]);
    while (h.recent.length > 1 && time - h.recent[0][0] > SPIKE_MS)
      h.recent.shift();
    // While pinched, use the smallest distance seen in the last ~30 ms, so a
    // single bad tracking frame cannot look like loosening or release.
    const d = h.closed
      ? Math.min(...h.recent.map(([, value]) => value))
      : distance;

    if (d > OPEN_DISTANCE) {
      if (h.closed) {
        if (h.looseAt != null && time - h.looseAt > RELEASE_TRAVEL_MS) {
          this.cancel(key, "release-stalled", time);
          return null;
        }
        h.looseAt ??= time;
        h.releaseAt ??= time;
        h.wentOpen = true;
        if (time - h.releaseAt < RELEASE_SETTLE_MS) return null;
        const separated = h.firstSeparation ?? h.looseAt;
        const contact = separated - h.started;
        const holdContact = separated - h.holdStart;
        let event = null,
          reason = null;
        if (h.held) reason = null;
        else if (contact < MIN_PINCH_MS) reason = "too-short";
        else if (holdContact >= HOLD_MS) event = { type: "menu", hand };
        else if (this.context === "menu") {
          if (h.target && target === h.target)
            event = { type: "select", target: h.target, hand };
          else reason = h.target ? "moved-off-button" : "no-button";
        } else if (hand === "left" || hand === "right")
          event = { type: "page", hand };
        else reason = "unknown-hand";
        if (!h.held) this.record({
          result: event ? event.type : "rejected",
          reason: reason ?? undefined,
          hand,
          ms: Math.round(contact),
          time,
        });
        h.closed = false;
        h.held = false;
        h.armed = false;
        h.openSince = h.releaseAt;
        h.releaseAt = null;
        h.looseAt = null;
        h.firstSeparation = null;
        h.wentOpen = false;
        this.owner = null;
        if (event && event.type !== "menu")
          this.cooldownUntil = time + COOLDOWN_MS;
        return event;
      }
      if (h.nearMin != null && !h.ignoredPinch)
        this.record({
          result: "ignored",
          reason: "not-firm-enough",
          hand,
          minMm: Math.round(h.nearMin * 1000),
          time,
        });
      h.nearMin = null;
      h.ignoredPinch = false;
      h.openSince ??= time;
      // Arming is sticky: a hand that has settled open stays ready even if a
      // noisy sample dips across the open threshold on the way into a pinch.
      if (time - h.openSince >= OPEN_SETTLE_MS) h.armed = true;
      return null;
    }
    h.openSince = null;
    if (!h.closed && d < CONTACT_DISTANCE) h.nearMin = Math.min(h.nearMin ?? d, d);
    if (!h.closed) {
      if (d < CLOSE_DISTANCE && h.armed && time >= this.cooldownUntil) {
        h.closed = true;
        h.started = time;
        h.holdStart = time;
        h.target = target;
        h.held = false;
        h.releaseAt = null;
        h.looseAt = null;
        h.firstSeparation = null;
        h.wentOpen = false;
        h.nearMin = null;
        h.recent = [[time, distance]];
        this.owner = key;
      } else {
        if (d < CLOSE_DISTANCE && !h.ignoredPinch) {
          h.ignoredPinch = true;
          this.record({
            result: "ignored",
            reason: time < this.cooldownUntil ? "cooldown" : "hand-not-open-first",
            hand,
            time,
          });
        }
        if (!h.armed) return null;
      }
    }
    if (h.closed) {
      if (d > CONTACT_DISTANCE) {
        // Loosening or a release dipping back below full open. Settling of a
        // release restarts; travel time is bounded.
        h.releaseAt = null;
        h.looseAt ??= time;
        h.firstSeparation ??= h.looseAt;
        if (time - h.looseAt >= RELEASE_TRAVEL_MS)
          this.cancel(key, "release-stalled", time);
        return null;
      }
      if (h.looseAt != null) {
        // Firm contact again. A short wobble keeps the pinch but restarts the
        // hold clock (visibly clearing the ring); a long one cancels.
        if (time - h.looseAt > WOBBLE_MS || h.wentOpen) {
          this.cancel(key, "re-pinched", time);
          return null;
        }
        h.looseAt = null;
        h.firstSeparation = null;
        h.holdStart = time;
      }
      if (!h.held && time - h.holdStart >= HOLD_MS) {
        h.held = true;
        this.record({ result: "menu", hand, ms: Math.round(time - h.started), time });
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
