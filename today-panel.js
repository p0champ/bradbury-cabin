import { innerEdge, UI, spaced, unspaced, lift, unlift } from "./theme.js?v=51";
// Today: Claude's three for the day on a page of their own, and a quiet
// closing page after each of them. Everything shown comes from real data:
// the date, the challenge day, ticks, saved places and catalogue metadata.
// Canvas-drawn on the reading page, hit-tested like the other menu panels.
import { CHALLENGE_START, KINDS, parseKey, streak } from "./progress.js?v=51";

const KIND = { poem: "POEM", story: "STORY", essay: "ESSAY" };
const ENTRY = (i) => ({ x: 274, y: 660 + i * 290, w: 1500, h: 260 });
// "‹ Menu" sits where the Library's does, away from "Leave the cabin".
const MENU_BUTTON = { x: 1394, y: 380, w: 380, h: 120 };
const LIBRARY_BUTTON = { x: 274, y: 1700, w: 760, h: 120 };
const ALL_LIBRARY_BUTTON = { x: 1074, y: 1700, w: 700, h: 120 };
const CLOSING_ROW = (i) => ({ x: 274, y: 700 + i * 190, w: 1500, h: 164 });

function partOfDay(date) {
  const h = date.getHours();
  return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night";
}

// "Wednesday evening · Day 11", plus how today's reading stands.
export function todayFacts(date, progress, today) {
  const day = Math.round((parseKey(today) - parseKey(CHALLENGE_START)) / 864e5) + 1;
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const read = KINDS.filter((k) => progress.days[today]?.[k] === true).length;
  const run = streak(progress, today);
  return {
    dateline: `${weekday} ${partOfDay(date)} · Day ${day}`,
    read,
    allRead: read === 3,
    closing: read === 3 ? (run >= 2 ? `All three read · ${run} days running` : "All three read today") : "",
  };
}

// Read (ticked today), In progress (a saved place) or nothing.
export function workStatus(work, progress, today, places) {
  if (progress.days[today]?.[work.kind] === true) return "Read";
  return places[work.id]?.page > 0 ? "In progress" : "";
}

export function todayButtons(works) {
  return [
    { id: "today-menu", ...MENU_BUTTON },
    ...works.slice(0, 3).map((w, i) => ({ id: "today:" + w.id, ...ENTRY(i) })),
    { id: "today-library", ...LIBRARY_BUTTON },
    { id: "today-full-library", ...ALL_LIBRARY_BUTTON },
  ];
}
export function todayHit(x, y, works) {
  return todayButtons(works).find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null;
}

// The next of today's works not yet read, in poem, story, essay order.
export function nextUnread(works, current, progress, today) {
  return works.find((w) => w.id !== current.id && progress.days[today]?.[w.kind] !== true) || null;
}

export function closingButtons(next) {
  const rows = [{ id: "end-mark" }, ...(next ? [{ id: "end-next" }] : []), { id: "end-today" }];
  return [{ id: "end-back", ...MENU_BUTTON }, ...rows.map((r, i) => ({ ...r, ...CLOSING_ROW(i) }))];
}
export function closingHit(x, y, next) {
  return closingButtons(next).find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null;
}

function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > width) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}
// Long titles step down in size before anything is cut, so a book label such
// as "(Songs of Experience)" stays readable. font(size) builds the font string.
function fitted(ctx, text, width, size, min, font) {
  for (let s = size; s >= min; s -= 4) {
    ctx.font = font(s);
    if (ctx.measureText(text).width <= width) return text;
  }
  return fit(ctx, text, width);
}
// Up to two lines, then an ellipsis.
function wrap2(ctx, text, width) {
  const words = String(text).split(" ");
  let first = "";
  while (words.length && ctx.measureText((first + " " + words[0]).trim()).width <= width)
    first = (first + " " + words.shift()).trim();
  return words.length ? [first, fit(ctx, words.join(" "), width)] : [first];
}
function card(ctx, b, fill, edge) {
  ctx.fillStyle = fill;
  if (edge) lift(ctx);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 36);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill();
  if (edge) unlift(ctx);
  innerEdge(ctx, b);
}
// A hairline, not a bar: separation without weight.
export function rule(ctx, y, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(274, y, 1500, 2);
  ctx.globalAlpha = 1;
}
function smallButton(ctx, b, label, hot, c, align = "center") {
  if (!b) return;
  card(ctx, b, hot ? c.hover : c.card, hot);
  ctx.fillStyle = c.ink;
  ctx.font = `500 44px ${c.ui || UI}`;
  ctx.textAlign = align;
  ctx.fillText(label, align === "center" ? b.x + b.w / 2 : b.x + 60, b.y + b.h / 2 + 15);
  ctx.textAlign = "left";
}
const byId = (buttons, id) => buttons.find((b) => b.id === id);

