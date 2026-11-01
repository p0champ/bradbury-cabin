import test from 'node:test';
import assert from 'node:assert/strict';
import { changedFields, mergeManagedState } from '../connection/managed-state.js';
import { mergeProgress } from '../drive.js';

const initial = () => ({ version: 1, start: '2026-10-18', trackingSince: '2026-10-18', savedAt: '2026-10-30T10:00:00Z', days: { '2026-10-29': { poem: true, story: true } }, weeks: {}, headset: { controls: { night: false, size: 1 }, reading: { last: 'ohenry-magi', places: { 'ohenry-magi': { page: 1, anchor: { block: 0, word: 0 } } } } } });
test('unchanged old headset fields never replace another device changes', () => {
  const base = initial(), local = structuredClone(base), remote = structuredClone(base);
  remote.headset.controls.night = true; remote.headset.reading.places['ohenry-magi'].page = 5;
  remote.days['2026-10-29'].essay = true; remote.savedAt = '2026-10-30T11:00:00Z';
  local.headset.controls.size = 2; local.days['2026-10-29'].story = false;
  const result = mergeManagedState(local, remote, base, mergeProgress);
  assert.equal(result.headset.controls.night, true); assert.equal(result.headset.controls.size, 2);
  assert.equal(result.headset.reading.places['ohenry-magi'].page, 5);
  assert.equal(result.days['2026-10-29'].story, false); assert.equal(result.days['2026-10-29'].essay, true);
});
test('independent work anchors and changed settings travel without dropping unknown history', () => {
  const base = initial(), local = structuredClone(base), remote = structuredClone(base);
  local.headset.reading.places['ohenry-magi'].anchor.word = 25;
  remote.headset.reading.places['bacon-truth'] = { page: 3, anchor: { block: 4, word: 2 } };
  remote.days['2026-10-28'] = { essay: true };
  const result = mergeManagedState(local, remote, base, mergeProgress);
  assert.equal(result.headset.reading.places['ohenry-magi'].anchor.word, 25);
  assert.equal(result.headset.reading.places['bacon-truth'].page, 3); assert.equal(result.days['2026-10-28'].essay, true);
});
test('a lost acknowledgement uses the received client baseline rather than reapplying an old edit', () => {
  const received = initial(), retry = structuredClone(received), current = structuredClone(received);
  current.headset.controls.night = true;
  assert.equal(mergeManagedState(retry, current, received, mergeProgress).headset.controls.night, true);
  retry.headset.controls.size = 3;
  const result = mergeManagedState(retry, current, received, mergeProgress);
  assert.deepEqual(result.headset.controls, { night: true, size: 3 });
});
test('first connection cannot replace existing server settings with an old local copy', () => {
  const local = initial(), current = initial();
  current.headset.controls.night = true; current.headset.reading.places['ohenry-magi'].page = 8;
  local.headset.reading.places['bacon-truth'] = { page: 3, anchor: { block: 4, word: 2 } };
  local.completedWorks = { 'blake-sick-rose': '2026-10-30T12:00:00Z' };
  const result = mergeManagedState(local, current, null, mergeProgress);
  assert.equal(result.headset.controls.night, true); assert.equal(result.headset.reading.places['ohenry-magi'].page, 8);
  assert.equal(result.headset.reading.places['bacon-truth'].page, 3); assert.ok(result.completedWorks['blake-sick-rose']);
});
test('older approved thoughts and drafts cannot defeat later deletion tombstones', () => {
  const old = initial(), current = initial();
  old.feedback = { 'blake-sick-rose': { thought: { value: 'Old thought.', at: '2026-10-29T12:00:00Z' } } };
  old.unapprovedThoughtDrafts = { 'ohenry-magi': { value: 'Old draft.', at: '2026-10-29T12:00:00Z', approved: false } };
  current.feedback = { 'blake-sick-rose': { thought: { value: null, at: '2026-10-30T12:00:00Z' } } };
  current.unapprovedThoughtDrafts = { 'ohenry-magi': { value: null, at: '2026-10-30T12:00:00Z', approved: false } };
  const result = mergeManagedState(old, current, initial(), mergeProgress);
  assert.equal(result.feedback['blake-sick-rose'].thought.value, null); assert.equal(result.unapprovedThoughtDrafts['ohenry-magi'].value, null);
});
test('missing fields never erase history and prototype keys cannot modify an object prototype', () => {
  const result = changedFields(JSON.parse('{"__proto__":{"polluted":true},"a":false}'), { a: true, b: 1 }, { a: true, b: 1 });
  assert.deepEqual(result, { a: false, b: 1 }); assert.equal({}.polluted, undefined);
});
