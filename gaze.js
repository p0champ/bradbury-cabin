// Optional page turn by looking (head direction, not eye tracking). Off by
// default. Look at the bottom-right corner of the page to go forward, the
// bottom-left corner to go back, and hold the look for DWELL_MS. A small ring
// beside that corner fills while you look; after a turn you must look away
// from the corner before it can turn again.
export const DWELL_MS = 1300;
export const ZONE = { width: 0.2, height: 0.14 }; // fraction of the page

// x, y in page canvas pixels (2048 × 2560). Returns "next", "prev" or null.
export function gazeZone(x, y, W = 2048, H = 2560) {
  if (x == null || y == null) return null;
  if (y < H * (1 - ZONE.height) || y > H) return null;
  if (x > W * (1 - ZONE.width) && x <= W) return "next";
  if (x < W * ZONE.width && x >= 0) return "prev";
  return null;
}

export class GazeDwell {
  constructor() {
    this.zone = null;
    this.since = null;
    this.armed = true;
  }
  reset() {
    this.zone = null;
    this.since = null;
    this.armed = true;
  }
  // Returns { fire: "next" | "prev" | null, zone, progress 0..1 }.
  update(zone, time, enabled = true) {
    if (!enabled) {
      this.reset();
      return { fire: null, zone: null, progress: 0 };
    }
    if (zone !== this.zone) {
      this.zone = zone;
      this.since = zone ? time : null;
      if (!zone) this.armed = true;
    }
    if (!zone || !this.armed) return { fire: null, zone, progress: 0 };
    const progress = Math.min(1, (time - this.since) / DWELL_MS);
    if (progress >= 1) {
      this.armed = false;
      return { fire: zone, zone, progress: 1 };
    }
    return { fire: null, zone, progress };
  }
}

export function paintGazeRing(canvas, progress, night = false) {
  const c = canvas.getContext("2d");
  const S = canvas.width;
  c.clearRect(0, 0, S, S);
  if (progress <= 0) return;
  c.fillStyle = night ? "rgba(26,33,30,0.85)" : "rgba(247,240,223,0.9)";
  c.beginPath();
  c.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = night ? "#e2c77e" : "#c8973a";
  c.lineWidth = S * 0.09;
  c.lineCap = "round";
  c.beginPath();
  c.arc(S / 2, S / 2, S * 0.32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  c.stroke();
}

// One small quad layer beside the page corner being looked at.
export class GazeRing {
  constructor(binding, space, onError = () => {}) {
    this.binding = binding;
    this.space = space;
    this.onError = onError;
    this.entry = null;
    this.visible = [];
    this.failed = false;
  }
  clearVisible() {
    if (this.entry) this.entry.layer.opacity = 0;
    const changed = this.visible.length > 0;
    this.visible = [];
    return changed;
  }
  // display: the page's XRRigidTransform. Returns true when the layer list changes.
  update(display, zone, progress, night) {
    const before = this.visible.length;
    if (this.failed || !display || !zone || progress <= 0) {
      this.clearVisible();
      return before !== 0;
    }
    try {
      if (!this.entry) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 192;
        const layer = this.binding.createQuadLayer({
          space: this.space,
          layout: "mono",
          textureType: "texture",
          viewPixelWidth: 192,
          viewPixelHeight: 192,
          width: 0.07,
          height: 0.07,
          isStatic: false,
          clearOnAccess: false,
        });
        layer.blendTextureSourceAlpha = true;
        this.entry = { canvas, layer, key: "", dirty: true };
      }
      const e = this.entry;
      const key = `${Math.round(progress * 32)}:${night}`;
      if (key !== e.key) {
        paintGazeRing(e.canvas, progress, night);
        e.key = key;
        e.dirty = true;
      }
      // Just outside the bottom corner of the 0.72 × 0.90 m page, 1 cm in front.
      const local = new DOMPoint(zone === "next" ? 0.4 : -0.4, -0.42, 0.01).matrixTransform(new DOMMatrix(display.matrix));
      e.layer.transform = new XRRigidTransform({ x: local.x, y: local.y, z: local.z }, display.orientation);
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
      gpu.copyPage(this.binding.getSubImage(e.layer, frame), e.canvas, { premultiplied: true });
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
