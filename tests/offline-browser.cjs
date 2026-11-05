const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CABIN_PLAYWRIGHT_PATH || 'playwright');

// A real service worker, disk profile and fresh Chromium process. HTTP cache
// is disabled by server headers; account APIs never enter the offline cache.
module.exports = async function offlineChecks(browser, { out, passed }) {
  const root = path.join(__dirname, '..');
  const { STATIC_ASSETS } = await import(pathToFileURL(path.join(root, 'static-assets.mjs')).href);
  const { makeOfflineEdition, manifestSource } = await import(pathToFileURL(path.join(root, 'tools/generate-offline.mjs')).href);
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(root, 'source-catalogue.js')).href);
  const { berlinDateKey } = await import(pathToFileURL(path.join(root, 'progress.js')).href);
  const date = berlinDateKey(), excluded = new Set(['blake-sick-rose', 'whitman-astronomer', 'whitman-captain', 'ohenry-magi', 'chopin-desiree', 'bacon-studies', 'bacon-truth']);
  const works = ['poem', 'story', 'essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !excluded.has(w.id)));
  const current = `today-${date}-story-${works[1].id}`;
  const files = new Map(await Promise.all(STATIC_ASSETS.filter(n => n !== 'offline-manifest.js').map(async n => [n, await fs.readFile(path.join(root, n))])));
  const editions = {};
  for (const label of ['A', 'B', 'C']) {
    const app = Buffer.concat([files.get('app.js'), Buffer.from(`\n// offline fixture edition ${label}\n`)]);
    const edition = await makeOfflineEdition(async n => n === 'app.js' ? app : files.get(n));
    editions[label] = { app, manifest: manifestSource(edition), digest: edition.digest };
  }
  let label = 'A', failure = null;
  const requests = [];
  const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', md: 'text/plain', txt: 'text/plain', ttf: 'font/ttf' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/cabin/')) return res.writeHead(404).end();
    const name = url.pathname.slice('/cabin/'.length) || 'index.html'; requests.push(name);
    if (failure === 'network' && name === 'assets/Literata.ttf') return res.writeHead(503).end();
    let body = name === 'offline-manifest.js' ? editions[label].manifest : name === 'app.js' ? editions[label].app : files.get(name);
    if (failure === 'integrity' && name === 'library.js') body = Buffer.concat([body, Buffer.from('\n// incomplete update\n')]);
    if (body == null) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[name.split('.').pop()], 'Cache-Control': 'no-store' }); res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/cabin/`;
  // Chromium's Windows cache files exceed MAX_PATH beneath a long checkout.
  // Use a short, disposable OS-temp profile; close and remove it in finally.
  const profile = await fs.mkdtemp(path.join(tmpdir(), 'cabin-offline-'));
  let context, p;
  const errors = [];
  const open = async offline => {
    context = await chromium.launchPersistentContext(profile, { headless: true, ...(process.env.CABIN_CHROMIUM_PATH ? { executablePath: process.env.CABIN_CHROMIUM_PATH } : {}) });
    await context.setOffline(offline);
    await context.route('https://accounts.google.com/**', r => r.abort());
    p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(url); await p.waitForFunction(() => document.querySelector('#place').textContent.includes('Page'));
  };
  const controlled = () => p.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const state = () => p.evaluate(() => Object.fromEntries(['cabin-progress', 'cabin-reading', 'cabin-controls', 'cabin-today'].map(k => [k, JSON.parse(localStorage.getItem(k) || 'null')])));
  const appLabel = () => p.evaluate(() => fetch('app.js?v=offline-check').then(r => r.text()).then(t => /offline fixture edition ([ABC])/.exec(t)?.[1]));
  const cacheKeys = () => p.evaluate(() => caches.keys());
  const waitForFailedUpdate = () => p.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Update did not fail as expected')), 40000);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker.addEventListener('statechange', () => { if (worker.state === 'redundant') { clearTimeout(timer); resolve(); } });
      }, { once: true });
      try { await registration.update(); } catch (e) { clearTimeout(timer); reject(e); }
    });
  });
  const waitForWaiting = () => p.evaluate(() => new Promise((resolve, reject) => {
    const deadline = Date.now() + 40000;
    const poll = async () => {
      if ((await navigator.serviceWorker.getRegistration())?.waiting?.state === 'installed') return resolve();
      if (Date.now() > deadline) return reject(Error('No complete waiting update'));
      setTimeout(poll, 25);
    }; poll();
  }));
  async function closeForUpdate(expected) {
    let worker;
    for (const candidate of context.serviceWorkers()) if (await candidate.evaluate(() => self.CABIN_OFFLINE?.digest).catch(() => null) === editions[expected].digest) worker = candidate;
    assert.ok(worker, 'the complete expected worker must exist');
    for (const page of context.pages()) await page.close();
    // Opening a new tab before activation would make it another old-edition
    // client. Observe the actual worker transition before opening that tab.
    const deadline = Date.now() + 30000;
    while (!await worker.evaluate(() => self.registration.active?.state === 'activated' && !self.registration.waiting).catch(() => false)) {
      if (Date.now() > deadline) throw Error('The waiting update did not activate after all old tabs closed');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  try {
    await open(false);
    await p.evaluate(({ date, works, current }) => {
      localStorage.setItem('cabin-today', JSON.stringify({ version: 2, date, picks: Object.fromEntries(works.map(w => [w.kind, { catalogueId: w.id }])) }));
      localStorage.setItem('cabin-reading', JSON.stringify({ last: current, places: { [current]: { anchor: { block: 1, word: 4, section: 'text' }, page: 1 } } }));
      localStorage.setItem('cabin-progress', JSON.stringify({ version: 1, start: '2026-10-18', trackingSince: '2026-10-18', days: { '2026-10-29': { poem: true } }, weeks: {}, feedback: { 'blake-sick-rose': { stars: { value: 4, at: '2026-10-30T12:00:00Z' }, thought: { value: 'Keep this thought.', at: '2026-10-30T12:00:00Z' } } }, unapprovedThoughtDrafts: { 'ohenry-magi': { value: 'Still checking this.', at: '2026-10-30T12:00:00Z', approved: false } } }));
      const progress = JSON.parse(localStorage.getItem('cabin-progress'));
      progress.days[date] = { ids: Object.fromEntries(works.map(w => [w.kind, w.id])), picks: Object.fromEntries(works.map(w => [w.kind, `${w.title} — ${w.author}`])), poem: true };
      localStorage.setItem('cabin-progress', JSON.stringify(progress));
    }, { date, works: works.map(({ id, title, author, kind }) => ({ id, title, author, kind })), current });
    await p.evaluate(async () => {
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(Error('Offline installation did not finish')), 40000))]);
    });
    await p.reload(); await controlled();
    assert.equal(await p.locator('#page').getAttribute('data-work'), current);
    await p.evaluate(() => { for (const details of document.querySelectorAll('details')) details.open = true; });
    await p.locator('#night').click(); await p.locator('#next').click();
    const saved = await state();
    const cachesA = await cacheKeys(); assert.equal(cachesA.length, 1);
    const cached = await p.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map(r => r.url));
    assert.equal(cached.length, STATIC_ASSETS.length - 1);
    assert.ok(cached.every(address => address.startsWith(url)), 'only public same-scope assets are cached');
    await context.close(); context = null;
    const before = requests.length;
    await open(true); await controlled();
    assert.equal(requests.length, before, 'cold offline opening makes no successful server requests');
    assert.equal(await appLabel(), 'A'); assert.equal(await p.locator('#page').getAttribute('data-work'), current);
    assert.equal(await p.locator('#night').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await state(), saved, 'all personal state survives a real browser-process restart');
    const catalogue = await p.evaluate(async () => (await import('./source-catalogue.js?cold')).SOURCE_CATALOGUE.length);
    assert.ok(catalogue > 30, 'complete source catalogue is available offline');
    passed('offline: a complete install opens after a browser-process restart without Wi-Fi and keeps reading places, settings, feedback and drafts');

    await context.setOffline(false); label = 'B'; failure = 'network'; await waitForFailedUpdate();
    assert.deepEqual(await cacheKeys(), cachesA, 'a failed update leaves only the old complete cache');
    await context.setOffline(true); await p.reload(); await controlled(); assert.equal(await appLabel(), 'A'); assert.deepEqual(await state(), saved);
    passed('offline: an interrupted update retains the working edition and every personal change');

    await context.setOffline(false); label = 'C'; failure = 'integrity'; await waitForFailedUpdate();
    assert.deepEqual(await cacheKeys(), cachesA, 'wrong bytes cannot become an installed edition');
    assert.equal(await appLabel(), 'A'); assert.deepEqual(await state(), saved);
    passed('offline: a mismatched update is refused without replacing good reading files');

    label = 'B'; failure = null;
    await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await waitForWaiting();
    assert.equal(await appLabel(), 'A', 'complete update waits for the open reader to close');
    assert.deepEqual(await state(), saved);
    // Closing every page releases the old worker; it must never be forced out
    // while a reader is still open.
    await closeForUpdate('B');
    p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(url); await controlled();
    await p.waitForFunction(() => document.querySelector('#place').textContent.includes('Page'));
    assert.equal(await appLabel(), 'B'); assert.deepEqual(await state(), saved);
    await context.close(); context = null; await open(true); await controlled(); assert.equal(await appLabel(), 'B'); assert.deepEqual(await state(), saved);
    passed('offline: a complete update waits for the reader to close, then works cold offline with the same personal state');

    await context.setOffline(false); label = 'A';
    await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await waitForWaiting();
    await closeForUpdate('A');
    p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(url); await controlled(); await p.waitForFunction(() => document.querySelector('#place').textContent.includes('Page'));
    assert.equal(await appLabel(), 'A'); assert.deepEqual(await state(), saved);
    assert.deepEqual(errors, []);
    passed('offline: restoring the previous source edition preserves current progress, thoughts, drafts, places and settings');

    assert.equal(await p.locator('#update-ready').isHidden(), true, 'no restart is offered without a complete waiting update');
    label = 'B';
    await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await waitForWaiting();
    await p.locator('#update-ready').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await appLabel(), 'A', 'a complete update still waits until the reader chooses to restart');
    await Promise.all([p.waitForEvent('load'), p.locator('#update-ready').click()]);
    await controlled(); await p.waitForFunction(() => document.querySelector('#place').textContent.includes('Page'));
    assert.equal(await appLabel(), 'B'); assert.deepEqual(await state(), saved);
    assert.equal(await p.locator('#update-ready').isHidden(), true, 'the offer disappears once the new edition is running');
    assert.deepEqual(errors, []);
    passed('offline: a complete update is offered as "New readings ready", and the reader\'s tap restarts into it with the same personal state');
  } catch (error) {
    if (p && !p.isClosed()) console.error('Offline diagnostic', await p.evaluate(async () => ({ url: location.href, controller: navigator.serviceWorker.controller?.scriptURL, registrations: await Promise.all((await navigator.serviceWorker.getRegistrations()).map(async r => ({ scope: r.scope, active: r.active?.state, waiting: r.waiting?.state, installing: r.installing?.state }))), caches: await caches.keys() })).catch(() => null), requests.slice(-12));
    throw error;
  } finally {
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(profile, { recursive: true, force: true });
  }
};
