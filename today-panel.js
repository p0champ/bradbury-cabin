// Today: Claude's three for the day on a page of their own, and a quiet
// closing page after each of them. Everything shown comes from real data:
// the date, the challenge day, ticks, saved places and catalogue metadata.
// Canvas-drawn on the reading page, hit-tested like the other menu panels.
import { CHALLENGE_START, KINDS, parseKey, streak } from "./progress.js?v=28";

const KIND = { poem: "POEM", story: "STORY", essay: "ESSAY" };
const ENTRY = (i) => ({ x: 274, y: 660 + i * 290, w: 1500, h: 260 });
// "‹ Menu" sits where the Library's does, away from "Leave the cabin".
const MENU_BUTTON = { x: 1394, y: 380, w: 380, h: 120 };
const LIBRARY_BUTTON = { x: 274, y: 1700, w: 760, h: 120 };
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
function card(ctx, b, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 28);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill();
}
function rule(ctx, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(274, y, 1500, 3);
}
function smallButton(ctx, b, label, hot, c, align = "center") {
  if (!b) return;
  card(ctx, b, hot ? c.accent : c.card);
  ctx.fillStyle = hot ? c.bg : c.ink;
  ctx.font = "44px Arial";
  ctx.textAlign = align;
  ctx.fillText(label, align === "center" ? b.x + b.w / 2 : b.x + 60, b.y + b.h / 2 + 15);
  ctx.textAlign = "left";
}
const byId = (buttons, id) => buttons.find((b) => b.id === id);

// c: { bg, ink, muted, card, accent, gold, serif, italic }
export function paintToday(ctx, { works, hover, facts, statuses, note = "", c }) {
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = `84px ${c.serif}`;
  ctx.fillText("Today", 274, 470);
  ctx.fillStyle = c.muted;
  ctx.font = "36px Arial";
  ctx.fillText(facts.dateline + (facts.read && !facts.allRead ? ` · ${facts.read} of 3 read` : ""), 274, 540);
  const buttons = todayButtons(works);
  smallButton(ctx, byId(buttons, "today-menu"), "‹  Menu", hover === "today-menu", c);
  // Gold while the day is open; ink once all three are read.
  rule(ctx, 610, facts.allRead ? c.ink : c.gold);
  for (const w of works.slice(0, 3)) {
    const b = byId(buttons, "today:" + w.id), hot = hover === b.id;
    const status = statuses[w.id] || "";
    card(ctx, b, hot ? c.accent : c.card);
    ctx.fillStyle = hot ? c.bg : c.muted;
    ctx.font = "32px Arial";
    ctx.fillText(KIND[w.kind], b.x + 60, b.y + 62);
    if (status) {
      ctx.fillStyle = hot ? c.bg : status === "Read" ? c.ink : c.muted;
      ctx.font = "38px Arial";
      ctx.textAlign = "right";
      ctx.fillText(status === "Read" ? "✓  Read" : status, b.x + b.w - 60, b.y + 64);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = hot ? c.bg : status === "Read" ? c.muted : c.ink;
    const title = fitted(ctx, w.title, b.w - 120, 64, 44, (s) => `${c.italic}${s}px ${c.serif}`);
    ctx.fillText(title, b.x + 60, b.y + 150);
    ctx.fillStyle = hot ? c.bg : c.muted;
    ctx.font = "34px Arial";
    ctx.fillText(fit(ctx, [w.author, w.year, w.place].filter(Boolean).join(" · "), b.w - 120), b.x + 60, b.y + 212);
  }
  rule(ctx, 1590, facts.allRead ? c.ink : c.gold);
  if (facts.closing) {
    ctx.fillStyle = c.ink;
    ctx.font = `${c.italic}48px ${c.serif}`;
    ctx.fillText(facts.closing, 274, 1660);
  }
  smallButton(ctx, byId(buttons, "today-library"), "Your shelf  ›", hover === "today-library", c, "left");
  if (note) {
    ctx.fillStyle = c.muted;
    ctx.font = "34px Arial";
    for (const [i, line] of wrap2(ctx, note, 1500).entries()) ctx.fillText(line, 274, 1920 + i * 50);
  }
}

// After the last page of one of today's works.
export function paintClosing(ctx, { work, next, read, hover, c }) {
  ctx.textAlign = "left";
  ctx.fillStyle = c.muted;
  ctx.font = "36px Arial";
  ctx.fillText(`FINISHED · ${KIND[work.kind] || ""}`, 274, 440);
  ctx.fillStyle = c.ink;
  ctx.fillText(fitted(ctx, work.title, 1080, 72, 40, (s) => `${c.italic}${s}px ${c.serif}`), 274, 545);
  ctx.fillStyle = c.muted;
  ctx.font = "34px Arial";
  ctx.fillText(fit(ctx, [work.author, work.year].filter(Boolean).join(" · "), 1080), 274, 615);
  const buttons = closingButtons(next);
  smallButton(ctx, byId(buttons, "end-back"), "‹  Text", hover === "end-back", c);
  rule(ctx, 662, c.gold);
  const labels = {
    "end-mark": read ? "Read today" : "Mark as read today",
    "end-next": next ? `Next: ${next.title}` : "",
    "end-today": "Today's three",
  };
  for (const b of buttons.slice(1)) {
    const hot = hover === b.id;
    card(ctx, b, hot ? c.accent : c.card);
    ctx.fillStyle = hot ? c.bg : c.ink;
    const label = fitted(ctx, labels[b.id], b.w - 260, 58, 40, (s) => `${s}px ${c.serif}`);
    ctx.fillText(label, b.x + 70, b.y + b.h / 2 + 20);
    if (b.id === "end-mark") {
      // A box to tick, filled once read.
      const box = { x: b.x + b.w - 130, y: b.y + b.h / 2 - 30, w: 60, h: 60 };
      ctx.strokeStyle = hot ? c.bg : c.ink;
      ctx.lineWidth = 4;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      if (read) {
        ctx.fillStyle = hot ? c.bg : c.ink;
        ctx.font = "52px Arial";
        ctx.textAlign = "center";
        ctx.fillText("✓", box.x + box.w / 2, box.y + 48);
        ctx.textAlign = "left";
      }
    }
  }
}
