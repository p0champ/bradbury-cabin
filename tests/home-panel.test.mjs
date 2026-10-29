import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_FRAME, HOME_SCALE, homeButtons, homeHit, homeTitleLines } from '../home-panel.js';

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
  for (const o of [{ works, notes: true }, { works, currentId: 'old', resume: { id: 'old', title: 'Another day' } },
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
  const buttons = homeButtons({ works, currentId: old.id, resume: old });
  assert.equal(buttons.filter(b => b.id === 'home-resume').length, 1);
  assert.equal(buttons.filter(b => b.id.startsWith('home-work:')).length, 3);
  assert.equal(buttons.find(b => b.id === 'home-work:work0').h / HOME_SCALE, 88);
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
