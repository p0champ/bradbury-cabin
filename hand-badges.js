// Small compositor layers follow the hands; the reading layer stays fixed.
export function paintHandBadge(
  canvas,
  {
    forward = true,
    progress = 0,
    ready = false,
    flash = false,
    menu = false,
  } = {},
) {
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 256, 256);
  c.fillStyle = "#243c32";
  c.beginPath();
  c.arc(128, 128, 112, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = ready ? "#829c8a" : "#4a6356";
  c.lineWidth = 9;
  c.beginPath();
  c.arc(128, 128, 102, 0, Math.PI * 2);
  c.stroke();
  if (progress > 0) {
    c.strokeStyle = flash ? "#fff4ca" : "#e8c980";
    c.lineWidth = 11;
    c.lineCap = "round";
    c.beginPath();
    c.arc(
      128,
      128,
      102,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress),
    );
    c.stroke();
  }
  c.fillStyle = ready || flash ? "#faf0d4" : "#829486";
  if (menu) {
    for (const y of [102, 124, 146]) c.fillRect(91, y, 74, 8);
  } else {
    c.save();
    if (!forward) {
      c.translate(256, 0);
      c.scale(-1, 1);
    }
    for (const x of [78, 116]) {
      c.beginPath();
      c.moveTo(x, 94);
      c.lineTo(x + 35, 128);
      c.lineTo(x, 162);
      c.closePath();
      c.fill();
    }
    c.fillRect(166, 94, 8, 68);
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
  pulse(hand, time, type) {
    const e = this.entries.get(hand);
    if (e) {
      e.pulseUntil = time + 200;
      e.fullHold = type === "menu";
    }
  }
  update(
    samples,
    viewer,
    engine,
    { swapped = false, menu = false, time = 0 } = {},
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
            progress = engine.progress(time, sample.source),
            flash = time < e.pulseUntil;
          const forward = (sample.hand === "right") !== swapped;
          const shownProgress = flash && e.fullHold ? 1 : progress;
          const key = [
            forward,
            Math.round(shownProgress * 48),
            !!h?.armed,
            flash,
            menu,
          ].join(":");
          if (key !== e.key) {
            paintHandBadge(e.canvas, {
              forward,
              progress: shownProgress,
              ready: !!h?.armed,
              flash,
              menu,
            });
            e.key = key;
            e.dirty = true;
          }
          const p = sample.position,
            v = viewer.position,
            d = Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z) || 1;
          const toward = 0.035;
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
