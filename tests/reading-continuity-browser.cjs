const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

module.exports = async function readingContinuityChecks(browser, { mock, BASE_URL, out, passed }) {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname, '..', 'source-catalogue.js')).href);
  const excluded = new Set(['blake-sick-rose', 'whitman-astronomer', 'whitman-captain', 'ohenry-magi', 'chopin-desiree', 'bacon-studies', 'bacon-truth']);
  const works = ['poem', 'story', 'essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !excluded.has(w.id)));
  const today = '2026-10-29';
  const assignedId = w => `today-${today}-${w.kind}-${w.id}`;
  const place = { anchor: { block: 0, word: 0, section: 'text' }, page: 0 };
  const target = (p, id) => p.evaluate(async id => { await __aim(id, true); __pinch(); __step(700); }, id);
  const snapshot = p => p.evaluate(() => ({ text: window.__continuityText, buttons: JSON.parse(document.querySelector('#page').dataset.buttons), view: document.querySelector('#page').dataset.view, route: document.querySelector('#page').dataset.menuPage }));
  const saveCanvas = async (p, name) => {
    if (!out) return;
    const png = await p.evaluate(() => document.querySelector('#page').toDataURL('image/png'));
    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(path.join(out, name), Buffer.from(png.split(',')[1], 'base64'));
  };
  async function open({ selected = null, read = [], foreign = false, failSave = false, set = works, extraSaved = [] } = {}) {
    const p = await browser.newPage();
    await p.clock.setFixedTime(new Date(2026, 9, 29, 20));
    await mock(p, 'layer', false, { practised: true, headPointer: false, visits: 4 });
    await p.addInitScript(({ set, selected, read, foreign, today, place, failSave, extraSaved }) => {
      const ids = Object.fromEntries(set.map(w => [w.kind, w.id]));
      const picks = Object.fromEntries(set.map(w => [w.kind, `${w.title} — ${w.author}`]));
      const days = { [today]: { ids, picks } };
      if (foreign) days['2026-10-28'] = { ids: { [foreign.kind]: foreign.id }, picks: { [foreign.kind]: `${foreign.title} — ${foreign.author}` } };
      localStorage.setItem('cabin-today', JSON.stringify({ version: 2, date: today, picks: Object.fromEntries(set.map(w => [w.kind, { catalogueId: w.id }])) }));
      localStorage.setItem('cabin-progress', JSON.stringify({ version: 1, start: '2026-10-18', trackingSince: today, days, weeks: {}, completedWorks: Object.fromEntries(read.map(id => [id, '2026-10-29T18:00:00.000Z'])) }));
      if (selected || extraSaved.length) localStorage.setItem('cabin-reading', JSON.stringify({ last: selected, places: { ...Object.fromEntries(extraSaved.map(id => [id, place])), ...(selected ? { [selected]: place } : {}) } }));
      window.__continuityText = [];
      const fill = CanvasRenderingContext2D.prototype.fillText, clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) { if (this.canvas.id === 'page') window.__continuityText = []; return clear.call(this, ...args); };
      CanvasRenderingContext2D.prototype.fillText = function (value, x, y, ...rest) {
        if (this.canvas.id === 'page') {
          const m = this.measureText(value), tr = this.getTransform();
          const offset = this.textAlign === 'center' ? m.width / 2 : ['right', 'end'].includes(this.textAlign) ? m.width : 0;
          const a = tr.transformPoint({ x: x - offset, y: y - m.actualBoundingBoxAscent });
          const b = tr.transformPoint({ x: x - offset + m.width, y: y + m.actualBoundingBoxDescent });
          window.__continuityText.push({ text: String(value), font: this.font, x: a.x, y: a.y, right: b.x, bottom: b.y });
        }
        return fill.call(this, value, x, y, ...rest);
      };
      if (failSave) {
        const save = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) { if (key === 'cabin-progress' && window.__continuityFailSave) throw new DOMException('test quota', 'QuotaExceededError'); return save.call(this, key, value); };
      }
    }, { set: set.map(({ id, kind, title, author }) => ({ id, kind, title, author })), selected, read, foreign, today, place, failSave, extraSaved });
    await p.goto(BASE_URL); await p.locator('#enter').click(); await p.evaluate(() => __center());
    assert.equal((await snapshot(p)).route, 'today');
    return p;
  }
  function textsForRow(s, id) {
    const b = s.buttons.find(b => b.id === id); assert.ok(b, `missing target ${id}`);
    return s.text.filter(t => t.y >= b.y - 1 && t.bottom <= b.y + b.h + 1);
  }
  function noTextOverlap(items, label) {
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      assert.ok(a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1, `${label}: glyph overlap ${a.text} / ${b.text}`);
    }
  }
  {
    const p = await open(), s = await snapshot(p);
    assert.ok(s.text.some(t => /^Begin\b/.test(t.text)), 'fresh entry should offer Begin');
    assert.ok(!s.text.some(t => /^Continue\b|^Resume\b/.test(t.text)), 'fresh state must not claim a saved reading place');
    assert.ok(!s.buttons.some(b => b.id === 'home-resume'), 'fresh sampler must not get a false Resume strip');
    assert.deepEqual(s.buttons.filter(b => b.id.startsWith('home-work:')).map(b => b.id), works.map(w => `home-work:${assignedId(w)}`));
    await saveCanvas(p, 'reading-continuity-fresh-today.png');
    await p.close(); passed('reading continuity: fresh entry has truthful Begin and source-order works');
  }
  for (const w of works) {
    const p = await open({ selected: assignedId(w) }), s = await snapshot(p);
    const row = textsForRow(s, `home-work:${assignedId(w)}`);
    assert.ok(row.some(t => /^Continue\b/.test(t.text)), `saved page zero should Continue: ${w.kind}`);
    assert.ok(row.some(t => /\b(?:Page|Text|Reading)\b.*\d|\d+\s*(?:\/|of)\s*\d+/.test(t.text)), 'Continue must identify the resolved real place');
    assert.equal(s.text.filter(t => /^Continue\s*→/.test(t.text)).length, 1, 'Continue must identify one saved current work');
    assert.deepEqual(s.buttons.filter(b => b.id.startsWith('home-work:')).map(b => b.id), works.map(w => `home-work:${assignedId(w)}`), 'featured current must preserve Today source order');
    assert.ok(!s.buttons.some(b => b.id === 'home-resume'), 'current Today work must not be duplicated as a Resume strip');
    noTextOverlap(row, `${w.kind} current row`);
    if (w.kind === 'poem') await saveCanvas(p, 'reading-continuity-saved-current.png');
    await target(p, `home-work:${assignedId(w)}`);
    assert.equal(await p.locator('#page').getAttribute('data-section'), 'text', 'Continue lost saved text section');
    await p.close(); passed(`reading continuity: saved page-zero ${w.kind} has one real-place Continue in source order`);
  }
  {
    const w = works[0], p = await open({ selected: assignedId(w), read: [w.id] }), s = await snapshot(p);
    const row = textsForRow(s, `home-work:${assignedId(w)}`);
    assert.ok(row.some(t => /^Read\s*✓/.test(t.text)), 'canonical completion must be visible');
    assert.ok(!row.some(t => /^Continue\b/.test(t.text)), 'canonical Read must take precedence over saved place');
    await p.close(); passed('reading continuity: canonical Read takes precedence over saved Continue');
  }
  {
    const foreign = SOURCE_CATALOGUE.find(w => w.kind === 'poem' && !works.some(x => x.id === w.id) && !excluded.has(w.id));
    const selected = `today-2026-10-28-${foreign.kind}-${foreign.id}`, p = await open({ selected, foreign }), s = await snapshot(p);
    assert.equal(s.buttons.filter(b => b.id === 'home-resume').length, 1);
    assert.equal(s.buttons.filter(b => b.id.startsWith('home-work:')).length, 3, 'foreign Resume displaced Today work');
    await saveCanvas(p, 'reading-continuity-foreign-resume.png');
    await target(p, 'home-resume');
    assert.equal(await p.locator('#page').getAttribute('data-work'), selected);
    assert.equal(await p.locator('#page').getAttribute('data-section'), 'text');
    await p.close(); passed('reading continuity: foreign Resume preserves all three works and exact saved section');
  }
  {
    const p = await open({ selected: assignedId(works[0]), read: works.map(w => w.id) }), s = await snapshot(p);
    assert.equal(s.text.filter(t => /^Read\s*✓/.test(t.text)).length, 3, 'all three canonical Read states must remain visible');
    assert.ok(!s.text.some(t => /^Next reading|^Next ·|^Continue\s*→|^Begin\b/.test(t.text)), 'all-read Today must not invent another reading');
    await p.close(); passed('reading continuity: all-read Today retains three Read states without invented next reading');
  }
  // Run the real production Home painter with real loaded font metrics. This
  // exercises extreme catalogue titles in every row without altering source text.
  {
    const p = await browser.newPage(); await p.goto(BASE_URL);
    const longest = [...SOURCE_CATALOGUE].sort((a, b) => b.title.length - a.title.length)[0];
    const result = await p.evaluate(async ({ works, longest }) => {
      const { paintHome, homeButtons } = await import(new URL('home-panel.js', location.href).href);
      await document.fonts.ready;
      const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 2560;
      const ctx = canvas.getContext('2d'); let text = [];
      const original = ctx.fillText.bind(ctx);
      ctx.fillText = function (value, x, y, ...rest) {
        const m = this.measureText(value), tr = this.getTransform();
        const offset = this.textAlign === 'center' ? m.width / 2 : ['right', 'end'].includes(this.textAlign) ? m.width : 0;
        const a = tr.transformPoint({ x: x - offset, y: y - m.actualBoundingBoxAscent });
        const b = tr.transformPoint({ x: x - offset + m.width, y: y + m.actualBoundingBoxDescent });
        text.push({ text: String(value), font: this.font, x: a.x, y: a.y, right: b.x, bottom: b.y });
        return original(value, x, y, ...rest);
      };
      const render = options => { ctx.clearRect(0, 0, 2048, 2560); text = []; paintHome(ctx, { ...options, c: { serif: 'Literata, Georgia, serif' } }); return { text, buttons: homeButtons(options) }; };
      const geometry = [];
      for (let current = 0; current < 3; current++) for (let longPosition = 0; longPosition < 3; longPosition++) {
        const set = works.map((w, i) => i === longPosition ? { ...longest, id: `long-${i}` } : { ...w });
        const id = set[current].id;
        geometry.push({ current, longPosition, ...render({ works: set, currentId: id, resumable: { [id]: true }, currentPosition: 'Text · Page 1' }) });
      }
      const next = { ...longest, id: 'offpage-next' };
      const same = render({ library: true, tab: 'shelf', works, total: 6, currentId: works[0].id, statuses: { [works[0].id]: 'Read ✓' }, resumable: { [works[1].id]: true }, completion: { id: works[0].id, saved: true, next: works[1] } });
      const off = render({ library: true, tab: 'shelf', works, total: 6, currentId: works[0].id, statuses: { [works[0].id]: 'Read ✓' }, resumable: { [next.id]: true }, completion: { id: works[0].id, saved: false, next } });
      const allRead = render({ library: true, tab: 'shelf', works, total: 3, statuses: Object.fromEntries(works.map(w => [w.id, 'Read ✓'])), completion: { id: works[0].id, saved: true, next: works[1] } });
      return { geometry, same, off, allRead, nextId: next.id };
    }, { works, longest });
    for (const s of result.geometry) {
      assert.equal(s.buttons.filter(b => b.id.startsWith('home-work:')).length, 3);
      for (const b of s.buttons.filter(b => b.id.startsWith('home-work:'))) {
        const items = textsForRow(s, b.id); noTextOverlap(items, `real longest title slot ${s.longPosition}, current ${s.current}, ${b.id}`);
        const titles = items.filter(t => /^24px/.test(t.font));
        assert.ok(titles.length >= 1 && titles.length <= 2, 'fixed-size title must fit in one or two lines');
        assert.ok(titles.every(t => t.x >= b.x && t.right <= b.x + b.w && t.y >= b.y && t.bottom <= b.y + b.h), 'real glyph bounds exceed their work target');
      }
    }
    for (const [label, panel] of [['visible next', result.same], ['offpage next', result.off], ['all read', result.allRead]]) {
      noTextOverlap(panel.text, `Library ${label}`);
      assert.equal(new Set(panel.buttons.map(b => b.id)).size, panel.buttons.length, 'Library must not duplicate navigation targets');
    }
    assert.ok(result.same.text.some(t => /^Library ·/.test(t.text)), 'completion must keep the Library destination named');
    const sameNextId = `home-work:${works[1].id}`;
    assert.equal(result.same.buttons.filter(b => b.id === sameNextId).length, 1, 'in-page next work must not get a duplicate strip');
    assert.ok(textsForRow(result.same, sameNextId).some(t => /Next · Continue/.test(t.text)), 'saved in-page next should Continue, not Begin');
    const offId = `home-work:${result.nextId}`;
    assert.equal(result.off.buttons.filter(b => b.id === offId).length, 1, 'off-page next target must appear exactly once');
    assert.equal(result.off.buttons.filter(b => b.id.startsWith('home-work:')).length, 4, 'off-page strip must preserve existing three Library works');
    assert.ok(textsForRow(result.off, offId).some(t => /^Continue/.test(t.text)), 'saved off-page next should Continue');
    for (const b of result.off.buttons.filter(b => b.id.startsWith('home-work:'))) noTextOverlap(textsForRow(result.off, b.id), 'off-page next geometry');
    assert.ok(result.off.text.some(t => /could not save/.test(t.text)), 'failed save context must remain explicit');
    assert.ok(!result.off.text.some(t => t.text === 'Marked as read ✓'), 'failed save must not claim successful persistence');
    assert.ok(!result.allRead.text.some(t => /^Next reading|^Next ·/.test(t.text)), 'completed next work must not be offered again');
    await p.close(); passed('reading continuity: real longest-title glyphs fit every row and current position; Library next is truthful and never duplicated');
  }
  // Real app completion: use the already established separate NEXT confirmation.
  // Only the post-completion continuation is new; never target a new closing control.
  for (const failSave of [false, true]) {
    const tiger = SOURCE_CATALOGUE.find(w => w.id === 'william-blake-experience-the-tiger');
    const set = [tiger, works[1], works[2]], p = await open({ set, failSave, extraSaved: [assignedId(works[1])] });
    await target(p, `home-work:${assignedId(tiger)}`);
    for (let i = 0; i < 100 && await p.locator('#page').getAttribute('data-menu-page') !== 'closing'; i++) await p.evaluate(() => { __pinch('right'); __step(700); });
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'), 'closing');
    if (!failSave) await saveCanvas(p, 'reading-continuity-closing-confirmation.png');
    if (failSave) await p.evaluate(() => { window.__continuityFailSave = true; });
    await p.evaluate(async () => { await __aim({ x: 0, y: 0, w: 1, h: 1 }, true); __step(700); __pinch('right'); __step(700); });
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'), 'feedback', 'completion offers optional feedback');
    await target(p, 'feedback-done');
    const s = await snapshot(p);
    assert.equal(s.route, 'library', 'completion must retain Library destination');
    assert.ok(s.text.some(t => /^Read\s*✓/.test(t.text)), 'completed edition lost Read');
    const nextId = `home-work:${assignedId(set[1])}`;
    assert.equal(s.buttons.filter(b => b.id === nextId).length, 1, 'next work must use one existing action target');
    assert.ok(textsForRow(s, nextId).some(t => /Next reading|^Next ·|Up next/.test(t.text)), 'Library must offer the next reading');
    assert.ok(textsForRow(s, nextId).some(t => /Continue/.test(t.text)), 'saved next reading must Continue rather than restart');
    if (failSave) {
      assert.ok(s.text.some(t => /could not save|not saved|couldn.t save|unable to save/i.test(t.text)), 'save failure must remain visible and honest after completion');
      assert.ok(!s.text.some(t => /saved (?:on|to|safely)|progress saved/i.test(t.text)), 'failed completion must not claim saved progress');
    }
    await saveCanvas(p, failSave ? 'reading-continuity-failed-save-library.png' : 'reading-continuity-completion.png');
    await target(p, nextId); assert.equal(await p.locator('#page').getAttribute('data-view'), 'reading');
    assert.equal(await p.locator('#page').getAttribute('data-work'), assignedId(set[1]));
    assert.equal(await p.locator('#page').getAttribute('data-section'), 'text', 'next-reading action lost the saved section');
    await p.close(); passed(`reading continuity: completion retains Library and offers one next action${failSave ? ' with honest save-failure feedback' : ''}`);
  }
};
