import test from 'node:test';
import assert from 'node:assert/strict';
import { collectIntents, observeRemote, acknowledgeIntents, mergeWithIntents } from '../connection/managed-intents.js';
const { mergeProgress } = await import(new URL('../drive.js', import.meta.url).href);
const original = () => ({ version: 1, start: '2026-10-18', trackingSince: '2026-10-31', days: { '2026-10-31': { poem: true, story: false, essay: false } }, weeks: { '2026-11-01': { submitted: true } }, savedAt: '2026-10-31T12:00:00Z', headset: { controls: { night: false, size: 1 }, reading: { last: 'the-raven', places: { 'the-raven': { anchor: { block: 1, word: 14, section: 'text' }, page: 1 } } } } });
const journal = state => ({ sequence: 0, observed: structuredClone(state), pending: [] });
test('only actual edits produce intents; a received change cannot erase a concurrent later correction', () => {
  const start = original(); let a = journal(start);
  const fromB = structuredClone(start); fromB.days['2026-10-31'].story = true;
  a = observeRemote(a, fromB); a = collectIntents(a, fromB); assert.deepEqual(a.pending, []);
  const fromC = structuredClone(fromB); fromC.days['2026-10-31'].story = false;
  const result = mergeWithIntents(fromB, fromC, a.pending, 0, mergeProgress);
  assert.equal(result.state.days['2026-10-31'].story, false);
});
test('independent unticks, settings and reading places survive unrelated newer remote changes', () => {
  const start = original(), local = structuredClone(start), remote = structuredClone(start);
  local.days['2026-10-31'].poem = false; local.weeks['2026-11-01'].submitted = false;
  local.headset.controls.night = true; local.headset.reading.places['the-raven'] = { anchor: { block: 2, word: 99, section: 'text' }, page: 2 };
  remote.days['2026-10-31'].essay = true; remote.headset.controls.size = 3; remote.savedAt = '2026-10-31T14:00:00Z';
  const a = collectIntents(journal(start), local), result = mergeWithIntents(local, remote, a.pending, 0, mergeProgress);
  assert.equal(result.state.days['2026-10-31'].poem, false); assert.equal(result.state.days['2026-10-31'].essay, true);
  assert.equal(result.state.weeks['2026-11-01'].submitted, false); assert.equal(result.state.headset.controls.night, true); assert.equal(result.state.headset.controls.size, 3);
  assert.deepEqual(result.state.headset.reading.places['the-raven'], { anchor: { block: 2, word: 99, section: 'text' }, page: 2 });
});
test('lost response then a new local edit does not reassert the already received untick', () => {
  const start = original(), local = structuredClone(start); local.days['2026-10-31'].poem = false;
  let a = collectIntents(journal(start), local);
  const first = mergeWithIntents(local, start, a.pending, 0, mergeProgress);
  assert.equal(first.sequence, 1); assert.equal(first.state.days['2026-10-31'].poem, false);
  // A did not receive the acknowledgement. B later corrects the same box.
  const fromB = structuredClone(first.state); fromB.days['2026-10-31'].poem = true;
  local.headset.controls.night = true; a = collectIntents(a, local);
  assert.equal(a.pending.length, 2);
  const after = mergeWithIntents(local, fromB, a.pending, first.sequence, mergeProgress);
  assert.equal(after.state.days['2026-10-31'].poem, true); assert.equal(after.state.headset.controls.night, true);
  assert.equal(after.sequence, 2);
  const delayed = mergeWithIntents(local, after.state, [{ sequence: 1, path: ['days', '2026-10-31', 'poem'], value: false }], after.sequence, mergeProgress);
  assert.equal(delayed.state.days['2026-10-31'].poem, true);
});
test('coalescing and an old acknowledgement preserve the latest local action without relying on a clock', () => {
  const start = original(), local = structuredClone(start); let a = journal(start);
  local.headset.controls.night = true; a = collectIntents(a, local);
  local.headset.controls.night = false; a = collectIntents(a, local);
  assert.equal(a.sequence, 2); assert.equal(a.pending.length, 1); assert.equal(a.pending[0].value, false);
  a = acknowledgeIntents(a, 1); assert.equal(a.pending.length, 1);
  a = acknowledgeIntents(a, 2); assert.equal(a.pending.length, 0);
  assert.throws(() => acknowledgeIntents(a, 3), /unreadable/);
});
test('missing fields never delete history and malformed paths, duplicate sequences or foreign data cannot be applied', () => {
  const start = original(); assert.deepEqual(collectIntents(journal(start), { ...start, weeks: {} }).pending, []);
  for (const operations of [
    [{ path: ['__proto__', 'polluted'], sequence: 1, value: true }],
    [{ path: ['headset', 'controls', '__proto__'], sequence: 1, value: {} }],
    [{ path: ['days', '2026-10-31', 'poem'], sequence: 1, value: false }, { path: ['days', '2026-10-31', 'essay'], sequence: 1, value: true }],
    [{ path: ['days', '2026-10-31', 'poem'], sequence: 1, value: false }, { path: ['days', '2026-10-31', 'poem'], sequence: 2, value: true }],
    [{ path: ['feedback', 'invented'], sequence: 1, value: { approved: true } }]
  ]) assert.throws(() => mergeWithIntents(start, start, operations, 0, mergeProgress), /Invalid changes/);
  assert.equal({}.polluted, undefined);
});

