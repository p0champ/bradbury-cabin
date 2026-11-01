import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { ManagedLink, finishConnectionReturn, CONNECTION_KEY, CONNECTION_DEVICE_KEY, CONNECTION_PAIR_KEY } from '../managed-drive.js';
import { EditJournal } from '../connection/edit-journal.js';
import { BackupCoordinator } from '../connection/backup-coordinator.js';
import { mergeProgress } from '../drive.js';
import { validProgress, berlinDateKey } from '../progress.js';

class LocalStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
class PrivateStorage {
  constructor() { this.data = new Map(); this.alarm = null; }
  async get(key) { return Array.isArray(key) ? new Map(key.filter(k => this.data.has(k)).map(k => [k, structuredClone(this.data.get(k))])) : structuredClone(this.data.get(key)); }
  async put(key, value) { if (typeof key === 'string') this.data.set(key, structuredClone(value)); else for (const [k, v] of Object.entries(key)) this.data.set(k, structuredClone(v)); }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key); }
  async getAlarm() { return this.alarm; } async setAlarm(value) { this.alarm = value; }
  async transaction(fn) { const tx = new PrivateStorage(); tx.data = structuredClone(this.data); tx.alarm = this.alarm; const result = await fn(tx); this.data = tx.data; this.alarm = tx.alarm; return result; }
}
const token = 't'.repeat(43), device = 'a'.repeat(64);
test('interrupted JSON bodies arm the calm fallback without exposing stream errors or revoking the private connection', async () => {
  for (const reason of [new TypeError('fixture private stream detail'), new DOMException('fixture private stream detail', 'AbortError')]) {
    const storage = new LocalStorage(); storage.setItem(CONNECTION_KEY, token);
    const client = new ManagedLink({ url: 'https://connection.example/', storage, fetchFn: async () => {
      let sent = false;
      return new Response(new ReadableStream({ pull(controller) {
        if (!sent) { sent = true; controller.enqueue(new TextEncoder().encode('{"state":')); }
        else controller.error(reason);
      } }), { headers: { 'Content-Type': 'application/json' } });
    } });
    await assert.rejects(client.read('progress.json'), failure => failure.code === 'unavailable' && failure.message.includes('kept') && !failure.message.includes('private stream detail'));
    assert.equal(client.unavailable, true); assert.equal(client.connected, true);
    assert.equal(storage.getItem(CONNECTION_KEY), token);
  }
});
const original = () => ({ version: 1, start: '2026-10-18', trackingSince: '2026-10-31', days: { '2026-10-31': { poem: true, story: false, essay: false } }, weeks: {}, savedAt: '2026-10-31T12:00:00Z', headset: { controls: { night: false }, reading: { last: 'the-raven', places: {} } } });
const fixture = (initial = original(), remote = original(), ownership = { controls: true, reading: true }) => {
  const storage = new LocalStorage(); storage.setItem(CONNECTION_KEY, token); storage.setItem('cabin-progress', JSON.stringify(initial));
  const journal = new EditJournal(storage), backend = new BackupCoordinator(new PrivateStorage(), { validate: validProgress, mergeProgress, readInitial: async () => JSON.stringify(remote), now: () => new Date('2026-10-31T14:00:00Z'), dayKey: berlinDateKey });
  let loseReply = false, replacement = null; const requests = [];
  const fetchFn = async (url, init) => {
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); assert.equal(init.headers.Authorization, 'Bearer ' + token);
    if (replacement) return typeof replacement === 'function' ? replacement() : replacement;
    const route = new URL(url).pathname;
    if (route === '/state') return Response.json(await backend.state(device));
    if (route === '/backup') {
      const body = JSON.parse(init.body); requests.push(structuredClone(body));
      try {
        const result = await backend.save(device, { ...body, payload: JSON.stringify(body.state) });
        if (loseReply) { loseReply = false; throw Object.assign(Error('fixture lost reply'), { lost: true }); }
        return Response.json(result);
      } catch (error) { if (error.lost) throw error; return Response.json({ code: error.code || 'unavailable', message: error.message }, { status: error.status || 503 }); }
    }
    throw Error('Unexpected fixture endpoint');
  };
  const client = new ManagedLink({ url: 'https://connection.example/', storage, journal, fetchFn });
  const prepare = value => JSON.parse(client.prepareBackupText(JSON.stringify(value)));
  client.initialise(prepare(initial), ownership);
  const adopt = value => {
    const check = value.cabinPickerInstructions?.lastCheck ?? client.lastCheck, complete = JSON.parse(client.prepareBackupText(JSON.stringify(value), check)), { headset, ...progress } = complete;
    journal.adopt({ 'cabin-progress': JSON.stringify(progress), 'cabin-reading': JSON.stringify(headset.reading), 'cabin-controls': JSON.stringify(headset.controls), 'cabin-last-check': JSON.stringify(check) }, complete);
    client.lastCheck = check; return complete;
  };
  const pull = async local => { const raw = await client.read('progress.json'); return adopt(client.mergeForLocal(prepare(local), raw === null ? null : JSON.parse(raw))); };
  const save = async (local, id = crypto.randomUUID()) => { const payload = client.prepareBackupText(JSON.stringify(local)); const reply = await client.writeProgress(payload, { requestId: id }); const next = adopt(client.mergeForLocal(prepare(local), reply.state)); client.acknowledge(reply); return { reply, next, payload, id }; };
  return { storage, journal, backend, client, prepare, pull, save, requests, loseNext: () => { loseReply = true; }, response: value => { replacement = value; } };
};

