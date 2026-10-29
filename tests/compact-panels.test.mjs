import test from 'node:test';
import assert from 'node:assert/strict';
import { compactBounds, compactButtons, compactNotesPages, compactWrap } from '../compact-panels.js';
import { seedProgress } from '../progress.js';
const today = '2026-10-29', progress = seedProgress(today);
const view = { year: 2026, month: 9, selected: today };
test('utility targets stay readable and non-overlapping inside the compact Home frame', () => {
  const bounds = compactBounds(), scale = 2048 / 720;
  for (const page of ['calendar', 'day', 'closing', 'notes']) {
    const rows = compactButtons({ page, view, progress, today, next: { title: 'Next work' }, notesPage: 1, notesCount: 3 });
    for (const r of rows) {
      assert.ok(r.h >= 44 * scale - .001, `${page}/${r.id} height`);
      assert.ok(r.w >= 44 * scale, `${page}/${r.id} width`);
      assert.ok(r.x >= bounds.x && r.y >= bounds.y && r.x + r.w <= bounds.x + bounds.w && r.y + r.h <= bounds.y + bounds.h, `${page}/${r.id} inside frame`);
      for (const other of rows) if (r !== other) assert.equal(r.x < other.x + other.w && r.x + r.w > other.x && r.y < other.y + other.h && r.y + r.h > other.y, false, `${page}/${r.id} overlaps ${other.id}`);
    }
  }
});
test('calendar prevents future and pre-challenge selection, including direct day access', () => {
  const rows = compactButtons({ page: 'calendar', view, progress, today });
  assert.ok(rows.some(r => r.id === `day:${today}`));
  assert.ok(!rows.some(r => r.id === 'day:2026-10-30' || r.id === 'day:2026-10-17'));
  assert.deepEqual(compactButtons({ page: 'day', view: { ...view, selected: '2026-10-30' }, progress, today }).map(r => r.id), ['cal-back']);
});
test('closing preserves mark, next and home semantics without inventing an unavailable next work', () => {
  assert.deepEqual(compactButtons({ page: 'closing' }).map(r => r.id), ['end-back', 'end-mark', 'end-today']);
  assert.ok(compactButtons({ page: 'closing', next: {} }).some(r => r.id === 'end-next'));
});
test('long notes paginate every line and preserve words and grapheme sequences', () => {
  const ctx = { save() {}, restore() {}, measureText: s => ({ width: Array.from(s).length * 10 }) };
  const text = Array.from({ length: 180 }, (_, i) => `word${i}`).join(' ') + ' 👩‍👩‍👧‍👦';
  const pages = compactNotesPages(ctx, text);
  assert.ok(pages.length > 1);
  assert.ok(pages.every(p => p.length <= 10));
  assert.equal(pages.flat().join(' ').replace(/\s+/g, ' ').trim(), text);
  const narrow = compactWrap(ctx, '👩‍👩‍👧‍👦 x', 30);
  assert.equal(narrow[0], '👩‍👩‍👧‍👦');
});

test('oversized imported labels retain a separate full-title route without moving read controls',()=>{
 const normal=compactButtons({page:'day',view,progress,today});
 const long=compactButtons({page:'day',view,progress,today,longPicks:true});
 assert.ok(long.some(r=>r.id==='day-notes'));
 assert.deepEqual(long.filter(r=>r.id.startsWith('tick:')),normal.filter(r=>r.id.startsWith('tick:')));
});
