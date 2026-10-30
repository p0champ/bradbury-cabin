// Quiet Folio: local preferences, exact displayed-word bounds, and calm motion.
import { typeset } from './folio.js?v=57';
import { UI } from './theme.js?v=57';

export const clampDim = value => Number.isFinite(value) ? Math.min(.96, Math.max(0, value)) : .32;
export const readingActive = s => !s.menuOpen && !s.centering && !s.arriving && !s.practice;
export function seasonFor(date = new Date(), hemisphere = 'north') {
  const n = Math.floor((date.getMonth() + 1) % 12 / 3);
  return ['winter', 'spring', 'summer', 'autumn'][(n + (hemisphere === 'south' ? 2 : 0)) % 4];
}
export const SEASON_COLOURS = Object.freeze({ spring: '#9db599', summer: '#c3b27d', autumn: '#be926c', winter: '#a6b8ca' });
export class FocusDim {
  constructor() { this.value = 0; this.time = null; }
  update(time, target, reduced = false) {
    const dt = this.time == null ? 0 : Math.max(0, Math.min(100, time - this.time));
    this.time = time;
    this.value += (clampDim(target) - this.value) * (1 - Math.exp(-dt / (reduced ? 70 : 420)));
    if (Math.abs(this.value - target) < .001) this.value = target;
    return this.value;
  }
  reset() { this.value = 0; this.time = null; }
}

// Match the exact paint font and prefix advances, including display-only quotes.
export function wordBounds(ctx, items, mood) {
  const words = [];
  ctx.save(); ctx.textAlign = 'left';
  for (const [line, b] of items.entries()) {
    if (!['line', 'heading', 'title', 'meta'].includes(b.kind) || typeof b.text !== 'string') continue;
    ctx.font = b.kind === 'heading' ? `bold ${b.font}px ${mood.body}`
      : b.kind === 'title' ? `${mood.title} ${b.font}px ${mood.body}`
      : b.kind === 'meta' && mood.body !== UI ? `small-caps ${b.font}px ${mood.body}` : `${b.font}px ${mood.body}`;
    for (const match of typeset(b.text).matchAll(/[\p{L}\p{N}]+(?:[’'\-][\p{L}]+)*/gu)) {
      const prefix = typeset(b.text).slice(0, match.index);
      const measured = ctx.measureText(match[0]);
      const cap = b.dropCap && match.index === 0 && !b.dropCap.separate ? b.dropCap : null;
      words.push({ id: `word:${line}:${match.index}`, word: (cap?.letter || '') + match[0],
        x: (b.x ?? 194) + ctx.measureText(prefix).width,
        y: b.y - b.font, w: measured.width, h: b.font * 1.2 });
      if (cap) words.push({ ...words.at(-1), x:cap.x, w:(b.x ?? 194)-cap.x, h:cap.dy+b.font*1.2 });
    }
    if (b.dropCap?.separate) words.push({ id: `word:${line}:cap`, word: b.dropCap.letter,
      x: b.dropCap.x, y: b.y - b.font, w: (b.x ?? 194) - b.dropCap.x, h: b.dropCap.dy + b.font * 1.2 });
  }
  ctx.restore(); return words;
}
export function wordAt(words, point) {
  if (!point) return null;
  // Strict bounds: no nearest-word guessing between words or lines.
  return words.find(w => point.x >= w.x && point.x <= w.x + w.w && point.y >= w.y && point.y <= w.y + w.h) || null;
}
export function seasonalDetail(time, since, season, reduced = false) {
  if (reduced || since == null) return null;
  const elapsed = time - since;
  if (elapsed < 90000) return null;
  const phase = (elapsed - 90000) % 180000;
  if (phase > 6000) return null;
  const t = phase / 6000;
  return { season, x: -.395 + Math.sin(t * Math.PI) * .008, y: .35 - t * .18,
    alpha: .32 * Math.sin(t * Math.PI), angle: t * .5 };
}

export function paintSeason(ctx, season) {
  ctx.save(); ctx.strokeStyle = SEASON_COLOURS[season]; ctx.lineWidth = 22;
  ctx.globalAlpha = .22;
  ctx.beginPath(); ctx.roundRect(20, 20, 2008, 2520, 70); ctx.stroke(); ctx.restore();
}
