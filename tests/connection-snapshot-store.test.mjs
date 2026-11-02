import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotStore } from '../connection/snapshot-store.js';
class MemoryStorage {
  constructor() { this.data = new Map(); this.fail = false; }
  async get(key) { return Array.isArray(key) ? new Map(key.filter(k => this.data.has(k)).map(k => [k, structuredClone(this.data.get(k))])) : structuredClone(this.data.get(key)); }
  async put(key, value) { if (this.fail) throw Error('fixture storage limit'); if (typeof key === 'string') this.data.set(key, structuredClone(value)); else for (const [k, v] of Object.entries(key)) this.data.set(k, structuredClone(v)); }
  async delete(keys) { for (const k of Array.isArray(keys) ? keys : [keys]) this.data.delete(k); }
  async transaction(fn) { const tx = new MemoryStorage(); tx.data = structuredClone(this.data); tx.fail = this.fail; const result = await fn(tx); this.data = tx.data; return result; }
}
const device = 'a'.repeat(64), valid = v => v?.version === 1 && v.days && v.weeks;
const text = n => JSON.stringify({ version: 1, days: {}, weeks: {}, value: n });
const request = (n, extra = {}) => ({ revision: n - 1, baselineRevision: n - 1, device, requestId: `request-${n}`, payload: text(n), state: text(n), stamp: '2026-10-31T12:00:00Z', day: '2026-10-31', ...extra });
const setup = () => { const storage = new MemoryStorage(); return { storage, store: new SnapshotStore(storage, valid) }; };
test('a complete Unicode state spanning multiple storage chunks restores exactly without credentials', async () => {
  const { storage, store } = setup(); await storage.put('credentials', 'fixture-only secret');
  const payload = JSON.stringify({ version: 1, days: {}, weeks: {}, thought: 'Full text æøå '.repeat(60000) });
  const result = await store.commit(request(1, { payload, state: payload }));
  assert.ok(result.root.parts > 1); assert.equal((await store.read()).text, payload);
  assert.equal((await store.deviceBaseline(device)).text, payload); assert.equal((await store.read()).text.includes('fixture-only secret'), false);
});
test('same request is harmless after a lost response; different content under the same identity is refused', async () => {
  const { store } = setup(); const first = await store.commit(request(1));
  assert.equal((await store.commit(request(1))).duplicate, true); assert.equal((await store.read()).root.revision, 1);
  await assert.rejects(store.commit(request(1, { payload: text(9) })), /reused/);
  assert.equal((await store.commit(request(2, { revision: 0 }))).conflict, true);
  assert.equal((await store.commit(request(2, { baselineRevision: 0 }))).staleDevice, true);
  assert.equal((await store.read()).root.revision, first.root.revision);
});
test('storage quota failure leaves the earlier complete backup and receipt unchanged', async () => {
  const { storage, store } = setup(); await store.commit(request(1)); const before = structuredClone(storage.data);
  storage.fail = true; await assert.rejects(store.commit(request(2)), /storage limit/); storage.fail = false;
  assert.deepEqual(storage.data, before); assert.equal((await store.read()).value.value, 1);
  assert.equal((await store.commit(request(2))).root.revision, 2);
});
test('corrupt or missing current data is recovery, never a blank replacement', async () => {
  const { storage, store } = setup(); await store.commit(request(1));
  const root = (await store.read()).root; await storage.put(`${root.id}/0`, new Uint8Array([0]));
  await assert.rejects(store.read(), /recovery/); assert.equal((await storage.get('current')).revision, 1);
  await storage.delete('current'); await assert.rejects(store.read(), /recovery/);
  await assert.rejects(store.commit(request(1, { requestId: 'another-request' })), /recovery/);
  await storage.delete(['history', 'daily']); await assert.rejects(store.read(), /recovery/, 'missing metadata after an earlier successful save must not mean a fresh account');
});
test('retention keeps current, twenty earlier changes, seven backup days and the device baseline only', async () => {
  const { storage, store } = setup(); let n = 0;
  for (let day = 1; day <= 8; day++) await store.commit(request(++n, { day: `2026-10-${String(day).padStart(2, '0')}` }));
  for (let i = 0; i < 35; i++) await store.commit(request(++n, { day: '2026-10-08' }));
  const history = await store.history(); assert.equal(history.current.revision, n); assert.equal(history.previous.length, 20);
  assert.deepEqual(Object.keys(history.daily).sort(), ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
  const roots = new Map([history.current, ...history.previous, ...Object.values(history.daily)].map(r => [r.id, r]));
  for (const root of roots.values()) assert.ok((await store.readSnapshot(root)).value);
  assert.equal([...storage.data.keys()].filter(k => k.startsWith('backup:')).length, roots.size);
  assert.equal([...storage.data.keys()].filter(k => k.startsWith('client:')).length, 1);
});
test('oversized data is refused without trimming or disturbing an existing full copy', async () => {
  const { store } = setup(); await store.commit(request(1));
  const huge = JSON.stringify({ version: 1, days: {}, weeks: {}, value: 'x'.repeat(8_000_001) });
  await assert.rejects(store.commit(request(2, { payload: huge, state: huge })), /nothing was cut/);
  assert.equal((await store.read()).value.value, 1);
});

test('edit sequence and replay identity commit atomically with the complete snapshot', async () => {
  const { storage, store } = setup();
  const first = request(1, { sequence: 1, operations: [{ sequence: 1, path: ['weeks', '2026-11-01', 'submitted'], value: false }] });
  const ack = await store.commit(first); assert.equal(ack.receipt.sequence, 1); assert.equal((await store.deviceState(device)).sequence, 1);
  await assert.rejects(store.commit({ ...first, operations: [{ ...first.operations[0], value: true }] }), /reused/);
  storage.fail = true;
  await assert.rejects(store.commit(request(2, { sequence: 2, operations: [{ sequence: 2, path: ['headset', 'controls', 'night'], value: true }] })), /storage limit/);
  storage.fail = false; assert.equal((await store.deviceState(device)).sequence, 1); assert.equal((await store.read()).root.revision, 1);
});
