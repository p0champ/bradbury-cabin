import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_FRAME, HOME_SCALE, homeButtons, homeHit, homeTitleLines, paintHome } from '../home-panel.js';

const works = Array.from({ length: 3 }, (_, i) => ({ id: `work${i}`, title: `Work ${i}`, author: 'A Writer', kind: 'poem' }));
test('compact home painted frame and all hit regions share the portrait layer coordinates', () => {
  assert.equal(HOME_FRAME.w, 2048);
  assert.equal(HOME_FRAME.h / 2560, .5 / .9);
  const buttons = homeButtons({ works });
  for (const b of buttons) {
    assert.ok(b.x >= HOME_FRAME.x && b.x + b.w <= HOME_FRAME.x + HOME_FRAME.w);
    assert.ok(b.y >= HOME_FRAME.y && b.y + b.h <= HOME_FRAME.y + HOME_FRAME.h);
    assert.equal(homeHit(b.x + b.w / 2, b.y + b.h / 2, { works }), b.id);
  }
  assert.equal(homeHit(1024, HOME_FRAME.y - 1, { works }), null);
  assert.equal(homeHit(1024, HOME_FRAME.y + HOME_FRAME.h + 1, { works }), null);
});
test('every clickable home region has its own nonoverlapping area', () => {
  for (const o of [{ works, notes: true }, { works, currentId: 'old', resume: { id: 'old', title: 'Another day' }, resumable: { old: true } },
    { tab: 'shelf', days: ['2026-10-28', '2026-10-27', '2026-10-26', '2026-10-25'], page: 0 },
    { tab: 'shelf', entries: works.map(work => ({ work, kind: work.kind })) }]) {
    const b = homeButtons(o);
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      assert.ok(b[i].x + b[i].w <= b[j].x || b[j].x + b[j].w <= b[i].x || b[i].y + b[i].h <= b[j].y || b[j].y + b[j].h <= b[i].y, `${b[i].id} overlaps ${b[j].id}`);
    }
  }
});
test('resume is truthful, appears once and preserves three distinct work targets', () => {
  const old = { id: 'old', title: 'Earlier reading' };
  assert.ok(!homeButtons({ works, resume: old }).some(b => b.id === 'home-resume'));
  assert.ok(!homeButtons({ works, currentId: works[0].id, resume: works[0] }).some(b => b.id === 'home-resume'));
  assert.ok(!homeButtons({ works, currentId: old.id, resume: old }).some(b => b.id === 'home-resume'));
  const buttons = homeButtons({ works, currentId: old.id, resume: old, resumable: { old: true } });
  assert.equal(buttons.filter(b => b.id === 'home-resume').length, 1);
  assert.equal(buttons.filter(b => b.id.startsWith('home-work:')).length, 3);
  assert.equal(buttons.find(b => b.id === 'home-work:work0').h / HOME_SCALE, 90);
});
test('archive pagination reaches every saved day and cannot open an unavailable edition', () => {
  const days = Array.from({ length: 7 }, (_, i) => `2026-10-${28 - i}`);
  const ids = [];
  for (let page = 0; page < 3; page++) {
    const b = homeButtons({ tab: 'shelf', days, page });
    ids.push(...b.filter(b => b.id.startsWith('home-day:')).map(b => b.id.slice(9)));
    assert.equal(b.some(b => b.id === 'home-earlier'), page < 2);
    assert.equal(b.some(b => b.id === 'home-later'), page > 0);
  }
  assert.deepEqual(ids, days);
  const b = homeButtons({ tab: 'shelf', entries: [{ work: works[0], kind: 'poem' }, { work: null, label: 'Unavailable edition', kind: 'story' }] });
  assert.deepEqual(b.filter(b => b.id.startsWith('home-work:')).map(b => b.id), ['home-work:work0']);
  assert.ok(b.some(b => b.id === 'home-back-shelf'));
});
test('long titles retain fixed type size and wrap to two bounded lines', () => {
  const ctx = { font: '24px serif', measureText: s => ({ width: s.length * 12 }) };
  const long = 'MONGAN LAMENTS THE CHANGE THAT HAS COME UPON HIM AND HIS BELOVED';
  const lines = homeTitleLines(ctx, long, 420);
  assert.equal(lines.length, 2);
  assert.ok(lines.every(s => ctx.measureText(s).width <= 420));
  assert.equal(ctx.font, '24px serif');
  const unbroken = homeTitleLines(ctx, 'A'.repeat(120), 420);
  assert.equal(unbroken.length, 2);
  assert.ok(unbroken.every(s => ctx.measureText(s).width <= 420));
});

