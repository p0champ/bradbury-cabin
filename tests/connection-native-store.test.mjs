// Local real workerd/SQLite proof. This harness is never deployed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from '../tools/connection-runtime.mjs';
import { build } from '../tools/connection-runtime.mjs';
const repo = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const source = `
import { SnapshotStore } from ${JSON.stringify(fileURLToPath(new URL('../connection/snapshot-store.js', import.meta.url)).replaceAll('\\', '/'))};
import { validProgress } from ${JSON.stringify(repo + '/progress.js')};
export class StoreFixture {
  constructor(ctx) { this.ctx = ctx; this.store = new SnapshotStore(ctx.storage, validProgress, { queueMirror: true }); }
  async alarm() {}
  async fetch(request) {
    const body = request.method === 'POST' ? await request.json() : {};
    try {
      switch (new URL(request.url).pathname) {
        case '/read': return Response.json(await this.store.read());
        case '/commit': return Response.json(await this.store.commit(body));
        case '/history': return Response.json(await this.store.history());
        case '/baseline': return Response.json(await this.store.deviceBaseline(body.device));
        case '/device': return Response.json(await this.store.deviceState(body.device));
        case '/pending': return Response.json({ pending: await this.ctx.storage.get('mirrorPending'), alarm: await this.ctx.storage.getAlarm() });
        case '/rollback':
          try { await this.ctx.storage.transaction(async txn => { await txn.put('current', { broken: true }); await txn.put('incomplete', true); await txn.setAlarm(Date.now() + 3600000); throw Error('fixture interruption'); }); } catch {}
          return Response.json(await this.store.read());
        case '/corrupt': { const root = await this.ctx.storage.get('current'); await this.ctx.storage.put(root.id + '/0', new Uint8Array([0])); return Response.json({corrupted:true}); }
      }
      return new Response('missing', { status: 404 });
    } catch(e) { return Response.json({ error: e.message }, { status: 503 }); }
  }
}
export default { fetch(request, env) { return env.STORE.get(env.STORE.idFromName('fixture-owner')).fetch(request); } };
`;
const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'store-fixture.js' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const runtime = persist => new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-30', durableObjects: { STORE: { className: 'StoreFixture', useSQLite: true } }, resourcePersistencePath: persist, telemetry: { enabled: false } }));
const device = 'a'.repeat(64);
const state = n => JSON.stringify({ version: 1, start: '2026-10-18', trackingSince: '2026-10-31', days: { '2026-10-31': { poem: n % 2 === 0 } }, weeks: {}, value: n });
const request = (n, extra = {}) => ({ revision: n - 1, baselineRevision: n - 1, device, requestId: `request-${n}`, payload: state(n), state: state(n), stamp: '2026-10-31T12:00:00Z', day: '2026-10-31', ...extra });
const call = async (mf, endpoint, body) => {
  const response = await mf.dispatchFetch(`https://fixture.example${endpoint}`, body ? { method: 'POST', body: JSON.stringify(body) } : {});
  return { status: response.status, body: await response.json() };
};
test('native SQLite: full Unicode snapshot survives process restart, duplicate retry and a rolled-back interruption', async () => {
  const persist = await mkdtemp(path.join(tmpdir(), 'cabin-store-')); let mf = runtime(persist);
  try {
    const large = JSON.stringify({ ...JSON.parse(state(1)), note: 'æøå完整 '.repeat(100000) });
    const first = request(1, { payload: large, state: large, sequence: 1, operations: [{ sequence: 1, path: ['days', '2026-10-31', 'poem'], value: false }] });
    const saved = await call(mf, '/commit', first); assert.equal(saved.status, 200); assert.equal(saved.body.root.parts > 1, true);
    assert.equal((await call(mf, '/pending')).body.pending.revision, 1);
    assert.ok((await call(mf, '/pending')).body.alarm);
    assert.equal((await call(mf, '/read')).body.text, large);
    const alarmBefore = (await call(mf, '/pending')).body.alarm;
    const rolledBack = await call(mf, '/rollback', {}); assert.equal(rolledBack.status, 200); assert.equal(rolledBack.body.text, large);
    assert.equal((await call(mf, '/pending')).body.alarm, alarmBefore, 'the alarm must roll back with the interrupted database writes');
    await mf.dispose(); mf = runtime(persist);
    assert.equal((await call(mf, '/read')).body.text, large);
    assert.equal((await call(mf, '/commit', first)).body.duplicate, true);
    assert.equal((await call(mf, '/baseline', { device })).body.text, large);
    assert.equal((await call(mf, '/device', { device })).body.sequence, 1);
    const changedId = await call(mf, '/commit', { ...first, payload: state(2) }); assert.equal(changedId.status, 503); assert.match(changedId.body.error, /reused/);
    assert.equal((await call(mf, '/read')).body.text, large);
  } finally { await mf.dispose(); await rm(persist, { recursive: true, force: true }); }
});
test('native SQLite: concurrent revisions cannot overwrite each other and corruption refuses replacement', async () => {
  const persist = await mkdtemp(path.join(tmpdir(), 'cabin-store-')), mf = runtime(persist);
  try {
    await call(mf, '/commit', request(1));
    const responses = await Promise.all([request(2), request(2, { requestId: 'request-concurrent', payload: state(3), state: state(3) })].map(body => call(mf, '/commit', body)));
    assert.equal(responses.filter(r => r.body.receipt).length, 1); assert.equal(responses.filter(r => r.body.conflict).length, 1);
    assert.equal((await call(mf, '/read')).body.root.revision, 2);
    assert.equal((await call(mf, '/history')).body.previous.length, 1);
    await call(mf, '/corrupt', {});
    assert.equal((await call(mf, '/read')).status, 503);
    assert.equal((await call(mf, '/commit', request(3))).status, 503);
    assert.equal((await call(mf, '/history')).body.current.revision, 2);
  } finally { await mf.dispose(); await rm(persist, { recursive: true, force: true }); }
});
