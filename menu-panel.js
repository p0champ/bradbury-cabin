import { UI, lift, unlift, innerEdge } from "./theme.js?v=56";

const MAIN_GROUPS = [
  ["resume"],
  ["library", "calendar"],
  ["night", "mood", "size"],
  ["more", "exit", "volume"],
];

function rounded(ctx, b, radius = 40) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, radius);
  else ctx.rect(b.x, b.y, b.w, b.h);
}

function groupsFor(rows, page) {
  if (page === "main")
    return MAIN_GROUPS.map((ids) => ids.map((id) => rows.find((b) => b.id === id)).filter(Boolean)).filter((g) => g.length);
  const groups = [];
  for (const b of rows) {
    const group = groups.at(-1), last = group?.at(-1);
    if (last && b.y - last.y - last.h < 40 && b.x === last.x && b.w === last.w) group.push(b);
    else groups.push([b]);
  }
  return groups;
}

// Only the drawing hierarchy changes. Every command retains the caller's
// original position, label, order and hit rectangle.
export function paintMenuRows(ctx, { rows, page, values = {}, hover = null, c, hasToday = false }) {
  for (const group of groupsFor(rows, page)) {
    const top = group[0], bottom = group.at(-1);
    const bounds = { x: top.x, y: top.y, w: top.w, h: bottom.y + bottom.h - top.y };
    ctx.fillStyle = page === "main" && top.id === "resume" ? c.hover : c.card;
    rounded(ctx, bounds);
    ctx.fill();
    innerEdge(ctx, bounds, 40);
    ctx.fillStyle = c.muted;
    ctx.globalAlpha = 0.25;
    group.slice(0, -1).forEach((b, i) => {
      const next = group[i + 1];
      if (hover !== b.id && hover !== next.id)
        ctx.fillRect(b.x + 70, b.y + b.h + (next.y - b.y - b.h) / 2 - 1, b.w - 140, 2);
    });
    ctx.globalAlpha = 1;
  }
  for (const b of rows) {
    const primary = page === "main" && b.id === "resume";
    if (hover === b.id) {
      ctx.fillStyle = c.hover;
      lift(ctx);
      rounded(ctx, b);
      ctx.fill();
      unlift(ctx);
      innerEdge(ctx, b, 40);
      if (primary) {
        // Keep the primary's opaque backing and label contrast while making
        // its pointed-at state visibly different from its resting emphasis.
        ctx.save();
        ctx.strokeStyle = c.ink;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 4;
        rounded(ctx, { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4 }, 38);
        ctx.stroke();
        ctx.restore();
      }
    }
    const back = ["back", "volume-back"].includes(b.id);
    const weight = primary ? 600 : back || (page === "main" && ["library", "calendar"].includes(b.id)) ? 500 : 400;
    ctx.fillStyle = c.ink;
    ctx.font = `${weight} 54px ${UI}`;
    ctx.textAlign = "left";
    ctx.fillText((back ? "‹  " : "") + (b.id === "library" ? (hasToday ? "Today" : "Your shelf") : b.label), b.x + 70, b.y + b.h / 2 + 20);
    if (values[b.id]) {
      ctx.fillStyle = c.muted;
      ctx.font = `400 42px ${UI}`;
      ctx.textAlign = "right";
      ctx.fillText(values[b.id], b.x + b.w - 70, b.y + b.h / 2 + 15);
    }
  }
  ctx.textAlign = "left";
}