function painter() {
  const calls = [];
  const ctx = {
    calls, font: '', fillStyle: '', textAlign: 'left',
    save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, clip() {}, fillRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    measureText(value) { const px = Number.parseFloat(this.font.replace(/^(?:400|500) /, '')) || 16; return { width: String(value).length * px * .55 }; },
    fillText(value, x, y) { this.calls.push({ text: String(value), x, y, font: this.font, colour: this.fillStyle, align: this.textAlign }); },
  };
  return ctx;
}
const logicalWorks = o => homeButtons(o).filter(b => b.id.startsWith('home-work:')).map(b => ({ ...b, x: b.x / HOME_SCALE, y: (b.y - HOME_FRAME.y) / HOME_SCALE, w: b.w / HOME_SCALE, h: b.h / HOME_SCALE }));

test('featured Today row keeps source order and 136/97/97 allocation at each current position', () => {
  for (let i = 0; i < 3; i++) {
    const o = { works, currentId: works[i].id, resumable: { [works[i].id]: true }, currentPosition: 'Text · Page 1' };
    const rows = logicalWorks(o);
    assert.deepEqual(rows.map(b => b.id), works.map(w => `home-work:${w.id}`));
    assert.deepEqual(rows.map(b => Math.round(b.h)), works.map((_, n) => n === i ? 136 : 97));
    assert.equal(Math.round(rows[0].y), 108);
    assert.equal(Math.round(rows.at(-1).y + rows.at(-1).h), 438);
    const ctx = painter(); paintHome(ctx, o);
    assert.equal(ctx.calls.filter(c => c.text === 'Continue reading').length, 1);
    assert.equal(ctx.calls.filter(c => c.text === 'Continue →').length, 1);
    assert.ok(ctx.calls.some(c => c.text.includes('Text · Page 1')));
  }
});
test('current id alone never promises Continue; Read takes precedence over saved places', () => {
  const ctx = painter();
  paintHome(ctx, { works, currentId: works[0].id });
  assert.ok(ctx.calls.some(c => c.text === 'Begin reading →'));
  assert.ok(!ctx.calls.some(c => c.text.includes('Continue')));
  const readCtx = painter();
  paintHome(readCtx, { works, currentId: works[0].id, resumable: { work0: true }, statuses: { work0: 'Read ✓' } });
  assert.ok(readCtx.calls.some(c => c.text === 'Read ✓ · Read again →'));
  assert.ok(!readCtx.calls.some(c => c.text === 'Continue reading'));
  const all = logicalWorks({ works, statuses: Object.fromEntries(works.map(w => [w.id, 'Read ✓'])) });
  assert.deepEqual(all.map(b => b.h), [110, 110, 110]);
});
test('foreign resume reserves 60 units and three equal source-ordered rows without a Today hero', () => {
  const old = { id: 'old', title: 'MONGAN LAMENTS THE CHANGE THAT HAS COME UPON HIM AND HIS BELOVED' };
  const o = { works, currentId: old.id, resume: old, resumable: { old: true } };
  assert.deepEqual(logicalWorks(o).map(b => Math.round(b.h)), [90, 90, 90]);
  const strip = homeButtons(o).find(b => b.id === 'home-resume');
  assert.equal(Math.round(strip.h / HOME_SCALE), 60);
  const ctx = painter(); paintHome(ctx, o);
  assert.ok(!ctx.calls.some(c => c.text === 'A place to begin' || c.text === 'Continue reading'));
  const title = ctx.calls.filter(c => c.font.startsWith('500 18px')).map(c => c.text).join(' ');
  assert.equal(title, `Resume ${old.title}`);
  assert.ok(ctx.calls.filter(c => c.font.startsWith('500 18px')).every(c => c.y <= 424));
});
test('Library preserves catalogue order, reveals Read, and cues a visible saved next work once', () => {
  const o = { library: true, tab: 'shelf', works, page: 1, total: 9, resumable: { work1: true }, statuses: { work0: 'Read ✓' }, completion: { id: 'work0', title: works[0].title, saved: true, next: works[1] } };
  assert.deepEqual(logicalWorks(o).map(b => b.id), works.map(w => `home-work:${w.id}`));
  assert.equal(homeButtons(o).filter(b => b.id === 'home-back-shelf').length, 1, 'Library has one footer Back, clear of its completion notice');
  assert.equal(homeButtons(o).filter(b => b.id === 'home-work:work1').length, 1);
  const ctx = painter(); paintHome(ctx, o);
  assert.ok(ctx.calls.some(c => c.text === 'Marked as read ✓'));
  assert.ok(ctx.calls.some(c => c.text === 'Library · 2 of 3'));
  assert.ok(ctx.calls.some(c => c.text === 'Read ✓ · Read again →'));
  assert.ok(ctx.calls.some(c => c.text === 'Next · Continue →'));
  assert.ok(ctx.calls.some(c => c.text === '← Previous'));
  assert.ok(ctx.calls.some(c => c.text === 'Next →'));
});
test('off-page next uses existing whole-work action once and save failure stays explicit', () => {
  const next = { id: 'offpage', title: 'Next edition', author: 'A Writer', kind: 'essay' };
  const o = { library: true, tab: 'shelf', works, total: 6, resumable: { offpage: true }, completion: { id: 'work0', saved: false, next } };
  const b = homeButtons(o), strip = b.find(b => b.id === 'home-work:offpage');
  assert.equal(b.filter(b => b.id === strip.id).length, 1);
  assert.equal(Math.round(strip.h / HOME_SCALE), 60);
  assert.deepEqual(logicalWorks(o).slice(0, 3).map(b => b.h), [90, 90, 90]);
  const ctx = painter(); paintHome(ctx, o);
  assert.ok(ctx.calls.some(c => c.text.includes('could not save')));
  assert.ok(!ctx.calls.some(c => c.text === 'Marked as read ✓'));
  assert.ok(ctx.calls.some(c => c.text === 'Continue →'));
  const noNext = homeButtons({ ...o, statuses: { offpage: 'Read ✓' } });
  assert.ok(!noNext.some(b => b.id === 'home-work:offpage'));
});
test('two-line titles have reserved room above sixteen-pixel metadata in every row position', () => {
  const title = 'MONGAN LAMENTS THE CHANGE THAT HAS COME UPON HIM AND HIS BELOVED';
  for (let current = 0; current < 3; current++) {
    const longWorks = works.map(w => ({ ...w, title }));
    const o = { works: longWorks, currentId: longWorks[current].id, resumable: { [longWorks[current].id]: true } };
    const ctx = painter(); paintHome(ctx, o);
    for (const row of logicalWorks(o)) {
      const titles = ctx.calls.filter(c => c.font.startsWith('24px') && c.y >= row.y && c.y < row.y + row.h);
      const meta = ctx.calls.find(c => c.font.startsWith('400 16px') && c.x === 40 && c.y > row.y + 60 && c.y < row.y + row.h);
      assert.equal(titles.length, 2);
      assert.ok(meta);
      assert.ok(titles.at(-1).y + 6 < meta.y - 16, `${row.id}: title descender overlaps metadata ascender`);
      assert.ok(meta.y + 5 <= row.y + row.h);
    }
  }
});

test('empty Today retains the current first leaf as a truthful prominent existing action', () => {
  const sampler = { id: 'sampler', title: 'A first leaf', kind: 'sampler' };
  const o = { works: [], currentId: sampler.id, resume: sampler };
  const buttons = homeButtons(o), begin = buttons.find(b => b.id === 'home-resume');
  assert.ok(begin);
  assert.equal(Math.round(begin.h / HOME_SCALE), 180);
  assert.equal(homeHit(begin.x + begin.w / 2, begin.y + begin.h / 2, o), 'home-resume');
  const ctx = painter(); paintHome(ctx, o);
  assert.ok(ctx.calls.some(c => c.text === 'Begin reading →'));
  assert.ok(!ctx.calls.some(c => c.text.includes('Continue')));
  assert.ok(!homeButtons({ ...o, works }).some(b => b.id === 'home-resume'));
});
