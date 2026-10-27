export const HOLD_MS = 1400;
export const RING_DELAY_MS = 350;
// The browser's calibrated recognizer decides clicks; no app contact threshold.
export const MIN_PINCH_MS = 0;
export const STABLE_MS = 400;
export const OPEN_SETTLE_MS = 180;
export const COOLDOWN_MS = 0;
export const OPEN_DISTANCE = 0.028;
const MAX_GAP_MS = 120;

export function inView(position, viewer, horizontal = 48, vertical = 42) {
  if (!position || !viewer) return false;
  const m = viewer.matrix,
    dx = position.x - m[12],
    dy = position.y - m[13],
    dz = position.z - m[14];
  const x = dx * m[0] + dy * m[1] + dz * m[2],
    y = dx * m[4] + dy * m[5] + dz * m[6],
    depth = -(dx * m[8] + dy * m[9] + dz * m[10]);
  return (
    depth > 0.12 &&
    depth < 1.5 &&
    Math.abs(x) < depth * Math.tan((horizontal * Math.PI) / 180) &&
    Math.abs(y) < depth * Math.tan((vertical * Math.PI) / 180)
  );
}
export function facingPanel(viewer, display) {
  if (!viewer || !display) return false;
  const a = viewer.matrix,
    b = display.matrix,
    dx = b[12] - a[12],
    dy = b[13] - a[13],
    dz = b[14] - a[14],
    d = Math.hypot(dx, dy, dz);
  return (
    d > 0.1 &&
    -(dx * a[8] + dy * a[9] + dz * a[10]) / d > Math.cos((40 * Math.PI) / 180)
  );
}
// Wrist/palm tracking remains useful while a pinch occludes its own tips.
// A target ray is an aiming aid, never proof of the physical hand's location.
export function handAnchor({
  wrist,
  palm,
  index,
  thumb,
  palmDeclared = false,
}) {
  const valid = (p) => p && !p.emulatedPosition && p.transform?.position;
  if (valid(wrist))
    return { position: wrist.transform.position, kind: "wrist" };
  if (valid(palm)) return { position: palm.transform.position, kind: "palm" };
  if (palmDeclared) return { position: null, kind: "palm-untracked" };
  if (valid(index) && valid(thumb))
    return {
      position: {
        x: (index.transform.position.x + thumb.transform.position.x) / 2,
        y: (index.transform.position.y + thumb.transform.position.y) / 2,
        z: (index.transform.position.z + thumb.transform.position.z) / 2,
      },
      kind: "tips-compatibility",
    };
  return { position: null, kind: "untracked" };
}

