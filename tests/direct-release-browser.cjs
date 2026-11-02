const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
// Exercise the actual Build 058 configuration. Unlike the retained Build 059
// fixtures, this never replaces config.js or chooses a test transport.
module.exports = async (browser, { BASE_URL, passed }) => {
  const { seedProgress, berlinDateKey } = await import(pathToFileURL(path.join(__dirname, '..', 'progress.js')).href);
  for (const mode of [null, 'direct', 'managed', 'old-return']) {
    const context = await browser.newContext(), page = await context.newPage();
    const errors = [], cloudflare = [], writes = [];
    let down = false, googleCalls = 0;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('https://**/*', route => route.abort());
    await context.route('https://**.workers.dev/**', route => { cloudflare.push(route.request().url()); return route.abort(); });
    await context.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'text/javascript', body: 'window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:"direct-release-fixture",expires_in:3600})})}}};' }));
    const initial = seedProgress(berlinDateKey());
    initial.days[berlinDateKey()] = { poem: true, story: false, essay: false };
    const journal = JSON.stringify({ retainedForBuild059: true });
    await page.addInitScript(({ mode, initial, journal }) => {
      if (!sessionStorage.getItem('direct-release-seeded')) {
        localStorage.setItem('cabin-progress', JSON.stringify(initial));
        localStorage.setItem('cabin-reading', JSON.stringify({ last: 'ohenry-magi', places: {} }));
        if (mode !== null) localStorage.setItem('cabin-drive-mode', mode === 'old-return' ? 'managed' : mode);
        localStorage.setItem('cabin-connection', 'A'.repeat(43));
        localStorage.setItem('cabin-connection-edits', journal);
        sessionStorage.setItem('direct-release-seeded', 'yes');
      }
      document.addEventListener('DOMContentLoaded', () => { for (const d of document.querySelectorAll('details')) d.open = true; });
    }, { mode, initial, journal });
    await context.route('https://www.googleapis.com/**', route => {
      googleCalls++;
      if (down) return route.fulfill({ status: 503, body: 'Temporarily unavailable' });
      const request = route.request(), url = new URL(request.url()), query = url.searchParams.get('q') || '';
      const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (request.method() !== 'GET') { writes.push(JSON.parse(request.postData())); return json({ id: 'P' }); }
      if (query.includes("name = 'Bradbury Cabin'")) return json({ files: [{ id: 'F', name: 'Bradbury Cabin' }] });
      if (query.includes("name = 'progress.json'")) return json({ files: [{ id: 'P', name: 'progress.json' }] });
      if (url.searchParams.get('alt') === 'media') return json(initial);
      return json({ files: [] });
    });
    try {
      await page.goto(BASE_URL + (mode === 'old-return' ? '#cabin-pair=' + 'B'.repeat(43) : ''));
      await page.waitForFunction(() => document.querySelector('#place').textContent.includes('Page'));
      await page.locator('#night').click(); await page.locator('#next').click();
      const before = await page.evaluate(() => ({ reading: JSON.parse(localStorage.getItem('cabin-reading')), controls: JSON.parse(localStorage.getItem('cabin-controls')) }));
      assert.equal(before.controls.night, true);
      assert.ok(before.reading.places[before.reading.last].page > 0);
      await page.locator('#drive-sync:not([disabled])').click();
      await page.waitForFunction(() => !document.querySelector('#drive-sync').disabled);
      assert.ok(googleCalls > 0); assert.ok(writes.length > 0, 'the real release must write through the established Google transport');
      const saved = writes.at(-1);
      assert.equal(saved.days[berlinDateKey()].poem, true);
      assert.deepEqual(saved.headset.reading, before.reading); assert.equal(saved.headset.controls.night, true);
      assert.deepEqual(cloudflare, [], 'neither an old mode, credential nor callback may enable Cloudflare in Build 058');
      assert.equal(await page.evaluate(() => localStorage.getItem('cabin-connection-edits')), journal, 'deferred connection data must be retained without using it');
      passed(`Build 058 direct release (${mode ?? 'fresh'}): tap-to-Sync saves the complete Google copy with no Cloudflare request`);
      down = true;
      await page.locator('#night').click();
      await page.waitForTimeout(1900);
      await page.locator('#drive-sync:not([disabled])').click();
      await page.waitForFunction(() => !document.querySelector('#drive-sync').disabled);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cabin-backup-outbox')).acknowledged), false);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#place').textContent.includes('Page'));
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cabin-controls')).night), false);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cabin-reading'))), before.reading);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cabin-backup-outbox')).acknowledged), false);
      assert.deepEqual(cloudflare, []); assert.deepEqual(errors, []);
      passed(`Build 058 direct release (${mode ?? 'fresh'}): Google failure and reopening preserve the saved place, settings and pending backup`);
    } finally { await context.close(); }
  }
};
