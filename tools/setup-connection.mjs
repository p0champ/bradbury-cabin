// Owner setup only: loopback, explicit static files, no credential proxy.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { STATIC_ASSETS } from '../static-assets.mjs';
import { CONNECTION_URL } from '../config.js';
const root = new URL('../', import.meta.url), allowed = new Set(STATIC_ASSETS);
export function setupServer() {
  return http.createServer(async (request, response) => {
    const origin = `http://127.0.0.1:${request.socket.localPort}`;
    if (request.headers.host !== new URL(origin).host || (request.headers.origin && request.headers.origin !== origin)) return response.writeHead(403).end();
    if (request.method !== 'GET') return response.writeHead(405).end();
    let path; try { path = new URL(request.url, origin).pathname; } catch { return response.writeHead(400).end(); }
    const name = path === '/' ? 'tools/connection-setup/index.html' : path === '/setup.js' ? 'tools/connection-setup/setup.js' : path.slice(1);
    if (!['tools/connection-setup/index.html', 'tools/connection-setup/setup.js'].includes(name) && !allowed.has(name)) return response.writeHead(404).end();
    try {
      const body = await readFile(new URL(name, root));
      response.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': `default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com; connect-src 'self' ${new URL(CONNECTION_URL).origin} https://www.googleapis.com https://openidconnect.googleapis.com https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'` }); response.end(body);
    } catch { response.writeHead(404).end(); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  execFileSync(process.execPath, ['tools/verify.mjs', '--receipt'], { cwd: fileURLToPath(root), stdio: 'inherit' });
  const server = setupServer();
  server.listen(Number(process.env.PORT || 18149), '127.0.0.1', () => console.log(`Owner setup: http://127.0.0.1:${server.address().port}/`));
}
