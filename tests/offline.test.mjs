import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { STATIC_ASSETS } from '../static-assets.mjs';
import { makeOfflineEdition, staticHash } from '../tools/generate-offline.mjs';

test('offline manifest covers all public assets and detects any changed bytes', async () => {
  const original = await makeOfflineEdition();
  assert.deepEqual(original.assets.map(a => a.path), STATIC_ASSETS.filter(n => n !== 'offline-manifest.js').sort());
  const changed = await makeOfflineEdition(async name => {
    const bytes = await readFile(new URL('../' + name, import.meta.url));
    return name === 'library.js' ? Buffer.concat([bytes, Buffer.from('changed')]) : bytes;
  });
  assert.notEqual(changed.digest, original.digest);
  assert.notEqual(changed.assets.find(a => a.path === 'library.js').sha256, original.assets.find(a => a.path === 'library.js').sha256);
  assert.equal(staticHash(Buffer.from('line\r\n'), true), staticHash(Buffer.from('line\n'), true));
  assert.notEqual(staticHash(Buffer.from([13, 10]), false), staticHash(Buffer.from([10]), false), 'binary bytes are exact');
});

test('every local runtime import is part of the offline public inventory', async () => {
  const allowed = new Set(STATIC_ASSETS);
  for (const name of STATIC_ASSETS.filter(n => n.endsWith('.js'))) {
    const source = await readFile(new URL('../' + name, import.meta.url), 'utf8');
    const imports = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\bimportScripts\(\s*|\bnew URL\(\s*)["'](\.[^"']+)["']/g;
    for (const [, address] of source.matchAll(imports)) {
      const target = posix.normalize(posix.join(posix.dirname(name), address.split('?')[0]));
      assert.ok(allowed.has(target), `${name} needs uncached ${target}`);
    }
  }
});
