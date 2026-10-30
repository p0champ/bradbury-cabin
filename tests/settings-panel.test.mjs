import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_PAGES, settingsBounds, settingsButtons, settingsHit } from '../settings-panel.js';

test('compact Settings has the approved physical proportions on the shared ray plane', () => {
  const b = settingsBounds(), scale = 2048 / 720;
  assert.equal(b.w / scale, 580);
  assert.equal(b.h / scale, 400);
  assert.equal(b.x + b.w / 2, 1024);
  assert.equal(b.y + b.h / 2, 1280);
});

test('every Settings page shares generous, disjoint paint and hit rectangles', () => {
  const bounds = settingsBounds(), scale = 2048 / 720;
  for (const page of SETTINGS_PAGES) {
    const rows = settingsButtons({ page });
    assert.equal(new Set(rows.map(b => b.id)).size, rows.length, page);
    for (const b of rows) {
      assert.ok(b.h >= 44 * scale - .001, `${page}/${b.id} target height`);
      assert.ok(b.w >= 44 * scale, `${page}/${b.id} target width`);
      assert.ok(b.x >= bounds.x && b.y >= bounds.y && b.x + b.w <= bounds.x + bounds.w + .001 && b.y + b.h <= bounds.y + bounds.h + .001, `${page}/${b.id} inside sheet`);
      assert.equal(settingsHit({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, { page }), b.id);
      for (const other of rows) {
        if (b === other) continue;
        const overlap = b.x < other.x + other.w && b.x + b.w > other.x && b.y < other.y + other.h && b.y + b.h > other.y;
        assert.equal(overlap, false, `${page}/${b.id} overlaps ${other.id}`);
      }
    }
    assert.equal(settingsHit({ x: 5, y: 5 }, { page }), null, 'transparent outside has no target');
  }
});

test('explicit choices show current preferences without cycling through hidden states', () => {
  const selected = (page, values) => settingsButtons({ page, values }).filter(b => b.selected).map(b => b.id);
  assert.deepEqual(selected('settings', { night: true, mood: 'modern', size: 2 }), ['settings-appearance:night', 'settings-type:modern', 'settings-size:2']);
  assert.deepEqual(selected('sound', { entrySound: false, ambience: 'fire' }), ['settings-entry:off', 'settings-ambience:fire']);
  assert.deepEqual(selected('volume', { ambienceVolume: .25 }), ['settings-volume:25']);
  assert.deepEqual(selected('wrist', { wristCalendar: false }), ['settings-wrist:off']);
  assert.deepEqual(selected('controls', { headPointer: true, swapped: true, gazeTurn: true }), ['settings-pointer:head', 'settings-next:left', 'settings-look:on']);
});

test('secondary routes retain sound, calendar, wrist and interaction capabilities', () => {
  assert.deepEqual(settingsButtons({ page: 'more' }).map(b => b.id), ['settings-back', 'settings-comfort', 'settings-sound', 'settings-calendar', 'settings-wrist', 'settings-controls']);
  assert.ok(settingsButtons({ page: 'controls' }).some(b => b.id === 'settings-move'));
  assert.ok(settingsButtons({ page: 'controls' }).some(b => b.id === 'settings-practise'));
  assert.deepEqual(settingsButtons({ page: 'unknown' }), []);
});
