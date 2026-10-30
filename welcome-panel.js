import { UI, lift, unlift, innerEdge } from "./theme.js?v=56";
// Entry always paints the complete welcome. Partial paint steps remain a
// compatibility option for previews, with no timed reveal in the application.
export const WELCOME_STEPS = 3;
export const WELCOME_MS = 0;

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
  ctx.font = `500 104px ${c.ui || UI}`;
  ctx.fillText(hello, 1024, 860);
  if (step >= 1) {
    ctx.fillStyle = c.muted;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(1024 - 120, 950, 240, 2);
    ctx.globalAlpha = 1;
  }
  if (step >= 2) {
    ctx.fillStyle = c.muted;
    ctx.font = `500 48px ${c.ui || UI}`;
    ctx.fillText(line, 1024, 1060);
  }
  ctx.textAlign = "left";
  if (step < 3) return;
  const buttons = welcomeButtons(today);
  const rows = buttons.filter((b) => b.id !== "welcome-menu");
  for (const b of buttons) {
    const hot = hover === b.id;
    const primary = b === rows[0];
    if (b.id !== "welcome-menu" || hot) {
      ctx.fillStyle = primary || hot ? c.hover : c.card;
      if (hot) lift(ctx);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 40);
      else ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
      unlift(ctx);
      innerEdge(ctx,b,40);
      if (primary && hot) {
        ctx.save();
        ctx.strokeStyle = c.ink;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, 38);
        else ctx.rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (b.id === "welcome-menu") {
      ctx.fillStyle = c.muted;
      ctx.font = `500 40px ${c.ui || UI}`;
      ctx.fillText("Menu  ›", b.x + 40, b.y + b.h / 2 + 14);
      continue;
    }
    ctx.fillStyle = c.ink;
    const size = primary ? 60 : 46;
    ctx.font = `${primary ? 600 : 400} ${size}px ${c.ui || UI}`;
    const room = b.w - 140 - (resume.place ? 200 : 0);
    const y = b.y + b.h / 2 + (primary ? 20 : 16);
    if (b.id === "welcome-begin") ctx.fillText("Today’s three", b.x + 70, y);
    else {
      const command = "Continue ";
      const commandWidth = ctx.measureText(command).width;
      ctx.fillText(command, b.x + 70, y);
      ctx.font = `${c.italic}${size}px ${c.serif}`;
      ctx.fillText(fit(ctx, resume.title, room - commandWidth), b.x + 70 + commandWidth, y);
    }
    if (b.id === "welcome-continue" && resume.place) {
      ctx.fillStyle = c.muted;
      ctx.font = `500 38px ${c.ui || UI}`;
      ctx.textAlign = "right";
      ctx.fillText(resume.place, b.x + b.w - 70, b.y + b.h / 2 + 14);
      ctx.textAlign = "left";
    }
  }
}
