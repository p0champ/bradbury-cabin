import test from 'node:test';
import assert from 'node:assert/strict';
import { EditJournal, EDIT_JOURNAL_KEY } from '../connection/edit-journal.js';
class Storage {
  constructor() { this.values = new Map(); this.writes = 0; this.failAt = Infinity; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (++this.writes === this.failAt) throw Error('fixture storage failure'); this.values.set(key, String(value)); }
  removeItem(key) { if (++this.writes === this.failAt) throw Error('fixture storage failure'); this.values.delete(key); }
}
const state = night => ({ version: 1, start: '2026-10-18', trackingSince: '2026-10-31', days: { '2026-10-31': { poem: true } }, weeks: {}, headset: { controls: { night }, reading: { last: 'the-raven', places: { 'the-raven': { anchor: { block: 2, word: 3, section: 'text' }, page: 1 } } } }, optionalGuide: 'large text'.repeat(1000) });
const values = s => ({ 'cabin-progress': JSON.stringify({ version: 1, start: s.start, trackingSince: s.trackingSince, days: s.days, weeks: s.weeks }), 'cabin-reading': JSON.stringify(s.headset.reading), 'cabin-controls': JSON.stringify(s.headset.controls) });
const setup = () => {
  const storage = new Storage(); for (const [key, value] of Object.entries(values(state(false)))) storage.setItem(key, value);
  const journal = new EditJournal(storage); journal.initialise(state(false)); return { storage, journal };
};
test('an interruption at every adoption write either keeps the original or finishes the complete received state', () => {
  for (let boundary = 1; boundary <= 5; boundary++) {
    const { storage, journal } = setup(); storage.failAt = storage.writes + boundary;
    assert.throws(() => journal.adopt(values(state(true)), state(true)), /fixture storage failure/);
    storage.failAt = Infinity;
    const reopened = new EditJournal(storage), expected = boundary === 1 ? state(false) : state(true);
    for (const [key, value] of Object.entries(values(expected))) assert.equal(storage.getItem(key), value, `boundary ${boundary}: ${key}`);
    assert.deepEqual(reopened.capture(expected).pending, [], 'receiving a remote state must not create a new local edit');
    assert.equal(reopened.record.adoption, null);
  }
});
test('a failed journal write never advances the edit counter or drops pending local edits', () => {
  const { storage, journal } = setup(); const first = journal.capture(state(true));
  storage.failAt = storage.writes + 1;
  assert.throws(() => journal.acknowledge(first.sequence), /fixture storage failure/);
  assert.equal(journal.record.pending.length, 1);
  storage.failAt = Infinity;
  const reopened = new EditJournal(storage); assert.equal(reopened.record.pending.length, 1);
  assert.equal(reopened.acknowledge(first.sequence).pending.length, 0);
});
test('an unrelated edit after an interrupted adoption is preserved for recovery instead of overwritten', () => {
  const { storage, journal } = setup(); storage.failAt = storage.writes + 3;
  assert.throws(() => journal.adopt(values(state(true)), state(true)), /fixture/);
  storage.failAt = Infinity; storage.setItem('cabin-controls', JSON.stringify({ night: false, size: 4 }));
  const before = structuredClone(storage.values);
  assert.throws(() => new EditJournal(storage), /recovery/); assert.deepEqual(storage.values, before);
});
test('corrupt metadata is kept intact; adoption cannot write credentials, and guide text is not duplicated in its baseline', () => {
  const { storage, journal } = setup();
  assert.equal(storage.getItem(EDIT_JOURNAL_KEY).includes('large text'), false);
  assert.throws(() => journal.adopt({ 'cabin-connection': 'invented credential' }, state(false)), /recovery/);
  storage.setItem(EDIT_JOURNAL_KEY, '{damaged'); const before = structuredClone(storage.values);
  assert.throws(() => new EditJournal(storage), /recovery/); assert.deepEqual(storage.values, before);
});

test('well-formed outer metadata cannot restore a damaged inner progress file or erase a good original', () => {
  const { storage, journal } = setup();
  const before = structuredClone(storage.values);
  for (const bad of ['{bad', 'null', '{"version":99}', JSON.stringify({ ...JSON.parse(values(state(true))['cabin-progress']), days: { '2026-02-31': { poem: true } } })]) {
    assert.throws(() => journal.adopt({ ...values(state(true)), 'cabin-progress': bad }, state(true)), /recovery/);
    assert.deepEqual(storage.values, before);
  }
  const record = structuredClone(journal.record); record.adoption = { before: values(state(false)), after: { ...values(state(true)), 'cabin-progress': '{bad' }, observed: {} };
  storage.setItem(EDIT_JOURNAL_KEY, JSON.stringify(record)); const kept = structuredClone(storage.values);
  assert.throws(() => new EditJournal(storage), /recovery/); assert.deepEqual(storage.values, kept);
});

test('the source verdict restores atomically with personal state across every write boundary', () => {
  for (let boundary = 1; boundary <= 6; boundary++) {
    const { storage, journal } = setup();
    storage.setItem('cabin-last-check', JSON.stringify({ accepted: false }));
    storage.failAt = storage.writes + boundary;
    assert.throws(() => journal.adopt({ ...values(state(true)), 'cabin-last-check': JSON.stringify({ accepted: true }) }, state(true)), /fixture/);
    storage.failAt = Infinity; const reopened = new EditJournal(storage);
    assert.equal(JSON.parse(storage.getItem('cabin-last-check')).accepted, boundary !== 1);
    assert.equal(JSON.parse(storage.getItem('cabin-controls')).night, boundary !== 1);
    assert.equal(reopened.record.adoption, null);
  }
});
