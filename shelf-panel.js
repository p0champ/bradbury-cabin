// Your shelf: every earlier day's three, newest first, and the works of one
// day. Past works reopen only as the exact catalogue edition that was given
// (by saved ID, or by an unambiguous title and author match). Anything else
// is listed as not in the cabin and can never be opened as unchecked text.
import { KINDS, parseKey, CHALLENGE_START } from "./progress.js?v=33";
import { dayGuide } from "./guide-archive.js?v=33";

const KIND = { poem: "POEM", story: "STORY", essay: "ESSAY" };
export const DAYS_PER_PAGE = 6;
const MENU_BUTTON = { x: 1394, y: 380, w: 380, h: 120 };
const DAY_ROW = (i) => ({ x: 274, y: 640 + i * 200, w: 1500, h: 180 });
const LIBRARY_BUTTON = { x: 274, y: 1880, w: 760, h: 120 };
const LATER_BUTTON = { x: 1100, y: 1880, w: 320, h: 120 };
const EARLIER_BUTTON = { x: 1454, y: 1880, w: 320, h: 120 };
const ENTRY = (i) => ({ x: 274, y: 660 + i * 290, w: 1500, h: 260 });

const titleKey = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// One day's works: [{ kind, label, work (catalogue entry or null), read }].
export function resolveDay(progress, date, catalogue) {
  const d = progress.days[date] || {};
  const byLabel = (label) => {
    const key = titleKey(String(label).replace(" — ", " "));
    const found = catalogue.filter((w) => titleKey(`${w.title} ${w.author}`) === key);
    return found.length === 1 ? found[0] : null;
  };
  return KINDS.filter((k) => d.ids?.[k] || d.picks?.[k]).map((kind) => {
    let work = d.ids?.[kind] ? catalogue.find((w) => w.id === d.ids[kind]) || null : null;
    // A saved ID must agree with the day's own label, if there is one.
    if (work && d.picks?.[kind] && titleKey(`${work.title} ${work.author}`) !== titleKey(String(d.picks[kind]).replace(" — ", " ")))
      work = null;
    if (!work && d.picks?.[kind]) work = byLabel(d.picks[kind]);
    if (work && work.kind !== kind) work = null;
    const label = work ? `${work.title} — ${work.author}` : String(d.picks?.[kind] || "");
    return { kind, label, work, read: d[kind] === true };
  });
}

// Earlier days that had picks, newest first.
export function shelfDays(progress, today) {
  return Object.keys(progress.days)
    .filter((k) => k < today && KINDS.some((kind) => progress.days[k].picks?.[kind] || progress.days[k].ids?.[kind]))
    .sort()
    .reverse();
}

export function dayHeading(date) {
  const d = parseKey(date);
  const day = Math.round((d - parseKey(CHALLENGE_START)) / 864e5) + 1;
  return `${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · Day ${day}`;
}

// The same edition the day gave, under the id it had then, so a saved
// reading place from that day still applies.
export function pastWork(date, kind, work, day = null) {
  return { ...JSON.parse(JSON.stringify(work)), catalogueId: work.id, id: `today-${date}-${kind}-${work.id}`, today: false, shelfDate: date,
    guide: dayGuide(day, kind, work) };
}

export function shelfButtons(days, page) {
  const pages = Math.max(1, Math.ceil(days.length / DAYS_PER_PAGE));
  const shown = days.slice(page * DAYS_PER_PAGE, (page + 1) * DAYS_PER_PAGE);
  return [
    { id: "shelf-menu", ...MENU_BUTTON },
    ...shown.map((date, i) => ({ id: "shelfday:" + date, ...DAY_ROW(i) })),
    { id: "shelf-library", ...LIBRARY_BUTTON },
    ...(page > 0 ? [{ id: "shelf-later", ...LATER_BUTTON }] : []),
    ...(page < pages - 1 ? [{ id: "shelf-earlier", ...EARLIER_BUTTON }] : []),
  ];
}
export function shelfHit(x, y, days, page) {
  return shelfButtons(days, page).find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null;
}

export function dayButtons(entries) {
  return [
    { id: "day-back", ...MENU_BUTTON },
    ...entries.map((e, i) => (e.work ? { id: `pastwork:${e.kind}`, ...ENTRY(i) } : null)).filter(Boolean),
  ];
}
export function dayHit(x, y, entries) {
  return dayButtons(entries).find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null;
}

function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > width) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}
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
function button(ctx, b, label, hot, c, align = "center") {
  if (!b) return;
  card(ctx, b, hot ? c.accent : c.card);
  ctx.fillStyle = hot ? c.bg : c.ink;
  ctx.font = "44px Arial";
  ctx.textAlign = align;
  ctx.fillText(label, align === "center" ? b.x + b.w / 2 : b.x + 60, b.y + b.h / 2 + 15);
  ctx.textAlign = "left";
}
const byId = (buttons, id) => buttons.find((b) => b.id === id);

