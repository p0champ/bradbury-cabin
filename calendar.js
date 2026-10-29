import { UI, lift, unlift } from "./theme.js?v=45";
// Challenge calendar panels drawn on the same crisp page canvas as the menu.
// Buttons are plain rectangles in canvas pixels, hit-tested like the menu.
import {
  KINDS,
  dayStatus,
  monthGrid,
  overview,
  parseKey,
  weekSunday,
  ticks,
} from "./progress.js?v=45";

const MONTHS = "January February March April May June July August September October November December".split(" ");
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG_DAYS = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" ");
const KIND_LABEL = { poem: "Poem", story: "Story", essay: "Essay" };
const GRID = { x: 194, y: 840, w: 230, h: 190, gap: 10 };
const ROW = (i) => ({ x: 274, y: 640 + i * 222, w: 1500, h: 186 });

export function shiftMonth(view, delta) {
  const d = new Date(view.year, view.month + delta, 1);
  return { ...view, year: d.getFullYear(), month: d.getMonth() };
}

export function calendarButtons(page, view, progress, today) {
  if (page === "day") {
    return [
      ...KINDS.map((k, i) => ({ id: "tick:" + k, ...ROW(i) })),
      { id: "weekly", ...ROW(3) },
      { id: "cal-back", ...ROW(4) },
    ];
  }
  const buttons = [
    { id: "cal-menu", x: 194, y: 600, w: 380, h: 130 },
    { id: "cal-prev", x: 1234, y: 600, w: 300, h: 130 },
    { id: "cal-next", x: 1554, y: 600, w: 300, h: 130 },
  ];
  monthGrid(view.year, view.month).forEach((cell, i) => {
    if (!cell) return;
    const s = dayStatus(progress, cell.key, today);
    if (s === "future" || s === "before") return;
    buttons.push({
      id: "day:" + cell.key,
      x: GRID.x + (i % 7) * (GRID.w + GRID.gap),
      y: GRID.y + Math.floor(i / 7) * (GRID.h + GRID.gap),
      w: GRID.w,
      h: GRID.h,
    });
  });
  return buttons;
}
export function calendarHit(x, y, page, view, progress, today) {
  return (
    calendarButtons(page, view, progress, today).find(
      (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h,
    )?.id || null
  );
}

function card(ctx, b, fill, radius = 30, hot = false) {
  ctx.fillStyle = fill;
  if (hot) lift(ctx);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, radius);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.fill();
  if (hot) unlift(ctx);
}
function outline(ctx, b, colour, width, radius = 30, dash = []) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, radius);
  else ctx.rect(b.x, b.y, b.w, b.h);
  ctx.stroke();
  ctx.setLineDash([]);
}
function dayTitle(key) {
  const d = parseKey(key);
  return `${LONG_DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function shortDate(key) {
  const d = parseKey(key);
  return `${LONG_DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function paintCalendar(ctx, { page, view, progress, today, hover, c, notice = "" }) {
  const buttons = calendarButtons(page, view, progress, today);
  const hot = (id) => hover === id;
  ctx.textAlign = "left";
  if (notice) {
    ctx.fillStyle = c.warn;
    ctx.font = `500 36px ${c.ui || UI}`;
    ctx.fillText(notice, page === "day" ? 274 : 194, 2230);
  }
  if (page === "day") return paintDay(ctx, buttons, view.selected, progress, today, hot, c);

  const o = overview(progress, today);
  ctx.fillStyle = c.ink;
  ctx.font = `500 84px ${c.ui || UI}`;
  ctx.fillText(`${MONTHS[view.month]} ${view.year}`, 194, 470);
  ctx.fillStyle = c.muted;
  ctx.font = `500 38px ${c.ui || UI}`;
  ctx.fillText(
    [
      `Streak ${o.streak} ${o.streak === 1 ? "day" : "days"}`,
      `${o.complete} complete`,
      o.partial ? `${o.partial} in progress` : null,
      `${o.missed} missed`,
    ]
      .filter(Boolean)
      .join("  ·  "),
    194,
    545,
  );
  const prev = shiftMonth(view, -1),
    next = shiftMonth(view, 1);
  for (const b of buttons.slice(0, 3)) {
    card(ctx, b, hot(b.id) ? c.hover : c.card, 26, hot(b.id));
    ctx.fillStyle = c.ink;
    ctx.font = `500 50px ${c.ui || UI}`;
    ctx.textAlign = "center";
    const label =
      b.id === "cal-menu"
        ? "‹  Menu"
        : b.id === "cal-prev"
          ? `‹  ${MONTHS[prev.month].slice(0, 3)}`
          : `${MONTHS[next.month].slice(0, 3)}  ›`;
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 18);
  }
  ctx.textAlign = "center";
  ctx.font = `500 34px ${c.ui || UI}`;
  ctx.fillStyle = c.muted;
  WEEKDAYS.forEach((w, i) =>
    ctx.fillText(w, GRID.x + i * (GRID.w + GRID.gap) + GRID.w / 2, GRID.y - 24),
  );
  const grid = monthGrid(view.year, view.month);
  grid.forEach((cell, i) => {
    if (!cell) return;
    const b = {
      x: GRID.x + (i % 7) * (GRID.w + GRID.gap),
      y: GRID.y + Math.floor(i / 7) * (GRID.h + GRID.gap),
      w: GRID.w,
      h: GRID.h,
    };
    const s = dayStatus(progress, cell.key, today);
    const isHot = hot("day:" + cell.key);
    const filled = s === "complete";
    if (filled) card(ctx, b, c.done, 24, isHot);
    else if (s === "partial" || s === "open" || s === "missed") card(ctx, b, isHot ? c.hover : c.card, 24, isHot);
    if (s === "unrecorded") outline(ctx, b, c.faint, 3, 24, [12, 10]);
    if (s === "missed") outline(ctx, b, c.warn, 4, 24);
    if (cell.key === today) outline(ctx, b, c.ink, 6, 24);
    // A neutral outline keeps targeting distinct from completion and missed days.
    if (isHot) {
      outline(ctx, b, filled ? c.hover : c.ink, 8, 24);
    }
    const text = filled ? c.bg : s === "future" || s === "before" ? c.faint : c.ink;
    ctx.fillStyle = text;
    ctx.textAlign = "left";
    ctx.font = `500 44px ${c.ui || UI}`;
    ctx.fillText(String(cell.day), b.x + 26, b.y + 62);
    if (s === "missed") {
      ctx.fillStyle = c.warn;
      ctx.font = `500 34px ${c.ui || UI}`;
      ctx.fillText("missed", b.x + 26, b.y + 166);
    } else if (s !== "future" && s !== "before" && s !== "unrecorded") {
      const d = progress.days[cell.key] || {};
      KINDS.forEach((k, j) => {
        ctx.beginPath();
        ctx.arc(b.x + 50 + j * 64, b.y + 150, 17, 0, Math.PI * 2);
        if (d[k]) {
          ctx.fillStyle = text;
          ctx.fill();
        } else {
          ctx.strokeStyle = filled ? c.bg : c.muted;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });
    }
    // Sundays carry the weekly written story.
    if (parseKey(cell.key).getDay() === 0 && s !== "before") {
      const submitted = !!progress.weeks[cell.key]?.submitted;
      const unknown = !submitted && cell.key < progress.trackingSince;
      const tag = { x: b.x + b.w - 74, y: b.y + 24, w: 50, h: 50 };
      if (submitted) card(ctx, tag, filled ? c.bg : c.accent, 12);
      else outline(ctx, tag, filled ? c.bg : unknown ? c.faint : c.muted, 3, 12, unknown ? [6, 6] : []);
      ctx.fillStyle = submitted ? (filled ? c.accent : c.bg) : filled ? c.bg : unknown ? c.faint : c.muted;
      ctx.font = `500 30px ${c.ui || UI}`;
      ctx.textAlign = "center";
      ctx.fillText("✎", tag.x + 25, tag.y + 36);
    }
  });
  ctx.textAlign = "left";
  // Legend
  let lx = 194;
  const ly = 2082;
  ctx.font = `500 32px ${c.ui || UI}`;
  const item = (draw, label) => {
    draw(lx);
    ctx.fillStyle = c.muted;
    ctx.fillText(label, lx + 56, ly + 11);
    lx += 56 + ctx.measureText(label).width + 44;
  };
  item((x) => card(ctx, { x, y: ly - 20, w: 40, h: 40 }, c.done, 8), "all three");
  item((x) => {
    ctx.beginPath();
    ctx.arc(x + 20, ly, 14, 0, Math.PI * 2);
    ctx.fillStyle = c.ink;
    ctx.fill();
  }, "one read");
  item((x) => outline(ctx, { x, y: ly - 20, w: 40, h: 40 }, c.warn, 4, 8), "missed");
  item((x) => outline(ctx, { x, y: ly - 20, w: 40, h: 40 }, c.muted, 3, 8, [6, 5]), "not recorded");
  item((x) => {
    ctx.fillStyle = c.muted;
    ctx.font = `500 34px ${c.ui || UI}`;
    ctx.fillText("✎", x + 6, ly + 12);
    ctx.font = `500 32px ${c.ui || UI}`;
  }, "weekly story");
  ctx.fillStyle = c.muted;
  ctx.font = `500 36px ${c.ui || UI}`;
  ctx.fillText(
    o.weekSubmitted
      ? "This week's written story: handed in ✎"
      : `This week's written story: due Sunday (${o.daysToSunday === 0 ? "today" : `in ${o.daysToSunday} ${o.daysToSunday === 1 ? "day" : "days"}`})`,
    194,
    2160,
  );
}

function paintDay(ctx, buttons, key, progress, today, hot, c) {
  const s = dayStatus(progress, key, today);
  const d = progress.days[key] || {};
  const n = ticks(progress, key);
  ctx.fillStyle = c.ink;
  ctx.font = `500 84px ${c.ui || UI}`;
  ctx.fillText(dayTitle(key), 274, 470);
  ctx.fillStyle = s === "missed" ? c.warn : c.muted;
  ctx.font = `500 38px ${c.ui || UI}`;
  ctx.fillText(
    {
      complete: "Complete — all three read.",
      partial: `${n} of 3 read. Tick the rest when you finish them.`,
      open: "Today. Tick each one when you finish it.",
      missed: "Missed. You can still tick anything you did read.",
      unrecorded: "Not recorded yet. Tick what you read that day.",
    }[s] || "",
    274,
    560,
  );
  const sunday = weekSunday(key);
  const submitted = !!progress.weeks[sunday]?.submitted;
  for (const b of buttons) {
    const isHot = hot(b.id);
    card(ctx, b, isHot ? c.hover : c.card, 30, isHot);
    const fg = c.ink,
      sub = c.muted;
    ctx.textAlign = "left";
    if (b.id.startsWith("tick:")) {
      const k = b.id.slice(5),
        done = !!d[k];
      // Tick circle
      ctx.beginPath();
      ctx.arc(b.x + 90, b.y + b.h / 2, 34, 0, Math.PI * 2);
      if (done) {
        ctx.fillStyle = fg;
        ctx.fill();
        ctx.strokeStyle = isHot ? c.hover : c.card;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(b.x + 72, b.y + b.h / 2 + 2);
        ctx.lineTo(b.x + 86, b.y + b.h / 2 + 16);
        ctx.lineTo(b.x + 110, b.y + b.h / 2 - 14);
        ctx.stroke();
      } else {
        ctx.strokeStyle = sub;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.fillStyle = fg;
      ctx.font = `500 58px ${c.ui || UI}`;
      const pick = d.picks?.[k];
      ctx.fillText(KIND_LABEL[k], b.x + 160, b.y + (pick ? 82 : 112));
      if (pick) {
        ctx.fillStyle = sub;
        ctx.font = `${c.italic ?? "italic "}36px ${c.serif || "Literata"}`;
        ctx.fillText(pick, b.x + 160, b.y + 140);
      }
      ctx.fillStyle = sub;
      ctx.font = `500 40px ${c.ui || UI}`;
      ctx.textAlign = "right";
      ctx.fillText(done ? "Read" : key === today ? "Not yet" : "Not read", b.x + b.w - 70, b.y + 108);
    } else if (b.id === "weekly") {
      ctx.fillStyle = fg;
      ctx.font = `500 52px ${c.ui || UI}`;
      ctx.fillText("Weekly written story", b.x + 70, b.y + 82);
      ctx.fillStyle = sub;
      ctx.font = `500 34px ${c.ui || UI}`;
      ctx.fillText(`Week ending ${shortDate(sunday)}`, b.x + 70, b.y + 140);
      ctx.font = `500 40px ${c.ui || UI}`;
      ctx.textAlign = "right";
      ctx.fillText(
        submitted ? "Handed in ✎" : sunday < progress.trackingSince ? "Not recorded" : "Not yet",
        b.x + b.w - 70,
        b.y + 108,
      );
    } else {
      ctx.fillStyle = fg;
      ctx.font = `500 58px ${c.ui || UI}`;
      ctx.fillText("‹  Calendar", b.x + 70, b.y + 112);
    }
  }
  ctx.textAlign = "left";
}

// A pinch repeated right after a day opens must not tick that day: the day
// page's tick rows sit where calendar cells were. Second line of defence; the
// recogniser's tracking-settling check usually rejects such a repeat already.
export const DAY_GUARD_MS = 600;
export function dayInputAllowed(now, openedAt) {
  return now - openedAt >= DAY_GUARD_MS;
}
