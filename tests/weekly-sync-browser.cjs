const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
module.exports = async (browser, { mock, BASE_URL, passed }) => {
  const { berlinDateKey, weekSunday } = await import(pathToFileURL(path.join(__dirname, '..', 'progress.js')).href);
  const today = berlinDateKey(), week = weekSunday(today);
  const base = { version: 1, start: '2026-10-18', trackingSince: '2026-10-18', days: {}, weeks: { [week]: { submitted: true } }, savedAt: '2026-10-30T12:00:00Z' };
  const p = await browser.newPage(), errors = [], writes = [];
  p.on('pageerror', e => errors.push(e.message));
  await mock(p, 'layer', false, { practised: true, headPointer: true });
  let remote = JSON.stringify(base);
  await p.route('https://accounts.google.com/**', route => route.abort());
  await p.route('https://www.googleapis.com/**', route => {
    const req = route.request(), url = new URL(req.url()), json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() !== 'GET') { remote = req.postData(); writes.push(JSON.parse(remote)); return json({ id: 'P' }); }
    if (url.searchParams.get('alt') === 'media') return route.fulfill({ contentType: 'application/json', body: remote });
    const q = url.searchParams.get('q') || '';
    return json({ files: q.includes('progress.json') ? [{ id: 'P' }] : q.includes("name = 'Bradbury Cabin'") ? [{ id: 'F' }] : [] });
  });
  await p.addInitScript(base => {
    if (!sessionStorage.getItem('weekly-seeded')) { localStorage.setItem('cabin-progress', JSON.stringify(base)); sessionStorage.setItem('weekly-seeded', '1'); }
    sessionStorage.setItem('cabin-google-token', JSON.stringify({ token: 'fixture-only', read: true, expires: Date.now() + 3600000 }));
  }, base);
  const settled = () => p.waitForFunction(() => JSON.parse(localStorage.getItem('cabin-backup-outbox') || 'null')?.acknowledged === true);
  const target = id => p.evaluate(async id => { await __aim(id); __pinch(); __step(700); }, id);
  try {
    await p.goto(BASE_URL); await settled();
    await p.locator('#enter').click(); await p.evaluate(() => __center());
    if (await p.locator('#page').getAttribute('data-view') !== 'menu') await p.evaluate(() => __hold());
    await p.evaluate(async () => { await __navigate('calendar'); __pinch(); __step(700); });
    await target(`day:${today}`); await target('weekly');
    assert.equal(await p.evaluate(week => JSON.parse(localStorage.getItem('cabin-progress')).weeks[week]?.submitted, week), false, 'an untick must be an explicit saved false');
    await p.waitForTimeout(1800); await settled();
    assert.equal(writes.at(-1).weeks[week]?.submitted, false, 'automatic merge must not revive the old true');
    // Another old copy arrives after this acknowledgement. Reopening must
    // retain the local explicit removal while merging that older copy.
    const beforeReload = writes.length;
    remote = JSON.stringify(base); await p.reload();
    for (let i = 0; i < 100 && writes.length <= beforeReload; i++) await p.waitForTimeout(100);
    assert.ok(writes.length > beforeReload, 'reopening must complete a new sync before the assertion');
    await settled();
    assert.equal(await p.evaluate(week => JSON.parse(localStorage.getItem('cabin-progress')).weeks[week]?.submitted, week), false);
    assert.equal(JSON.parse(remote).weeks[week]?.submitted, false);
    assert.deepEqual(errors, []);
    passed('weekly story: unticking survives automatic backup and reopening against an older Drive copy');
  } finally { await p.close(); }
};
