import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { BackupCoordinator } from '../connection/backup-coordinator.js';
import { collectIntents } from '../connection/managed-intents.js';
const repo = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const { mergeProgress } = await import(pathToFileURL(repo + '/drive.js').href);
const { validProgress, berlinDateKey } = await import(pathToFileURL(repo + '/progress.js').href);
class Storage {
  constructor() { this.data = new Map(); this.alarm = null; this.failAlarm = false; this.failWrite = false; }
  async get(key) { return Array.isArray(key) ? new Map(key.filter(k => this.data.has(k)).map(k => [k, structuredClone(this.data.get(k))])) : structuredClone(this.data.get(key)); }
  async put(key, value) { if (this.failWrite) throw Error('fixture quota reached'); if (typeof key === 'string') this.data.set(key, structuredClone(value)); else for (const [k, v] of Object.entries(key)) this.data.set(k, structuredClone(v)); }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key); }
  async getAlarm() { return this.alarm; }
  async setAlarm(value) { if (this.failAlarm) throw Error('fixture alarm failure'); this.alarm = value; }
  async transaction(fn) { const tx = new Storage(); tx.data = structuredClone(this.data); tx.alarm = this.alarm; tx.failAlarm = this.failAlarm; tx.failWrite = this.failWrite; const value = await fn(tx); this.data = tx.data; this.alarm = tx.alarm; return value; }
}
const a = 'a'.repeat(64), b = 'b'.repeat(64);
const original = () => ({ version: 1, start: '2026-10-18', trackingSince: '2026-10-31', days: { '2026-10-31': { poem: true, story: false, essay: false } }, weeks: { '2026-11-01': { submitted: true } }, savedAt: '2026-10-31T12:00:00Z', headset: { controls: { night: false, size: 1 }, reading: { last: 'the-raven', places: {} } } });
const setup = (readInitial = async () => JSON.stringify(original())) => {
  const storage = new Storage(), coordinator = new BackupCoordinator(storage, { validate: validProgress, mergeProgress, readInitial, now: () => new Date('2026-10-31T13:00:00Z'), dayKey: berlinDateKey });
  return { storage, coordinator };
};
let count = 0;
const send = async (coordinator, device, state, operations = [], sequence = 0) => {
  const current = await coordinator.state(device);
  const request = { requestId: `fixture-request-${++count}`, payload: JSON.stringify(state), revision: current.revision, baselineRevision: current.baselineRevision, operations, sequence };
  return { request, reply: await coordinator.save(device, request) };
};
test('first connection imports complete Drive state, while empty, corrupt or unavailable existing files never mean a blank replacement', async () => {
  const { coordinator } = setup(); const restored = await coordinator.state(a);
  assert.deepEqual(restored.state, original()); assert.equal(restored.revision, 1); assert.equal(restored.driveCurrent, false);
  for (const read of [async () => '', async () => '{bad', async () => 'null', async () => { throw Error('fixture outage'); }]) {
    const { storage, coordinator: refused } = setup(read); await assert.rejects(refused.state(a)); assert.equal(storage.data.has('current'), false);
    await assert.rejects(send(refused, a, original())); assert.equal(storage.data.has('current'), false);
  }
  const fresh = setup(async () => null); assert.equal((await fresh.coordinator.state(a)).state, null);
  assert.equal((await send(fresh.coordinator, a, original())).reply.state.days['2026-10-31'].poem, true);
});
test('lost acknowledgement plus another device and another local edit keeps the later correction', async () => {
  const { coordinator } = setup(), initial = original();
  await send(coordinator, a, initial); await send(coordinator, b, initial);
  let journal = { sequence: 0, pending: [], observed: initial };
  const local = structuredClone(initial); local.days['2026-10-31'].poem = false;
  journal = collectIntents(journal, local);
  const accepted = await send(coordinator, a, local, journal.pending, journal.sequence);
  assert.equal(accepted.reply.receipt.sequence, 1);
  const other = structuredClone(accepted.reply.state); other.days['2026-10-31'].poem = true;
  await send(coordinator, b, other, [{ path: ['days', '2026-10-31', 'poem'], value: true, sequence: 1 }], 1);
  // The first response was lost. A still carries the original pending untick.
  local.headset.controls.night = true; journal = collectIntents(journal, local);
  const next = await send(coordinator, a, local, journal.pending, journal.sequence);
  assert.equal(next.reply.state.days['2026-10-31'].poem, true); assert.equal(next.reply.state.headset.controls.night, true);
  const replay = await coordinator.save(a, accepted.request);
  assert.equal(replay.state.days['2026-10-31'].poem, true); assert.equal(replay.state.headset.controls.night, true);
  assert.equal(replay.receipt.sequence, 1);
});

test('the first device keeps newer offline calendar corrections while claiming its existing settings', async () => {
  const { coordinator } = setup(), local = original();
  local.days['2026-10-31'].poem = false; local.savedAt = '2026-10-31T15:00:00Z'; local.headset.controls.night = true;
  const accepted = await send(coordinator, a, local, [{ path: ['headset', 'controls', 'night'], value: true, sequence: 1 }], 1);
  assert.equal(accepted.reply.state.days['2026-10-31'].poem, false); assert.equal(accepted.reply.state.headset.controls.night, true);
  assert.equal(accepted.reply.state.headset.controls.size, 1);
});
test('snapshot, edit acknowledgement and retry alarm survive together or all roll back', async () => {
  const { storage, coordinator } = setup(); await coordinator.state(a);
  assert.equal((await storage.get('mirrorPending')).revision, 1); assert.ok(await storage.getAlarm());
  // A real alarm transaction is also exercised by native-store.test.mjs.
  storage.alarm = null; storage.failAlarm = true;
  const before = structuredClone(storage.data);
  await assert.rejects(send(coordinator, a, original()), /alarm failure/);
  assert.deepEqual(storage.data, before); assert.equal(storage.alarm, null);
  storage.failAlarm = false; const accepted = await send(coordinator, a, original());
  assert.equal((await storage.get('mirrorPending')).revision, accepted.reply.revision); assert.ok(storage.alarm);
  storage.failWrite = true; await assert.rejects(send(coordinator, a, original()), /quota/); storage.failWrite = false;
  assert.equal((await coordinator.state(a)).revision, accepted.reply.revision);
});
test('corruption and stale revisions refuse a write while preserving the last backup and independent private secrets', async () => {
  const { storage, coordinator } = setup(); await storage.put('google', { protectedRefresh: 'fixture-encrypted' });
  const first = await send(coordinator, a, original());
  const stale = { ...first.request, requestId: 'new-stale-request' };
  await assert.rejects(coordinator.save(a, stale), error => error.code === 'conflict');
  const root = await storage.get('current'); await storage.put(root.id + '/0', new Uint8Array([0]));
  const before = structuredClone(storage.data); await assert.rejects(coordinator.save(a, first.request), /recovery/);
  assert.deepEqual(storage.data, before); assert.equal(JSON.stringify(first.reply.state).includes('fixture-encrypted'), false);
});
