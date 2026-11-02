import test from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionService } from '../connection/connection-service.js';
const origin = 'https://cabin.example', state = { version: 1, days: {}, weeks: {}, headset: { controls: { night: true } } };
const setup = () => {
  const calls = { authenticate: 0, save: 0, file: 0 };
  const authority = { google: { config: { origins: new Set([origin]) } }, async authenticate(header) { calls.authenticate++; if (header !== 'Bearer fixture') throw Object.assign(Error('Connect the cabin again; your readings are kept'), { code: 'connection', status: 401 }); return { device: 'a'.repeat(64) }; } };
  const backups = { async state() { return { state, revision: 1 }; }, async save(device, request) { calls.save++; return { receipt: { id: request.requestId }, state: JSON.parse(request.payload) }; }, snapshots: { async history() { return { current: { id: 'backup:1' }, previous: [], daily: {} }; }, async readSnapshot() { return { text: JSON.stringify(state) }; } } };
  const files = { async newestPicksStamp() { calls.file++; throw Error('fixture-private-secret must never appear in a response'); } };
  return { service: new ConnectionService({ authority, backups, files }), calls, backups };
};
const request = (path, { body, headers, method } = {}) => new Request('https://connection.example' + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { Origin: origin, Authorization: 'Bearer fixture', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
test('private endpoints require owner authorization, exact allowed origins and no-cache responses', async () => {
  const { service, calls } = setup();
  const foreign = await service.fetch(request('/state', { headers: { Origin: 'https://evil.example' } })); assert.equal(foreign.status, 403); assert.equal(calls.authenticate, 0); assert.equal(foreign.headers.has('Access-Control-Allow-Origin'), false);
  const unauthenticated = await service.fetch(request('/state', { headers: { Authorization: '' } })); assert.equal(unauthenticated.status, 401);
  const good = await service.fetch(request('/state')); assert.equal(good.status, 200); assert.equal(good.headers.get('Access-Control-Allow-Origin'), origin); assert.equal(good.headers.get('Cache-Control'), 'no-store'); assert.equal(good.headers.get('Referrer-Policy'), 'no-referrer');
  assert.deepEqual((await good.json()).state, state);
});
test('preflight permits only the intended methods and headers without exposing credentials', async () => {
  const { service } = setup();
  const headers = { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' };
  const good = await service.fetch(request('/backup', { method: 'OPTIONS', headers })); assert.equal(good.status, 204); assert.equal(good.headers.get('Access-Control-Allow-Headers'), 'Authorization, Content-Type'); assert.equal(good.headers.has('Access-Control-Allow-Credentials'), false);
  assert.equal((await service.fetch(request('/backup', { method: 'OPTIONS', headers: { ...headers, 'Access-Control-Request-Headers': 'cookie,x-arbitrary' } }))).status, 403);
  assert.equal((await service.fetch(request('/backup', { method: 'OPTIONS', headers: { ...headers, 'Access-Control-Request-Method': 'DELETE' } }))).status, 403);
});
test('malformed, oversized or non-JSON input cannot invoke a backup write or receive an acknowledgement', async () => {
  const { service, calls } = setup();
  for (const req of [request('/backup', { body: '{bad' }), request('/backup', { body: '{}', headers: { 'Content-Length': '10000001' } }), request('/backup', { body: '{}', headers: { 'Content-Type': 'text/plain' } }), request('/backup', { body: 'null' })]) {
    const reply = await service.fetch(req); assert.equal(reply.status, 400); assert.equal((await reply.json()).receipt, undefined);
  }
  assert.equal(calls.save, 0);
  const good = await service.fetch(request('/backup', { body: { requestId: 'fixture-request', state } })); assert.equal(good.status, 200); assert.equal(calls.save, 1); assert.deepEqual((await good.json()).state, state);
});
test('Google failure leaves the private reading copy available and never exposes internal failure text', async () => {
  const { service, calls } = setup();
  const failed = await service.fetch(request('/stamp?day=2026-10-31')); assert.equal(failed.status, 503); assert.equal((await failed.text()).includes('fixture-private-secret'), false);
  assert.equal((await service.fetch(request('/state'))).status, 200);
  assert.equal((await service.fetch(request('/stamp?day=2026-02-31'))).status, 400); assert.equal(calls.file, 1);
  assert.equal((await service.fetch(request('/proxy?url=https://www.googleapis.com/drive/v3/files'))).status, 404);
});
test('snapshot download is byte-exact state only and requires a retained snapshot identity', async () => {
  const { service } = setup();
  const reply = await service.fetch(request('/snapshot?id=backup:1')); assert.equal(reply.status, 200); assert.equal(await reply.text(), JSON.stringify(state)); assert.match(reply.headers.get('Content-Disposition'), /attachment/);
  assert.equal((await service.fetch(request('/snapshot?id=googleGrant'))).status, 404);
});