// days: shelfDays(); entriesFor(date) gives resolveDay() for a date.
export function paintShelf(ctx, { days, page, entriesFor, hover, note = "", c }) {
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = `84px ${c.serif}`;
  ctx.fillText("Your shelf", 274, 470);
  ctx.fillStyle = c.muted;
  ctx.font = "36px Arial";
  const pages = Math.max(1, Math.ceil(days.length / DAYS_PER_PAGE));
  ctx.fillText(
    days.length
      ? `${days.length} earlier day${days.length === 1 ? "" : "s"}` + (pages > 1 ? ` · page ${page + 1} of ${pages}` : "")
      : "Each day's three will gather here.",
    274,
    540,
  );
  const buttons = shelfButtons(days, page);
  button(ctx, byId(buttons, "shelf-menu"), "‹  Menu", hover === "shelf-menu", c);
  ctx.fillStyle = c.gold;
  ctx.fillRect(274, 600, 1500, 3);
  for (const b of buttons.filter((x) => x.id.startsWith("shelfday:"))) {
    const date = b.id.slice(9), hot = hover === b.id, entries = entriesFor(date);
    card(ctx, b, hot ? c.accent : c.card);
    const read = entries.filter((e) => e.read).length;
    ctx.fillStyle = hot ? c.bg : c.muted;
    ctx.font = "34px Arial";
    ctx.fillText(dayHeading(date), b.x + 60, b.y + 58);
    ctx.textAlign = "right";
    ctx.fillText(read === 3 ? "✓  All three read" : `${read} of ${entries.length} read`, b.x + b.w - 60, b.y + 58);
    ctx.textAlign = "left";
    // Titles in a row: read ones in ink, unread ones muted.
    const titles = entries.map((e) => e.label.split(" — ")[0]);
    const line = titles.join("  ·  ");
    fitted(ctx, line, b.w - 120, 46, 30, (s) => `${c.italic}${s}px ${c.serif}`);
    const shrunk = ctx.measureText(line).width > b.w - 120;
    let x = b.x + 60;
    for (const [i, e] of entries.entries()) {
      const t = shrunk ? fit(ctx, titles[i], (b.w - 120) / entries.length - 50) : titles[i];
      ctx.fillStyle = hot ? c.bg : e.read ? c.ink : c.muted;
      ctx.fillText(t, x, b.y + 132);
      x += ctx.measureText(t).width;
      if (i < entries.length - 1) {
        ctx.fillStyle = hot ? c.bg : c.muted;
        ctx.fillText("  ·  ", x, b.y + 132);
        x += ctx.measureText("  ·  ").width;
      }
    }
  }
  button(ctx, byId(buttons, "shelf-library"), "The whole Library  ›", hover === "shelf-library", c, "left");
  if (note) {
    ctx.fillStyle = c.muted;
    ctx.font = "34px Arial";
    for (const [i, line] of wrap2(ctx, note, 1500).entries()) ctx.fillText(line, 274, 2060 + i * 50);
  }
  button(ctx, byId(buttons, "shelf-later"), "‹  Later", hover === "shelf-later", c);
  button(ctx, byId(buttons, "shelf-earlier"), "Earlier  ›", hover === "shelf-earlier", c);
}

export function paintShelfDay(ctx, { date, entries, statuses = {}, hover, c }) {
  ctx.textAlign = "left";
  ctx.fillStyle = c.ink;
  ctx.font = `72px ${c.serif}`;
  ctx.fillText(fit(ctx, dayHeading(date).split(" · ")[0], 1050), 274, 470);
  ctx.fillStyle = c.muted;
  ctx.font = "36px Arial";
  const read = entries.filter((e) => e.read).length;
  ctx.fillText(`${dayHeading(date).split(" · ")[1]} · ${read} of ${entries.length} read`, 274, 540);
  const buttons = dayButtons(entries);
  button(ctx, byId(buttons, "day-back"), "‹  Shelf", hover === "day-back", c);
  ctx.fillStyle = read === entries.length && entries.length ? c.ink : c.gold;
  ctx.fillRect(274, 610, 1500, 3);
  for (const [i, e] of entries.entries()) {
    const b = { id: `pastwork:${e.kind}`, ...ENTRY(i) }, hot = e.work && hover === b.id;
    card(ctx, b, hot ? c.accent : c.card);
    ctx.fillStyle = hot ? c.bg : c.muted;
    ctx.font = "32px Arial";
    ctx.fillText(KIND[e.kind], b.x + 60, b.y + 62);
    const status = e.read ? "✓  Read" : e.work ? statuses[e.kind] || "" : "Not in the cabin";
    if (status) {
      ctx.fillStyle = hot ? c.bg : e.read ? c.ink : c.muted;
      ctx.font = "38px Arial";
      ctx.textAlign = "right";
      ctx.fillText(status, b.x + b.w - 60, b.y + 64);
      ctx.textAlign = "left";
    }
    const [title, author] = e.label.split(" — ");
    ctx.fillStyle = hot ? c.bg : e.work && !e.read ? c.ink : c.muted;
    ctx.fillText(fitted(ctx, title, b.w - 120, 64, 44, (s) => `${c.italic}${s}px ${c.serif}`), b.x + 60, b.y + 150);
    ctx.fillStyle = hot ? c.bg : c.muted;
    ctx.font = "34px Arial";
    const meta = e.work ? [e.work.author, e.work.year, e.work.place] : [author];
    ctx.fillText(fit(ctx, meta.filter(Boolean).join(" · "), b.w - 120), b.x + 60, b.y + 212);
  }
}
