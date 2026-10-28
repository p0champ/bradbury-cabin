// Optional background ambience, generated in code: no recordings, no network,
// no third-party audio, so there is nothing to license. Each kind is an
// 8-second loop baked from a seeded noise source. Levels are set by what
// small headset speakers can play (energy above ~200 Hz), not by bass.
export const AMBIENCE_KINDS = ["off", "rain", "fire", "room"];
export const AMBIENCE_LABEL = { off: "Off", rain: "Soft rain", fire: "Fireplace", room: "Quiet room" };
export const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1];
export const ambienceVolume = value => typeof value === "number" && Number.isFinite(value)
  ? Math.max(0, Math.min(1, value)) : 1;
const BAKE_RATE = 22050;
const SECONDS = 8,
  // Each loop is baked so its audible band (above ~200 Hz) sits at about
  // −24 dBFS with peaks ≤ 0.9; playback gain is then 1. (Build 017 played at
  // about −40 dBFS and was inaudible on the Quest speakers.)
  TARGET_DB = -24,
  MAX_PEAK = 0.9,
  LEVEL = { rain: 1, fire: 1, room: 1 };
export { LEVEL as AMBIENCE_LEVEL };
// Second-order high-pass (RBJ biquad), a stand-in for small speakers.
export function highPass(samples, rate, hz = 200) {
  const w = (2 * Math.PI * hz) / rate,
    q = Math.SQRT1_2,
    a = Math.sin(w) / (2 * q),
    c = Math.cos(w);
  const b0 = (1 + c) / 2 / (1 + a),
    b1 = -(1 + c) / (1 + a),
    a1 = (-2 * c) / (1 + a),
    a2 = (1 - a) / (1 + a);
  const out = new Float32Array(samples.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i],
      y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}
const rms = (a) => {
  let s = 0;
  for (const x of a) s += x * x;
  return Math.sqrt(s / a.length);
};

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

// Returns a Float32Array of mono samples for one loop. Pure, so it is tested.
export function bakeAmbience(kind, rate = BAKE_RATE) {
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
      // A warm, softly flickering hiss (mid-range, so speakers can play it),
      // a little low rumble, and frequent short bright crackles.
      lp += (white - lp) * 0.22;
      hp += (brown - hp) * 0.05;
      const flicker = 0.7 + 0.3 * Math.sin(i / (rate * 0.37)) * Math.sin(i / (rate * 1.3));
      v = lp * 0.35 * flicker + hp * 0.35;
      if (r() < 0.0005) {
        const len = 20 + Math.floor(r() * 80),
          amp = 0.15 + r() * 0.25;
        for (let k = 0; k < len && i + k < n; k++) out[i + k] += (r() * 2 - 1) * Math.exp(-k / 9) * amp;
      }
    } else if (kind === "room") {
      // Soft, steady "air" (like a quiet ventilated room) over a low tone.
      lp += (brown - lp) * 0.08;
      hp += (white - hp) * 0.1;
      v = lp * 0.5 + hp * 0.5;
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
  // Level by the audible band, then cap the peak.
  const audible = rms(highPass(looped, rate));
  let peak = 0;
  for (const x of looped) peak = Math.max(peak, Math.abs(x));
  let scale = audible > 0 ? 10 ** (TARGET_DB / 20) / audible : 0;
  if (peak * scale > MAX_PEAK) scale = MAX_PEAK / peak;
  for (let k = 0; k < looped.length; k++) looped[k] *= scale;
  return looped;
}

export class Ambience {
  constructor(volume = 1) {
    this.kind = "off";
    this.source = null;
    this.gain = null;
    this.error = null;
    this.cache = new Map();
    this.volume = ambienceVolume(volume);
    this.envelope = null;
  }
  currentGain(time) {
    const e = this.envelope;
    if (!e) return 0;
    const fraction = Math.max(0, Math.min(1, (time - e.start) / (e.end - e.start)));
    return e.from + (e.to - e.from) * fraction;
  }
  hold(param, time) {
    const value = this.currentGain(time);
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
    else param.cancelScheduledValues(time);
    // Anchor the new ramp explicitly. Holding after a completed ramp alone
    // can let the next ramp interpolate from that older event and jump now.
    param.setValueAtTime(value, time);
    return value;
  }
  setVolume(context, volume) {
    this.volume = ambienceVolume(volume);
    if (!this.gain) return;
    const time = (this.source?.context || context).currentTime;
    const from = this.hold(this.gain.gain, time);
    const to = LEVEL[this.kind] * this.volume;
    this.gain.gain.linearRampToValueAtTime(to, time + 0.18);
    this.envelope = { from, to, start: time, end: time + 0.18 };
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
      const target = LEVEL[kind] * this.volume;
      gain.gain.linearRampToValueAtTime(target, context.currentTime + 2);
      this.envelope = { from: 0, to: target, start: context.currentTime, end: context.currentTime + 2 };
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
      this.hold(gain.gain, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.6);
      source.stop(t + 0.7);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    } catch {}
  }
  status() {
    return {
      kind: this.kind,
      playing: !!this.source,
      volume: this.volume,
      targetGain: this.source ? LEVEL[this.kind] * this.volume : 0,
      context: this.source?.context?.state || null,
      error: this.error,
    };
  }
}
