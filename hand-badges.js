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
  // A small disc of frosted glass with one thin symbol, as on visionOS: no
  // words, no colour except a warm hint for the hold ring and the end stop.
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = "rgba(60, 64, 60, 0.35)";
  c.beginPath();
  c.arc(128, 128, 108, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = `rgba(240, 242, 238, ${ready ? 0.6 : 0.4})`;
  c.lineWidth = 3;
  c.beginPath();
  c.arc(128, 128, 106, 0, Math.PI * 2);
  c.stroke();
  if (progress > 0) {
    c.strokeStyle = flash ? "#fff3d0" : "#f5e6c4";
    c.lineWidth = 9;
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
    ? "rgba(170, 174, 170, 0.55)"
    : flash
      ? "#ffffff"
      : ready
        ? "rgba(236, 238, 234, 0.95)"
        : "rgba(225, 228, 224, 0.8)";
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = 14;
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
  if (welcome != null) {
    c.save();
    c.globalAlpha = Math.sin(Math.PI * welcome) * 0.8;
    c.strokeStyle = "#ecd79b";
    c.lineWidth = 3;
    const radius = 48 + 62 * welcome,
      angle = welcome * Math.PI * 2;
    for (const offset of [0, Math.PI]) {
      c.beginPath();
      c.arc(128, 128, radius, angle + offset, angle + offset + 1.4);
      c.stroke();
      const x = 128 + Math.cos(angle + offset) * radius,
        y = 128 + Math.sin(angle + offset) * radius;
      c.fillStyle = "#fff3ce";
      c.beginPath();
      c.arc(x, y, 3, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
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
    } = {},
  ) {
    const next = [];
    if (!this.failed)
      for (const sample of samples) {
        if (
          !sample.position ||
          sample.systemGesture ||
          !["left", "right"].includes(sample.hand)
        )
          continue;
        try {
          let e = this.entries.get(sample.hand);
          if (!e) {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 256;
            const layer = this.binding.createQuadLayer({
              space: this.space,
              layout: "mono",
              textureType: "texture",
              viewPixelWidth: 256,
              viewPixelHeight: 256,
              width: 0.06,
              height: 0.06,
              isStatic: false,
              clearOnAccess: false,
            });
            layer.blendTextureSourceAlpha = true;
            e = { canvas, layer, key: "", dirty: true, pulseUntil: 0 };
            this.entries.set(sample.hand, e);
          }
          const h = engine.hands.get(sample.source),
            ready = !!h?.armed && time >= engine.cooldownUntil,
            progress = engine.progress(time, sample.source),
            flash = time < e.pulseUntil;
          const forward = (sample.hand === "right") !== swapped;
          const available =
            menu || practice || (forward ? canForward : canBack);
          const blocked = flash && !!e.blocked;
          if (entryTime != null && e.welcomeStart == null)
            e.welcomeStart = time;
          const welcome =
            e.welcomeStart != null && time - e.welcomeStart < 1000
              ? (time - e.welcomeStart) / 1000
              : null;
          const shownProgress = flash && e.fullHold ? 1 : progress;
          const key = [
            forward,
            Math.round(shownProgress * 48),
            ready,
            flash,
            menu,
            available,
            blocked,
            welcome == null ? "" : Math.round(welcome * 48),
          ].join(":");
          if (key !== e.key) {
            paintHandBadge(e.canvas, {
              forward,
              progress: shownProgress,
              ready,
              flash: flash && !blocked,
              menu,
              available,
              blocked,
              welcome,
            });
            e.key = key;
            e.dirty = true;
          }
          const p = sample.position,
            v = viewer.position,
            d = Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z) || 1;
          const toward =
            0.035 + (welcome == null ? 0 : Math.sin(Math.PI * welcome) * 0.012);
          e.layer.transform = new XRRigidTransform(
            {
              x: p.x + ((v.x - p.x) / d) * toward,
              y: p.y + ((v.y - p.y) / d) * toward,
              z: p.z + ((v.z - p.z) / d) * toward,
            },
            viewer.orientation,
          );
          e.layer.opacity = 1;
          next.push(e.layer);
        } catch (error) {
          this.failed = true;
          this.clearVisible();
          this.onError(error);
          return true;
        }
      }
    for (const e of this.entries.values())
      if (!next.includes(e.layer)) e.layer.opacity = 0;
    const changed =
      next.length !== this.visible.length ||
      next.some((layer, i) => layer !== this.visible[i]);
    this.visible = next;
    return changed;
  }
  draw(frame, gpu, activeLayers) {
    for (const e of this.entries.values())
      if (
        this.visible.includes(e.layer) &&
        activeLayers.includes(e.layer) &&
        (e.dirty || e.layer.needsRedraw)
      ) {
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
      }
    return false;
  }
  dispose() {
    for (const e of this.entries.values()) e.layer.destroy();
    this.entries.clear();
    this.visible = [];
  }
}
