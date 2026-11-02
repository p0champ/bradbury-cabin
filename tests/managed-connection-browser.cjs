const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
module.exports = async (browser, { mock, BASE_URL, passed }) => {
  const { connectionFixture } = await import(pathToFileURL(path.join(__dirname, 'connection-browser-fixture.mjs')).href);
  const { berlinDateKey, seedProgress } = await import(pathToFileURL(path.join(__dirname, '..', 'progress.js')).href);
  const contexts = [];
  const makePage = async (fixture, { credentials, xr = true, seed } = {}) => {
    const context = await browser.newContext(); contexts.push(context); await fixture.routeContext(context);
    const page = await context.newPage(), errors = []; let loads = 0; page.on('load', () => loads++); page.on('pageerror', error => errors.push(error.message));
    if (xr) await mock(page, 'layer', false, { practised: true, headPointer: true }, 'managed');
    await page.addInitScript(({ credentials, seed }) => {
      localStorage.setItem('cabin-drive-mode', 'managed');
      if (!sessionStorage.getItem('managed-fixture-seeded')) {
        if (credentials) { localStorage.setItem('cabin-connection', credentials.token); localStorage.setItem('cabin-connection-device', credentials.device); }
        if (seed?.controls) localStorage.setItem('cabin-controls', JSON.stringify(seed.controls));
        if (seed?.reading) localStorage.setItem('cabin-reading', JSON.stringify(seed.reading));
        sessionStorage.setItem('managed-fixture-seeded', '1');
      }
      document.addEventListener('DOMContentLoaded', () => { for (const detail of document.querySelectorAll('details')) detail.open = true; });
      const every = window.setInterval; window.__managedMinute = [];
      window.setInterval = (fn, ms, ...args) => { if (ms === 60000) __managedMinute.push(fn); return every(fn, ms, ...args); };
      window.__managedWords = [];
      const fill = CanvasRenderingContext2D.prototype.fillRect, draw = CanvasRenderingContext2D.prototype.fillText;
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function(x,y,w,h) { if (this.canvas.id === 'page' && x === 0 && y === 0 && w === 2048 && h === 2560) __managedWords = []; return clear.call(this,x,y,w,h); };
      CanvasRenderingContext2D.prototype.fillRect = function(x,y,w,h) { if (this.canvas.id === 'page' && w === 2048 && h === 2560) __managedWords = []; return fill.call(this,x,y,w,h); };
      CanvasRenderingContext2D.prototype.fillText = function(text,...args) { if (this.canvas.id === 'page') __managedWords.push(String(text)); return draw.call(this,text,...args); };
    }, { credentials, seed });
    const settled = () => page.waitForFunction(() => JSON.parse(localStorage.getItem('cabin-backup-outbox') || 'null')?.acknowledged === true, null, { timeout: 30000 });
    const minute = async () => { await page.bringToFront(); await page.evaluate(() => Promise.all(__managedMinute.map(fn => fn()))); };
    await page.goto(BASE_URL);
    return { page, context, errors, settled, minute, loads: () => loads };
  };
  const close = async t => { assert.deepEqual(t.errors, []); await t.context.close(); contexts.splice(contexts.indexOf(t.context), 1); };
  {
    const fixture = await connectionFixture(BASE_URL); let t;
    try {
      const credentials = await fixture.authorise(); t = await makePage(fixture, { credentials, seed: { reading: { last: 'ohenry-magi', places: {} } } });
      const { page } = t; await t.settled(); await page.waitForTimeout(1800); await t.settled();
      fixture.setAPI('html-limit'); await page.locator('#night').click(); await page.locator('#next').click(); await page.waitForTimeout(2100);
      const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('cabin-backup-outbox')));
      assert.equal(queued.acknowledged, false); assert.equal(JSON.parse(queued.payload).headset.controls.night, true);
      const place = JSON.parse(queued.payload).headset.reading; assert.equal(place.places[place.last].page, 1);
      await page.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(Error('The complete offline edition did not install')), 40000))]).then(() => undefined));
      fixture.setAPI('offline'); await t.context.setOffline(true); await page.reload(); await page.waitForTimeout(600); assert.equal(await page.locator('#night').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cabin-backup-outbox')).acknowledged), false);
      assert.equal(await page.evaluate(() => localStorage.getItem('cabin-connection')), credentials.token);
      passed('managed connection: Cloudflare limit pages leave reading, the saved page and the durable pending backup intact after reopening');
      fixture.setAPI('normal'); await t.context.setOffline(false); await page.evaluate(() => dispatchEvent(new Event('online'))); await t.settled();
      const restored = await fixture.state(credentials.token); assert.equal(restored.state.headset.controls.night, true); assert.equal(restored.state.headset.reading.places[place.last].page, 1);
      const download = page.waitForEvent('download'); await page.locator('#progress-export').click();
      const exported = await fs.readFile(await (await download).path(), 'utf8');
      assert.equal(exported.includes(credentials.token), false); assert.equal(exported.includes(credentials.device), false); assert.equal(exported.includes('fixture-refresh'), false);
      passed('managed connection: returning service retries the complete backup, and exports never contain connection or Google credentials');
      await close(t); t = null;
    } finally { if (t) await t.context.close(); await fixture.dispose(); }
  }
  {
    const fixture = await connectionFixture(BASE_URL); let t;
    try {
      const credentials = await fixture.authorise(); t = await makePage(fixture, { credentials }); await t.settled();
      fixture.setGoogle('limit'); await t.page.locator('#night').click(); await t.page.waitForTimeout(1800); await t.settled(); await fixture.mirror(credentials.token);
      const saved = await fixture.state(credentials.token); assert.equal(saved.state.headset.controls.night, true); assert.equal(saved.driveCurrent, false); assert.equal(saved.mirrorProblem.code, 'unavailable');
      await t.minute(); assert.equal(await t.page.evaluate(() => JSON.parse(localStorage.getItem('cabin-backup-outbox')).acknowledged), true);
      fixture.setGoogle('normal'); await fixture.mirror(credentials.token); await t.minute();
      assert.equal((await fixture.state(credentials.token)).driveCurrent, true); assert.equal(fixture.writes.at(-1).headset.controls.night, true);
      passed('managed connection: Google failure still permits a checked private backup; Drive catches up only after its full copy is read back');
      await close(t); t = null;
    } finally { if (t) await t.context.close(); await fixture.dispose(); }
  }
  {
    const fixture = await connectionFixture(BASE_URL); let t;
    try {
      const credentials = await fixture.authorise(); t = await makePage(fixture, { credentials }); await t.settled();
      fixture.holdNextBackup(); await t.page.locator('#night').click();
      for (let i = 0; i < 80 && !fixture.held(); i++) await t.page.waitForTimeout(100); assert.ok(fixture.held());
      const sent = await t.page.evaluate(() => JSON.parse(localStorage.getItem('cabin-backup-outbox')).id);
      await t.page.evaluate(() => { const volume = document.querySelector('#ambience-volume'); volume.value = '41'; volume.dispatchEvent(new Event('input', { bubbles: true })); });
      await t.page.waitForTimeout(1800);
      assert.notEqual(await t.page.evaluate(() => JSON.parse(localStorage.getItem('cabin-backup-outbox')).id), sent);
      fixture.release(); await t.page.waitForTimeout(400); await t.minute(); await t.settled();
      const state = await fixture.state(credentials.token); assert.equal(state.state.headset.controls.night, true); assert.equal(state.state.headset.controls.ambienceVolume, 0.41, 'the 41% control is stored as its full normalized value');
      passed('managed connection: a late acknowledgement cannot clear a newer settings edit, including when its first retry ran during the older save');
      await close(t); t = null;
    } finally { if (t) await t.context.close(); await fixture.dispose(); }
  }
  {
    const today = berlinDateKey(), initial = seedProgress(today);
    const reading = { last: 'ohenry-magi', places: { 'ohenry-magi': { anchor: { block: 3, word: 4 }, page: 1 }, 'bacon-truth': { anchor: { block: 6, word: 4 }, page: 2 } } };
    initial.headset = { reading, controls: { handMapRevision: 9, swapped: true, size: 2, night: true, practised: true } };
    const at = '2026-10-30T12:00:00.000Z', gift = 'edgar-allan-poe-the-tell-tale-heart';
    initial.completedWorks = { 'blake-sick-rose': at };
    initial.feedback = { 'blake-sick-rose': { stars: { value: 4, at }, thought: { value: null, at } } };
    initial.unapprovedThoughtDrafts = { 'ohenry-magi': { value: 'Still deciding what I think.\nThis is an unsaved draft.', at, approved: false } };
    initial.rewards = { awards: { 'streak-7': { at, catalogueId: gift } }, unlocked: { [gift]: at }, seen: { 'streak-7': at } };
    const fixture = await connectionFixture(BASE_URL, { initial }); let t;
    try {
      for (const returning of [false, true]) {
        const credentials = await fixture.authorise();
        t = await makePage(fixture, { credentials, xr: false, ...(returning ? { seed: { controls: { handMapRevision: 9, swapped: false, size: 1, night: false, practised: true }, reading: { last: 'bacon-truth', places: { 'bacon-truth': { anchor: { block: 20, word: 1 }, page: 7 } } } } } : {}) });
        await t.settled(); await t.page.waitForTimeout(1800); await t.settled();
        const restored = await t.page.evaluate(() => ({ progress: JSON.parse(localStorage.getItem('cabin-progress')), reading: JSON.parse(localStorage.getItem('cabin-reading')), controls: JSON.parse(localStorage.getItem('cabin-controls')) }));
        assert.equal(restored.progress.headset, undefined);
        for (const key of ['completedWorks', 'feedback', 'unapprovedThoughtDrafts', 'rewards']) assert.deepEqual(restored.progress[key], initial[key], `complete private restoration must retain ${key}`);
        if (!returning) { assert.deepEqual(restored.reading, reading); assert.equal(restored.controls.night, true); assert.equal(restored.controls.size, 2); assert.equal(t.loads(), 2); }
        else { assert.equal(restored.reading.last, 'bacon-truth'); assert.equal(restored.reading.places['bacon-truth'].page, 7); assert.ok(restored.reading.places['ohenry-magi']); assert.equal(restored.controls.night, false); assert.equal(restored.controls.size, 1); assert.equal(t.loads(), 1); }
        await close(t); t = null;
      }
      passed('managed connection: an empty browser restores all places and settings once; an existing browser keeps its own place and choices');
    } finally { if (t) await t.context.close(); await fixture.dispose(); }
  }
  {
    const today = berlinDateKey(), fixture = await connectionFixture(BASE_URL); let t;
    try {
      const credentials = await fixture.authorise(); t = await makePage(fixture, { credentials, seed: { reading: { last: 'ohenry-magi', places: {} } } }); await t.settled();
      await t.page.locator('#enter:not([disabled])').click(); await t.page.evaluate(() => __center());
      if (await t.page.locator('#page').getAttribute('data-view') === 'menu') await t.page.evaluate(() => __hold());
      await t.page.evaluate(() => { __step(2000); __pinch(); __step(2000); }); await t.page.waitForTimeout(1800); await t.settled();
      await t.page.evaluate(() => __step(2000));
      assert.equal(await t.page.locator('#page').getAttribute('data-view'), 'reading');
      assert.ok(await t.page.evaluate(() => JSON.parse(localStorage.getItem('cabin-reading')).places['ohenry-magi'].page > 0), 'the reader must have really turned past the first page');
      const before = await t.page.evaluate(() => [...__managedWords]), count = fixture.requestPaths.filter(path => path === '/picks').length, renewals = fixture.renewals(); let popups = 0;
      t.page.on('popup', () => popups++); await fixture.expireAccess(credentials.token); fixture.addPicks(); await t.minute(); await t.settled();
      assert.ok(fixture.renewals() > renewals, 'the server must renew the expired Google access'); assert.equal(popups, 0);
      let day = await t.page.evaluate(today => JSON.parse(localStorage.getItem('cabin-progress')).days[today], today);
      assert.equal(day.ids.poem, fixture.works.poem.id); assert.equal(day.ids.story, fixture.works.story.id); assert.equal(day.ids.essay, fixture.works.essay.id);
      assert.deepEqual(await t.page.evaluate(() => [...__managedWords]), before);
      fixture.addPicks(fixture.works.swapPoem); await t.minute(); await t.settled();
      day = await t.page.evaluate(today => JSON.parse(localStorage.getItem('cabin-progress')).days[today], today);
      assert.equal(day.ids.poem, fixture.works.swapPoem.id); assert.equal(day.ids.story, fixture.works.story.id); assert.equal(day.ids.essay, fixture.works.essay.id); assert.deepEqual(await t.page.evaluate(() => [...__managedWords]), before);
      const changed = fixture.requestPaths.filter(path => path === '/picks').length; assert.equal(changed, count + 2); await t.minute(); assert.equal(fixture.requestPaths.filter(path => path === '/picks').length, changed);
      passed('managed connection: expired Google access renews without a popup; the daily three and a poem swap arrive on the minute without moving the reading page');
      const pageBefore = await t.page.evaluate(() => JSON.parse(localStorage.getItem('cabin-reading')).places['ohenry-magi'].page);
      await t.page.evaluate(() => { __step(2000); __hand(0.05); __step(600); __hand(0.012); __native('selectstart'); __step(100); });
      await t.page.locator('#drive-sync:not([disabled])').click();
      await t.page.waitForFunction(() => !document.querySelector('#drive-sync').disabled); await t.settled();
      await t.page.evaluate(() => { __step(140); __hand(0.05); __native('select'); __native('selectend'); __step(2000); });
      assert.equal(await t.page.evaluate(() => JSON.parse(localStorage.getItem('cabin-reading')).places['ohenry-magi'].page), pageBefore + 1, 'a no-op private read and acknowledgement must not cancel an already held native pinch');
      passed('managed connection: a routine private save does not cancel a page turn already held by the reader');
      await close(t); t = null;
    } finally { if (t) await t.context.close(); await fixture.dispose(); }
  }
  for (const allow of [true, false]) {
    const fixture = await connectionFixture(BASE_URL); let t, popup;
    try {
      t = await makePage(fixture); await t.page.waitForFunction(() => !document.querySelector('#enter').disabled);
      const popupEvent = t.context.waitForEvent('page').catch(async error => { throw Error(error.message + '\nReader status: ' + await t.page.locator('#status').textContent() + '\nPage failures: ' + JSON.stringify(t.errors) + '\nService paths: ' + JSON.stringify(fixture.requestPaths)); }); await t.page.locator('#drive-sync:not([disabled])').click(); popup = await popupEvent;
      if (allow) {
        await popup.locator('#allow').click({ noWaitAfter: true }).catch(error => { if (!popup.isClosed()) throw error; });
        await t.settled(); assert.ok(await t.page.evaluate(() => /^[A-Za-z0-9_-]{43}$/.test(localStorage.getItem('cabin-connection') || '')));
        assert.equal(new URL(t.page.url()).hash, '');
        if (!popup.isClosed()) {
          assert.equal(new URL(popup.url()).hash, ''); assert.match(await popup.locator('#status').textContent(), /connected/);
          assert.equal(await popup.locator('#enter').isDisabled(), true, 'a return tab must not become a second reader sharing unfinished saves');
        }
        passed('managed connection: actual browser sign-in completes through the checked callback even when Google severs the popup opener');
      } else {
        await popup.locator('#decline').click({ noWaitAfter: true }); await t.page.waitForFunction(() => !document.querySelector('#drive-sync').disabled && document.querySelector('#status').textContent.includes('closed'));
        assert.equal(await t.page.evaluate(() => localStorage.getItem('cabin-connection')), null); assert.ok(await t.page.evaluate(() => JSON.parse(localStorage.getItem('cabin-progress')).days));
        passed('managed connection: declining Google returns a calm note without removing local reading data or inventing a connection');
      }
      if (popup && !popup.isClosed()) await popup.close(); popup = null; await close(t); t = null;
    } finally { if (popup) await popup.close().catch(() => {}); if (t) await t.context.close(); await fixture.dispose(); }
  }
  {
    const { setupServer } = await import(pathToFileURL(path.join(__dirname, '..', 'tools/setup-connection.mjs')).href);
    const server = setupServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = `http://127.0.0.1:${server.address().port}/`, fixture = await connectionFixture(address), context = await browser.newContext();
    let popup;
    try {
      await fixture.routeContext(context); const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(address); const opened = context.waitForEvent('page'); await page.locator('#connect').click(); popup = await opened;
      await popup.locator('#allow').click({ noWaitAfter: true }).catch(error => { if (!popup.isClosed()) throw error; });
      await page.locator('#check:not([disabled])').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Your complete backup was read'));
      assert.equal(fixture.writes.length,0,'the disposable probe must leave the real progress file untouched');
      await page.locator('#fallback:not([disabled])').click();
      for(let attempt=0;attempt<100&&!fixture.recoveryFiles().length;attempt++)await page.waitForTimeout(50);
      assert.equal(fixture.recoveryFiles().length,1);await fixture.mirror(await page.evaluate(()=>localStorage.getItem('cabin-connection')));
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Your reading data matches'));
      assert.equal(fixture.recoveryFiles().length,1);
      const download = page.waitForEvent('download'); await page.locator('#download').click();
      const exported = await fs.readFile(await (await download).path(), 'utf8');
      const privateCopy = await fixture.state(await page.evaluate(() => localStorage.getItem('cabin-connection')));
      assert.deepEqual(JSON.parse(exported), privateCopy.state);
      assert.equal(JSON.parse(exported).version, 1); assert.equal(exported.includes('fixture-refresh'), false); assert.ok(fixture.writes.length>0,'the real main backup must also pass checked publication');
      await page.locator('#disconnect').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('This setup page is disconnected'));
      assert.equal(await page.evaluate(() => localStorage.getItem('cabin-connection')), null); assert.equal(await page.locator('#download').isDisabled(), true); assert.deepEqual(errors, []);
      passed('managed connection: the local owner setup renews Google, checks a disposable file and the complete direct safety backup, downloads the private backup and revokes only its own setup access');
    } finally { if (popup && !popup.isClosed()) await popup.close(); await context.close(); await fixture.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
  assert.equal(contexts.length, 0);
};