test('a newer unrelated local save cannot roll back another device’s accepted swap or source verdict', () => {
  const start = original(); start.days['2026-10-31'].ids = { poem: 'old-poem' }; start.days['2026-10-31'].picks = { poem: 'Earlier poem' }; start.cabinPickerInstructions = { lastCheck: { accepted: false, problems: ['old rejection'] } };
  const local = structuredClone(start), remote = structuredClone(start);
  local.headset.controls.night = true; local.savedAt = '2026-10-31T16:00:00Z';
  remote.days['2026-10-31'].ids.poem = 'new-poem'; remote.days['2026-10-31'].picks.poem = 'New poem'; remote.days['2026-10-31'].poem = false; remote.cabinPickerInstructions.lastCheck = { accepted: true, problems: [] };
  const edits = collectIntents(journal(start), local);
  const result = mergeWithIntents(local, remote, edits.pending, 0, mergeProgress);
  assert.equal(result.state.days['2026-10-31'].ids.poem, 'new-poem'); assert.equal(result.state.days['2026-10-31'].picks.poem, 'New poem');
  assert.equal(result.state.days['2026-10-31'].poem, false); assert.equal(result.state.cabinPickerInstructions.lastCheck.accepted, true);
  assert.equal(result.state.headset.controls.night, true);
});

test('finishing an older piece cannot tick its replacement; a same-request swap establishes its edition before clearing the old tick', () => {
  const start = original(); start.days['2026-10-31'].ids = { poem: 'old-poem' }; start.days['2026-10-31'].picks = { poem: 'Earlier poem' }; start.days['2026-10-31'].poem = false;
  const local = structuredClone(start), remote = structuredClone(start);
  local.days['2026-10-31'].poem = true; local.completedWorks = { 'old-poem': '2026-10-31T15:00:00Z' };
  remote.days['2026-10-31'].ids.poem = 'new-poem'; remote.days['2026-10-31'].picks.poem = 'New poem';
  const edits = collectIntents(journal(start), local), result = mergeWithIntents(local, remote, edits.pending, 0, mergeProgress);
  assert.equal(result.state.days['2026-10-31'].ids.poem, 'new-poem'); assert.equal(result.state.days['2026-10-31'].poem, false); assert.ok(result.state.completedWorks['old-poem']);
  const readOld = structuredClone(start); readOld.days['2026-10-31'].poem = true;
  const swapped = structuredClone(remote); const swap = collectIntents(journal(readOld), swapped);
  const accepted = mergeWithIntents(swapped, readOld, swap.pending, 0, mergeProgress);
  assert.equal(accepted.state.days['2026-10-31'].ids.poem, 'new-poem'); assert.equal(accepted.state.days['2026-10-31'].poem, false);
  const imported = structuredClone(swapped); imported.days['2026-10-31'].poem = true;
  const importedEdits = collectIntents(journal(readOld), imported);
  const checkedImport = mergeWithIntents(imported, remote, importedEdits.pending, 0, mergeProgress);
  assert.equal(checkedImport.state.days['2026-10-31'].poem, true, 'a checked replacement in an approved import belongs to the new exact edition');
});
