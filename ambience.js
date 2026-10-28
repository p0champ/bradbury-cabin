// Optional background ambience, generated in code: no recordings, no network,
// no third-party audio, so there is nothing to license. Each kind is an
// 8-second loop baked from a seeded noise source, played very quietly.
export const AMBIENCE_KINDS = ["off", "rain", "fire", "room"];
export const AMBIENCE_LABEL = { off: "Off", rain: "Soft rain", fire: "Fireplace", room: "Quiet room" };
const BAKE_RATE = 22050;
const SECONDS = 8,
  LEVEL = { rain: 0.05, fire: 0.06, room: 0.04 };

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

// Returns a Float32Array of mono samples for one loop. Pure, so it is tested.
export function bakeAmbience(kind, rate = 48000) {
  const n = SECONDS * rate,
    out = new Float32Array(n),
    r = rng(kind.length * 7919 + 17);
  let brown = 0,
    lp = 0,
    hp = 0,
    prev = 0;
  for (let i = 0; i < n; i++) {
    const white = r() * 2 - 1;
    brown = Math.max(-1, Math.min(1, brown + white * 0.02)) * 0.998;
    let v = 0;
    if (kind === "rain") {
      // Bright, even hiss with a slow swell, plus sparse soft drops.
      lp += (white - lp) * 0.35;
      hp = lp - prev;
      prev = lp;
      const swell = 0.75 + 0.25 * Math.sin((2 * Math.PI * i) / n);
      v = (lp * 0.5 + hp * 0.5) * swell;
      if (r() < 0.0006) v += (r() * 2 - 1) * 0.6;
    } else if (kind === "fire") {
      // Low rumble with occasional short crackles.
      lp += (brown - lp) * 0.05;
      v = lp * 1.4;
      if (r() < 0.00025) {
        const len = 40 + Math.floor(r() * 200);
        for (let k = 0; k < len && i + k < n; k++) out[i + k] += (r() * 2 - 1) * Math.exp(-k / 30) * 0.7;
      }
    } else if (kind === "room") {
      // Low room tone plus a little soft mid-range "air", so small headset
      // speakers can actually reproduce it.
      lp += (brown - lp) * 0.02;
      hp += (white - hp) * 0.08;
      v = lp + hp * 0.12;
    }
    out[i] += v;
  }
  // Seamless loop: equal-power crossfade of the last 0.5 s into the start
  // (no level dip, since the two halves are uncorrelated noise).
  const fade = Math.floor(rate * 0.5);
  for (let k = 0; k < fade; k++) {
    const t = k / fade;
    out[k] = out[k] * Math.sqrt(t) + out[n - fade + k] * Math.sqrt(1 - t);
  }
  const looped = out.subarray(0, n - fade);
  // Normalise to a fixed peak so every kind sits at a predictable level.
  let peak = 0;
  for (const x of looped) peak = Math.max(peak, Math.abs(x));
  if (peak > 0) for (let k = 0; k < looped.length; k++) looped[k] /= peak;
  return looped;
}

export class Ambience {
  constructor() {
    this.kind = "off";
    this.source = null;
    this.gain = null;
    this.error = null;
    this.cache = new Map();
  }
  // context: a running or resumable AudioContext (the entry sound's).
  set(context, kind) {
    if (!AMBIENCE_KINDS.includes(kind)) kind = "off";
    if (kind === this.kind && (kind === "off" || this.source || this.pending)) return;
    this.stop(context);
    this.kind = kind;
    if (kind === "off" || !context) return;
    // Bake outside the XR frame callback, at a modest rate (the browser
    // resamples), so choosing a sound never hitches the view.
    const token = (this.pending = {});
    setTimeout(() => {
      if (this.pending !== token || this.kind !== kind) return;
      this.pending = null;
      this.start(context, kind);
    }, 0);
  }
  start(context, kind) {
    try {
      let buffer = this.cache.get(kind);
      if (!buffer) {
        const rate = BAKE_RATE;
        const samples = bakeAmbience(kind, rate);
        buffer = context.createBuffer(1, samples.length, rate);
        buffer.copyToChannel(samples, 0);
        this.cache.set(kind, buffer);
      }
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(LEVEL[kind], context.currentTime + 2);
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
      this.source = source;
      this.gain = gain;
      context.resume?.().catch?.(() => {});
    } catch (e) {
      this.error = e.message;
      this.source = null;
    }
  }
  stop(context) {
    this.pending = null;
    const { source, gain } = this;
    this.source = null;
    this.gain = null;
    if (!source) return;
    try {
      const t = context?.currentTime ?? 0;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.6);
      source.stop(t + 0.7);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    } catch {}
  }
  status() {
    return { kind: this.kind, playing: !!this.source, error: this.error };
  }
}
