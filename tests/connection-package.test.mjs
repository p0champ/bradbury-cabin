import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageConnection } from '../tools/deploy-connection.mjs';

test('private deployment packages only bundled checked code and public configuration, never local credentials or stale files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cabin-package-'));
  try {
    await mkdir(join(root, 'connection'));
    await writeFile(join(root, 'connection/worker.js'), 'export default {fetch(request,env){return new Response(env.GOOGLE_CLIENT_SECRET ? "connected" : "setup");}};');
    const config = 'name="fixture-connection"\nmain="worker.js"\ncompatibility_date="2026-10-30"\n';
    await writeFile(join(root, 'connection/wrangler.toml'), config);
    await writeFile(join(root, 'connection/.dev.vars'), 'GOOGLE_CLIENT_SECRET=fixture-secret-never-package-this\n');
    await writeFile(join(root, 'private-progress.json'), '{"thought":"private-fixture-thought"}');
    const out = join(root, 'package'), hashes = await packageConnection(root, out);
    assert.deepEqual((await readdir(out)).sort(), ['worker.js', 'wrangler.toml']);
    const script = await readFile(join(out, 'worker.js'), 'utf8');
    assert.equal(script.includes('fixture-secret-never-package-this'), false); assert.equal(script.includes('private-fixture-thought'), false);
    assert.equal(await readFile(join(out, 'wrangler.toml'), 'utf8'), config);
    assert.equal(Object.values(hashes).every(hash => /^[a-f0-9]{64}$/.test(hash)), true);
    await writeFile(join(out, 'old-private-file'), 'keep');
    await assert.rejects(packageConnection(root, out), error => error.code === 'EEXIST');
    assert.equal(await readFile(join(out, 'old-private-file'), 'utf8'), 'keep');
  } finally { await rm(root, { recursive: true, force: true }); }
});
