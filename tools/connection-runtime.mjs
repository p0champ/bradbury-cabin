// Pinned local Workers test/deployment tools. Missing tools fail the gate;
// they never silently skip private-backup or recovery checks.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(process.env.CABIN_WORKER_RUNTIME
  ? join(resolve(process.env.CABIN_WORKER_RUNTIME), 'package.json')
  : new URL('../package.json', import.meta.url));
export const { Miniflare, convertV4MiniflareOptions } = await import(pathToFileURL(require.resolve('miniflare')).href);
export const { build } = await import(pathToFileURL(require.resolve('esbuild')).href);
export const resolveConnectionTool = specifier => require.resolve(specifier);