// The application paints the complete day immediately. Partial preview paint
// remains supported without any timed reveal or input-consuming decoration.
export const REVEAL_STEPS = 4;
export const REVEAL_MS = 0;

// c: { bg, ink, muted, card, accent, gold, serif, italic }
// reveal: how many works are shown yet; REVEAL_STEPS also shows the rest.
export function paintToday(ctx, { works, hover, facts, statuses, note = "", personal = {}, reveal = REVEAL_STEPS, c }) {
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = `500 84px ${c.ui || UI}`;
  ctx.fillText("Today", 274, 470);
  ctx.fillStyle = c.muted;
  ctx.font = `500 36px ${c.ui || UI}`;
  ctx.fillText(facts.dateline + (facts.read && !facts.allRead ? ` · ${facts.read} of 3 read` : ""), 274, 540);
  const buttons = todayButtons(works);
  smallButton(ctx, byId(buttons, "today-menu"), "‹  Menu", hover === "today-menu", c);
  const complete = reveal >= REVEAL_STEPS;
  // The same quiet divider in every navigation panel.
  let openingLines = [];
  if (!facts.allRead && personal.dedication) {
    ctx.font = `500 32px ${c.ui || UI}`;
    openingLines = wrapPersonal(ctx, personal.dedication, 1500);
    ctx.fillStyle = c.muted;
    openingLines.forEach((line, i) => ctx.fillText(line, 274, 585 + i * 36));
  }
  if (complete) rule(ctx, openingLines.length > 1 ? 637 : 610, c.muted);
  for (const w of works.slice(0, Math.min(3, reveal))) {
    const b = byId(buttons, "today:" + w.id), hot = hover === b.id;
    const status = statuses[w.id] || "";
    card(ctx, b, hot ? c.hover : c.card, hot);
    ctx.fillStyle = c.muted;
    ctx.font = `600 28px ${c.ui || UI}`;
    spaced(ctx, 5);
    ctx.fillText(KIND[w.kind], b.x + 60, b.y + 62);
    unspaced(ctx);
    if (status) {
      ctx.fillStyle = status === "Read" ? c.ink : c.muted;
      ctx.font = `500 34px ${c.ui || UI}`;
      ctx.textAlign = "right";
      ctx.fillText(status === "Read" ? "✓  Read" : status, b.x + b.w - 60, b.y + 62);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = status === "Read" ? c.muted : c.ink;
    const title = fitted(ctx, w.title, b.w - 120, 64, 44, (s) => `${c.italic}${s}px ${c.serif}`);
    ctx.fillText(title, b.x + 60, b.y + 150);
    ctx.fillStyle = c.muted;
    ctx.font = `500 34px ${c.ui || UI}`;
    ctx.fillText(fit(ctx, [w.author, w.year, w.place].filter(Boolean).join(" · "), b.w - 120), b.x + 60, b.y + 212);
  }
  if (!complete) return;
  rule(ctx, 1590, c.muted);
  if (facts.closing) {
    ctx.fillStyle = c.ink;
    ctx.font = `500 48px ${c.ui || UI}`;
    ctx.fillText(facts.closing, 274, 1660);
  }
  smallButton(ctx, byId(buttons, "today-library"), "Your shelf  ›", hover === "today-library", c, "left");
  smallButton(ctx, byId(buttons, "today-full-library"), "Library  ›", hover === "today-full-library", c, "left");
  let noteY = 1920;
  if (facts.allRead && personal.thread) {
    ctx.font = `500 34px ${c.ui || UI}`;
    ctx.fillStyle = c.ink;
    const lines = wrapPersonal(ctx, personal.thread, 1500);
    lines.forEach((line, i) => ctx.fillText(line, 274, 1885 + i * 44));
    noteY = Math.max(noteY, 1885 + lines.length * 44 + 50);
  }
  if (note) {
    ctx.fillStyle = c.muted;
    ctx.font = `500 34px ${c.ui || UI}`;
    for (const [i, line] of wrap2(ctx, note, 1500).entries()) ctx.fillText(line, 274, noteY + i * 50);
  }
}

// After the last page of one of today's works.
export function paintClosing(ctx, { work, next, read, hover, allRead = false, thread = null, c }) {
  ctx.textAlign = "left";
  ctx.fillStyle = c.muted;
  ctx.font = `600 28px ${c.ui || UI}`;
  spaced(ctx, 5);
  ctx.fillText(`FINISHED · ${KIND[work.kind] || ""}`, 274, 440);
  unspaced(ctx);
  ctx.fillStyle = c.ink;
  ctx.fillText(fitted(ctx, work.title, 1080, 72, 40, (s) => `${c.italic}${s}px ${c.serif}`), 274, 545);
  ctx.fillStyle = c.muted;
  ctx.font = `500 34px ${c.ui || UI}`;
  ctx.fillText(fit(ctx, [work.author, work.year].filter(Boolean).join(" · "), 1080), 274, 615);
  const buttons = closingButtons(next);
  smallButton(ctx, byId(buttons, "end-back"), "‹  Text", hover === "end-back", c);
  rule(ctx, 662, c.muted);
  const labels = {
    "end-mark": read ? "Read today" : "Mark as read today",
    "end-next": next ? `Next: ${next.title}` : "",
    "end-today": "Today's three",
  };
  for (const b of buttons.slice(1)) {
    const hot = hover === b.id;
    card(ctx, b, hot ? c.hover : c.card, hot);
    ctx.fillStyle = c.ink;
    if (b.id === "end-next") {
      ctx.font = `500 58px ${c.ui || UI}`;
      const prefix = "Next: ", prefixWidth = ctx.measureText(prefix).width;
      ctx.fillText(prefix, b.x + 70, b.y + b.h / 2 + 20);
      const title = fitted(ctx, next.title, b.w - 260 - prefixWidth, 58, 40, (s) => `${c.italic}${s}px ${c.serif}`);
      ctx.fillText(title, b.x + 70 + prefixWidth, b.y + b.h / 2 + 20);
    } else {
      const label = fitted(ctx, labels[b.id], b.w - 260, 58, 40, (s) => `500 ${s}px ${c.ui || UI}`);
      ctx.fillText(label, b.x + 70, b.y + b.h / 2 + 20);
    }
    if (b.id === "end-mark") {
      // A circle to tick, filled with a check once read.
      const cx = b.x + b.w - 100, cy = b.y + b.h / 2, r = 32;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - r, cy - r, r * 2, r * 2, r);
      else ctx.rect(cx - r, cy - r, r * 2, r * 2);
      if (read) {
        ctx.fillStyle = c.ink;
        ctx.fill();
        ctx.strokeStyle = c.bg;
        ctx.lineWidth = 6;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy + 1);
        ctx.lineTo(cx - 3, cy + 12);
        ctx.lineTo(cx + 15, cy - 10);
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
      } else {
        ctx.strokeStyle = c.muted;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }
  if (allRead && thread) {
    ctx.fillStyle = c.ink;
    ctx.font = `500 42px ${c.ui || UI}`;
    wrapPersonal(ctx, thread, 1500).forEach((line, i) => ctx.fillText(line, 274, 1350 + i * 54));
  }
}

// Editorial copy wraps completely; no ellipsis, clipped words or split
// surrogate pairs. Segmentation also keeps emoji sequences together.
export function wrapPersonal(ctx, text, width) {
  const parts = typeof Intl.Segmenter === "function"
    ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(p => p.segment)
    : Array.from(text);
  const lines = []; let line = "";
  for (const part of parts) {
    while (line && ctx.measureText(line + part).width > width) {
      const at = line.lastIndexOf(" ");
      if (at > 0) { lines.push(line.slice(0, at)); line = line.slice(at + 1); }
      else { lines.push(line); line = ""; }
    }
    line += part;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
