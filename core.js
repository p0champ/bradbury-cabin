export const PAGE = {
  width: 2048,
  height: 2560,
  metresWide: 0.72,
  metresHigh: 0.9,
  distance: 1.1,
};
export const SIZES = [46, 54, 62];
export const poem = [
  "O Rose thou art sick.",
  "The invisible worm,",
  "That flies in the night",
  "In the howling storm:",
  "",
  "Has found out thy bed",
  "Of crimson joy:",
  "And his dark secret love",
  "Does thy life destroy.",
];
export const opening =
  "One dollar and eighty-seven cents. That was all. And sixty cents of it was in pennies. Pennies saved one and two at a time by bulldozing the grocer and the vegetable man and the butcher until one’s cheeks burned with the silent imputation of parsimony that such close dealing implied. Three times Della counted it. One dollar and eighty-seven cents. And the next day would be Christmas.";
export const continuation =
  "There was clearly nothing to do but flop down on the shabby little couch and howl. So Della did it. Which instigates the moral reflection that life is made up of sobs, sniffles, and smiles, with sniffles predominating.";
export function wrap(ctx, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
// An intentionally small test corpus; Phase 1 owns general document pagination.
export function layout(ctx, size) {
  const font = SIZES[size],
    leading = font * 1.43;
  ctx.font = `${font}px Literata, Georgia, serif`;
  const blocks = [
    { text: "The Sick Rose", kind: "title" },
    { text: "William Blake · 1794 · England", kind: "meta" },
    ...poem.map((text) => ({ text, kind: "line" })),
    { text: "The Gift of the Magi", kind: "title" },
    { text: "O. Henry · 1905 · United States · opening excerpt", kind: "meta" },
    ...wrap(ctx, opening, 1660).map((text) => ({ text, kind: "line" })),
    { text: "The Gift of the Magi", kind: "title", break: true },
    { text: "Opening excerpt · continued", kind: "meta" },
    ...wrap(ctx, continuation, 1660).map((text) => ({ text, kind: "line" })),
  ];
  const pages = [];
  let page = [],
    y = 380;
  for (const b of blocks) {
    const h = b.kind === "title" ? 100 : b.kind === "meta" ? 80 : leading;
    if (
      (b.break && page.some((block) => block.kind === "title")) ||
      y + h > 2120
    ) {
      pages.push(page);
      page = [];
      y = 380;
    }
    page.push({
      ...b,
      y,
      font: b.kind === "title" ? 66 : b.kind === "meta" ? 30 : font,
    });
    y += h;
  }
  if (page.length) pages.push(page);
  return pages;
}
export function placedPose(matrix) {
  return {
    position: {
      x: matrix[12] - matrix[8] * PAGE.distance,
      y: matrix[13] - matrix[9] * PAGE.distance,
      z: matrix[14] - matrix[10] * PAGE.distance,
    },
  };
}
