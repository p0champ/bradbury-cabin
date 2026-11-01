import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerDrive } from '../connection/owner-drive.js';
const { DriveLink } = await import(new URL('../drive.js', import.meta.url).href);
const setup = handler => {
  const calls = [], authority = { accessInfo: { expires: Date.now() + 3600000 }, async access() { return 'fixture-server-only'; } };
  const drive = createOwnerDrive(DriveLink, authority, { fetchFn: async (url, init) => { calls.push({ url, init }); return handler(url, init, calls.length); } });
  return { drive, calls, authority };
};
const json = data => Response.json(data);
test('managed listing retains all pages including an empty page, uses the server page budget and never exports Google credentials', async () => {
  const { drive, calls } = setup(url => {
    const token = new URL(url).searchParams.get('pageToken');
    return json(token === 'two' ? { files: [{ id: 'P', name: 'progress.json' }] } : { files: [], nextPageToken: token ? 'two' : 'one' });
  });
  assert.deepEqual(await drive.find("name = 'progress.json'"), [{ id: 'P', name: 'progress.json' }]);
  assert.equal(calls.length, 3); assert.ok(calls.every(c => new URL(c.url).searchParams.get('pageSize') === '1000'));
  assert.ok(calls.every(c => c.init.redirect === 'manual' && c.init.signal && c.init.headers.Authorization === 'Bearer fixture-server-only'));
  await assert.rejects(drive.call('https://evil.example/'), /outside/);
});
test('conditional write refuses missing or weak versions, and a stale version cannot replace a newer Drive copy', async () => {
  let stored = '{"newer":true}';
  const { drive, calls } = setup((url, init) => {
    if (init.method === 'PATCH') { if (init.headers['If-Match'] !== '"version-2"') return new Response(null, { status: 412 }); stored = init.body; return json({ id: 'P' }); }
    return json({});
  });
  for (const etag of [null, '', 'W/"version-2"', '"bad\r\nheader"']) await assert.rejects(drive.writeConditional({ id: 'P', etag }, '{"older":true}'), /safely updated/);
  assert.equal(calls.length, 0);
  await assert.rejects(drive.writeConditional({ id: 'P', etag: '"version-1"' }, '{"older":true}'), error => error.status === 412);
  assert.equal(stored, '{"newer":true}');
  await drive.writeConditional({ id: 'P', etag: '"version-2"' }, '{"latest":true}'); assert.equal(stored, '{"latest":true}');
});
test('newest malformed picks are reported without substituting an older request; oversized guide downloads are not imported', async () => {
  const { drive } = setup(url => {
    if (url.includes('alt=media')) return new Response('{"date":"2026-10-30"}');
    const query = new URL(url).searchParams.get('q') || '';
    if (query.includes('mimeType')) return json({ files: [{ id: 'F' }] });
    return json({ files: [{ id: 'NEW', name: 'picks-2026-10-31-2.json', size: 1500001 }, { id: 'OLD', name: 'picks-2026-10-31.json', size: 100 }] });
  });
  const newest = await drive.readPicks('2026-10-31'); assert.equal(newest.raw, null); assert.equal(newest.date, '2026-10-31'); assert.match(newest.problems[0], /too large/);
  assert.equal((await drive.readGuide('2026-10-31')).raw, null);
});
test('a server request budget, upstream quota or bad listing ends calmly instead of presenting partial results', async () => {
  const { drive, calls } = setup((url, init, n) => json({ files: [], nextPageToken: `next-${n}` }));
  await assert.rejects(drive.find("name = 'progress.json'"), /busy/); assert.equal(calls.length, 45);
  const limited = setup(() => new Response('<html>limit</html>', { status: 429 }));
  await assert.rejects(limited.drive.find("name = 'progress.json'"), error => error.status === 429);
  const broken = setup(() => new Response('<html>upstream broken</html>', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(broken.drive.find("name = 'progress.json'"));
  const redirected = setup(() => new Response(null, { status: 302, headers: { Location: 'https://evil.example/' } }));
  await assert.rejects(redirected.drive.find("name = 'progress.json'")); assert.equal(redirected.calls.length, 1, 'Google authorization must not follow a redirect');
});
test('a preallocated file identity is sent in creation, and a complete progress read carries its actual version', async () => {
  const { drive, calls } = setup(url => {
    if (url.includes('generateIds')) return json({ ids: ['reserved-id'] });
    if (url.includes('alt=media')) return new Response('{"version":1}', { headers: { ETag: '"actual-version"' } });
    if (url.includes('uploadType')) return json({ id: 'reserved-id' });
    const query = new URL(url).searchParams.get('q') || '';
    return json({ files: query.includes('mimeType') ? [{ id: 'F' }] : [{ id: 'P' }] });
  });
  const version = await drive.readProgressVersion(); assert.deepEqual(version, { id: 'P', etag: '"actual-version"', raw: '{"version":1}' });
  const id = await drive.reserveId(); await drive.createProgress(id, '{"fixture":true}');
  const upload = calls.find(c => c.url.includes('uploadType')); assert.match(upload.init.body, /"id":"reserved-id"/); assert.match(upload.init.body, /"name":"progress.json"/); assert.match(upload.init.body, /"parents":\["F"\]/);
});

test('the one-time compatibility probe proves both stale-write rejections and cleans up only its disposable file', async () => {
  for (const honorsCondition of [true, false]) {
    let probe = null, revision = 1; const existingProgress = '{"personal":"never touched"}';
    const { drive, calls } = setup((url, init) => {
      const parsed = new URL(url);
      if (url.includes('generateIds')) return json({ ids: ['probe-only-id'] });
      if (parsed.searchParams.get('q')) return json({ files: [{ id: 'F' }] });
      if (init.method === 'POST') {
        const parts = [...init.body.matchAll(/\r\n\r\n({[^\r\n]+})\r\n--/g)].map(match => match[1]);
        probe = { metadata: JSON.parse(parts[0]), raw: parts[1] }; return json({ id: 'probe-only-id' });
      }
      if (init.method === 'PATCH') {
        if (honorsCondition && init.headers['If-Match'] !== `"v${revision}"`) return new Response(null, { status: 412 });
        probe.raw = init.body; revision++; return json({ id: 'probe-only-id' });
      }
      if (init.method === 'DELETE') { assert.equal(parsed.pathname.endsWith('/probe-only-id'), true); probe = null; return new Response(null, { status: 204 }); }
      if (parsed.searchParams.get('alt') === 'media') return new Response(probe.raw, { headers: { ETag: `"v${revision}"` } });
      return json(probe.metadata);
    });
    const result = await drive.probeConditional(); assert.deepEqual(result, { safeConditional: honorsCondition, cleanup: true });
    assert.equal(probe, null); assert.equal(existingProgress, '{"personal":"never touched"}');
    assert.equal(calls.filter(c => c.init.method === 'PATCH').length, honorsCondition ? 3 : 1);
    assert.equal(calls.some(c => c.init.body?.includes('never touched')), false);
  }
});
