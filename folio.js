// "Glass folio" (Build 054): warm paper inside a thin frosted-glass frame,
// book typesetting touches, a slide-and-fade page turn and a slow highlight
// that travels along the glass rim. Presentation only: the stored literary
// text, its pagination and saved places are never changed here.
import { WINDOW_RADIUS } from "./theme.js?v=56";

// Width of the glass band around the paper, in page pixels (~2 cm).
export const FRAME = 56;
// The moving text band of a page: the body and its folio, never the frame.
export const FOLIO_BAND = { y: 300, h: 1920 };
export const TURN_MS = 460;
export const TURN_SLIDE_PX = 70;
export const SHIMMER = { everyMs: 25000, passMs: 2400, width: 420 };

export function paintGlassFrame(ctx, { width, height, paper, night = false }) {
  ctx.save();
  const glass = ctx.createLinearGradient(0, 0, width * .3, height);
  glass.addColorStop(0, night ? "rgba(70,76,73,.62)" : "rgba(238,234,226,.50)");
  glass.addColorStop(1, night ? "rgba(36,40,38,.58)" : "rgba(196,192,184,.42)");
  ctx.fillStyle = glass;
  ctx.beginPath(); ctx.roundRect(0, 0, width, height, WINDOW_RADIUS); ctx.fill();
  const rim = ctx.createLinearGradient(0, 0, 0, height);
  rim.addColorStop(0, night ? "rgba(255,255,255,.30)" : "rgba(255,255,255,.62)");
  rim.addColorStop(1, "rgba(255,255,255,.10)");
  ctx.strokeStyle = rim; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(1.5, 1.5, width - 3, height - 3, WINDOW_RADIUS - 1.5); ctx.stroke();
  // The paper sits in the glass with a hairline of shade, like a mount.
  ctx.shadowColor = night ? "rgba(0,0,0,.45)" : "rgba(60,48,30,.22)";
  ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
  ctx.fillStyle = paper;
  ctx.beginPath(); ctx.roundRect(FRAME, FRAME, width - 2 * FRAME, height - 2 * FRAME, WINDOW_RADIUS - FRAME * .6); ctx.fill();
  ctx.restore();
}

// Typographic quotes at display time. Elisions such as 'tis keep a
// right-pointing apostrophe; anything else keeps its original character.
const ELISIONS = /^(tis|twas|twere|twill|em|neath|gainst|mid|midst|til|tween|twixt|n)\b/i;
export function typeset(text) {
  if (typeof text !== "string" || !/["']/.test(text)) return text;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], prev = text[i - 1] ?? " ", next = text[i + 1] ?? " ";
    const opening = /[\s([{—–-]/.test(prev) || i === 0;
    if (ch === '"') out += opening ? "“" : "”";
    else if (ch === "'") {
      if (/\p{L}/u.test(prev) && /\p{L}/u.test(next)) out += "’";
      else if (opening && ELISIONS.test(text.slice(i + 1))) out += "’";
      else out += opening ? "‘" : "’";
    } else out += ch;
  }
  return out;
}

const smooth = (p) => { p = Math.max(0, Math.min(1, p)); return p * p * (3 - 2 * p); };
const easeOut = (p) => 1 - (1 - Math.max(0, Math.min(1, p))) ** 3;
// Old text slides a few centimetres and fades; the new text glides in from
// the other side. dir: +1 next, -1 previous. Reduced motion: crossfade only.
export function turnFrame(t, dir = 1, reduced = false) {
  const p = Math.max(0, Math.min(1, t / TURN_MS));
  const out = Math.min(1, p / .6), inn = Math.max(0, (p - .3) / .7);
  const slide = reduced ? 0 : TURN_SLIDE_PX;
  return {
    old: { alpha: 1 - smooth(out), dx: -dir * slide * easeOut(out) },
    next: { alpha: smooth(inn), dx: dir * slide * (1 - easeOut(inn)) },
    done: p >= 1,
  };
}

// Light catching the top rim: a soft streak drawn once, moved along the
// glass band only, so it never passes behind the words.
export function paintShimmer(canvas) {
  canvas.width = SHIMMER.width; canvas.height = FRAME;
  const c = canvas.getContext("2d");
  const g = c.createLinearGradient(0, 0, SHIMMER.width, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(.5, "rgba(255,252,244,.42)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, SHIMMER.width, FRAME);
  // Fade toward the paper edge so the band's inner border stays crisp.
  c.globalCompositeOperation = "destination-in";
  const v = c.createLinearGradient(0, 0, 0, FRAME);
  v.addColorStop(0, "rgba(0,0,0,.35)"); v.addColorStop(.35, "rgba(0,0,0,1)"); v.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = v; c.fillRect(0, 0, SHIMMER.width, FRAME);
}
// Where the streak is t ms into reading; null between passes. It travels
// the straight part of the top rim, clear of the rounded corners.
export function shimmerAt(t, width) {
  if (t < SHIMMER.everyMs) return null;
  const into = (t - SHIMMER.everyMs) % SHIMMER.everyMs;
  if (into >= SHIMMER.passMs) return null;
  const p = smooth(into / SHIMMER.passMs), start = WINDOW_RADIUS, end = width - WINDOW_RADIUS - SHIMMER.width;
  const alpha = Math.sin(Math.PI * Math.min(1, into / SHIMMER.passMs));
  return { x: start + (end - start) * p, y: 0, alpha: Math.max(0, Math.min(1, alpha)) };
}
