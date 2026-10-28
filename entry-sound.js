// Original, quiet welcome chime. No recordings, network or third-party assets.
export function scheduleEntryChime(
  context,
  destination,
  at = context.currentTime,
) {
  const nodes = [];
  for (const [i, hz] of [392, 587.3295, 783.9909].entries()) {
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = hz;
    const start = at + i * 0.11,
      // Loud enough to be heard over the background sound (about −21 dBFS).
      peak = [0.09, 0.07, 0.055][i];
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.00001, start + 1.15);
    gain.gain.linearRampToValueAtTime(0, start + 1.25);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + 1.3);
    nodes.push(oscillator);
  }
  return nodes;
}
export class EntrySound {
  constructor() {
    this.context = null;
    this.played = false;
    this.plays = 0;
    this.error = null;
    this.disposed = false;
  }
  unlock() {
    try {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) throw Error("Audio unavailable");
      this.context = new Audio();
      this.context.resume().catch((e) => {
        this.error = e.message;
      });
    } catch (e) {
      this.error = e.message;
    }
  }
  play(enabled = true) {
    if (!enabled || this.played || this.disposed) return;
    this.played = true;
    const context = this.context;
    if (!context) {
      this.error ??= "Audio unavailable";
      return;
    }
    const begin = () => {
      if (this.disposed || context.state !== "running") return;
      try {
        scheduleEntryChime(context, context.destination);
        this.plays++;
      } catch (e) {
        this.error = e.message;
      }
    };
    if (context.state === "running") begin();
    else
      context
        .resume()
        .then(begin)
        .catch((e) => {
          this.error = e.message;
        });
  }
  status() {
    return {
      state: this.context?.state || "unavailable",
      plays: this.plays,
      error: this.error,
    };
  }
  dispose() {
    this.disposed = true;
    this.context?.close().catch(() => {});
  }
}
