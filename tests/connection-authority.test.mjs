import test from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionAuthority } from '../connection/connection-authority.js';
import { GoogleAuth, READ_SCOPE, FILE_SCOPE } from '../connection/google-auth.js';
import { randomToken } from '../connection/connection-crypto.js';
class Storage {
  constructor() { this.data = new Map(); }
  async get(key) { return structuredClone(this.data.get(key)); }
  async put(key, value) { if (typeof key === 'string') this.data.set(key, structuredClone(value)); else for (const [k, v] of Object.entries(key)) this.data.set(k, structuredClone(v)); }
  async transaction(fn) { const tx = new Storage(); tx.data = structuredClone(this.data); const result = await fn(tx); this.data = tx.data; return result; }
}
const env = { SERVICE_URL: 'https://connection.example/', CABIN_URL: 'https://cabin.example/bradbury/', OWNER_EMAIL: 'reader@example.com', GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-client-secret', MASTER_KEY: randomToken() };
const json = body => Response.json(body);
const setup = () => {
  let time = 1793480000000, fetches = 0, renews = 0, response = 'valid';
  const storage = new Storage(), google = new GoogleAuth(env, { now: () => time, fetchFn: async (url, init) => {
    fetches++;
    if (url.includes('/userinfo')) return json({ email: env.OWNER_EMAIL, email_verified: true, sub: 'owner-123' });
    if (init.body.get('grant_type') === 'refresh_token') { renews++; if (response === 'outage') throw Error('fixture outage'); if (response === 'revoked') return new Response('{"error":"invalid_grant"}', { status: 400 }); }
    return json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'Bearer', expires_in: 3600, scope: `${READ_SCOPE} ${FILE_SCOPE}` });
  } });
  const authority = new ConnectionAuthority(storage, google, { now: () => time });
  return { storage, google, authority, advance: n => { time += n; }, mode: value => { response = value; }, counters: () => ({ fetches, renews }) };
};
const begin = async authority => {
  const result = await authority.begin(env.CABIN_URL), state = new URL(result.url).searchParams.get('state');
  return new Request(`${env.SERVICE_URL}auth/callback?${new URLSearchParams({ state, code: 'fixture-authorization-code' })}`, { headers: { Cookie: result.cookie.split(';')[0] } });
};
const connected = async fixture => {
  const request = await begin(fixture.authority), callback = await fixture.authority.callback(request);
  const code = new URLSearchParams(new URL(callback.url).hash.slice(1)).get('cabin-pair'), device = randomToken();
  const pair = await fixture.authority.pair(code, device, new URL(env.CABIN_URL).origin);
  return { request, callback, code, device, pair };
};
test('authorization state and short-lived pairing code each work once; long-lived token is only in the JSON result', async () => {
  const fixture = setup(), result = await connected(fixture);
  await assert.rejects(fixture.authority.callback(result.request), /fresh try/);
  await assert.rejects(fixture.authority.pair(result.code, result.device, new URL(env.CABIN_URL).origin), /expired/);
  assert.equal(result.callback.url.includes(result.pair.token), false);
  assert.equal(JSON.stringify([...fixture.storage.data.values()]).includes(result.pair.token), false);
  assert.equal(JSON.stringify([...fixture.storage.data.values()]).includes('fixture-refresh'), false);
  assert.equal((await fixture.authority.authenticate(`Bearer ${result.pair.token}`)).device, result.pair.device);
});
test('foreign origins, expired codes, invalid tokens and disconnected devices cannot read or change private backups', async () => {
  const fixture = setup(), request = await begin(fixture.authority), callback = await fixture.authority.callback(request);
  const code = new URLSearchParams(new URL(callback.url).hash.slice(1)).get('cabin-pair');
  await assert.rejects(fixture.authority.pair(code, randomToken(), 'https://evil.example'), /Return to the cabin/);
  fixture.advance(120001); await assert.rejects(fixture.authority.pair(code, randomToken(), new URL(env.CABIN_URL).origin), /expired/);
  for (const header of ['', 'Bearer wrong', `Bearer ${randomToken()}`]) await assert.rejects(fixture.authority.authenticate(header), error => error.status === 401);
  const result = await connected(fixture); await fixture.storage.put('current', { fixture: 'private progress' });
  await fixture.authority.disconnect(`Bearer ${result.pair.token}`);
  await assert.rejects(fixture.authority.authenticate(`Bearer ${result.pair.token}`));
  assert.deepEqual(await fixture.storage.get('current'), { fixture: 'private progress' });
});
test('refresh is shared between concurrent requests and temporary failures preserve grant and Cabin authorization', async () => {
  const fixture = setup(), result = await connected(fixture);
  fixture.advance(3600000); fixture.mode('outage'); const before = await fixture.storage.get('googleGrant');
  await assert.rejects(fixture.authority.access(), /unavailable/); assert.deepEqual(await fixture.storage.get('googleGrant'), before);
  await fixture.authority.authenticate(`Bearer ${result.pair.token}`);
  fixture.mode('valid'); const beforeRenew = fixture.counters().renews;
  assert.deepEqual(await Promise.all(Array.from({ length: 8 }, () => fixture.authority.access())), Array(8).fill('fixture-access'));
  assert.equal(fixture.counters().renews - beforeRenew, 1);
});
test('actual Google revocation asks for reconnecting while preserving every private snapshot and device token', async () => {
  const fixture = setup(), result = await connected(fixture); await fixture.storage.put('current', { fixture: 'kept' });
  fixture.advance(3600000); fixture.mode('revoked');
  await assert.rejects(fixture.authority.access(), error => error.status === 424 && error.code === 'google_reconnect');
  assert.equal((await fixture.storage.get('googleGrant')).reconnect, true);
  await fixture.authority.authenticate(`Bearer ${result.pair.token}`);
  assert.deepEqual(await fixture.storage.get('current'), { fixture: 'kept' });
  fixture.mode('valid'); await connected(fixture); assert.equal(await fixture.authority.access(), 'fixture-access');
});
test('unfinished authorizations are bounded and expired records free their places without touching backups', async () => {
  const fixture = setup(); for (let i = 0; i < 16; i++) await begin(fixture.authority);
  await assert.rejects(begin(fixture.authority), error => error.status === 429);
  fixture.advance(600001); await begin(fixture.authority);
  assert.equal(Object.keys(await fixture.storage.get('authStates')).length, 1);
});

test('declining Google returns only to the checked cabin address and leaves an existing grant intact', async () => {
  const fixture = setup(); await connected(fixture); const grant = await fixture.storage.get('googleGrant');
  const request = await begin(fixture.authority), url = new URL(request.url); url.searchParams.delete('code'); url.searchParams.set('error', 'access_denied');
  const before = fixture.counters().fetches, result = await fixture.authority.callback(new Request(url, { headers: request.headers }));
  assert.equal(result.url, env.CABIN_URL + '#cabin-connection=cancelled'); assert.equal(fixture.counters().fetches, before);
  assert.deepEqual(await fixture.storage.get('googleGrant'), grant);
  await assert.rejects(fixture.authority.callback(new Request(url, { headers: request.headers })), /fresh try/);
});
