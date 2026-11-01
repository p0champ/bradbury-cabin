import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotStore } from '../connection/snapshot-store.js';
import { DriveMirror } from '../connection/drive-mirror.js';
import { digest } from '../connection/connection-crypto.js';
const { validProgress } = await import(new URL('../progress.js', import.meta.url).href);
class Storage {
  constructor() { this.data = new Map(); this.alarm = null; }
  async get(key) { return Array.isArray(key) ? new Map(key.filter(k => this.data.has(k)).map(k => [k, structuredClone(this.data.get(k))])) : structuredClone(this.data.get(key)); }
  async put(key, value) { if (typeof key === 'string') this.data.set(key, structuredClone(value)); else for (const [k, v] of Object.entries(key)) this.data.set(k, structuredClone(v)); }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key); }
  async getAlarm() { return this.alarm; } async setAlarm(value) { this.alarm = value; } async deleteAlarm() { this.alarm = null; }
  async transaction(fn) { const tx = new Storage(); tx.data = structuredClone(this.data); tx.alarm = this.alarm; const result = await fn(tx); this.data = tx.data; this.alarm = tx.alarm; return result; }
}
const base = { version: 1, start: '2026-10-18', trackingSince: '2026-10-31', days: { '2026-10-31': { poem: true } }, weeks: {}, headset: { controls: { night: false }, reading: { last: 'the-raven', places: {} } } };
const setup = async ({ existing = true, conditionalReady = true } = {}) => {
  const storage = new Storage(), snapshots = new SnapshotStore(storage, validProgress, { queueMirror: true });
  let remote = existing ? { id: 'P', etag: '"v0"', raw: JSON.stringify(base) } : null, version = 0, writes = 0, reserves = 0, mode = 'valid', delayed = null;
  if (remote) await storage.put('driveMirrorHead', { id: 'P', etag: remote.etag, digest: await digest(remote.raw) });
  let n = 0;
  const commit = async state => { const payload = JSON.stringify(state); const result = await snapshots.commit({ revision: n, baselineRevision: n, device: 'a'.repeat(64), requestId: `fixture-request-${++n}`, payload, state: payload, stamp: '2026-10-31T13:00:00Z', day: '2026-10-31' }); return result; };
  const files = {
    async readProgressVersion() { return structuredClone(remote); },
    async reserveId() { reserves++; return 'reserved-id'; },
    async createProgress(id, raw) { writes++; if (remote) throw Error('ID already exists'); remote = { id, etag: `"v${++version}"`, raw }; if (mode === 'lost') throw Error('fixture lost create response'); },
    async writeConditional(expected, raw) {
      writes++;
      const apply = () => { if (remote?.etag !== expected.etag) throw Object.assign(Error('fixture stale version'), { status: 412 }); remote = { id: expected.id, etag: `"v${++version}"`, raw }; };
      if (mode === 'delayed') { delayed = apply; throw Error('fixture timeout before completion'); }
      if (mode !== 'wrong') apply(); if (mode === 'lost') throw Error('fixture lost write response');
    }
  };
  const mirror = new DriveMirror(storage, snapshots, files, { publish: text => text, conditionalReady });
  return { storage, snapshots, mirror, commit, remote: () => structuredClone(remote), setRemote: value => { remote = value; }, mode: value => { mode = value; }, counts: () => ({ writes, reserves }), late: () => delayed() };
};
test('Drive is current only after the complete uploaded bytes are read back and checked', async () => {
  const fixture = await setup(), changed = structuredClone(base); changed.headset.controls.night = true;
  await fixture.commit(changed); fixture.mode('wrong'); await fixture.mirror.run();
  assert.equal(await fixture.storage.get('mirrorVerified'), undefined); assert.ok(await fixture.storage.getAlarm());
  assert.deepEqual((await fixture.snapshots.read()).value, changed);
  fixture.mode('valid'); await fixture.mirror.run();
  assert.deepEqual(JSON.parse(fixture.remote().raw), changed); assert.equal((await fixture.storage.get('mirrorVerified')).revision, 1);
  assert.equal(await fixture.storage.getAlarm(), null); assert.equal(await fixture.storage.get('mirrorPending'), undefined);
});
test('a lost Google write response is recognized as this connection’s own copy, then the latest private change is mirrored', async () => {
  const fixture = await setup(), first = structuredClone(base); first.days['2026-10-31'].poem = false;
  await fixture.commit(first); fixture.mode('lost'); await fixture.mirror.run();
  assert.equal(await fixture.storage.get('mirrorVerified'), undefined); assert.equal(JSON.parse(fixture.remote().raw).days['2026-10-31'].poem, false);
  const next = structuredClone(first); next.headset.controls.night = true; await fixture.commit(next);
  fixture.mode('valid'); await fixture.mirror.run();
  assert.deepEqual(JSON.parse(fixture.remote().raw), next); assert.equal((await fixture.storage.get('mirrorVerified')).revision, 2);
  assert.deepEqual((await fixture.snapshots.read()).value, next);
});
test('with verified conditional writes, a delayed older upload cannot overwrite the newer complete Google copy', async () => {
  const fixture = await setup(), first = structuredClone(base); first.days['2026-10-31'].poem = false;
  await fixture.commit(first); fixture.mode('delayed'); await fixture.mirror.run();
  const next = structuredClone(first); next.headset.controls.night = true; await fixture.commit(next);
  fixture.mode('valid'); await fixture.mirror.run(); assert.throws(() => fixture.late(), error => error.status === 412);
  assert.deepEqual(JSON.parse(fixture.remote().raw), next); assert.deepEqual((await fixture.snapshots.read()).value, next);
});
test('an independent, missing or damaged Drive copy is left untouched; the private snapshot and retry remain safe', async () => {
  for (const remote of [null, { id: 'P', etag: '"v-external"', raw: JSON.stringify({ ...base, independent: true }) }, { id: 'P', etag: '"v-broken"', raw: '' }]) {
    const fixture = await setup(); await fixture.commit(base); fixture.setRemote(remote); await fixture.mirror.run();
    assert.deepEqual(fixture.remote(), remote); assert.equal(fixture.counts().writes, 0); assert.equal((await fixture.storage.get('mirrorProblem')).code, 'drive_changed');
    assert.deepEqual((await fixture.snapshots.read()).value, base); assert.ok(await fixture.storage.getAlarm());
  }
});
test('lost creation response reuses the reserved identity, and unverified Google conditional support cannot enable writes', async () => {
  const fixture = await setup({ existing: false }); await fixture.commit(base); fixture.mode('lost'); await fixture.mirror.run();
  fixture.mode('valid'); await fixture.mirror.run(); assert.deepEqual(fixture.counts(), { writes: 1, reserves: 1 });
  assert.equal(fixture.remote().id, 'reserved-id'); assert.equal((await fixture.storage.get('mirrorVerified')).revision, 1);
  const held = await setup({ conditionalReady: false }); await held.commit(base); await held.mirror.run(); assert.equal(held.counts().writes, 0); assert.equal(await held.storage.get('mirrorVerified'), undefined);
});
