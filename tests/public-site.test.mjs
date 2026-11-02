import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { STATIC_ASSETS } from '../static-assets.mjs';
import { copyPublicSite } from '../tools/package-site.mjs';

test('deployment contains the complete public reader and excludes private/repository files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cabin-public-'));
  try {
    const root = join(dir, 'source'), output = join(dir, 'output');
    await mkdir(root);
    for (const name of STATIC_ASSETS) {
      await mkdir(dirname(join(root, name)), { recursive: true });
      await writeFile(join(root, name), `original bytes: ${name}\r\n`);
    }
    for (const name of ['.env', 'private/credentials.json', '.git/config', 'evidence/verify/private.json', 'bridge/private/account.json']) {
      await mkdir(dirname(join(root, name)), { recursive: true });
      await writeFile(join(root, name), 'MUST NOT BE PUBLIC');
    }
    await copyPublicSite(root, output);
    const list = (await readdir(output, { recursive: true, withFileTypes: true })).filter(f => f.isFile()).map(f => join(f.parentPath, f.name).slice(output.length + 1).replaceAll('\\', '/')).sort();
    assert.deepEqual(list, [...STATIC_ASSETS, '.nojekyll'].sort());
    for (const name of STATIC_ASSETS) assert.deepEqual(await readFile(join(output, name)), await readFile(join(root, name)));
    await assert.rejects(copyPublicSite(root, output), /EEXIST/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a public inventory entry cannot leak a private symlink target', async t => {
  // Windows needs special privileges for symlinks; the publishing host is Linux.
  if (process.platform === 'win32') return t.skip('Linux publishing filesystem check');
  const dir = await mkdtemp(join(tmpdir(), 'cabin-link-'));
  try {
    const root = join(dir, 'source'); await mkdir(root);
    await writeFile(join(dir, 'secret'), 'MUST NOT BE PUBLIC');
    await symlink(join(dir, 'secret'), join(root, STATIC_ASSETS[0]));
    await assert.rejects(copyPublicSite(root, join(dir, 'output')), /Not a regular public file/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
