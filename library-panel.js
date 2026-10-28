// Library page inside the menu: "‹ Menu" at the top, then one row per work.
// "‹ Menu" deliberately sits away from where "Leave the cabin" is on the main
// page, so a repeated pinch can never exit by accident.
const KIND = { sampler: "Sampler", poem: "Poem", story: "Story", essay: "Essay" };
export const LIBRARY_ROWS = 8;
const ROW = (i) => ({ x: 274, y: 760 + i * 150, w: 1500, h: 132 });

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
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 28);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill();
}
// places: { [workId]: "in progress" } labels for works with a saved place.
export function paintLibrary(ctx, { works, hover, current, places = {}, c }) {
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = `84px ${c.serif || "Literata"}`;
  ctx.fillText("Library", 274, 470);
  ctx.fillStyle = c.muted;
  ctx.font = "36px Arial";
  ctx.fillText("Out-of-copyright works on this headset. Pick one to read.", 274, 540);
  ctx.fillText("Coming later: Claude's daily picks will be added here.", 274, 600);
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
    ctx.font = "30px Arial";
    ctx.fillText(KIND[w.kind].toUpperCase() + (w.id === current ? "  ·  READING NOW" : ""), b.x + 60, b.y + 44);
    ctx.fillStyle = fg;
    ctx.font = `italic 48px ${c.serif || "Literata"}`;
    ctx.fillText(w.title, b.x + 60, b.y + 100);
    ctx.textAlign = "right";
    ctx.fillStyle = sub;
    ctx.font = "32px Arial";
    ctx.fillText(w.author + (places[w.id] ? "  ·  " + places[w.id] : ""), b.x + b.w - 60, b.y + 100);
    ctx.textAlign = "left";
  }
}
