// Only a complete, verified static edition can become the offline reader.
// Personal data and Google responses are never put in this cache.
importScripts('./offline-manifest.js');
const scope = new URL(self.registration.scope);
const prefix = `bradbury-static:${scope.pathname}:`;
const edition = self.CABIN_OFFLINE;
const cacheName = prefix + edition.digest;
const addresses = new Map(edition.assets.map(asset => [new URL(asset.path, scope).href, asset]));
async function sha256(bytes, text) {
  // Git checkouts use CRLF on Windows and LF on Linux; original-text checks
  // remain independent. Only checkout line endings are canonical here.
  const data = text ? new TextEncoder().encode(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n')) : bytes;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(v => v.toString(16).padStart(2, '0')).join('');
}
self.addEventListener('install', event => event.waitUntil((async () => {
  // An identical current edition is already complete; don't destroy it when
  // the browser refetches an otherwise identical worker.
  if (await caches.has(cacheName)) {
    const existing = await caches.open(cacheName);
    if ((await existing.keys()).length === addresses.size) return;
  }
  const cache = await caches.open(cacheName), controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 30000);
  try {
    const todo = [...addresses];
    const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
      try { while (todo.length) {
        const [url, asset] = todo.shift();
        const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: controller.signal });
        if (!response.ok || response.type === 'opaque') throw Error('Offline copy incomplete');
        const bytes = await response.clone().arrayBuffer();
        if (await sha256(bytes, asset.text) !== asset.sha256) throw Error('Offline copy does not match');
        await cache.put(url, response);
      } } catch (error) { controller.abort(); throw error; }
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  } finally { clearTimeout(deadline); }
  // No automatic skipWaiting: the current edition stays in place until its
  // tabs close, or until the reader taps "New readings ready · Restart".
})()));
self.addEventListener('message', event => {
  if (event.data === 'restart-into-new-edition') self.skipWaiting();
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  const earlier = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName);
  // Preserve the immediately previous complete edition as well.
  for (const name of earlier.slice(0, -1)) await caches.delete(name);
  // No clients.claim: never replace an open page underneath the reader.
})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin) return;
  url.search = ''; url.hash = '';
  if (url.href === scope.href) url.pathname += 'index.html';
  if (!addresses.has(url.href)) return;
  event.respondWith((async () => (await (await caches.open(cacheName)).match(url.href)) || fetch(event.request))());
});
