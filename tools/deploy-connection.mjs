// The private service uses the same exact complete receipt as the reader.
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';

export async function packageConnection(root, destination) {
  await mkdir(destination);
  for (const name of ['worker.js', 'wrangler.toml']) if (!(await lstat(join(root, 'connection', name))).isFile()) throw Error('The connection source must be a regular checked file');
  const { build } = await import('./connection-runtime.mjs');
  await build({ entryPoints: [join(root, 'connection/worker.js')], bundle: true, write: true, outfile: join(destination, 'worker.js'), platform: 'browser', format: 'esm', target: 'es2022' });
  await writeFile(join(destination, 'wrangler.toml'), await readFile(join(root, 'connection/wrangler.toml')));
  const hashes = {};
  for (const name of ['worker.js', 'wrangler.toml']) hashes[name] = createHash('sha256').update(await readFile(join(destination, name))).digest('hex');
  return hashes;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const verify = () => execFileSync(process.execPath, ['tools/verify.mjs', '--receipt'], { cwd: root, stdio: 'inherit' });
  verify();
  const receipt = JSON.parse(await readFile(join(root, 'evidence/verify/receipt.json'), 'utf8'));
  const destination = join(root, 'evidence', `connection-release-${receipt.commit.slice(0, 12)}-${randomUUID()}`);
  const hashes = await packageConnection(root, destination);
  verify();
  for (const [name, expected] of Object.entries(hashes)) if (createHash('sha256').update(await readFile(join(destination, name))).digest('hex') !== expected) throw Error('The checked connection package changed');
  const { resolveConnectionTool } = await import('./connection-runtime.mjs');
  const cli = join(dirname(dirname(resolveConnectionTool('wrangler'))), 'bin/wrangler.js');
  const args = [cli, 'deploy', '--no-bundle', '--config', join(destination, 'wrangler.toml')];
  if (process.env.CABIN_SETUP_URL) {
    const url = new URL(process.env.CABIN_SETUP_URL);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) throw Error('The temporary setup return must be an exact loopback address');
    args.push('--var', `SETUP_URL:${url.href}`);
  }
  await mkdir(join(root, 'evidence/connection'), { recursive: true });
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: join(root, 'evidence/connection/wrangler.log') } });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw Error('The connection deployment did not finish');
  await writeFile(join(destination, 'deployment.json'), JSON.stringify({ commit: receipt.commit, hashes, finishedAt: new Date().toISOString(), temporarySetup: !!process.env.CABIN_SETUP_URL }, null, 2));
}
