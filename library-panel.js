import { UI } from "./theme.js?v=33";
// Library page inside the menu: "‹ Menu" at the top, then one row per work.
// "‹ Menu" deliberately sits away from where "Leave the cabin" is on the main
// page, so a repeated pinch can never exit by accident.
const KIND = { sampler: "Sampler", poem: "Poem", story: "Story", essay: "Essay" };
// Room for today's three (from Claude, via Drive), the sampler and the shelf.
export const LIBRARY_ROWS = 11;
const ROW = (i) => ({ x: 274, y: 700 + i * 124, w: 1500, h: 112 });

export function libraryButtons(works) {
  return [
    { id: "lib-menu", x: 1394, y: 380, w: 380, h: 120 },
    ...works.slice(0, LIBRARY_ROWS).map((w, i) => ({ id: "work:" + w.id, ...ROW(i) })),
  ];
}
export function libraryHit(x, y, works) {
  return (
    libraryButtons(works).find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null
  );
}
function card(ctx, b, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 36);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill();
}
// places: { [workId]: "in progress" } labels for works with a saved place.
export function paintLibrary(ctx, { works, hover, current, places = {}, c, note = "" }) {
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = `84px ${c.serif || "Literata"}`;
  ctx.fillText("Library", 274, 470);
  ctx.fillStyle = c.muted;
  ctx.font = `36px ${UI}`;
  ctx.fillText(
    works.some((w) => w.today)
      ? "Today's three from Claude are at the top. Pick one to read."
      : "Ask Claude for today's three; they appear here. Pick any work to read.",
    274,
    540,
  );
  if (note) ctx.fillText(note, 274, 600);
  for (const b of libraryButtons(works)) {
    const hot = hover === b.id;
    card(ctx, b, hot ? c.accent : c.card);
    const fg = hot ? c.bg : c.ink,
      sub = hot ? c.bg : c.muted;
    if (b.id === "lib-menu") {
      ctx.fillStyle = fg;
      ctx.font = `50px ${c.serif || "Literata"}`;
      ctx.textAlign = "center";
      ctx.fillText("‹  Menu", b.x + b.w / 2, b.y + 78);
      ctx.textAlign = "left";
      continue;
    }
    const w = works.find((x) => "work:" + x.id === b.id);
    ctx.fillStyle = sub;
    ctx.font = `28px ${UI}`;
    ctx.fillText(
      (w.today ? "TODAY  ·  " : "") + KIND[w.kind].toUpperCase() + (w.id === current ? "  ·  READING NOW" : ""),
      b.x + 60,
      b.y + 38,
    );
    ctx.fillStyle = fg;
    ctx.font = `${c.italic ?? "italic "}44px ${c.serif || "Literata"}`;
    // Long titles are shortened so they never run into the author.
    let title = w.title;
    ctx.save();
    ctx.font = `32px ${UI}`;
    let author = w.author;
    while (author.length > 4 && ctx.measureText(author).width > b.w * 0.4) author = author.slice(0, -2);
    if (author !== w.author) author = author.trimEnd() + "…";
    const authorWidth = ctx.measureText(author + (places[w.id] ? "  ·  " + places[w.id] : "")).width;
    ctx.restore();
    const room = b.w - 120 - authorWidth - 60;
    while (title.length > 4 && ctx.measureText(title).width > room) title = title.slice(0, -2);
    if (title !== w.title) title = title.trimEnd() + "…";
    ctx.fillText(title, b.x + 60, b.y + 88);
    ctx.textAlign = "right";
    ctx.fillStyle = sub;
    ctx.font = `32px ${UI}`;
    ctx.fillText(author + (places[w.id] ? "  ·  " + places[w.id] : ""), b.x + b.w - 60, b.y + 88);
    ctx.textAlign = "left";
  }
}
