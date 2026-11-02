// The public reader is an explicit inventory, never the repository root.
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STATIC_ASSETS } from '../static-assets.mjs';

export async function copyPublicSite(root, destination) {
  // Refuse an existing output directory: stale or private files cannot ride
  // along in an otherwise correct deployment artifact.
  await mkdir(destination);
  const publicRoot = await realpath(root);
  for (const name of STATIC_ASSETS) {
    const source = join(root, name);
    if (!(await lstat(source)).isFile() || await realpath(source) !== join(publicRoot, name)) throw Error(`Not a regular public file: ${name}`);
    const target = join(destination, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await readFile(source));
  }
  await writeFile(join(destination, '.nojekyll'), '');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const verify = () => execFileSync(process.execPath, ['tools/verify.mjs', '--receipt'], { cwd: root, stdio: 'inherit' });
  verify();
  await copyPublicSite(root, join(root, 'evidence/site'));
  verify();
  console.log('Only the exact checked public reader was packaged.');
}
