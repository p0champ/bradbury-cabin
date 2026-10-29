import { navigationSurface, CONTROL, NAV } from './theme.js?v=48';
// Settings uses the same canvas and ray plane as Home. Geometry is expressed
// here once, in millimetre-like logical units, then shared with the hit tester.
const SCALE = 2048 / 720;
const WIDTH = 580, HEIGHT = 400;
const X = (2048 - WIDTH * SCALE) / 2;
const Y = (2560 - HEIGHT * SCALE) / 2;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SETTINGS_PAGES = Object.freeze(['settings', 'more', 'sound', 'volume', 'wrist', 'controls']);
export const settingsBounds = () => ({ x: X, y: Y, w: WIDTH * SCALE, h: HEIGHT * SCALE });
const rect = (id, label, x, y, w, h, selected = false) => ({ id, label, x, y, w, h, selected });
function segment(prefix, choices, selected, y, { x = 24, w = 532 } = {}) {
  const gap = 5, each = (w - 10 - gap * (choices.length - 1)) / choices.length;
  return choices.map(([value, label], i) => rect(`${prefix}:${value}`, label, x + 5 + i * (each + gap), y + 5, each, 44, String(selected) === String(value)));
}
function localButtons(page, values) {
  const rows = [rect(page === 'settings' ? 'settings-done' : 'settings-back', page === 'settings' ? 'Done' : 'Back', 460, 18, 96, 48)];
  if (page === 'settings') {
    rows.push(...segment('settings-appearance', [['paper', 'Paper'], ['night', 'Night']], values.night ? 'night' : 'paper', 101));
    rows.push(...segment('settings-type', [['literary', 'Literary'], ['modern', 'Modern']], values.mood ?? 'literary', 182));
    rows.push(...segment('settings-size', [[0, 'Small'], [1, 'Medium'], [2, 'Large']], values.size ?? 1, 263));
    rows.push(rect('settings-more', 'More settings', 24, 334, 260, 48), rect('settings-exit', 'Leave cabin', 296, 334, 260, 48));
  } else if (page === 'more') {
    ['Sound', 'Calendar', 'Wrist calendar', 'Controls'].forEach((label, i) => rows.push(rect(`settings-${['sound', 'calendar', 'wrist', 'controls'][i]}`, label, 24, 84 + i * 74, 532, 64)));
  } else if (page === 'sound') {
    rows.push(...segment('settings-entry', [['on', 'On'], ['off', 'Off']], values.entrySound !== false ? 'on' : 'off', 111));
    rows.push(...segment('settings-ambience', [['off', 'Off'], ['rain', 'Soft rain'], ['fire', 'Fireplace'], ['room', 'Quiet room']], values.ambience ?? 'off', 202));
    rows.push(rect('settings-volume', `Volume · ${Math.round((values.ambienceVolume ?? 1) * 100)}%`, 24, 284, 532, 64));
  } else if (page === 'volume') {
    rows.push(...segment('settings-volume', [[0, 'Off'], [25, '25%'], [50, '50%'], [75, '75%'], [100, '100%']], Math.round((values.ambienceVolume ?? 1) * 100), 174));
  } else if (page === 'wrist') {
    rows.push(...segment('settings-wrist', [['on', 'On'], ['off', 'Off']], values.wristCalendar !== false ? 'on' : 'off', 192));
  } else if (page === 'controls') {
    rows.push(...segment('settings-pointer', [['hand', 'Hand'], ['head', 'Head']], values.headPointer ? 'head' : 'hand', 101));
    rows.push(...segment('settings-next', [['right', 'Right'], ['left', 'Left']], values.swapped ? 'left' : 'right', 182));
    rows.push(...segment('settings-look', [['off', 'Off'], ['on', 'On']], values.gazeTurn ? 'on' : 'off', 263));
    rows.push(rect('settings-move', 'Move page here', 24, 334, 260, 48), rect('settings-practise', 'Practise', 296, 334, 260, 48));
  }
  return rows;
}

// These rectangles are in the 2048 × 2560 parent canvas, not local coordinates.
export function settingsButtons({ page = 'settings', values = {} } = {}) {
  if (!SETTINGS_PAGES.includes(page)) return [];
  return localButtons(page, values).map(b => ({ ...b, x: X + b.x * SCALE, y: Y + b.y * SCALE, w: b.w * SCALE, h: b.h * SCALE }));
}
export function settingsHit(point, options) {
  return settingsButtons(options).find(b => point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h)?.id ?? null;
}

function rounded(ctx, x, y, w, h, r = 12) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
function label(ctx, text, y) {
  ctx.fillStyle = '#cbd0cd';
  ctx.font = `400 17px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(text, 29, y);
}
export function paintSettings(ctx, { page = 'settings', values = {}, hover = null } = {}) {
  if (!SETTINGS_PAGES.includes(page)) return;
  ctx.save();
  ctx.translate(X, Y);
  ctx.scale(SCALE, SCALE);
  navigationSurface(ctx, WIDTH, HEIGHT);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5f5f2';
  ctx.font = `550 24px ${FONT}`;
  ctx.fillText({ settings: 'Settings', more: 'More settings', sound: 'Sound', volume: 'Volume', wrist: 'Wrist calendar', controls: 'Controls' }[page], 29, 42);
  const group = y => {
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    rounded(ctx, 24, y, 532, 54, 14);
    ctx.fill();
  };
  if (page === 'settings') {
    label(ctx, 'Reading appearance', 86); group(101);
    label(ctx, 'Typeface', 167); group(182);
    label(ctx, 'Text size', 248); group(263);
  } else if (page === 'sound') {
    label(ctx, 'Entry chime', 96); group(111);
    label(ctx, 'Background ambience', 187); group(202);
  } else if (page === 'volume') {
    label(ctx, 'Background ambience volume', 146); group(174);
    label(ctx, 'Entry chime keeps its own level.', 267);
  } else if (page === 'wrist') {
    label(ctx, 'A glance at the date on your right wrist.', 130);
    group(192);
    label(ctx, 'Turn the back of your right wrist toward you.', 285);
  } else if (page === 'controls') {
    label(ctx, 'Aim with', 86); group(101);
    label(ctx, 'Next-page hand', 167); group(182);
    label(ctx, 'Turn pages by looking', 248); group(263);
  }
  for (const b of localButtons(page, values)) {
    const header = ['settings-done', 'settings-back'].includes(b.id);
    const route = page === 'more' || b.id === 'settings-volume';
    if (hover === b.id || b.selected || route) {
      ctx.fillStyle = b.selected ? CONTROL.selected : hover === b.id ? CONTROL.hover : CONTROL.quiet;
      rounded(ctx, b.x, b.y, b.w, b.h);
      ctx.fill();
    }
    ctx.fillStyle = b.selected ? CONTROL.selectedInk : NAV.ink;
    ctx.font = `${b.selected || header ? 550 : 400} ${header ? 18 : route ? 19 : 17}px ${FONT}`;
    ctx.textAlign = route ? 'left' : 'center';
    ctx.fillText(b.label, route ? b.x + 18 : b.x + b.w / 2, b.y + b.h / 2);
    if (route) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#cbd0cd';
      ctx.fillText('›', b.x + b.w - 18, b.y + b.h / 2);
    }
  }
  ctx.restore();
}
