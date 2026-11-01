// Connection: explicit owner-only API; never an arbitrary Google proxy.
const MAX_BODY = 10000000;
const safeCodes = new Set(['connection', 'signin', 'pair', 'owner', 'busy', 'devices', 'google_reconnect', 'recovery', 'conflict', 'invalid']);
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const invalid = () => Object.assign(Error('Unreadable request'), { status: 400, code: 'invalid' });
async function bodyJSON(request) {
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) throw invalid();
  if (Number(request.headers.get('Content-Length')) > MAX_BODY || !request.body) throw invalid();
  const reader = request.body.getReader(), parts = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > MAX_BODY) { await reader.cancel(); throw invalid(); } parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); if (!plain(value)) throw Error(); return value; }
  catch { throw invalid(); }
}
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') throw invalid();
  const parsed = new Date(value + 'T00:00:00Z'); if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw invalid();
  return value;
};
export class ConnectionService {
  constructor({ authority, backups, files, verifyConnection }) { this.authority = authority; this.backups = backups; this.files = files; this.verifyConnection = verifyConnection; }
  async fetch(request) {
    const origin = request.headers.get('Origin'), allowed = this.authority.google.config.origins;
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' });
    if (origin && allowed.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
    const json = (value, status = 200) => Response.json(value, { status, headers });
    if (origin && !allowed.has(origin)) return json({ code: 'origin', message: 'Return to the cabin to connect' }, 403);
    try {
      const url = new URL(request.url), path = url.pathname;
      if (request.method === 'OPTIONS') {
        if (!origin || !allowed.has(origin) || !['GET', 'POST'].includes(request.headers.get('Access-Control-Request-Method')) || (request.headers.get('Access-Control-Request-Headers') || '').split(',').some(h => h.trim() && !['authorization', 'content-type'].includes(h.trim().toLowerCase()))) return json({ code: 'origin' }, 403);
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type'); headers.set('Access-Control-Max-Age', '600');
        return new Response(null, { status: 204, headers });
      }
      if (path === '/health' && request.method === 'GET') return json({ service: 'Bradbury Cabin connection', ready: true });
      if (path === '/auth/begin' && request.method === 'GET') {
        const result = await this.authority.begin(url.searchParams.get('return'));
        headers.set('Location', result.url); headers.set('Set-Cookie', result.cookie); return new Response(null, { status: 303, headers });
      }
      if (path === '/auth/callback' && request.method === 'GET') {
        const result = await this.authority.callback(request);
        headers.set('Location', result.url); headers.set('Set-Cookie', result.cookie); return new Response(null, { status: 303, headers });
      }
      if (path === '/pair' && request.method === 'POST') {
        const body = await bodyJSON(request); return json(await this.authority.pair(body.code, body.device, origin));
      }
      const { device } = await this.authority.authenticate(request.headers.get('Authorization'));
      if (path === '/connection-check' && request.method === 'POST' && this.verifyConnection) return json(await this.verifyConnection());
      if (path === '/state' && request.method === 'GET') return json(await this.backups.state(device));
      if (path === '/backup' && request.method === 'POST') {
        const body = await bodyJSON(request);
        return json(await this.backups.save(device, { ...body, payload: JSON.stringify(body.state) }));
      }
      if (path === '/disconnect' && request.method === 'POST') { await this.authority.disconnect(request.headers.get('Authorization')); return json({ disconnected: true }); }
      if (path === '/stamp' && request.method === 'GET') return json({ stamp: await this.files.newestPicksStamp(date(url.searchParams.get('day'))) });
      if (path === '/picks' && request.method === 'GET') return json(await this.files.readPicks(date(url.searchParams.get('day'))));
      if (path === '/guide' && request.method === 'GET') return json(await this.files.readGuide(date(url.searchParams.get('day')), (url.searchParams.get('known') || '').slice(0, 500)));
      if (path === '/history' && request.method === 'GET') return json(await this.backups.snapshots.history());
      if (path === '/snapshot' && request.method === 'GET') {
        const history = await this.backups.snapshots.history(), id = url.searchParams.get('id');
        const root = [history.current, ...history.previous, ...Object.values(history.daily)].find(root => root?.id === id);
        if (!root) return json({ code: 'missing', message: 'That earlier backup is not available; the current copy is kept' }, 404);
        const snapshot = await this.backups.snapshots.readSnapshot(root);
        headers.set('Content-Type', 'application/json; charset=utf-8'); headers.set('Content-Disposition', 'attachment; filename="bradbury-progress-backup.json"');
        return new Response(snapshot.text, { headers });
      }
      return json({ code: 'missing', message: 'Return to the cabin to continue' }, 404);
    } catch (error) {
      const known = safeCodes.has(error?.code);
      return json({ code: known ? error.code : 'unavailable', message: known ? error.message : "The connection couldn't finish just now. Your changes are kept on this headset; you can keep reading." }, known && Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 503);
    }
  }
}
