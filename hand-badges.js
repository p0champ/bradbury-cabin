import { PoseFollower } from "./follow-pose.js?v=56";
// Small compositor layers follow the hands; the reading layer stays fixed.
export function paintHandBadge(
  canvas,
  {
    forward = true,
    progress = 0,
    ready = false,
    flash = false,
    menu = false,
    available = true,
    blocked = false,
    welcome = null,
  } = {},
) {
  // Strong neutral backing keeps the small symbol readable over passthrough.
  // A quiet rim suggests glass without relying on transparency for legibility.
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = "rgba(35, 43, 42, 0.94)";
  c.beginPath();
  c.arc(128, 128, 108, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(240, 242, 238, 0.45)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(128, 128, 106, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = "rgba(255, 255, 255, 0.18)";
  c.lineWidth = 4;
  c.beginPath();
  c.arc(128, 128, 103, -Math.PI * .83, -Math.PI * .17);
  c.stroke();
  if (progress > 0) {
    c.strokeStyle = flash ? "#fff3d0" : "#f5e6c4";
    c.lineWidth = 5;
    c.lineCap = "round";
    c.beginPath();
    c.arc(128, 128, 101, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
    c.stroke();
  }
  // The symbol is dimmed when that direction has no page left; a blocked
  // attempt shows a short warm end stop instead, so it never looks like a turn.
  // A successful turn always flashes, even if it just reached the last page.
  // Only a real turn is pure white; resting and dimmed states are soft greys.
  const ink = blocked || (!available && !flash)
    ? "rgba(196, 201, 198, 0.85)"
    : flash
      ? "#ffffff"
      : ready
        ? "rgba(243, 245, 242, 0.98)"
        : "rgba(236, 239, 235, 0.98)";
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = 6;
  c.lineCap = "round";
  c.lineJoin = "round";
  if (menu) {
    for (const y of [104, 128, 152]) {
      c.beginPath();
      c.moveTo(96, y);
      c.lineTo(160, y);
      c.stroke();
    }
  } else {
    c.save();
    if (!forward) {
      c.translate(256, 0);
      c.scale(-1, 1);
    }
    c.beginPath();
    c.moveTo(96, 84);
    c.lineTo(140, 128);
    c.lineTo(96, 172);
    c.stroke();
    if (blocked || (!available && !flash)) {
      c.fillStyle = blocked ? "#f2b48a" : "rgba(242, 180, 138, 0.5)";
      c.beginPath();
      if (c.roundRect) c.roundRect(164, 94, 12, 68, 6);
      else c.rect(164, 94, 12, 68);
      c.fill();
    }
    c.restore();
  }
  c.lineCap = "butt";
  c.lineJoin = "miter";

}

export class HandBadges {
  constructor(binding, space, onError = () => {}) {
    this.binding = binding;
    this.space = space;
    this.onError = onError;
    this.entries = new Map();
    this.visible = [];
    this.failed = false;
  }
  createEntry(hand) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const layer = this.binding.createQuadLayer({
      space: this.space, layout: "mono", textureType: "texture",
      viewPixelWidth: 256, viewPixelHeight: 256,
      width: 0.036, height: 0.036, isStatic: false, clearOnAccess: false,
    });
    layer.blendTextureSourceAlpha = true;
    layer.opacity = 0;
    paintHandBadge(canvas, { forward: hand === "right" });
    const e = {canvas, layer, key: "", dirty: true, initialUpload: true,
      pulseUntil: 0, follower: new PoseFollower(), moving: false, lastActivity: null,
      lastInput: null, opacity: 0};
    this.entries.set(hand, e);
    return e;
  }
  prepare() {
    if (this.failed) return [];
    try {
      for (const hand of ["left", "right"])
        if (!this.entries.has(hand)) this.createEntry(hand);
      return [...this.entries.values()].map(e => e.layer);
    } catch (error) {
      this.failed = true; this.clearVisible(); this.onError(error); return [];
    }
  }
  pendingPreloads() {
    return this.failed ? [] : [...this.entries.values()]
      .filter(e => e.initialUpload).map(e => e.layer);
  }
  clearVisible() {
    for (const e of this.entries.values()) e.layer.opacity = 0;
    const changed = this.visible.length > 0;
    this.visible = [];
    return changed;
  }
  // outcome: "turned" | "practice" | "select" flash the icon; "menu" shows a
  // full ring; "first-page" | "last-page" show the end bar, never a turn flash.
  pulse(hand, time, outcome) {
    const e = this.entries.get(hand);
    if (!e) return;
    e.lastActivity = time;
    e.blocked = outcome === "first-page" || outcome === "last-page";
    e.pulseUntil = time + (e.blocked ? 600 : 220);
    e.fullHold = outcome === "menu";
  }
  update(
    samples,
    viewer,
    engine,
    {
      swapped = false,
      menu = false,
      practice = false,
      canForward = true,
      canBack = true,
      time = 0,
      entryTime = null,
      nearPage = false,
    } = {},
  ) {
    const next = [], seen = new Set();
    if (!this.failed)
      for (const sample of samples) {
        if (!["left", "right"].includes(sample.hand)) continue;
        if (sample.systemGesture) {
          seen.add(sample.hand);
          const hidden = this.entries.get(sample.hand);
          if (hidden) hidden.layer.opacity = 0;
          continue;
        }
        try {
          const e = this.entries.get(sample.hand) || this.createEntry(sample.hand);
          seen.add(sample.hand);
          const p = sample.position, v = viewer.position;
          const d = p ? Math.hypot(v.x-p.x,v.y-p.y,v.z-p.z)||1 : 1;
          const target = p ? {x:p.x+(v.x-p.x)/d*.035,y:p.y+(v.y-p.y)/d*.035,z:p.z+(v.z-p.z)/d*.035} : null;
          const pose = e.follower.update(target, p ? viewer.orientation : null, time);
          if (!pose) continue;
          e.moving = pose.moving;
          e.layer.transform = new XRRigidTransform(pose.position, pose.orientation);
          if (e.lastActivity == null) e.lastActivity = time;
          if (p && e.lastInput && Math.hypot(p.x-e.lastInput.x,p.y-e.lastInput.y,p.z-e.lastInput.z) > .003) {
            e.lastActivity = time; e.lastInput = {...p};
          } else if (p && !e.lastInput) e.lastInput = {...p};
          const h = engine.hands.get(sample.source),
            ready = !!h?.armed && time >= engine.cooldownUntil,
            progress = engine.progress(time, sample.source),
            flash = time < e.pulseUntil;
          const forward = (sample.hand === "right") !== swapped;
          const available = menu || practice || (forward ? canForward : canBack);
          const blocked = flash && !!e.blocked;
          if (progress > 0 || flash || h?.closed) e.lastActivity = time;
          const shownProgress = flash && e.fullHold ? 1 : progress;
          const key = [forward,Math.round(shownProgress*48),ready,flash,menu,available,blocked].join(":");
          if (key !== e.key) {
            paintHandBadge(e.canvas, {forward,progress:shownProgress,ready,flash:flash&&!blocked,menu,available,blocked});
            e.key = key; e.dirty = true;
          }
          // Resting tracked controls stay visible; only tracking loss fades them.
          e.layer.opacity = .96 * pose.lossOpacity;
          next.push(e.layer);
        } catch (error) {
          this.failed = true;
          this.clearVisible();
          this.onError(error);
          return true;
        }
      }
    for (const [hand,e] of this.entries) {
      if (seen.has(hand)) continue;
      const pose = e.follower.update(null, null, time);
      e.moving = false;
      if (pose && pose.lossOpacity > 0 && e.layer.opacity > 0) {
        e.layer.opacity = Math.min(e.layer.opacity, .96 * pose.lossOpacity);
        next.push(e.layer);
      } else e.layer.opacity = 0;
    }
    const changed =
      next.length !== this.visible.length ||
      next.some((layer, i) => layer !== this.visible[i]);
    this.visible = next;
    return changed;
  }
  draw(frame, gpu, activeLayers) {
    for (const e of this.entries.values())
      if (
        activeLayers.includes(e.layer) &&
        (this.visible.includes(e.layer) || e.initialUpload) &&
        (e.dirty || e.layer.needsRedraw)
      ) {
        try {
          gpu.copyPage(this.binding.getSubImage(e.layer, frame), e.canvas, {
            premultiplied: true,
          });
          e.dirty = false;
          e.initialUpload = false;
        } catch (error) {
          this.failed = true;
          this.clearVisible();
          this.onError(error);
          return true;
        }
      }
    return false;
  }
  dispose() {
    for (const e of this.entries.values()) e.layer.destroy();
    this.entries.clear();
    this.visible = [];
  }
}