test('client: existing settings stay owned while a fresh browser receives the private restoration copy', async () => {
  const remote = original(); remote.headset.controls.night = true;
  for (const owns of [true, false]) {
    const f = fixture(original(), remote, { controls: owns, reading: false }), local = await f.pull(original());
    assert.equal(local.headset.controls.night, !owns);
    const saved = await f.save(local); assert.equal(saved.reply.state.headset.controls.night, !owns); assert.equal(f.journal.record.pending.length, 0);
  }
});

test('client: an unchanged queued identity retries its exact edits after acknowledgement', async () => {
  const f = fixture(); let local = await f.pull(original());
  local.days['2026-10-31'].poem = false; local.savedAt = '2026-10-31T15:00:00Z';
  local = await f.pull(local); const first = await f.save(local);
  await f.client.read('progress.json'); const again = await f.client.writeProgress(first.payload, { requestId: first.id });
  assert.equal(again.receipt.id, first.id); assert.equal(again.receipt.revision, first.reply.receipt.revision);
  assert.deepEqual(f.requests.at(-1).operations, f.requests[0].operations); assert.equal(again.state.days['2026-10-31'].poem, false);
});

test('client: a lost response and a later independent correction survive a new local settings edit', async () => {
  const f = fixture(); let local = await f.pull(original());
  local.days['2026-10-31'].poem = false; local.savedAt = '2026-10-31T15:00:00Z'; local = await f.pull(local);
  f.loseNext(); await assert.rejects(f.save(local)); assert.equal(f.client.connected, true); assert.ok(f.journal.record.pending.length);
  const otherDevice = 'b'.repeat(64), other = await f.backend.state(otherDevice), corrected = structuredClone(other.state); corrected.days['2026-10-31'].poem = true;
  await f.backend.save(otherDevice, { requestId: 'other-device-correction', payload: JSON.stringify(corrected), revision: other.revision, baselineRevision: other.baselineRevision, sequence: 1, operations: [{ path: ['days', '2026-10-31', 'poem'], value: true, sequence: 1 }] });
  local.headset.controls.night = true; local = await f.pull(local); assert.equal(local.days['2026-10-31'].poem, true);
  const next = await f.save(local); assert.equal(next.reply.state.days['2026-10-31'].poem, true); assert.equal(next.reply.state.headset.controls.night, true);
  assert.equal(f.journal.record.pending.length, 0);
});

test('client: HTML, limits, malformed replies and timeouts preserve connection and local progress', async () => {
  const responses = [
    () => new Response('<html>quota</html>', { status: 429 }),
    () => new Response('<html>proxy error</html>'),
    () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } }),
    () => Response.json({ code: 'unavailable' }, { status: 503 }),
    () => { throw Error('fixture timeout'); },
    () => Response.json({ code: 'proxy_login' }, { status: 401 }),
  ];
  for (const response of responses) {
    const f = fixture(), before = f.storage.getItem('cabin-progress'); f.response(response);
    await assert.rejects(f.client.read('progress.json'));
    assert.equal(f.client.connected, true); assert.equal(f.storage.getItem(CONNECTION_KEY), token); assert.equal(f.storage.getItem('cabin-progress'), before); assert.equal(f.requests.length, 0);
  }
  const revoked = fixture(); revoked.response(() => Response.json({ code: 'connection', message: 'Connect again; your readings are kept' }, { status: 401 }));
  await assert.rejects(revoked.client.read('progress.json')); assert.equal(revoked.client.connected, false); assert.equal(revoked.storage.getItem('cabin-progress'), JSON.stringify(original()));
});

test('client: a damaged private reply cannot replace its prior checked state or acknowledge local edits', async () => {
  const f = fixture(); await f.client.read('progress.json'); const good = f.client.status, before = f.storage.getItem('cabin-progress');
  f.response(() => Response.json({ ...good, state: null, revision: good.revision + 1 }));
  await assert.rejects(f.client.read('progress.json'), /recovery/); assert.equal(f.client.status, good); assert.equal(f.storage.getItem('cabin-progress'), before);
});

test('pair return: the early script removes the one-use code and the restricted connection never enters a URL or progress copy', async () => {
  const script = await readFile(new URL('../pair-return.js', import.meta.url), 'utf8'), session = new LocalStorage(), storage = new LocalStorage(), code = 'c'.repeat(43);
  let address;
  const context = { URLSearchParams, Date, sessionStorage: session, location: { hash: '#cabin-pair=' + code, pathname: '/bradbury-cabin/', search: '?v=58' }, history: { state: {}, replaceState: (state, title, url) => { address = url; } } };
  vm.runInNewContext(script, context); assert.equal(address, '/bradbury-cabin/?v=58'); assert.equal(context.__cabinConnectionReturn, true);
  const calls = [];
  const result = await finishConnectionReturn({ url: 'https://connection.example/', storage, session, returning: true, fetchFn: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return Response.json({ token }); } });
  assert.equal(result.connected, true); assert.equal(storage.getItem(CONNECTION_KEY), token); assert.equal(session.getItem(CONNECTION_PAIR_KEY), null); assert.equal(calls[0].url, 'https://connection.example/pair'); assert.equal(calls[0].body.code, code); assert.equal(calls[0].body.device, storage.getItem(CONNECTION_DEVICE_KEY));
  assert.equal(storage.getItem('cabin-progress'), null); assert.equal(JSON.stringify(result).includes(token), false);
});
