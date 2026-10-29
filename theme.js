// A quiet system sans and neutral navigation distinguish the interface from
// literature. Reading keeps its own paper, night and mood choices below.
// Visual only: no geometry lives here, so gesture targets never move.
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Navigation has one opaque backing in every reading mood. The reading page
// still uses MOODS below; these colours belong to commands and browsing only.
export const NAV = Object.freeze({
  bg: "#333e3d", ink: "#f3f5f2", muted: "#d3ddd5",
  card: "#414e4a", hover: "#52635a", accent: "#d3ddd5",
  gold: "#b7c0bd", faint: "#8f9e98", done: "#c4d6c7", warn: "#efbcac",
  ui: UI,
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
