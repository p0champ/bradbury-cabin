// One visual system for every panel: a quiet system sans for interface text,
// the reading serif for literature, soft paper tones and one deep accent.
// Visual only: no geometry lives here, so gesture targets never move.
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const MOODS = {
  // Literary: warm paper, a bookish serif with italic titles.
  literary: {
    paper: { bg: "#f6f2e9", ink: "#1f2a24", muted: "#6a746c", card: "#ebe6da" },
    night: { bg: "#131715", ink: "#ebe6da", muted: "#9ba59d", card: "#1f2522" },
    body: "Literata, Georgia, serif",
    title: "italic",
  },
  // Clean modern: cooler paper, the interface sans with upright bold titles.
  modern: {
    paper: { bg: "#f4f4f2", ink: "#1c1f21", muted: "#646b6f", card: "#e8e9e6" },
    night: { bg: "#111314", ink: "#e6e8e9", muted: "#9aa1a5", card: "#202426" },
    body: UI,
    title: "bold",
  },
};

export const accentFor = (night) => (night ? "#d6c9a4" : "#2f4b3e");
export const goldFor = (night) => (night ? "#b8a06a" : "#a8873e");

// Small capitals for labels and running heads, spaced like a book's folio.
export function spaced(ctx, px = 4) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}
export function unspaced(ctx) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}
