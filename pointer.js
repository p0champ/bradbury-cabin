// A quiet pointer for menus: a hairline beam from the hand that fades out
// towards the hand, ending in a soft dot on the page. Compositor layers only;
// the page itself never repaints for it. Hidden while reading.
const BEAM_PX = [48, 512], DOT_PX = 160;
const BEAM_WIDTH = 0.004, DOT_SIZE = 0.022;

function paintBeam(canvas) {
  const c = canvas.getContext("2d"), [w, h] = BEAM_PX;
  c.clearRect(0, 0, w, h);
  const along = c.createLinearGradient(0, 0, 0, h);
  along.addColorStop(0, "rgba(255,255,255,0.55)");
  along.addColorStop(0.55, "rgba(255,255,255,0.22)");
  along.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = along;
  c.fillRect(w * 0.3, 0, w * 0.4, h);
}
function paintDot(canvas) {
  const c = canvas.getContext("2d"), r = DOT_PX / 2;
  c.clearRect(0, 0, DOT_PX, DOT_PX);
  const halo = c.createRadialGradient(r, r, 0, r, r, r);
  halo.addColorStop(0, "rgba(255,255,255,0.95)");
  halo.addColorStop(0.32, "rgba(255,255,255,0.9)");
  halo.addColorStop(0.42, "rgba(255,255,255,0.28)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = halo;
  c.beginPath();
  c.arc(r, r, r, 0, Math.PI * 2);
  c.fill();
}
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
// Rotation whose columns are the given unit axes, as a quaternion.
function quat(x, y, z) {
  const t = x.x + y.y + z.z;
  if (t > 0) {
    const s = Math.sqrt(t + 1) * 2;
    return { w: s / 4, x: (y.z - z.y) / s, y: (z.x - x.z) / s, z: (x.y - y.x) / s };
  }
  if (x.x > y.y && x.x > z.z) {
    const s = Math.sqrt(1 + x.x - y.y - z.z) * 2;
    return { w: (y.z - z.y) / s, x: s / 4, y: (y.x + x.y) / s, z: (z.x + x.z) / s };
  }
  if (y.y > z.z) {
    const s = Math.sqrt(1 + y.y - x.x - z.z) * 2;
    return { w: (z.x - x.z) / s, x: (y.x + x.y) / s, y: s / 4, z: (z.y + y.z) / s };
  }
  const s = Math.sqrt(1 + z.z - x.x - y.y) * 2;
  return { w: (x.y - y.x) / s, x: (z.x + x.z) / s, y: (z.y + y.z) / s, z: s / 4 };
}

// Where a ray meets the page plane, in world space; null when it misses.
export function rayOnPage(ray, display, metresWide, metresHigh) {
  if (!ray || !display) return null;
  const m = ray.matrix, inv = new DOMMatrix(display.inverse.matrix);
  const o = { x: m[12], y: m[13], z: m[14] }, d = norm({ x: -m[8], y: -m[9], z: -m[10] });
  const lo = new DOMPoint(o.x, o.y, o.z).matrixTransform(inv);
  const ld = new DOMPoint(d.x, d.y, d.z, 0).matrixTransform(inv);
  if (ld.z >= -0.0001) return null;
  const t = -lo.z / ld.z;
  if (t < 0.05) return null;
  const lx = lo.x + ld.x * t, ly = lo.y + ld.y * t;
  if (Math.abs(lx) > metresWide / 2 + 0.04 || Math.abs(ly) > metresHigh / 2 + 0.04) return null;
  return { origin: o, direction: d, point: add(o, d, t), distance: t };
}

export class Pointer {
  constructor(binding, space, onError = () => {}) {
    this.binding = binding;
    this.space = space;
    this.onError = onError;
    this.entries = new Map();
    this.visible = [];
    this.failed = false;
  }
  entry(hand) {
    if (this.entries.has(hand)) return this.entries.get(hand);
    const beamCanvas = document.createElement("canvas");
    [beamCanvas.width, beamCanvas.height] = BEAM_PX;
    paintBeam(beamCanvas);
    const dotCanvas = document.createElement("canvas");
    dotCanvas.width = dotCanvas.height = DOT_PX;
    paintDot(dotCanvas);
    const make = (w, h, mw, mh) => {
      const layer = this.binding.createQuadLayer({
        space: this.space, layout: "mono", textureType: "texture",
        viewPixelWidth: w, viewPixelHeight: h, width: mw, height: mh,
        isStatic: false, clearOnAccess: false,
      });
      layer.blendTextureSourceAlpha = true;
      return layer;
    };
    const e = {
      beam: { canvas: beamCanvas, layer: make(...BEAM_PX, BEAM_WIDTH, 0.3), dirty: true },
      dot: { canvas: dotCanvas, layer: make(DOT_PX, DOT_PX, DOT_SIZE, DOT_SIZE), dirty: true },
    };
    this.entries.set(hand, e);
    return e;
  }
  clearVisible() {
    for (const e of this.entries.values()) e.beam.layer.opacity = e.dot.layer.opacity = 0;
    const changed = this.visible.length > 0;
    this.visible = [];
    return changed;
  }
  // rays: [{ hand, hit: rayOnPage(...) }]; viewer: the head position.
  update(rays, display, viewer) {
    if (this.failed) return this.clearVisible();
    try {
      const shown = [];
      for (const { hand, hit } of rays) {
        if (!hit) continue;
        const e = this.entry(hand);
        const start = add(hit.origin, hit.direction, 0.06),
          end = add(hit.point, hit.direction, -0.006);
        const length = Math.max(0.02, Math.hypot(...Object.values(sub(end, start))));
        const mid = add(start, sub(end, start), 0.5);
        const y = hit.direction;
        const toViewer = norm(sub(viewer, mid));
        const z = norm(add(toViewer, y, -dot(toViewer, y)));
        const x = cross(y, z);
        e.beam.layer.height = length;
        e.beam.layer.transform = new XRRigidTransform(mid, quat(x, y, z));
        e.dot.layer.transform = new XRRigidTransform(add(hit.point, hit.direction, -0.004), display.orientation);
        e.beam.layer.opacity = e.dot.layer.opacity = 1;
        shown.push(e.beam.layer, e.dot.layer);
      }
      for (const e of this.entries.values())
        if (!shown.includes(e.beam.layer)) e.beam.layer.opacity = e.dot.layer.opacity = 0;
      const changed = shown.length !== this.visible.length || shown.some((l, i) => l !== this.visible[i]);
      this.visible = shown;
      return changed;
    } catch (error) {
      this.failed = true;
      this.clearVisible();
      this.onError(error);
      return true;
    }
  }
  draw(frame, gpu, active) {
    for (const e of this.entries.values())
      for (const part of [e.beam, e.dot])
        if (this.visible.includes(part.layer) && active.includes(part.layer) && (part.dirty || part.layer.needsRedraw)) {
          try {
            gpu.copyPage(this.binding.getSubImage(part.layer, frame), part.canvas, { premultiplied: true });
            part.dirty = false;
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
    for (const e of this.entries.values()) { e.beam.layer.destroy(); e.dot.layer.destroy(); }
    this.entries.clear();
    this.visible = [];
  }
}
