import { navigationSurface, CONTROL } from './theme.js?v=53';
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
function isRead(o, item) {
  return !!item?.read || /^Read(?:\s|$)/.test(o.statuses?.[item?.id] || '');
}
function canResume(o, item) { return !!item && o.resumable?.[item.id] === true; }
function layout(o = {}) {
  const shelf = o.tab === 'shelf', archive = shelf && !o.library && o.entries == null;
  const rows = rowsFor(o);
  const resume = !shelf && !o.library && o.resume && o.resume.id === o.currentId &&
    !rows.some(w => w.id === o.resume.id) && (!rows.length || canResume(o, o.resume) || isRead(o, o.resume)) ? o.resume : null;
  const next = o.library && o.completion?.next && !isRead(o, o.completion.next) ? o.completion.next : null;
  const nextStrip = next && !rows.some(w => w.id === next.id) ? next : null;
  const featured = !shelf && !o.library && !resume ?
    rows.find(w => w.available && w.id === o.currentId && canResume(o, w) && !isRead(o, w)) ||
    rows.find(w => w.available && !isRead(o, w)) : null;
  const buttons = [rect('home-today', 24, 24, 103, 48), rect('home-shelf', 131, 24, 100, 48), rect('home-settings', 565, 24, 131, 48)];
  const start = 108, strip = resume || nextStrip;
  const display = archive ? (o.days || []).slice((o.page || 0) * 3, ((o.page || 0) + 1) * 3) : rows;
  let y = start;
  const placements = display.map(item => {
    const height = strip ? 90 : featured ? item.id === featured.id ? 136 : 97 : 110;
    const position = { item, y, height, featured: item.id === featured?.id };
    const b = rect(archive ? `home-day:${dateOf(item)}` : `home-work:${item.id}`, 24, y, 672, height, { item, archive, featured: position.featured });
    if (archive || item.available) buttons.push(b);
    y += height;
    return position;
  });
  if (resume) buttons.push(rect('home-resume', 24, rows.length ? 378 : 158, 672, rows.length ? 60 : 180, { item: resume }));
  if (nextStrip) buttons.push(rect(`home-work:${nextStrip.id}`, 24, 378, 672, 60, { item: nextStrip, nextStrip: true }));
  if (shelf && !archive && !o.library) buttons.push(rect('home-back-shelf', 24, 76, 136, 30));
  if (shelf || o.library) {
    if (!o.library) buttons.push(rect('home-calendar', 24, 446, 116, 36));
    if ((archive || o.library) && (o.page || 0) > 0) buttons.push(rect('home-later', 151, 446, 100, 36));
    if ((archive || o.library) && ((o.page || 0) + 1) * 3 < (o.library ? o.total : (o.days || []).length)) buttons.push(rect('home-earlier', 260, 446, 110, 36));
  } else if (o.notes) buttons.push(rect('home-notes', 24, 446, 180, 36));
  buttons.push(rect(o.library ? 'home-back-shelf' : 'home-library', 463, 446, 233, 36));
  return { buttons, display, placements, rows, archive, shelf, resume, next, nextStrip, featured, start };
}

