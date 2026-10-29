// A quiet pointer for menus, as on visionOS: no beam, only a small soft dot
// where the hand points on the page. Over a choice it opens into a ring,
// which closes as you pinch. Compositor layers only; never shown while reading.
const DOT_PX = 160, DOT_SIZE = 0.014;
const LOOKS = ["dot", "ring", "press"];

function paintLook(canvas, look) {
  const c = canvas.getContext("2d"), r = DOT_PX / 2;
  c.clearRect(0, 0, DOT_PX, DOT_PX);
  if (look === "dot") {
    // 6 mm: a white dot with a faint ink edge, readable on paper and night.
    c.fillStyle = "rgba(255,255,255,0.92)";
    c.beginPath();
    c.arc(r, r, r * 0.43, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(31,42,36,0.28)";
    c.lineWidth = 4;
    c.stroke();
    return;
  }
  // 12 mm ring over a choice; 8 mm while pinching.
  const radius = look === "ring" ? r * 0.82 : r * 0.55;
  c.strokeStyle = "rgba(31,42,36,0.22)";
  c.lineWidth = 12;
  c.beginPath();
  c.arc(r, r, radius, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.lineWidth = 7;
  c.stroke();
}

// One-Euro filter (Casiez et al.): reduces still-hand noise and adapts to
// movement. Its response is measured, not a claim of zero latency. Large jumps (tracking returning) reset it instead of sliding.
export class OneEuro {
  constructor(minCutoff = 1.0, beta = 0.03, dCutoff = 1.0) {
    Object.assign(this, { minCutoff, beta, dCutoff, x: null, dx: null, t: null });
  }
  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(v, t, jump = Infinity) {
    if (this.x == null || t <= this.t || v.some((n, i) => Math.abs(n - this.x[i]) > jump)) {
      this.x = v.slice();
      this.dx = v.map(() => 0);
      this.t = t;
      return this.x;
    }
    const dt = Math.min(1, (t - this.t) / 1000);
    this.t = t;
    const ad = OneEuro.alpha(this.dCutoff, dt);
    this.dx = v.map((n, i) => this.dx[i] + ad * ((n - this.x[i]) / dt - this.dx[i]));
    const speed = Math.hypot(...this.dx);
    const a = OneEuro.alpha(this.minCutoff + this.beta * speed, dt);
    this.x = v.map((n, i) => this.x[i] + a * (n - this.x[i]));
    return this.x;
  }
}
// A ray as a minimal transform (only the parts hit-testing reads).
export function smoothRay(filter, ray, time) {
  if (!ray) return ray;
  const m = ray.matrix;
  const [ox, oy, oz, dx, dy, dz] = filter.filter([m[12], m[13], m[14], -m[8], -m[9], -m[10]], time, 0.15);
  const l = Math.hypot(dx, dy, dz) || 1;
  const out = new Float32Array(16);
  out[0] = out[5] = out[10] = out[15] = 1;
  out[8] = -dx / l; out[9] = -dy / l; out[10] = -dz / l;
  out[12] = ox; out[13] = oy; out[14] = oz;
  return { matrix: out };
}
const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
// Where a ray meets the page plane, in world space; null when it misses.
export function rayOnPage(ray, display, metresWide, metresHigh) {
  if (!ray || !display) return null;
  const m = ray.matrix, inv = new DOMMatrix(display.inverse.matrix);
  const o = { x: m[12], y: m[13], z: m[14] }, d = norm({ x: -m[8], y: -m[9], z: -m[10] });
  const lo = new DOMPoint(o.x, o.y, o.z).matrixTransform(inv);
  const ld = new DOMPoint(d.x, d.y, d.z, 0).matrixTransform(inv);
  if (ld.z >= -0.0001) return null;
  const t = -lo.z / ld.z;
  if (t < 0.08) return null;
  const lx = lo.x + ld.x * t, ly = lo.y + ld.y * t;
  if (Math.abs(lx) > metresWide / 2 + 0.04 || Math.abs(ly) > metresHigh / 2 + 0.04) return null;
  const normal = norm({ x: display.matrix[8], y: display.matrix[9], z: display.matrix[10] });
  return { origin: o, direction: d, point: add(o, d, t), distance: t,
    local: { x: lx, y: ly }, normal };
}

// Filter the place the reader aims at, in millimetres on the page. Ray origin
// and direction have different units; filtering them together hid excess drag.
export class PageAimFilter {
  constructor() { this.filter = new OneEuro(1, 0.08); }
  reset() { this.filter.x = null; }
  update(ray, display, width, height, time) {
    const raw = rayOnPage(ray, display, width, height);
    if (!raw) { this.reset(); return null; }
    const [x, y] = this.filter.filter([raw.local.x * 1000, raw.local.y * 1000], time, 150);
    const local = { x: x / 1000, y: y / 1000 };
    const world = new DOMPoint(local.x, local.y, 0).matrixTransform(new DOMMatrix(display.matrix));
    return { ...raw, local, point: { x: world.x, y: world.y, z: world.z } };
  }
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
    const canvases = {};
    for (const look of LOOKS) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = DOT_PX;
      paintLook(canvas, look);
      canvases[look] = canvas;
    }
    const layer = this.binding.createQuadLayer({
      space: this.space, layout: "mono", textureType: "texture",
      viewPixelWidth: DOT_PX, viewPixelHeight: DOT_PX, width: DOT_SIZE, height: DOT_SIZE,
      isStatic: false, clearOnAccess: false,
    });
    layer.blendTextureSourceAlpha = true;
    const e = { canvases, look: "dot", layer, dirty: true };
    this.entries.set(hand, e);
    return e;
  }
  clearVisible() {
    for (const e of this.entries.values()) e.layer.opacity = 0;
    const changed = this.visible.length > 0;
    this.visible = [];
    return changed;
  }
  // rays: [{ hand, hit: rayOnPage(...), look: "dot" | "ring" | "press" }].
  update(rays, display) {
    if (this.failed) return this.clearVisible();
    try {
      // While pointing is possible the layers stay listed and only their
      // opacity changes, so crossing the page edge never re-submits layers.
      if (!rays.length) return this.clearVisible();
      const lit = [];
      for (const { hand, hit, look = "dot" } of rays) {
        const e = this.entry(hand);
        if (!hit || hit.distance < 0.08) continue;
        const at = add(hit.point, hit.normal, 0.001);
        if (![at.x, at.y, at.z].every(Number.isFinite)) continue;
        e.layer.transform = new XRRigidTransform(at, display.orientation);
        if (look !== e.look) { e.look = look; e.dirty = true; }
        lit.push(e);
      }
      const shown = [];
      for (const e of this.entries.values()) {
        e.layer.opacity = lit.includes(e) ? 1 : 0;
        shown.push(e.layer);
      }
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
      if (this.visible.includes(e.layer) && active.includes(e.layer) && (e.dirty || e.layer.needsRedraw)) {
        try {
          gpu.copyPage(this.binding.getSubImage(e.layer, frame), e.canvases[e.look], { premultiplied: true });
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
