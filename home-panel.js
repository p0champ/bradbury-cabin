// A compact home on the existing portrait composition layer. All public
// rectangles use that layer's 2048 × 2560 canvas coordinates; the painter
// works in 720 × 500 logical units. Drawing and picking share one layout.
export const HOME_SCALE = 2048 / 720;
export const HOME_FRAME = Object.freeze({ x: 0, y: (2560 - 500 * HOME_SCALE) / 2, w: 2048, h: 500 * HOME_SCALE });
export const HOME_METRES = Object.freeze({ width: .72, height: .50 });
export const HOME_DAYS_PER_PAGE = 3;
const UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const KIND = { poem: 'Poem', story: 'Story', essay: 'Essay', sampler: 'Sampler' };
const rect = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });
const dateOf = day => typeof day === 'string' ? day : day.date;
const dayText = day => {
  if (typeof day !== 'string' && day.label) return day.label;
  const date = new Date(`${dateOf(day)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(dateOf(day)) : date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};
function rowsFor(o) {
  if (o.tab === 'shelf' && o.entries != null)
    return o.entries.slice(0, 3).map(e => ({ ...e.work, kind: e.kind, available: !!e.work, label: e.label, read: e.read }));
  return (o.works || []).slice(0, 3).map(w => ({ ...w, available: true }));
}
function layout(o = {}) {
  const shelf = o.tab === 'shelf', archive = shelf && !o.library && o.entries == null;
  const rows = rowsFor(o), resume = !shelf && o.resume && o.resume.id === o.currentId && !rows.some(w => w.id === o.resume.id) ? o.resume : null;
  const buttons = [rect('home-today', 24, 24, 103, 48), rect('home-shelf', 131, 24, 100, 48), rect('home-settings', 565, 24, 131, 48)];
  const start = 108, end = resume ? 378 : 438, rowHeight = (end - start) / 3;
  const display = archive ? (o.days || []).slice((o.page || 0) * 3, ((o.page || 0) + 1) * 3) : rows;
  display.forEach((item, i) => {
    const b = rect(archive ? `home-day:${dateOf(item)}` : `home-work:${item.id}`, 24, start + i * rowHeight, 672, rowHeight - 2, { item, archive });
    if (archive || item.available) buttons.push(b);
  });
  if (resume) buttons.push(rect('home-resume', 24, 378, 672, 60, { item: resume }));
  if (shelf && !archive) buttons.push(rect('home-back-shelf', 24, 76, 136, 30));
  if (shelf || o.library) {
    if(!o.library) buttons.push(rect('home-calendar', 24, 446, 116, 36));
    if ((archive || o.library) && (o.page || 0) > 0) buttons.push(rect('home-later', 151, 446, 100, 36));
    if ((archive || o.library) && ((o.page || 0) + 1) * 3 < (o.library ? o.total : (o.days || []).length)) buttons.push(rect('home-earlier', 260, 446, 110, 36));
  } else if (o.notes) buttons.push(rect('home-notes', 24, 446, 180, 36));
  buttons.push(rect(o.library?'home-back-shelf':'home-library', 463, 446, 233, 36));
  return { buttons, display, rows, archive, shelf, resume, start, rowHeight };
}

/** options: tab, works, days, page, entries (null = archive index), dayLabel,
 * dateline, currentId, statuses {id: label}, resume (actual current work),
 * notes, hover, c. Missing archive editions are displayed but never clickable. */
export function homeButtons(options = {}) {
  return layout(options).buttons.map(({ x, y, w, h, item, archive, ...b }) => ({ ...b, x: x * HOME_SCALE, y: HOME_FRAME.y + y * HOME_SCALE, w: w * HOME_SCALE, h: h * HOME_SCALE }));
}
export function homeHit(x, y, options = {}) {
  return homeButtons(options).find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id || null;
}
function round(ctx, b, r = 13) {
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, r);
}
function fit(ctx, text, width) {
  let value = String(text || '');
  if (ctx.measureText(value).width <= width) return value;
  while (value.length && ctx.measureText(value + '…').width > width) value = value.slice(0, -1);
  return value.trimEnd() + '…';
}
// Fixed-size literary titles. Wrap first, then visibly truncate rather than
// turning unusually long works into tiny type.
export function homeTitleLines(ctx, text, width) {
  const words = String(text || '').trim().split(/\s+/), lines = [];
  let line = '';
  while (words.length) {
    const next = words[0], candidate = line ? `${line} ${next}` : next;
    if (ctx.measureText(candidate).width <= width) { line = candidate; words.shift(); }
    else if (line) { lines.push(line); line = ''; break; }
    else { let n = 1; while (n < next.length && ctx.measureText(next.slice(0, n + 1)).width <= width) n++; lines.push(next.slice(0, n)); words[0] = next.slice(n); break; }
  }
  if (!words.length) { if (line) lines.push(line); return lines; }
  lines.push(fit(ctx, words.join(' '), width));
  return lines;
}

export function paintHome(ctx, options = {}) {
  const o = options, l = layout(o), c = { ink: '#f5f5f2', muted: '#cbd0cc', ...o.c };
  ctx.save();
  ctx.translate(HOME_FRAME.x, HOME_FRAME.y);
  ctx.scale(HOME_SCALE, HOME_SCALE);
  round(ctx, { x: .5, y: .5, w: 719, h: 499 }, 29);
  const surface = ctx.createLinearGradient(0, 0, 220, 500);
  surface.addColorStop(0, 'rgba(62,64,63,.985)');
  surface.addColorStop(.65, 'rgba(35,37,36,.985)');
  ctx.fillStyle = surface; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.20)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.clip();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const font = (size, weight = 400) => { ctx.font = `${weight} ${size}px ${c.ui || UI}`; };
  const text = (value, x, y, color = c.ink) => { ctx.fillStyle = color; ctx.fillText(value, x, y); };
  const label = (b, value, size = 17) => { font(size, 500); ctx.textAlign = 'center'; text(value, b.x + b.w / 2, b.y + b.h / 2 + size * .34); ctx.textAlign = 'left'; };
  for (const b of l.buttons) {
    const selected = b.id === (l.shelf ? 'home-shelf' : 'home-today');
    if (selected || o.hover === b.id) { ctx.fillStyle = selected ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.075)'; round(ctx, b); ctx.fill(); }
    if (b.id === 'home-today') label(b, 'Today', 19);
    else if (b.id === 'home-shelf') label(b, 'Shelf', 19);
    else if (b.id === 'home-settings') label(b, 'Settings', 19);
    else if (b.id === 'home-library') label(b, 'Browse the library →', 16);
    else if (b.id === 'home-calendar') label(b, 'Calendar', 16);
    else if (b.id === 'home-notes') label(b, 'Today’s notes →', 16);
    else if (b.id === 'home-earlier') label(b, 'Earlier →', 15);
    else if (b.id === 'home-later') label(b, '← Later', 15);
    else if (b.id === 'home-back-shelf') label(b, o.library?'← Shelf':'← All days', 16);
  }
  font(14);
  if (o.library) text(o.dateline || 'Library', 40, 96, c.muted);
  else if (l.shelf && !l.archive) { ctx.textAlign = 'right'; text(fit(ctx, o.dayLabel || '', 492), 680, 96, c.muted); ctx.textAlign = 'left'; }
  else text(fit(ctx, l.archive ? 'Your earlier days' : (o.dateline || 'Three pieces for today'), 640), 40, 96, c.muted);
  for (let i = 0; i < l.display.length; i++) {
    const item = l.display[i], y = l.start + i * l.rowHeight;
    if (i) { ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(40, y, 640, 1); }
    if (l.archive) {
      font(23, 500); text(fit(ctx, dayText(item), 576), 40, y + 42);
      font(15); text(fit(ctx, (typeof item === 'object' && item.subtitle) || 'Open this day’s reading', 576), 40, y + 69, c.muted);
      font(22); text('→', 656, y + 54, c.muted);
      continue;
    }
    ctx.font = `24px ${c.serif || 'Literata, Georgia, serif'}`;
    const title = item.title || item.label || KIND[item.kind] || 'Unavailable work';
    const lines = homeTitleLines(ctx, title, 624);
    const titleTop = y + (l.rowHeight < 100 ? 25 : 32);
    lines.forEach((line, n) => text(line, 40, titleTop + n * 27, item.available ? c.ink : c.muted));
    font(15);
    const completed = item.read || /^Read/.test(o.statuses?.[item.id] || '');
    const status = completed ? 'Read ✓' : item.id === o.currentId ? 'Continue →' : (o.statuses?.[item.id] || '');
    const meta = item.available ? [item.author, KIND[item.kind] || item.kind].filter(Boolean).join(' · ') : 'Not in the cabin';
    const metaY = y + l.rowHeight - 13;
    text(fit(ctx, meta, status ? 470 : 600), 40, metaY, c.muted);
    ctx.textAlign = 'right'; font(status.startsWith('Continue') ? 17 : 14, status.startsWith('Continue') ? 500 : 400);
    text(status || (item.available ? '→' : ''), 680, metaY, status.startsWith('Continue') ? c.ink : c.muted); ctx.textAlign = 'left';
  }
  if (!l.display.length) {
    ctx.font = `27px ${c.serif || 'Literata, Georgia, serif'}`;
    text(l.archive ? 'A day to begin' : 'A little room for reading', 40, 230);
    font(16); text(l.archive ? 'Your saved days will appear here.' : 'Choose a work from the library.', 40, 263, c.muted);
  }
  if (l.resume) {
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(40, 378, 640, 1);
    font(18, 500);
    const lines = homeTitleLines(ctx, `Resume ${l.resume.title} →`, 624);
    lines.forEach((line,i)=>text(line,40,400+i*24));
  }
  ctx.restore();
}
