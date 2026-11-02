// Tests the actual preparation entry point, not a reconstructed controller.
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
const config = { SERVICE_URL: 'https://connection.example/', CABIN_URL: 'https://cabin.example/bradbury/', OWNER_EMAIL: 'reader@example.com', GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret', MASTER_KEY: randomToken() };
const original = { version: 1, start: '2026-10-18', trackingSince: '2026-10-31', days: { '2026-10-31': { poem: true } }, weeks: {}, savedAt: '2026-10-31T12:00:00Z', headset: { controls: { night: false }, reading: { last: 'the-raven', places: { 'the-raven': { anchor: { block: 2, word: 45, section: 'text' }, page: 1 } } } } };
const entry = fileURLToPath(new URL('../connection/worker.js', import.meta.url)).replaceAll('\\', '/');
const source = `import worker, { CabinOwner } from ${JSON.stringify(entry)};
export class OwnerFixture extends CabinOwner {
  async fetch(request) {
    if (new URL(request.url).pathname === '/__fixture/forget-alarm') return this.exclusive(async () => { await this.authority.authenticate(request.headers.get('Authorization')); await this.storage.deleteAlarm(); return Response.json({ forgotten: true }); });
    if (new URL(request.url).pathname === '/__fixture/alarm-status') return this.exclusive(async () => { await this.authority.authenticate(request.headers.get('Authorization')); return Response.json({ at: await this.storage.getAlarm() }); });
    if (new URL(request.url).pathname === '/__fixture/alarm') { await this.authority.authenticate(request.headers.get('Authorization')); await super.alarm(); return Response.json({ ran: true }); }
    return super.fetch(request);
  }
}
export default worker;`;
const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'production-fixture.js' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', plugins: [{ name: 'cabin-source', setup(builder) { builder.onResolve({ filter: /^cabin:/ }, args => ({ path: repo + '/' + args.path.slice(6) + '.js' })); } }] });
const origin = new URL(config.CABIN_URL).origin;
const call = (mf, route, { token, body, headers = {} } = {}) => mf.dispatchFetch(config.SERVICE_URL.slice(0, -1) + route, { redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function connect(mf) {
  const begin = await call(mf, '/auth/begin?return=' + encodeURIComponent(config.CABIN_URL)); assert.equal(begin.status, 303);
  const state = new URL(begin.headers.get('Location')).searchParams.get('state'), cookie = begin.headers.get('Set-Cookie').split(';')[0];
  const callback = await call(mf, '/auth/callback?' + new URLSearchParams({ state, code: 'fixture-authorization-code' }), { headers: { Cookie: cookie } }); assert.equal(callback.status, 303);
  const code = new URLSearchParams(new URL(callback.headers.get('Location')).hash.slice(1)).get('cabin-pair');
  const pair = await call(mf, '/pair', { body: { code, device: randomToken() } }); assert.equal(pair.status, 200); return (await pair.json()).token;
}
function googleFixture() {
  const files = new Map([['P', { id: 'P', name: 'progress.json', raw: JSON.stringify(original), revision: 1 }]]);
  let reserved = 0, quota = false, progressWrites = 0, renewals = 0;
  const fetcher = async request => {
    const url = new URL(request.url);
    if (url.hostname === 'oauth2.googleapis.com') { if (new URLSearchParams(await request.text()).get('grant_type') === 'refresh_token') renewals++; return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'Bearer', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file' }); }
    if (url.hostname === 'openidconnect.googleapis.com') return Response.json({ email: config.OWNER_EMAIL, email_verified: true, sub: 'fixture-owner' });
    assert.equal(url.hostname, 'www.googleapis.com'); assert.equal(request.headers.get('Authorization'), 'Bearer fixture-access');
    if (quota) return new Response('<html>fixture free limit</html>', { status: 429 });
    if (url.pathname.endsWith('/generateIds')) return Response.json({ ids: [`probe-${++reserved}`] });
    const query = url.searchParams.get('q');
    if (query) return Response.json({ files: query.includes('mimeType') ? [{ id: 'F' }] : query.includes("name = 'progress.json'") ? [{ id: 'P', name: 'progress.json' }] : [] });
    if (request.method === 'POST') {
      const body = await request.text(), parts = [...body.matchAll(/\r\n\r\n({[^\r\n]+})\r\n--/g)].map(match => match[1]), metadata = JSON.parse(parts[0]);
      assert.match(metadata.name, /^cabin-connection-check-/); files.set(metadata.id, { ...metadata, raw: parts[1], revision: 1 }); return Response.json({ id: metadata.id });
    }
    const id = url.pathname.split('/').at(-1), file = files.get(id); assert.ok(file, `unexpected fixture file ${id}`);
    if (request.method === 'PATCH') {
      if (request.headers.get('If-Match') !== `"${file.revision}"`) return new Response(null, { status: 412 });
      file.raw = await request.text(); file.revision++; if (id === 'P') progressWrites++; return Response.json({ id });
    }
    if (request.method === 'DELETE') { assert.notEqual(id, 'P'); files.delete(id); return new Response(null, { status: 204 }); }
    if (url.searchParams.get('alt') === 'media') return new Response(file.raw, { headers: { ETag: `"${file.revision}"` } });
    return Response.json({ id, name: file.name, appProperties: file.appProperties });
  };
  return { fetcher, files, setQuota: value => { quota = value; }, writes: () => progressWrites, renewals: () => renewals };
}
test('actual Worker: owner setup, harmless compatibility probe, checked Drive mirror, upstream limits and cold private restore', async () => {
  const persist = await mkdtemp(path.join(tmpdir(), 'cabin-worker-')), google = googleFixture();
  const runtime = () => new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-30', bindings: config, durableObjects: { OWNER: { className: 'OwnerFixture', useSQLite: true } }, outboundService: google.fetcher, resourcePersistencePath: persist, telemetry: { enabled: false } }));
  let mf = runtime();
  try {
    const privacy = await call(mf, '/privacy'); assert.equal(privacy.status, 200); assert.equal((await privacy.text()).includes('fixture-secret'), false);
    const token = await connect(mf), first = await (await call(mf, '/state', { token })).json(); assert.deepEqual(first.state, original);
    await call(mf, '/__fixture/forget-alarm', { token });
    assert.equal((await (await call(mf, '/__fixture/alarm-status', { token })).json()).at, null);
    const resumed = await (await call(mf, '/state', { token })).json();
    assert.deepEqual(resumed.state, original); assert.equal(resumed.revision, first.revision);
    assert.ok((await (await call(mf, '/__fixture/alarm-status', { token })).json()).at, 'native SQLite retry must restart after an exhausted outage');
    await call(mf, '/__fixture/alarm', { token }); assert.equal(google.writes(), 0, 'personal Drive writes stay disabled until the compatibility test passes');
    const renewals = google.renewals();
    const probe = await call(mf, '/connection-check', { token, body: {} }); assert.equal(probe.status, 200); assert.deepEqual(await probe.json(), { safeConditional: true, cleanup: true, renewed: true }); assert.equal(google.files.size, 1); assert.equal(google.renewals(), renewals + 1, 'setup must actually decrypt and use the renewal grant');
    const before = await (await call(mf, '/state', { token })).json(), state = structuredClone(before.state); state.days['2026-10-31'].poem = false;
    const body = { state, revision: before.revision, baselineRevision: before.baselineRevision, requestId: crypto.randomUUID(), sequence: 1, operations: [{ sequence: 1, path: ['days', '2026-10-31', 'poem'], value: false }] };
    const saved = await call(mf, '/backup', { token, body }); assert.equal(saved.status, 200); assert.equal((await saved.json()).driveCurrent, false);
    google.setQuota(true); await call(mf, '/__fixture/alarm', { token });
    const waiting = await (await call(mf, '/state', { token })).json(); assert.equal(waiting.state.days['2026-10-31'].poem, false); assert.equal(waiting.driveCurrent, false); assert.equal(waiting.mirrorProblem.code, 'unavailable');
    google.setQuota(false); await call(mf, '/__fixture/alarm', { token });
    const checked = await (await call(mf, '/state', { token })).json(); assert.equal(checked.driveCurrent, true); assert.equal(checked.mirrorProblem, null);
    assert.equal((await (await call(mf, '/__fixture/alarm-status', { token })).json()).at, null, 'checked-current storage stays quiet');
    const mirrored = JSON.parse(google.files.get('P').raw); assert.equal(mirrored.days['2026-10-31'].poem, false); assert.deepEqual(mirrored.headset, original.headset); assert.equal(mirrored.cabinPickerInstructions.protocol, 'bradbury-daily-three/v2'); assert.ok(mirrored.cabinPickerInstructions.catalogue.length > 20);
    await mf.dispose(); mf = runtime();
    const restored = await (await call(mf, '/state', { token })).json(); assert.deepEqual(restored.state, state); assert.equal(restored.driveCurrent, true); assert.equal(JSON.stringify(restored).includes('fixture-refresh'), false);
  } finally { await mf.dispose(); await rm(persist, { recursive: true, force: true }); }
});
