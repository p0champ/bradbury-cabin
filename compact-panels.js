import { KINDS, dayStatus, monthGrid, overview, parseKey, weekSunday, ticks } from './progress.js?v=54';
import { navigationSurface, CONTROL } from './theme.js?v=54';
const SCALE = 2048 / 720, Y = (2560 - 500 * SCALE) / 2;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MONTHS = 'January February March April May June July August September October November December'.split(' ');
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KIND = { poem: 'Poem', story: 'Story', essay: 'Essay' };
export const compactBounds = () => ({ x: 0, y: Y, w: 2048, h: 500 * SCALE });
const b = (id, x, y, w, h, label = '') => ({ id, x, y, w, h, label });
const cellRect = i => ({ x: 24 + (i % 7) * 96, y: 170 + Math.floor(i / 7) * 51, w: 90, h: 46 });
function localButtons(o) {
  const { page, view, progress, today, next, notesPage = 0, notesCount = 1 } = o;
  if (page === 'calendar') return [b('cal-menu', 24, 18, 110, 48, 'Back'), b('cal-prev', 24, 86, 104, 48, '‹ Earlier'), b('cal-next', 592, 86, 104, 48, 'Later ›'), ...monthGrid(view.year, view.month).flatMap((cell, i) => cell && !['future', 'before'].includes(dayStatus(progress, cell.key, today)) ? [{ id: `day:${cell.key}`, label: String(cell.day), ...cellRect(i) }] : [])];
  if (page === 'day') {
    const editable = !['future', 'before'].includes(dayStatus(progress, view.selected, today));
    return [b('cal-back', 24, 18, 120, 48, '‹ Calendar'), ...(o.longPicks ? [b('day-notes',548,18,148,48,'Full titles')] : []), ...(editable ? KINDS.map((kind, i) => b(`tick:${kind}`, 24, 126 + i * 90, 672, 82, KIND[kind])) : []), ...(editable ? [b('weekly', 24, 405, 672, 68, 'Weekly written story')] : [])];
  }
  if (page === 'closing') return [b('end-back', 24, 18, 150, 48, '‹ Back to text'), b('end-mark', 24, 300, 672, 72, o.read ? 'Read ✓ · Open Library' : 'Mark as read')];
  return [b('notes-home', 24, 18, 110, 48, o.backLabel ? `‹ ${o.backLabel}` : 'Back'), ...(notesPage > 0 ? [b('notes-prev', 24, 428, 160, 48, '‹ Previous')] : []), ...(notesPage + 1 < notesCount ? [b('notes-next', 536, 428, 160, 48, 'Next ›')] : [])];
}
export function compactButtons(options) {
  return localButtons(options).map(r => ({ ...r, x: r.x * SCALE, y: Y + r.y * SCALE, w: r.w * SCALE, h: r.h * SCALE }));
}
function rounded(ctx, r, radius = 12) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  else ctx.rect(r.x, r.y, r.w, r.h);
}
// Full notes are wrapped and paginated, never shortened with ellipses. This
// helper also lets the app derive the exact next/previous button availability.
export function compactWrap(ctx, text, width = 656) {
  const lines = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let line = '';
    const graphemes = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(paragraph)].map(p => p.segment) : Array.from(paragraph);
    for (const part of graphemes) {
      while (line && ctx.measureText(line + part).width > width) {
        const at = line.lastIndexOf(' ');
        if (at > 0) { lines.push(line.slice(0, at)); line = line.slice(at + 1); }
        else { lines.push(line); line = ''; }
      }
      line += part;
    }
    lines.push(line);
  }
  return lines;
}
export function compactNotesPages(ctx, notes) {
  ctx.save(); ctx.font = `400 19px ${FONT}`;
  const text = Array.isArray(notes) ? notes.join('\n\n') : String(notes ?? '');
  const lines = compactWrap(ctx, text);
  ctx.restore();
  const pages = [];
  for (let i = 0; i < lines.length; i += 10) pages.push(lines.slice(i, i + 10));
  return pages.length ? pages : [[]];
}
function text(ctx, str, x, y, size = 19, colour = '#f5f5f2', weight = 400, align = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = colour; ctx.textAlign = align; ctx.fillText(str, x, y);
}
function button(ctx, r, hover, { selected = false, label = r.label } = {}) {
  ctx.fillStyle = hover === r.id ? CONTROL.hover : selected ? '#515b55' : CONTROL.quiet;
  rounded(ctx, r); ctx.fill();
  text(ctx, label, r.x + 18, r.y + r.h / 2, 19);
}
function dayTitle(key) {
  const d = parseKey(key);
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
// Only compact summaries may be shortened. Full source titles and notes stay
// available in the reader; fixed summary slots must not overrun the controls.
function summaryLines(ctx, value, width, limit) {
  const lines = compactWrap(ctx, value, width);
  if (lines.length <= limit) return lines;
  const visible = lines.slice(0, limit);
  let tail = visible[limit - 1];
  while (tail && ctx.measureText(tail + '…').width > width) tail = Array.from(tail).slice(0, -1).join('');
  visible[limit - 1] = tail.trimEnd() + '…';
  return visible;
}
export function paintCompact(ctx, options) {
  const o = { ...options };
  const notePages = compactNotesPages(ctx, o.notes);
  if (!['calendar', 'day', 'closing'].includes(o.page)) o.notesCount = notePages.length;
  const rows = localButtons(o), byId = id => rows.find(r => r.id === id);
  ctx.save(); ctx.translate(0, Y); ctx.scale(SCALE, SCALE); ctx.textBaseline = 'middle';
  navigationSurface(ctx, 720, 500);
  if (o.page === 'calendar') {
    const { view, progress, today } = o, facts = overview(progress, today);
    button(ctx, byId('cal-menu'), o.hover);
    text(ctx, 'Calendar', 360, 42, 24, '#f5f5f2', 550, 'center');
    text(ctx, `${facts.streak} day streak · ${facts.complete} complete · ${facts.partial} in progress · ${facts.missed} missed`, 360, 72, 17, '#cbd0cd', 400, 'center');
    button(ctx, byId('cal-prev'), o.hover); button(ctx, byId('cal-next'), o.hover);
    text(ctx, `${MONTHS[view.month]} ${view.year}`, 360, 110, 21, '#f5f5f2', 500, 'center');
    DAYS.forEach((day, i) => text(ctx, day, 69 + i * 96, 151, 17, '#cbd0cd', 400, 'center'));
    monthGrid(view.year, view.month).forEach((cell, i) => {
      if (!cell) return;
      const r = cellRect(i), status = dayStatus(progress, cell.key, today), hot = o.hover === `day:${cell.key}`;
      const disabled = ['future', 'before'].includes(status);
      ctx.fillStyle = hot ? '#5a625d' : status === 'complete' ? '#bfcfc3' : disabled ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)';
      rounded(ctx, r, 9); ctx.fill();
      if (cell.key === today || status === 'missed' || status === 'unrecorded') {
        ctx.strokeStyle = cell.key === today ? '#f5f5f2' : status === 'missed' ? '#efbcac' : '#a9b2ac';
        ctx.lineWidth = 1.5; ctx.setLineDash(status === 'unrecorded' ? [3, 3] : []); rounded(ctx, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, 8); ctx.stroke(); ctx.setLineDash([]);
      }
      const ink = status === 'complete' ? '#232924' : disabled ? '#a0a6a1' : '#f5f5f2';
      text(ctx, String(cell.day), r.x + 14, r.y + 18, 19, ink, 500);
      if (!disabled && status !== 'unrecorded') KINDS.forEach((kind, n) => {
        ctx.beginPath(); ctx.arc(r.x + 16 + n * 12, r.y + 35, 2.5, 0, Math.PI * 2);
        if (progress.days[cell.key]?.[kind]) { ctx.fillStyle = ink; ctx.fill(); }
        else { ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke(); }
      });
      if (parseKey(cell.key).getDay() === 0 && status !== 'before') text(ctx, progress.weeks[cell.key]?.submitted ? '✓' : '✎', r.x + 72, r.y + 24, 17, ink, 400, 'center');
    });
    text(ctx, o.notice || (facts.weekSubmitted ? 'Weekly story handed in ✓' : `Weekly story due Sunday${facts.daysToSunday === 0 ? ' · today' : ` · in ${facts.daysToSunday} days`}`), 24, 488, 17, o.notice ? '#efbcac' : '#cbd0cd');
  } else if (o.page === 'day') {
    const key = o.view.selected, status = dayStatus(o.progress, key, o.today), day = o.progress.days[key] || {};
    button(ctx, byId('cal-back'), o.hover);
    if(byId('day-notes'))button(ctx,byId('day-notes'),o.hover);
    text(ctx, dayTitle(key), 360, 42, 24, '#f5f5f2', 550, 'center');
    text(ctx, ['future', 'before'].includes(status) ? 'This date is read-only.' : `${ticks(o.progress, key)} of 3 read · Tick each piece after reading.`, 24, 96, 17, '#cbd0cd');
    for (const r of rows.filter(r => r.id.startsWith('tick:'))) {
      const kind = r.id.slice(5), done = !!day[kind];
      button(ctx, r, o.hover, { selected: done, label: '' });
      text(ctx, `${done ? '✓' : '○'}  ${KIND[kind]}`, r.x + 18, r.y + 21, 19, '#f5f5f2', 500);
      text(ctx, done ? 'Read' : 'Not yet', r.x + r.w - 18, r.y + 21, 17, '#cbd0cd', 400, 'right');
      ctx.font = `400 17px ${FONT}`;
      const lines=compactWrap(ctx, day.picks?.[kind] || '', 630);
      lines.slice(0,2).forEach((line,n)=>{
        if(n===1&&lines.length>2){while(line&&ctx.measureText(line+'…').width>630)line=line.slice(0,-1);line+='…';}
        text(ctx,line,r.x+18,r.y+44+n*18,17,'#cbd0cd');
      });
    }
    const weekly = byId('weekly');
    if (weekly) {
      const sunday = weekSunday(key), submitted = !!o.progress.weeks[sunday]?.submitted;
      button(ctx, weekly, o.hover, { selected: submitted, label: '' });
      text(ctx, 'Weekly written story', 42, 426, 19, '#f5f5f2', 500);
      text(ctx, `Week ending ${dayTitle(sunday)} · ${submitted ? 'Handed in ✓' : sunday < o.progress.trackingSince ? 'Not recorded' : 'Not yet'}`, 42, 451, 17, '#cbd0cd');
    }
  } else if (o.page === 'closing') {
    button(ctx, byId('end-back'), o.hover);
    text(ctx, o.read ? 'Already read' : 'Finished reading?', 24, 92, 22, '#f5f5f2', 500);
    ctx.font = '400 28px Georgia, serif';
    const title = summaryLines(ctx, o.work?.title || '', 656, 3);
    for (const [i, line] of title.entries()) { ctx.font = '400 28px Georgia, serif'; ctx.fillStyle = '#f5f5f2'; ctx.textAlign = 'left'; ctx.fillText(line, 24, 128 + i * 29); }
    ctx.font = `400 17px ${FONT}`;
    const metadata = summaryLines(ctx, [o.work?.author, o.work?.year].filter(Boolean).join(' · '), 656, 1)[0];
    text(ctx, metadata, 24, 215, 17, '#cbd0cd');
    text(ctx, o.read ? 'NEXT opens your Library.' : 'Pinch NEXT again to mark as read.', 24, 248, 20, '#f5f5f2', 500);
    text(ctx, 'BACK returns to the last page.', 24, 277, 17, '#cbd0cd');
    const mark = byId('end-mark');
    ctx.fillStyle = o.hover === mark.id ? '#ffffff' : CONTROL.selected;
    rounded(ctx, mark); ctx.fill();
    text(ctx, mark.label, mark.x + 24, mark.y + mark.h / 2, 20, CONTROL.selectedInk, 500);
    if (o.allRead && o.thread && !o.next) {
      ctx.font = `400 17px ${FONT}`;
      summaryLines(ctx, o.thread, 656, 3).forEach((line, i) => text(ctx, line, 24, 410 + i * 23, 17, '#dce2dc'));
    }
  } else {
    button(ctx, byId('notes-home'), o.hover);
    text(ctx, o.title || 'Reading notes', 360, 42, 24, '#f5f5f2', 550, 'center');
    const page = Math.max(0, Math.min(o.notesPage || 0, notePages.length - 1));
    notePages[page].forEach((line, i) => text(ctx, line, 32, 112 + i * 29, 19));
    rows.filter(r => r.id !== 'notes-home').forEach(r => button(ctx, r, o.hover));
    text(ctx, `${page + 1} / ${notePages.length}`, 360, 452, 17, '#cbd0cd', 400, 'center');
  }
  ctx.restore();
}
