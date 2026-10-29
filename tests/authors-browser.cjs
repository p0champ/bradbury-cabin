const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function authorChecks(browser, { mock, BASE_URL, out, passed }) {
  const { SOURCE_CATALOGUE } = await import('../source-catalogue.js');
  const ids = [
    'w-b-yeats-the-song-of-wandering-aengus',
    'edgar-allan-poe-the-tell-tale-heart',
    'thomas-de-quincey-on-the-knocking-at-the-gate-in-macbeth',
    'rabindranath-tagore-realisation-in-love',
  ];
  for (const [i, id] of ids.entries()) {
    const work = SOURCE_CATALOGUE.find(w => w.id === id);
    assert.ok(work, id + ' independently accepted');
    const lying = i % 2 === 1;
    const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026, 9, 28, 20));
    await mock(p, 'layer', lying, { practised: true, headPointer: true, size: 2 });
    const picks = { version: 2, date: '2026-10-28', picks: {} };
    for (const kind of ['poem', 'story', 'essay']) {
      const w = work.kind === kind ? work : SOURCE_CATALOGUE.find(w => w.kind === kind && ids.includes(w.id));
      picks.picks[kind] = { catalogueId: w.id };
    }
    const todayId = `today-2026-10-28-${work.kind}-${work.id}`;
    await p.addInitScript(({ picks, todayId }) => {
      if (!sessionStorage.getItem('authors-seeded')) {
        localStorage.setItem('cabin-today', JSON.stringify(picks));
        localStorage.setItem('cabin-reading', JSON.stringify({ last: todayId, places: {} }));
        sessionStorage.setItem('authors-seeded', 'yes');
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
    }, { picks, todayId });
    await p.goto(BASE_URL);
    await p.waitForFunction(id => document.querySelector('#page').dataset.work === id, todayId);
    const expected = await p.evaluate(async id => {
      await document.fonts.ready;
      const { SOURCE_CATALOGUE } = await import('./source-catalogue.js?v=36');
      const { layoutWork } = await import('./reader.js?v=36');
      const ctx = document.querySelector('#page').getContext('2d');
      const work = SOURCE_CATALOGUE.find(w => w.id === id);
      return layoutWork(ctx, work, 2).map(p => p.filter(x => x.kind === 'line').map(x => x.text));
    }, id);
    // Compare the actual app's first and last source pages with its full layout.
    const actual = () => p.evaluate(() => __pageText.join(' '));
    for (const line of expected[0]) assert.ok((await actual()).includes(line), id + ' first page retains source line');
    await p.locator('#page').screenshot({ path: path.join(out, `author-${i}-first.png`) });
    for (let page = 1; page < expected.length; page++) await p.locator('#next').click();
    for (const line of expected.at(-1)) assert.ok((await actual()).includes(line), id + ' complete ending retained');
    await p.locator('#page').screenshot({ path: path.join(out, `author-${i}-last.png`) });
    await p.reload();
    await p.waitForFunction(id => document.querySelector('#page').dataset.work === id, todayId);
    for (const line of expected.at(-1)) assert.ok((await actual()).includes(line), id + ' last page resumes after reload');
    await p.locator('#enter:not([disabled])').click();
    await p.evaluate(() => { __center(); __step(1600); });
    await p.locator('#page').screenshot({ path: path.join(out, `author-${i}-today.png`) });
    await p.evaluate(() => { __mock.offsetX = .25; __step(); __welcomeScene(); });
    await p.locator('#welcome-scene').screenshot({ path: path.join(out, `author-${i}-side${lying ? '-lying' : ''}.png`) });
    assert.deepEqual(errors, []);
    await p.close();
    passed('new author loads from references, preserves first/last pages and resumes offline: ' + work.author);
  }
};
