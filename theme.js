// One visual system for every panel: a quiet system sans for interface text,
// the reading serif for literature, soft paper tones and one deep accent.
// Visual only: no geometry lives here, so gesture targets never move.
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const MOODS = {
  // Literary: warm paper, a bookish serif with italic titles.
  literary: {
    paper: { bg: "#f6f2e9", ink: "#1f2a24", muted: "#6a746c", card: "#ebe6da", hover: "#ddd4bf" },
    night: { bg: "#131715", ink: "#ebe6da", muted: "#9ba59d", card: "#1f2522", hover: "#2e3732" },
    body: "Literata, Georgia, serif",
    title: "italic",
  },
  // Clean modern: cooler paper, the interface sans with upright bold titles.
  modern: {
    paper: { bg: "#f4f4f2", ink: "#1c1f21", muted: "#646b6f", card: "#e8e9e6", hover: "#d9dcd8" },
    night: { bg: "#111314", ink: "#e6e8e9", muted: "#9aa1a5", card: "#202426", hover: "#2e3437" },
    body: UI,
    title: "bold",
  },
};

export const accentFor = (night) => (night ? "#d6c9a4" : "#2f4b3e");
// Hover is a deeper tint (palette.hover) plus a ring; the label never changes
// colour, so what you are reading stays put while the choice lights up.
export function ring(ctx, b, color, radius) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8, Math.max(0, radius - 4));
  else ctx.rect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
  ctx.stroke();
}
export const goldFor = (night) => (night ? "#b8a06a" : "#a8873e");

// Small capitals for labels and running heads, spaced like a book's folio.
export function spaced(ctx, px = 4) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}
export function unspaced(ctx) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}
