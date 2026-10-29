// A quiet system sans and neutral navigation distinguish the interface from
// literature. Reading keeps its own paper, night and mood choices below.
// Visual only: no geometry lives here, so gesture targets never move.
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Navigation has one opaque backing in every reading mood. The reading page
// still uses MOODS below; these colours belong to commands and browsing only.
export const NAV = Object.freeze({
  bg: "#303637", ink: "#f5f6f4", muted: "#d2d8d7",
  card: "#3d4546", hover: "#505b5d", accent: "#d2d8d7",
  gold: "#b7c0bd", faint: "#8f9e98", done: "#c4d6c7", warn: "#efbcac",
  ui: UI,
});

// One material for every navigation surface. Solid backing preserves contrast
// in passthrough; this does not simulate the system's adaptive glass or blur.
export function navigationSurface(ctx, width, height, radius = 28) {
  const fill = ctx.createLinearGradient(0, 0, width * .35, height);
  fill.addColorStop(0, '#454746');
  fill.addColorStop(1, '#303332');
  ctx.beginPath(); ctx.roundRect(.5, .5, width - 1, height - 1, radius);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.clip();
}

export const CONTROL = Object.freeze({
  hover: 'rgba(255,255,255,.14)',
  quiet: 'rgba(255,255,255,.055)',
  selected: '#eceeec', selectedInk: '#252a27',
});

export const MOODS = {
  // Literary: warm paper, a bookish serif with italic titles.
  literary: {
    paper: { bg: "#f6f2e9", ink: "#1f2a24", muted: "#6a746c", card: "#ebe6da", hover: "#fffdf8" },
    night: { bg: "#131715", ink: "#ebe6da", muted: "#9ba59d", card: "#1f2522", hover: "#3a443f" },
    body: "Literata, Georgia, serif",
    title: "italic",
  },
  // Clean modern: cooler paper, the interface sans with upright bold titles.
  modern: {
    paper: { bg: "#f4f4f2", ink: "#1c1f21", muted: "#646b6f", card: "#e8e9e6", hover: "#ffffff" },
    night: { bg: "#111314", ink: "#e6e8e9", muted: "#9aa1a5", card: "#202426", hover: "#33393c" },
    body: UI,
    title: "bold",
  },
};

export const accentFor = (night) => (night ? "#d6c9a4" : "#2f4b3e");
// Hover lifts the choice, as on visionOS: the card brightens and a soft
// shadow appears beneath it. No coloured ring; the label never changes.
export function lift(ctx) {
  ctx.shadowColor = "rgba(20, 24, 22, 0.16)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 14;
}
export function unlift(ctx) {
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
// The page is a floating window: this radius rounds its corners.
export const WINDOW_RADIUS = 88;
export const goldFor = (night) => (night ? "#b8a06a" : "#a8873e");

// Small capitals for labels and running heads, spaced like a book's folio.
export function spaced(ctx, px = 4) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}
export function unspaced(ctx) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

// One restrained inner edge on interactive cards, entirely inside the hit area.
export function innerEdge(ctx, b, radius = 36) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x+1,b.y+1,b.w-2,b.h-2,radius);
  else ctx.rect(b.x+1,b.y+1,b.w-2,b.h-2);
  ctx.stroke();
  ctx.restore();
}
