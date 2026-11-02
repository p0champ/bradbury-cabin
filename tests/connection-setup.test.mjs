import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { setupServer } from '../tools/setup-connection.mjs';
test('owner setup serves only loopback static files; rejects foreign Host, Origin, writes and private files', async () => {
  const server = setupServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /disposable Google file/); assert.equal(page.headers.get('cache-control'), 'no-store'); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    for (const path of ['/setup.js', '/managed-drive.js', '/pair-return.js']) assert.equal((await fetch(base + path)).status, 200);
    for (const path of ['/connection/worker.js', '/connection/wrangler.toml', '/.dev.vars', '/evidence/verify/receipt.json', '/package.json']) assert.equal((await fetch(base + path)).status, 404);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal((await fetch(base, { headers: { Origin: 'https://foreign.example' } })).status, 403);
    const foreign = await new Promise((resolve, reject) => { const req = http.get(base, { headers: { Host: 'foreign.example' } }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); });
    assert.equal(foreign, 403);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
