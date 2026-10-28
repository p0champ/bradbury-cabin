const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function archiveChecks(browser, { mock, BASE_URL, out, passed }) {
  const { SOURCE_CATALOGUE } = await import('../source-catalogue.js');
  const { rememberGuides } = await import('../guide-archive.js');
  const wanted = ['william-blake-experience-the-tiger', 'kate-chopin-a-pair-of-silk-stockings', 'francis-bacon-of-travel'];
  const originals = wanted.map(id => SOURCE_CATALOGUE.find(w => w.id === id));
  const guide = { context: ['Saved introduction.'], notice: ['Look closely at the language.'], themes: ['Saved reflection.'], questions: ['Which detail stayed with you?'] };
  const base = () => ({ version: 1, start: '2026-10-18', trackingSince: '2026-10-18', days: {}, weeks: {}, savedAt: '2026-10-28T12:00:00Z' });
  const picksFor = (date, notes = true) => ({ version: 2, date, picks: Object.fromEntries(originals.map(w => [w.kind, { catalogueId: w.id, ...(notes ? { guide } : {}) }])) });
  const seed = async (p, progress, picks, id) => p.addInitScript(({ progress, picks, id }) => {
    if (!sessionStorage.getItem('archive-seeded')) {
      localStorage.setItem('cabin-progress', JSON.stringify(progress));
      if (picks) localStorage.setItem('cabin-today', JSON.stringify(picks));
      localStorage.setItem('cabin-reading', JSON.stringify({ last: id, places: {} }));
      sessionStorage.setItem('archive-seeded', 'yes');
    }
    window.__pageText = [];
    const fill = CanvasRenderingContext2D.prototype.fillRect, draw = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillRect = function(x,y,w,h) {
      if (this.canvas.id === 'page' && w === 2048 && h === 2560) __pageText = [];
      return fill.call(this,x,y,w,h);
    };
    CanvasRenderingContext2D.prototype.fillText = function(t,...a) {
      if (this.canvas.id === 'page') __pageText.push(String(t));
      return draw.call(this,t,...a);
    };
  }, { progress, picks, id });
  for (const lying of [false, true]) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026,9,28,20)); await mock(p,'layer',lying);
    const id = `today-2026-10-27-poem-${originals[0].id}`;
    await seed(p, base(), picksFor('2026-10-27'), id);
    await p.goto(BASE_URL);
    await p.waitForFunction(id => document.querySelector('#page').dataset.work === id && document.querySelector('#page').dataset.section === 'before', id);
    assert.ok((await p.evaluate(() => __pageText)).includes('Saved introduction.'));
    await p.locator('#page').screenshot({ path: path.join(out, `archive-before${lying ? '-lying' : ''}.png`) });
    for (let i = 0; await p.locator('#page').getAttribute('data-section') !== 'after'; i++) {
      assert.ok(i < 30); await p.locator('#next').click();
    }
    assert.ok((await p.evaluate(() => __pageText)).includes('Saved reflection.'));
    await p.evaluate(() => localStorage.removeItem('cabin-today'));
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#page').dataset.section === 'after');
    assert.ok((await p.evaluate(() => __pageText)).includes('Saved reflection.'));
    const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('cabin-progress')));
    assert.equal(stored.days['2026-10-27'].guides.poem.catalogueId, originals[0].id);
    assert.equal(stored.days['2026-10-27'].poem, undefined, 'archiving does not mark anything read');
    await p.locator('#enter:not([disabled])').click(); await p.evaluate(() => { __center(); __step(1600); __mock.offsetX=.25; __step(); __welcomeScene(); });
    await p.locator('#welcome-scene').screenshot({ path: path.join(out, `archive-side${lying ? '-lying' : ''}.png`) });
    assert.deepEqual(errors, []); await p.close();
    passed('cached prior-day notes survive the next day, cache removal and offline reload' + (lying ? ' lying' : ''));
  }
  {
    const p = await browser.newPage(), progress = base(), date = '2026-10-28';
    rememberGuides(progress, date, originals.map(w => ({ ...w, catalogueId: w.id, guide })));
    const id = `today-${date}-poem-${originals[0].id}`;
    await p.clock.setFixedTime(new Date(2026,9,28,20)); await mock(p,'layer',false);
    await seed(p, progress, picksFor(date, false), id);
    await p.goto(BASE_URL);
    await p.waitForFunction(() => document.querySelector('#page').dataset.section === 'before');
    assert.ok((await p.evaluate(() => __pageText)).includes('Saved introduction.'));
    await p.close();
    passed('today restores saved notes offline even when its current cache omits guides');
  }
  {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [], progress = base(), writes = [];
    p.on('pageerror', e => errors.push(e.message));
    progress.days['2026-10-27'] = { ids: Object.fromEntries(originals.map(w => [w.kind,w.id])), picks: Object.fromEntries(originals.map(w => [w.kind,`${w.title} — ${w.author}`])), story: true };
    const id = `today-2026-10-27-poem-${originals[0].id}`;
    await p.clock.setFixedTime(new Date(2026,9,28,20)); await mock(p,'layer',false); await seed(p,progress,null,id);
    await p.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType:'text/javascript', body:`window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'fake-token',expires_in:3600})})}}};` }));
    await p.route('https://www.googleapis.com/**', async r => {
      const u = decodeURIComponent(r.request().url()), json = x => r.fulfill({contentType:'application/json',body:JSON.stringify(x)});
      if (r.request().method() !== 'GET') { writes.push(JSON.parse(r.request().postData())); return json({id:'P'}); }
      if (u.includes('files?q=') && u.includes('Bradbury Cabin')) return json({files:[{id:'F'}]});
      if (u.includes('files?q=') && u.includes('progress.json')) return json({files:[{id:'P'}]});
      if (u.includes('files?q=') && u.includes("name contains 'picks-2026-10-27'")) return json({files:[{id:'H',name:'picks-2026-10-27.json',size:'3000',createdTime:'2026-10-27T12:00:00Z'}]});
      if (u.includes('files?q=')) return json({files:[]});
      if (u.includes('/files/P?alt=media')) return json(progress);
      if (u.includes('/files/H?alt=media')) return json(picksFor('2026-10-27'));
      return r.fulfill({status:404,body:''});
    });
    await p.goto(BASE_URL);
    await p.waitForFunction(() => document.querySelector('#page').dataset.section === 'text');
    await p.locator('#next').click();
    const anchor = await p.evaluate(id => JSON.parse(localStorage.getItem('cabin-reading')).places[id].anchor,id);
    await p.locator('#drive-sync:not([disabled])').click();
    await p.waitForFunction(() => document.querySelector('#drive-sync').disabled === false && document.querySelector('#status').textContent.includes('No picks from Claude'));
    assert.equal(writes.at(-1).days['2026-10-27'].guides.poem.catalogueId, originals[0].id);
    assert.equal(writes.at(-1).days['2026-10-27'].story,true);
    assert.equal(await p.locator('#page').getAttribute('data-section'),'text','late recovery keeps an open source page');
    assert.deepEqual(await p.evaluate(id => JSON.parse(localStorage.getItem('cabin-reading')).places[id].anchor,id),anchor);
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#page').dataset.section === 'text');
    assert.deepEqual(await p.evaluate(id => JSON.parse(localStorage.getItem('cabin-reading')).places[id].anchor,id),anchor);
    await p.locator('#page').screenshot({path:path.join(out,'archive-recovered-source.png')});
    assert.deepEqual(errors, []); await p.close();
    passed('Sync automatically recovers old Drive notes and keeps the current source anchor and ticks');
  }
};