/** options: tab, works, days, page, entries (null = archive index), dayLabel,
 * dateline, currentId, statuses {id: label}, resume (actual current work), resumable {id: boolean}, currentPosition (resolved current work only), completion {id, title, saved, next},
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

// The arrival lifts these horizontal bands separately: the header, each
// reading, then everything below. Page pixels, rounded so bands abut exactly.
export function homeArrivalBands(options = {}) {
  const l = layout(options);
  const band = (top, bottom) => {
    const y = Math.round(HOME_FRAME.y + top * HOME_SCALE);
    return { y, h: Math.round(HOME_FRAME.y + bottom * HOME_SCALE) - y };
  };
  const last = l.placements.at(-1), end = last ? last.y + last.height : l.start;
  return { header: band(0, l.start), rows: l.placements.map(p => band(p.y, p.y + p.height)), footer: band(end, 500) };
}

// options.layer: "surface" paints only the glass, "content" only what sits
// on it (transparent elsewhere), so the arrival can reveal one over the other.
export function paintHome(ctx, options = {}) {
  const o = options, l = layout(o), c = { ink: '#f5f5f2', muted: '#cbd0cc', ...o.c };
  ctx.save();
  ctx.translate(HOME_FRAME.x, HOME_FRAME.y);
  ctx.scale(HOME_SCALE, HOME_SCALE);
  if (o.layer === 'content') { ctx.beginPath(); ctx.roundRect(.5, .5, 719, 499, 28); ctx.clip(); }
  else navigationSurface(ctx, 720, 500);
  if (o.layer === 'surface') { ctx.restore(); return; }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const font = (size, weight = 400) => { ctx.font = `${weight} ${size}px ${c.ui || UI}`; };
  const text = (value, x, y, color = c.ink) => { ctx.fillStyle = color; ctx.fillText(value, x, y); };
  const label = (b, value, size = 17) => { font(size, 500); ctx.textAlign = 'center'; text(value, b.x + b.w / 2, b.y + b.h / 2 + size * .34); ctx.textAlign = 'left'; };
  for (const b of l.buttons) {
    const selected = b.id === (l.shelf || o.library ? 'home-shelf' : 'home-today');
    const revealed = o.library && b.item?.id === o.completion?.id;
    const filled = selected || b.featured || revealed || b.nextStrip || b.id === 'home-resume' || o.hover === b.id;
    if (filled) {
      ctx.fillStyle = selected ? CONTROL.selected : o.hover === b.id ? CONTROL.hover : b.featured ? '#414a44' : revealed ? '#3b453f' : CONTROL.quiet;
      round(ctx, { ...b, y: b.y + 1, h: b.h - 2 }, b.featured ? 17 : 13); ctx.fill();
      if (revealed) { ctx.strokeStyle = 'rgba(180,210,180,.32)'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    const tabInk = selected ? CONTROL.selectedInk : c.ink;
    const tab = value => { font(19, 500); ctx.textAlign = 'center'; text(value, b.x + b.w / 2, b.y + b.h / 2 + 19 * .34, tabInk); ctx.textAlign = 'left'; };
    if (b.id === 'home-today') tab('Today');
    else if (b.id === 'home-shelf') tab('Shelf');
    else if (b.id === 'home-settings') label(b, 'Settings', 19);
    else if (b.id === 'home-library') label(b, 'Browse the library →', 16);
    else if (b.id === 'home-calendar') label(b, 'Calendar', 16);
    else if (b.id === 'home-notes') label(b, 'Today’s notes →', 16);
    else if (b.id === 'home-earlier') label(b, o.library ? 'Next →' : 'Earlier →', 15);
    else if (b.id === 'home-later') label(b, o.library ? '← Previous' : '← Later', 15);
    else if (b.id === 'home-back-shelf') label(b, o.library ? '← Shelf' : '← All days', 16);
  }
  font(16);
  if (o.library) {
    const notice = o.completion ? o.completion.saved ? 'Marked as read ✓' : 'Read here · could not save on this headset' : o.dateline || 'Library';
    text(fit(ctx, notice, 510), 40, 96, o.completion?.saved ? '#d6e9d6' : c.muted);
    if (o.total != null) { ctx.textAlign = 'right'; font(14); text(`${o.completion ? 'Library · ' : ''}${(o.page || 0) + 1} of ${Math.max(1, Math.ceil(o.total / 3))}`, 680, 96, c.muted); ctx.textAlign = 'left'; }
  } else if (l.shelf && !l.archive) { ctx.textAlign = 'right'; text(fit(ctx, o.dayLabel || '', 492), 680, 96, c.muted); ctx.textAlign = 'left'; }
  else text(fit(ctx, l.archive ? 'Your earlier days' : (o.dateline || 'Three pieces for today'), 640), 40, 96, c.muted);
  for (const { item, y, height, featured } of l.placements) {
    if (y > l.start && !featured) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(40, y, 640, 1); }
    if (l.archive) {
      font(23, 500); text(fit(ctx, dayText(item), 576), 40, y + 42);
      font(16); text(fit(ctx, (typeof item === 'object' && item.subtitle) || 'Open this day’s reading', 576), 40, y + 69, c.muted);
      font(22); text('→', 656, y + 54, c.muted);
      continue;
    }
    const completed = isRead(o, item), saved = canResume(o, item);
    const next = item.id === l.next?.id;
    if (featured) { font(12, 500); text(saved ? 'Continue reading' : 'A place to begin', 42, y + 20, '#cad6cb'); }
    ctx.font = `24px ${c.serif || 'Literata, Georgia, serif'}`;
    const title = item.title || item.label || KIND[item.kind] || 'Unavailable work';
    const lines = homeTitleLines(ctx, title, 624);
    const titleTop = y + (featured ? 49 : 26);
    lines.forEach((line, n) => text(line, 40, titleTop + n * 27, item.available ? c.ink : c.muted));
    let action = completed ? 'Read ✓ · Read again →' : saved ? 'Continue →' : 'Begin →';
    if (featured && !saved) action = 'Begin reading →';
    if (next && !completed) action = `Next · ${saved ? 'Continue' : 'Begin'} →`;
    if (!item.available) action = '';
    const actionSize = featured ? 16 : 14;
    font(actionSize, featured ? 500 : 400);
    const actionWidth = ctx.measureText(action).width;
    const actionX = 680 - actionWidth;
    const metaY = y + height - (featured ? 21 : 13);
    if (featured) {
      ctx.fillStyle = CONTROL.selected;
      round(ctx, { x: actionX - 13, y: y + height - 43, w: actionWidth + 26, h: 32 }, 16); ctx.fill();
    }
    ctx.textAlign = 'right'; text(action, 680, metaY, featured ? CONTROL.selectedInk : completed ? '#c8dec9' : c.ink); ctx.textAlign = 'left';
    const position = featured && item.id === o.currentId && saved ? o.currentPosition : '';
    const kind = KIND[item.kind] || item.kind;
    font(16);
    const metaWidth = Math.max(40, actionX - (featured ? 30 : 18) - 40);
    let meta = item.available ? [item.author, kind].filter(Boolean).join(' · ') : 'Not in the cabin';
    if (position) {
      // The current resolved place is the continuity promise. Reserve it before
      // shortening a long author; never lose it at the end of a fitted string.
      const suffix = [kind, position].filter(Boolean).join(' · ');
      const authorWidth = metaWidth - ctx.measureText(` · ${suffix}`).width;
      meta = item.author && authorWidth >= ctx.measureText('…').width
        ? `${fit(ctx, item.author, authorWidth)} · ${suffix}`
        : ctx.measureText(suffix).width <= metaWidth ? suffix : position;
    } else meta = fit(ctx, meta, metaWidth);
    text(meta, 40, metaY, c.muted);
  }
  if (!l.display.length && !l.resume) {
    ctx.font = `27px ${c.serif || 'Literata, Georgia, serif'}`;
    text(l.archive ? 'A day to begin' : 'A little room for reading', 40, 230);
    font(16); text(l.archive ? 'Your saved days will appear here.' : 'Choose a work from the library.', 40, 263, c.muted);
  }
  const strip = l.resume || l.nextStrip;
  if (strip) {
    const read = isRead(o, strip), saved = canResume(o, strip);
    const empty = !l.rows.length && !!l.resume;
    const action = read ? 'Read again →' : saved ? 'Continue →' : empty ? 'Begin reading →' : 'Begin →';
    font(16, 500);
    const actionWidth = ctx.measureText(action).width;
    ctx.textAlign = 'right'; text(action, 680, empty ? 313 : 431); ctx.textAlign = 'left';
    if (empty) {
      font(16); text(read ? 'A reading to return to' : saved ? 'Your place is waiting' : 'A place to begin', 40, 190, c.muted);
      ctx.font = `24px ${c.serif || 'Literata, Georgia, serif'}`;
      homeTitleLines(ctx, strip.title, 624).forEach((line, i) => text(line, 40, 234 + i * 27));
      font(16); text(fit(ctx, [strip.author, saved ? o.currentPosition : ''].filter(Boolean).join(' · '), 624), 40, 287, c.muted);
    } else {
      font(18, 500);
      const prefix = l.resume ? read ? 'Read again' : saved ? 'Resume' : 'Begin' : 'Next reading';
      const lines = homeTitleLines(ctx, `${prefix} ${strip.title}`, 624);
      lines.forEach((line, i) => text(line, 40, 393 + i * 18));
      font(13);
      const position = l.resume && saved ? o.currentPosition : '';
      const detail = [position, strip.author].filter(Boolean).join(' · ');
      text(fit(ctx, detail, 624 - actionWidth - 22), 40, 431, c.muted);
    }
  }
  ctx.restore();
}
