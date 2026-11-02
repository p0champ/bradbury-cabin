import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProgress, toggleWeekly, saveProgress, loadProgress, validProgress } from '../progress.js';
import { mergeProgress } from '../drive.js';

test('removing an empty weekly submission survives storage, restore and older-copy merges', () => {
  const today = '2026-10-31', week = '2026-11-01', local = seedProgress(today);
  toggleWeekly(local, today, today); local.savedAt = '2026-10-30T12:00:00Z';
  const older = structuredClone(local);
  toggleWeekly(local, today, today); local.savedAt = '2026-10-31T12:00:00Z';
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveProgress(storage, local), true);
  const restored = loadProgress(storage, today);
  assert.equal(validProgress(restored), true);
  assert.equal(restored.weeks[week]?.submitted, false, 'removal must stay saved even without a title or grade');
  for (const merged of [mergeProgress(restored, older), mergeProgress(older, restored)]) assert.equal(merged.weeks[week]?.submitted, false, 'an older checked box must not return');
});