// Native events are the ONLY action authority. Frame samples only establish
// safe tracking, fresh-open readiness, and continuously validate a held press.
export class GestureEngine {
  constructor() {
    this.hands = new Map();
    this.owner = null;
    this.context = "centering";
    this.cooldownUntil = 0;
    this.log = [];
    this.ignored = [];
    this.trace = [];
    this.lastEntry = null;
  }
  record(entry) {
    this.log.push(entry);
    if (this.log.length > 40) this.log.shift();
    return entry;
  }
  note(entry) {
    this.ignored.push(entry);
    if (this.ignored.length > 40) this.ignored.shift();
    return entry;
  }
  snapshot(h) {
    return {
      hand: h?.hand,
      inView: !!h?.inView,
      tracked: !!h?.tracked,
      stable: !!h?.stable,
      attentive: !!h?.attentive,
      context: this.context,
      anchorKind: h?.anchorKind,
      tipsTracked: !!h?.tipsTracked,
    };
  }
  reset(reason = "reset") {
    for (const key of this.hands.keys()) this.cancel(key, reason);
    this.hands.clear();
    this.owner = null;
  }
  cancel(key, reason = "cancelled", time) {
    const h = this.hands.get(key);
    if (!h) return;
    if (h.closed)
      this.record({
        result: "cancelled",
        reason,
        eventSource: "native-select",
        time: time ?? h.lastTime,
        ...this.snapshot(h),
      });
    h.closed = false;
    h.nativeDown = false;
    h.needsOpen = true;
    h.completed = false;
    h.armed = false;
    h.openSince = null;
    h.stableSince = null;
    h.stable = false;
    if (this.owner === key) this.owner = null;
  }
  setContext(context) {
    this.reset("context-change");
    this.context = context;
  }
  update(
    key,
    {
      time,
      hand = "none",
      tracked = false,
      inView = false,
      attentive = false,
      systemGesture = false,
      open = false,
      target = null,
      anchorKind = null,
      tipsTracked = false,
    },
  ) {
    let h = this.hands.get(key);
    if (!h) {
      h = {
        hand,
        armed: false,
        closed: false,
        nativeDown: false,
        needsOpen: true,
        completed: false,
        stableSince: null,
        openSince: null,
        lastTime: time,
      };
      this.hands.set(key, h);
    }
    if (time - h.lastTime > MAX_GAP_MS) this.cancel(key, "tracking-gap", time);
    Object.assign(h, {
      lastTime: time,
      hand,
      tracked,
      inView,
      attentive,
      target,
      systemGesture,
      anchorKind,
      tipsTracked,
    });
    h.safe =
      tracked &&
      inView &&
      attentive &&
      !systemGesture &&
      ["left", "right"].includes(hand);
    if (!h.safe) {
      this.cancel(
        key,
        systemGesture
          ? "system-gesture"
          : !attentive
            ? "attention-paused"
            : !tracked
              ? "tracking-lost"
              : "hand-out-of-view",
        time,
      );
      return;
    }
    h.stableSince ??= time;
    h.stable = time - h.stableSince >= STABLE_MS;
    if (h.closed) return;
    if (!h.needsOpen) {
      h.armed = h.stable;
      return;
    }
    if (open && !h.nativeDown) {
      h.openSince ??= time;
      h.armed =
        h.stable &&
        time - h.openSince >= OPEN_SETTLE_MS &&
        time >= this.cooldownUntil;
      if (h.armed) h.needsOpen = false;
    } else {
      h.openSince = null;
      if (h.nativeDown) h.armed = false;
    }
  }
  handle(kind, key, time, target = null) {
    const h = this.hands.get(key),
      fresh = h && time - h.lastTime <= MAX_GAP_MS;
    const gate = {
      ...this.snapshot(h),
      eventSource: "native-select",
      kind,
      time,
    };
    this.trace.push({ ...gate, stage: "validated", ready: !!h?.armed });
    if (this.trace.length > 120) this.trace.shift();
    if (kind === "selectstart") {
      if (h?.closed && this.owner === key) {
        this.note({ ...gate, result: "ignored", reason: "duplicate-start" });
        return null;
      }
      if (h) h.nativeDown = true;
      const reason = !fresh
        ? "stale-tracking"
        : !h.safe
          ? "unsafe"
          : !h.stable
            ? "tracking-settling"
            : !h.armed
              ? "fresh-open-required"
              : this.owner !== null
                ? "other-hand-owns-press"
                : time < this.cooldownUntil
                  ? "cooldown"
                  : null;
      if (reason) {
        this.note({ ...gate, result: "ignored", reason });
        if (h) {
          h.nativeDown = false;
          h.armed = false;
          h.openSince = null;
          h.needsOpen = true;
          h.completed = false;
        }
        return null;
      }
      h.closed = true;
      h.completed = false;
      h.armed = false;
      h.started = time;
      h.pressTarget = target;
      h.pressContext = this.context;
      this.owner = key;
      return null;
    }
    if (kind === "selectend") {
      if (h) {
        h.nativeDown = false;
        if (h.closed) this.cancel(key, "end-without-select", time);
        if (h.completed) {
          h.completed = false;
          h.armed = h.safe && h.stable;
        }
      }
      return null;
    }
    if (kind !== "select") return null;
    if (
      !fresh ||
      !h.safe ||
      !h.closed ||
      this.owner !== key ||
      h.pressContext !== this.context
    ) {
      this.note({ ...gate, result: "ignored", reason: "no-valid-start" });
      return null;
    }
    const duration = Math.max(0, time - h.started);
    let event;
    if (this.context === "centering") event = { type: "center", hand: h.hand };
    else if (duration >= HOLD_MS) event = { type: "menu", hand: h.hand };
    else if (this.context === "menu") {
      if (h.pressTarget && target === h.pressTarget)
        event = { type: "select", target, hand: h.hand };
    } else event = { type: "page", hand: h.hand };
    h.closed = false;
    h.nativeDown = false;
    h.completed = true;
    h.needsOpen = false;
    h.armed = true;
    this.owner = null;
    this.cooldownUntil = time + COOLDOWN_MS;
    this.lastEntry = this.record({
      ...gate,
      result: event?.type ?? "rejected",
      reason: event ? undefined : "moved-off-button",
      ms: Math.round(duration),
    });
    return event ?? null;
  }
  tick(time) {
    const h = this.hands.get(this.owner);
    if (
      !h ||
      !h.closed ||
      !h.safe ||
      time - h.lastTime > MAX_GAP_MS ||
      this.context === "centering" ||
      time - h.started < HOLD_MS
    )
      return null;
    h.closed = false;
    h.needsOpen = true;
    h.completed = false;
    h.armed = false;
    h.openSince = null;
    this.owner = null;
    this.cooldownUntil = time + COOLDOWN_MS;
    this.lastEntry = this.record({
      result: "menu",
      eventSource: "native-hold",
      time,
      ms: Math.round(time - h.started),
      ...this.snapshot(h),
    });
    return { type: "menu", hand: h.hand };
  }
  holdCharge(time, key = this.owner) {
    const h = this.hands.get(key);
    return this.context !== "centering" && h?.closed && h.safe
      ? Math.min(1, Math.max(0, (time - h.started) / HOLD_MS))
      : 0;
  }
  progress(time, key = this.owner) {
    const charge = this.holdCharge(time, key);
    return Math.max(
      0,
      Math.min(
        1,
        (charge * HOLD_MS - RING_DELAY_MS) / (HOLD_MS - RING_DELAY_MS),
      ),
    );
  }
}
// Two short menu pages. Main holds what a reader needs; "More settings"
// holds rarely used preferences. Page arrows live on the hands, not here.
export const MENU_PAGES = {
  main: ["resume", "calendar", "night", "size", "more", "recenter", "exit"],
  // Back sits exactly where "More settings" was, so a repeated pinch just
  // returns to the main page instead of choosing something new.
  more: ["swap", "pointer", "sound", "practice", "back"],
};
export const menuLabels = {
  resume: "Continue reading",
  calendar: "Challenge calendar",
  recenter: "Move page here",
  night: "Page colour",
  size: "Text size",
  more: "More settings",
  exit: "Leave the cabin",
  back: "Back",
  swap: "Next page hand",
  pointer: "Point with",
  sound: "Welcome chime",
  practice: "Practise gestures",
};
export const menuButtons = Object.entries(MENU_PAGES).flatMap(([page, ids]) =>
  ids.map((id, i) => ({
    id,
    page,
    label: menuLabels[id],
    x: 274,
    y: 580 + i * 222,
    w: 1500,
    h: 186,
  })),
);
export function menuHit(x, y, page = "main") {
  return (
    menuButtons.find(
      (b) =>
        b.page === page &&
        x >= b.x &&
        x <= b.x + b.w &&
        y >= b.y &&
        y <= b.y + b.h,
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
