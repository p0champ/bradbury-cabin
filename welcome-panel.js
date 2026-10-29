import { UI, lift, unlift } from "./theme.js?v=37";
// The welcome screen every entry lands on. It builds in quiet steps after the
// window has faded in: the greeting (already shown during the fade), a
// hairline, one line about the day, then the choices. One repaint per step.
export const WELCOME_STEPS = 3;
export const WELCOME_MS = 600;

const PRIMARY = { x: 274, y: 1250, w: 1500, h: 170 };
const SECONDARY = { x: 274, y: 1440, w: 1500, h: 150 };
const MENU = { id: "welcome-menu", x: 274, y: 1700, w: 520, h: 110 };

// hasToday: today's three are ready, so the first choice begins them.
export function welcomeButtons(hasToday) {
  return hasToday
    ? [{ id: "welcome-begin", ...PRIMARY }, { id: "welcome-continue", ...SECONDARY }, MENU]
    : [{ id: "welcome-continue", ...PRIMARY }, MENU];
}
export function welcomeHit(x, y, hasToday) {
  return welcomeButtons(hasToday).find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null;
}
export function greeting(date = new Date()) {
  const h = date.getHours();
  return h >= 5 && h < 12 ? "Good morning, Bastian." : h >= 12 && h < 18 ? "Good afternoon, Bastian." : "Good evening, Bastian.";
}

function fit(ctx, text, width) {
  while (text.length > 8 && ctx.measureText(text).width > width) text = text.slice(0, -2).trimEnd() + "…";
  return text;
}

// c: { ink, muted, card, hover, serif, italic }
// reveal: 0 shows the greeting only; WELCOME_STEPS (or null) shows everything.
export function paintWelcome(ctx, { hello, line, today, resume, reveal = WELCOME_STEPS, hover = null, c }) {
  const step = reveal ?? WELCOME_STEPS;
  ctx.textAlign = "center";
  ctx.fillStyle = c.ink;
  ctx.font = `104px ${c.serif}`;
  ctx.fillText(hello, 1024, 860);
  if (step >= 1) {
    ctx.fillStyle = c.muted;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(1024 - 120, 950, 240, 2);
    ctx.globalAlpha = 1;
  }
  if (step >= 2) {
    ctx.fillStyle = c.muted;
    ctx.font = `${c.italic}48px ${c.serif}`;
    ctx.fillText(line, 1024, 1060);
  }
  ctx.textAlign = "left";
  if (step < 3) return;
  const buttons = welcomeButtons(today);
  const rows = buttons.filter((b) => b.id !== "welcome-menu");
  // The choices share one soft panel, like a grouped list.
  const top = rows[0], bottom = rows.at(-1);
  ctx.fillStyle = c.card;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(top.x, top.y, top.w, bottom.y + bottom.h - top.y, 40);
  else ctx.rect(top.x, top.y, top.w, bottom.y + bottom.h - top.y);
  ctx.fill();
  if (rows.length > 1 && !rows.some((b) => b.id === hover)) {
    ctx.fillStyle = c.muted;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(top.x + 70, top.y + top.h + (rows[1].y - top.y - top.h) / 2 - 1, top.w - 140, 2);
    ctx.globalAlpha = 1;
  }
  for (const b of buttons) {
    const hot = hover === b.id;
    if (hot) {
      ctx.fillStyle = c.hover;
      lift(ctx);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 40);
      else ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
      unlift(ctx);
    }
    const primary = b === rows[0];
    if (b.id === "welcome-menu") {
      ctx.fillStyle = c.muted;
      ctx.font = `40px ${UI}`;
      ctx.fillText("Menu  ›", b.x + 40, b.y + b.h / 2 + 14);
      continue;
    }
    const label = b.id === "welcome-begin" ? "Begin today’s reading" : `Continue ${resume.title}`;
    ctx.fillStyle = c.ink;
    ctx.font = primary ? `${c.italic}60px ${c.serif}` : `46px ${c.serif}`;
    const room = b.w - 140 - (resume.place ? 200 : 0);
    ctx.fillText(fit(ctx, label, room), b.x + 70, b.y + b.h / 2 + (primary ? 20 : 16));
    if (b.id === "welcome-continue" && resume.place) {
      ctx.fillStyle = c.muted;
      ctx.font = `38px ${UI}`;
      ctx.textAlign = "right";
      ctx.fillText(resume.place, b.x + b.w - 70, b.y + b.h / 2 + 14);
      ctx.textAlign = "left";
    }
  }
}
