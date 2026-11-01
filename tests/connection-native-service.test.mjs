// Entire owner API in local workerd/SQLite, with fake Google only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from '../tools/connection-runtime.mjs';
import { build } from '../tools/connection-runtime.mjs';
import { randomToken } from '../connection/connection-crypto.js';
const repo = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const fixtureEnv = { SERVICE_URL: 'https://connection.example/', CABIN_URL: 'https://cabin.example/bradbury/', OWNER_EMAIL: 'reader@example.com', GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-client-secret', MASTER_KEY: randomToken() };
const original = { version: 1, start: '2026-10-18', trackingSince: '2026-10-31', days: { '2026-10-31': { poem: true, story: false, essay: false } }, weeks: {}, savedAt: '2026-10-31T12:00:00Z', headset: { controls: { night: false, size: 1 }, reading: { last: 'the-raven', places: {} } } };
const modulePath = file => fileURLToPath(new URL(file, import.meta.url)).replaceAll('\\', '/');
const source = `
import { GoogleAuth, READ_SCOPE, FILE_SCOPE } from ${JSON.stringify(modulePath('../connection/google-auth.js'))};
import { ConnectionAuthority } from ${JSON.stringify(modulePath('../connection/connection-authority.js'))};
import { BackupCoordinator } from ${JSON.stringify(modulePath('../connection/backup-coordinator.js'))};
import { ConnectionService } from ${JSON.stringify(modulePath('../connection/connection-service.js'))};
import { mergeProgress } from ${JSON.stringify(repo + '/drive.js')};
import { validProgress, berlinDateKey } from ${JSON.stringify(repo + '/progress.js')};
const config = ${JSON.stringify(fixtureEnv)}, initial = ${JSON.stringify(original)};
export class NativeOwnerFixture {
  constructor(ctx) {
    const google = new GoogleAuth(config, { fetchFn: async url => Response.json(url.includes('/userinfo') ? { email: config.OWNER_EMAIL, email_verified: true, sub: 'fixture-owner' } : { access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'Bearer', expires_in: 3600, scope: READ_SCOPE + ' ' + FILE_SCOPE }) });
    const authority = new ConnectionAuthority(ctx.storage, google);
    const backups = new BackupCoordinator(ctx.storage, { validate: validProgress, mergeProgress, readInitial: async () => JSON.stringify(initial), dayKey: berlinDateKey });
    const files = { async newestPicksStamp() { throw Error('fixture Google outage'); } };
    this.service = new ConnectionService({ authority, backups, files });
  }
  fetch(request) { return this.service.fetch(request); }
  async alarm() {}
}
export default { fetch(request, env) { return env.OWNER.get(env.OWNER.idFromName('fixture-owner')).fetch(request); } };
`;
const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'native-service-fixture.js' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const runtime = persist => new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-30', durableObjects: { OWNER: { className: 'NativeOwnerFixture', useSQLite: true } }, resourcePersistencePath: persist, telemetry: { enabled: false } }));
const origin = new URL(fixtureEnv.CABIN_URL).origin;
async function call(mf, path, { token, body, headers = {} } = {}) {
  return mf.dispatchFetch(fixtureEnv.SERVICE_URL.slice(0, -1) + path, { redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function connect(mf) {
  const start = await call(mf, '/auth/begin?return=' + encodeURIComponent(fixtureEnv.CABIN_URL)); assert.equal(start.status, 303);
  const state = new URL(start.headers.get('Location')).searchParams.get('state'), cookie = start.headers.get('Set-Cookie').split(';')[0];
  const callback = await call(mf, '/auth/callback?' + new URLSearchParams({ state, code: 'fixture-authorization-code' }), { headers: { Cookie: cookie } }); assert.equal(callback.status, 303);
  const code = new URLSearchParams(new URL(callback.headers.get('Location')).hash.slice(1)).get('cabin-pair');
  const pair = await call(mf, '/pair', { body: { code, device: randomToken() } }); assert.equal(pair.status, 200); return (await pair.json()).token;
}
async function save(mf, token, state, operations = [], sequence = 0) {
  const read = await call(mf, '/state', { token }); assert.equal(read.status, 200); const info = await read.json();
  const body = structuredClone({ requestId: crypto.randomUUID(), state, operations, sequence, revision: info.revision, baselineRevision: info.baselineRevision });
  const reply = await call(mf, '/backup', { token, body }); assert.equal(reply.status, 200); return { body, result: await reply.json() };
}
test('native owner API: Google pairing, two-device corrections, lost responses, cold restore and restricted recovery download', async () => {
  const persist = await mkdtemp(path.join(tmpdir(), 'cabin-api-')); let mf = runtime(persist);
  try {
    assert.equal((await call(mf, '/state')).status, 401);
    const tokenA = await connect(mf), tokenB = await connect(mf);
    assert.equal((await call(mf, '/state', { token: tokenA, headers: { Origin: 'https://evil.example' } })).status, 403);
    await save(mf, tokenA, original); await save(mf, tokenB, original);
    const localA = structuredClone(original); localA.days['2026-10-31'].poem = false;
    const untick = { path: ['days', '2026-10-31', 'poem'], sequence: 1, value: false };
    const lost = await save(mf, tokenA, localA, [untick], 1);
    const localB = structuredClone(lost.result.state); localB.days['2026-10-31'].poem = true;
    await save(mf, tokenB, localB, [{ ...untick, value: true }], 1);
    localA.headset.controls.night = true;
    const next = await save(mf, tokenA, localA, [untick, { path: ['headset', 'controls', 'night'], sequence: 2, value: true }], 2);
    assert.equal(next.result.state.days['2026-10-31'].poem, true); assert.equal(next.result.state.headset.controls.night, true); assert.equal(next.result.driveCurrent, false);
    const replay = await call(mf, '/backup', { token: tokenA, body: lost.body }); assert.equal(replay.status, 200); const retried = await replay.json();
    assert.equal(retried.receipt.sequence, 1); assert.equal(retried.state.days['2026-10-31'].poem, true); assert.equal(retried.state.headset.controls.night, true);
    assert.equal((await call(mf, '/stamp?day=2026-10-31', { token: tokenA })).status, 503);
    await mf.dispose(); mf = runtime(persist);
    const restored = await call(mf, '/state', { token: tokenA }); assert.equal(restored.status, 200); const cold = await restored.json(); assert.deepEqual(cold.state, next.result.state);
    const history = await (await call(mf, '/history', { token: tokenA })).json();
    const snapshot = await call(mf, '/snapshot?id=' + history.current.id, { token: tokenA }); assert.equal(snapshot.status, 200); assert.deepEqual(await snapshot.json(), cold.state);
    assert.equal((await call(mf, '/snapshot?id=googleGrant', { token: tokenA })).status, 404);
    const disconnected = await call(mf, '/disconnect', { token: tokenA, body: {} }); assert.equal(disconnected.status, 200);
    assert.equal((await call(mf, '/state', { token: tokenA })).status, 401); assert.equal((await call(mf, '/state', { token: tokenB })).status, 200);
  } finally { await mf.dispose(); await rm(persist, { recursive: true, force: true }); }
});
