// Browser dictation is optional. No key, audio upload or transcription service
// is installed. Success means an actual final transcript, never just API presence.
export class ThoughtVoice {
  constructor(env = globalThis) { this.env = env; this.active = null; this.token = 0; }
  get supported() { return !!(this.env.SpeechRecognition || this.env.webkitSpeechRecognition); }
  cancel() { this.token++; clearTimeout(this.timer); const r = this.active; this.active = null; try { r?.abort(); } catch {} }
  start({ onText, onStatus }) {
    this.cancel();
    const Constructor = this.env.SpeechRecognition || this.env.webkitSpeechRecognition;
    if (!Constructor) { onStatus('Dictation is unavailable here. You can type your thought after leaving the cabin.'); return false; }
    let r;
    try { r = new Constructor(); } catch { onStatus('Dictation could not start. You can type after leaving the cabin.'); return false; }
    const token = this.token; this.active = r;
    let received = false, failed = false;
    r.lang = 'en-US'; r.interimResults = false; r.continuous = false;
    r.onresult = e => {
      if (this.token !== token) return;
      const text = Array.from(e.results).filter(v => v.isFinal !== false).map(v => v[0]?.transcript || '').join(' ').trim();
      if (text) { received = true; onText(text); onStatus('Check your sentence, then save it.'); }
    };
    r.onerror = e => { if (this.token === token) { failed = true; onStatus(`Dictation did not finish (${e.error || 'unavailable'}). Retry, or type after leaving the cabin.`); } };
    r.onend = () => { if (this.token === token) { this.active = null; clearTimeout(this.timer); onStatus(!received && !failed ? 'No sentence returned. Retry, or type instead.' : null); } };
    try { r.start(); onStatus('Listening… Pinch Stop when finished.'); this.timer = setTimeout(() => this.stop(), 20000); return true; }
    catch { this.active = null; onStatus('Dictation could not start. You can type after leaving the cabin.'); return false; }
  }
  stop() { clearTimeout(this.timer); try { this.active?.stop(); } catch {} }
}
