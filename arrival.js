// A brief, transparent book gateway. It never moves the viewer or replaces
// passthrough. Original procedural artwork; no external assets.
// "Lamp on": a warm glow rises and settles, then Today's header fades in
// where it belongs and the three readings rise into place, a beat apart.
export const ARRIVAL_MS = 5000;
// Reduced motion: one short fade straight into Today, no movement.
export const ARRIVAL_REDUCED_MS = 300;
// A fresh pinch skips to Today, but never the placing pinch's own release.
export const ARRIVAL_SKIP_AFTER_MS = 400;
// Rise distance in page pixels (2048 px = 0.72 m), about 1 cm.
export const LAMP_RISE_PX = 28;
export function easeArrival(p) {
  p = Math.max(0, Math.min(1, p));
  // Retained for the optional leaf artwork.
  return 1 - (1 - p) ** 4;
}
// Smooth in and out, for fades that should never visibly step.
export const smooth = (p) => {
  p = Math.max(0, Math.min(1, p));
  return p * p * (3 - 2 * p);
};
const LAMP = { opacityMs: 1400, glowRise: 1100, glowSettle: [1300, 1300], glowPeak: .55,
  header: [2000, 900], rows: 2700, rowStep: 380, rowMs: 900, footerMs: 800 };
const span = (t, start, ms) => Math.max(0, Math.min(1, (t - start) / ms));
const easeOut = (p) => 1 - (1 - p) ** 3;
// Everything the compositor needs at t ms into the arrival. Pure, so tests
// and previews can sample any moment without running frames.
export function lampFrame(t, rowCount = 3) {
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const p = span(t, LAMP.rows + i * LAMP.rowStep, LAMP.rowMs);
    return { alpha: smooth(p), lift: LAMP_RISE_PX * (1 - easeOut(p)) };
  });
  return {
    opacity: smooth(t / LAMP.opacityMs),
    glow: LAMP.glowPeak * smooth(span(t, 0, LAMP.glowRise)) * (1 - smooth(span(t, ...LAMP.glowSettle))),
    header: smooth(span(t, ...LAMP.header)),
    rows,
    footer: smooth(span(t, LAMP.rows + rowCount * LAMP.rowStep, LAMP.footerMs)),
  };
}
// The lamp's light: a warm pane, brightest a little above centre, with no
// hard edge. Drawn once at low resolution; the GPU scales it smoothly.
export function paintLampGlow(canvas, radius) {
  const c = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.save();
  c.beginPath(); c.roundRect(0, 0, w, h, radius); c.clip();
  const g = c.createRadialGradient(w / 2, h * .42, 0, w / 2, h * .42, Math.hypot(w, h) * .62);
  g.addColorStop(0, "rgba(255,214,160,.95)");
  g.addColorStop(.45, "rgba(255,196,128,.55)");
  g.addColorStop(1, "rgba(240,170,105,.22)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.restore();
}
export function localPose(anchor, x, y, z, yaw = 0) {
  const m = anchor.matrix,
    q = anchor.orientation,
    s = Math.sin(yaw / 2),
    c = Math.cos(yaw / 2);
  return new XRRigidTransform(
    {
      x: m[12] + m[0] * x + m[4] * y + m[8] * z,
      y: m[13] + m[1] * x + m[5] * y + m[9] * z,
      z: m[14] + m[2] * x + m[6] * y + m[10] * z,
    },
    {
      x: q.x * c - q.z * s,
      y: q.w * s + q.y * c,
      z: q.x * s + q.z * c,
      w: q.w * c - q.y * s,
    },
  );
}
export function pageArrivalPose(anchor, p) {
  // Placement stays fixed; arrival changes opacity only.
  return localPose(anchor, 0, 0, -1.1, 0);
}
export function paintLeaf(canvas, side) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  if (side === 1) {
    c.translate(w, 0);
    c.scale(-1, 1);
  }
  const wash = c.createLinearGradient(0, 0, w, 0);
  wash.addColorStop(0, "rgba(246,242,233,.72)");
  wash.addColorStop(0.5, "rgba(246,242,233,.12)");
  wash.addColorStop(1, "rgba(246,242,233,0)");
  c.fillStyle = wash;
  c.fillRect(34, 65, w - 34, h - 130);
  c.strokeStyle = "#bfae86";
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(w - 6, 30);
  c.bezierCurveTo(55, 30, 35, 100, 35, 240);
  c.lineTo(35, h - 100);
  c.quadraticCurveTo(35, h - 45, w - 6, h - 45);
  c.stroke();
  c.strokeStyle = "rgba(191,174,134,.35)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(w - 8, 49);
  c.bezierCurveTo(76, 49, 52, 112, 52, 240);
  c.lineTo(52, h - 100);
  c.quadraticCurveTo(52, h - 64, w - 8, h - 64);
  c.stroke();
  // Sparse letterpress rules and a diamond make a page-like invitation.
  for (let i = 0; i < 9; i++) {
    const y = 260 + i * 48;
    c.strokeStyle = `rgba(106,116,108,${0.22 - i * 0.016})`;
    c.beginPath();
    c.moveTo(76, y);
    c.lineTo(w - 44 - (i % 3) * 26, y);
    c.stroke();
  }
  c.fillStyle = "#bfae86";
  c.beginPath();
  c.moveTo(35, 168);
  c.lineTo(42, 180);
  c.lineTo(35, 192);
  c.lineTo(28, 180);
  c.closePath();
  c.fill();
  c.setTransform(1, 0, 0, 1, 0, 0);
}
export class Arrival {
  constructor(binding, space, onError = () => {}) {
    this.binding = binding;
    this.space = space;
    this.onError = onError;
    this.entries = [];
    this.visible = [];
    this.failed = false;
  }
  clearVisible() {
    for (const e of this.entries) e.layer.opacity = 0;
    const changed = this.visible.length > 0;
    this.visible = [];
    return changed;
  }
  update(anchor, time, progress = null) {
    if (this.failed) return this.clearVisible();
    try {
      if (!this.entries.length)
        for (const side of [-1, 1]) {
          const canvas = document.createElement("canvas");
          canvas.width = 384;
          canvas.height = 960;
          paintLeaf(canvas, side);
          const layer = this.binding.createQuadLayer({
            space: this.space,
            layout: "mono",
            textureType: "texture",
            viewPixelWidth: 384,
            viewPixelHeight: 960,
            width: 0.34,
            height: 1.02,
            isStatic: false,
            clearOnAccess: false,
          });
          layer.blendTextureSourceAlpha = true;
          this.entries.push({ side, canvas, layer, dirty: true });
        }
      const e = progress == null ? 0 : easeArrival(progress);
      for (const entry of this.entries) {
        entry.layer.transform = localPose(
          anchor,
          entry.side * (0.43 + 0.3 * e),
          0,
          -1.03 + 0.12 * e,
          entry.side * (0.07 + 1.08 * e),
        );
        entry.layer.opacity =
          progress == null
            ? 0.82
            : 1 - smooth((progress - 0.35) / 0.65);
      }
      const changed = this.visible.length !== this.entries.length;
      this.visible = this.entries.map((e) => e.layer);
      return changed;
    } catch (error) {
      this.failed = true;
      this.clearVisible();
      this.onError(error);
      return true;
    }
  }
  draw(frame, gpu, active) {
    for (const e of this.entries)
      if (
        this.visible.includes(e.layer) &&
        active.includes(e.layer) &&
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
    for (const e of this.entries) e.layer.destroy();
    this.entries = [];
    this.visible = [];
  }
}
