import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleAuth, authConfig, READ_SCOPE, FILE_SCOPE } from '../connection/google-auth.js';
import { randomToken, open, seal } from '../connection/connection-crypto.js';
const now = 1793480000000;
const env = { SERVICE_URL: 'https://connection.example/', CABIN_URL: 'https://cabin.example/bradbury/', SETUP_URL: 'http://127.0.0.1:18143/', OWNER_EMAIL: 'reader@example.com', GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-client-secret', MASTER_KEY: randomToken() };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const valid = () => ({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'Bearer', expires_in: 3600, scope: `${READ_SCOPE} ${FILE_SCOPE} openid email` });
const profile = () => ({ email: 'reader@example.com', email_verified: true, sub: 'owner-123' });
const callback = async auth => {
  const begin = await auth.begin(env.CABIN_URL), params = new URL(begin.url).searchParams;
  const request = new Request(`${env.SERVICE_URL}auth/callback?${new URLSearchParams({ state: params.get('state'), code: 'fixture-authorization-code' })}`, { headers: { Cookie: begin.cookie.split(';')[0] } });
  return { begin, request, result: await auth.readCallback(request) };
};
test('only the exact HTTPS Cabin or configured temporary loopback can receive a one-use pairing result', async () => {
  const auth = new GoogleAuth(env, { now: () => now });
  for (const url of ['https://evil.example/', env.CABIN_URL + '?next=evil', 'http://localhost:18143/', 'http://127.0.0.1:18144/', env.CABIN_URL + 'other/']) await assert.rejects(auth.begin(url), /Return to the cabin/);
  for (const bad of [{ SERVICE_URL: 'http://connection.example/' }, { CABIN_URL: 'https://user:pass@cabin.example/' }, { SETUP_URL: 'http://192.168.1.1/' }, { SETUP_URL: 'https://evil.example/' }]) assert.throws(() => authConfig({ ...env, ...bad }));
  const begin = await auth.begin(env.SETUP_URL);
  assert.match(begin.cookie, /^__Host-cabin-connection=.+; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=600$/);
  assert.equal(begin.url.includes(env.GOOGLE_CLIENT_SECRET), false);
  const params = new URL(begin.url).searchParams;
  assert.equal(params.get('code_challenge_method'), 'S256'); assert.equal(params.get('access_type'), 'offline');
  assert.equal(params.get('redirect_uri'), 'https://connection.example/auth/callback');
});
test('callback refuses missing, duplicate, tampered, mismatched and expired state before asking Google', async () => {
  let fetched = 0; const auth = new GoogleAuth(env, { now: () => now, fetchFn: () => { fetched++; throw Error(); } });
  const { begin, request } = await callback(auth), url = new URL(request.url);
  await assert.rejects(auth.readCallback(new Request(request.url)), /did not finish/);
  await assert.rejects(auth.readCallback(new Request(request.url, { headers: { Cookie: `${begin.cookie.split(';')[0]}; ${begin.cookie.split(';')[0]}` } })), /did not finish/);
  url.searchParams.set('state', 'another-state'); await assert.rejects(auth.readCallback(new Request(url, { headers: request.headers })), /fresh try/);
  const expired = new GoogleAuth(env, { now: () => now + 600001 }); await assert.rejects(expired.readCallback(request), /fresh try/);
  await assert.rejects(auth.readCallback(new Request(request.url, { headers: { Cookie: '__Host-cabin-connection=1.tampered.cookie' } })), /reconnecting/);
  assert.equal(fetched, 0);
});
test('Google verified owner and both Drive grants are required; refresh credential stays encrypted', async () => {
  const calls = [], auth = new GoogleAuth(env, { now: () => now, fetchFn: async (url, init) => { calls.push({ url, init }); return json(url.includes('/token') ? valid() : profile()); } });
  const { result } = await callback(auth), connected = await auth.exchange(result);
  assert.equal(connected.subject, 'owner-123'); assert.equal(connected.protectedRefresh.includes('fixture-refresh'), false);
  assert.deepEqual(await open(connected.protectedRefresh, env.MASTER_KEY, 'google-refresh'), { refresh: 'fixture-refresh', subject: 'owner-123' });
  const body = calls[0].init.body; assert.equal(body.get('code_verifier'), result.verifier); assert.equal(body.get('client_secret'), env.GOOGLE_CLIENT_SECRET);
  assert.equal(calls[1].url, 'https://openidconnect.googleapis.com/v1/userinfo'); assert.equal(calls[1].init.headers.Authorization, 'Bearer fixture-access');
  assert.equal(calls.every(c => c.init.redirect === 'manual' && c.init.signal), true);
  for (const badProfile of [{ ...profile(), email_verified: false }, { ...profile(), email: 'someone@example.com' }, { ...profile(), sub: '' }]) {
    const refused = new GoogleAuth(env, { now: () => now, fetchFn: async url => json(url.includes('/token') ? valid() : badProfile) });
    await assert.rejects(refused.exchange(result), /owner/);
  }
  await assert.rejects(auth.exchange(result, 'different-owner'), /owner/);
  let redirectCalls = 0;
  const redirected = new GoogleAuth(env, { now: () => now, fetchFn: async (url, init) => { redirectCalls++; assert.equal(url, 'https://oauth2.googleapis.com/token'); assert.equal(init.redirect, 'manual'); return new Response(null, { status: 302, headers: { Location: 'https://evil.example/' } }); } });
  await assert.rejects(redirected.exchange(result)); assert.equal(redirectCalls, 1, 'a redirect must never forward the client secret');
  for (const badToken of [{ ...valid(), scope: FILE_SCOPE }, { ...valid(), refresh_token: undefined }, { ...valid(), access_token: 'bad\r\nheader' }]) {
    const refused = new GoogleAuth(env, { now: () => now, fetchFn: async () => json(badToken) }); await assert.rejects(refused.exchange(result));
  }
});
test('renewal distinguishes actual revocation from outages, HTML, limits and malformed responses', async () => {
  const protectedRefresh = await seal({ refresh: 'fixture-refresh', subject: 'owner-123' }, env.MASTER_KEY, 'google-refresh');
  const renew = response => new GoogleAuth(env, { now: () => now, fetchFn: async () => typeof response === 'function' ? response() : response }).renew(protectedRefresh, 'owner-123');
  const renewed = await renew(json({ access_token: 'renewed-access', expires_in: 3600, token_type: 'Bearer' }));
  assert.equal(renewed.protectedRefresh, protectedRefresh); assert.equal(renewed.access, 'renewed-access');
  assert.deepEqual(await renew(json({ error: 'invalid_grant' }, 400)), { reconnect: true });
  assert.deepEqual(await renew(json({ ...valid(), scope: FILE_SCOPE })), { reconnect: true });
  for (const response of [json({ error: 'rate_limit' }, 429), json({}, 503), new Response('<html>limit reached</html>', { status: 400 }), json({ error: 'other' }, 400), json({}), new Response('x'.repeat(64001)), () => { throw Error('fixture outage'); }]) await assert.rejects(renew(response));
  const rotated = await renew(json({ ...valid(), refresh_token: 'rotated-refresh' }));
  assert.equal((await open(rotated.protectedRefresh, env.MASTER_KEY, 'google-refresh')).refresh, 'rotated-refresh');
  await assert.rejects(new GoogleAuth(env).renew(protectedRefresh, 'wrong-owner'), /reconnecting/);
});
