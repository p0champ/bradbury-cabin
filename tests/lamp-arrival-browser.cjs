const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// "Lamp on" (Build 052): what the headset image shows during the arrival,
// read from the native quad texture, plus skip, reduced motion and tracking loss.
module.exports = async function lampArrivalChecks(browser, { mock, BASE_URL, out, passed }) {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname, '..', 'source-catalogue.js')).href);
  const excluded = new Set(['blake-sick-rose', 'whitman-astronomer', 'whitman-captain', 'ohenry-magi', 'chopin-desiree', 'bacon-studies', 'bacon-truth']);
  const works = ['poem', 'story', 'essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !excluded.has(w.id)));
  async function setup({ lying = false, reduce = false } = {}) {
    const p = await browser.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
    await mock(p, 'layer', lying, { practised: true, headPointer: false, visits: 4 });
    await p.addInitScript(w => localStorage.setItem('cabin-today', JSON.stringify({ version: 2, date: '2026-10-29', picks: Object.fromEntries(w.map(x => [x.kind, { catalogueId: x.id }])) })), works.map(({ id, kind }) => ({ id, kind })));
    await p.clock.setFixedTime(new Date(2026, 9, 29, 20));
    await p.goto(BASE_URL); await p.locator('#enter').click();
    await p.evaluate(() => {
      const P = WebGL2RenderingContext.prototype;
      // Native pixels of one page band, with the clean Today page for comparison.
      window.__lampRead = (y, h) => {
        const gl = __mock.gl, page = document.querySelector('#page'), d = __mock.layerData.get(__mock.quad);
        const v = d.viewport || { x: 0, y: 0, width: d.width, height: d.height };
        const sy = v.height / page.height, top = Math.floor(y * sy), rows = Math.max(1, Math.floor(h * sy));
        const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), fbo = gl.createFramebuffer();
        P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, fbo);
        P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d.tex, 0);
        const px = new Uint8Array(v.width * rows * 4);
        gl.readPixels(v.x, v.y + v.height - top - rows, v.width, rows, gl.RGBA, gl.UNSIGNED_BYTE, px);
        P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, prev); gl.deleteFramebuffer(fbo);
        const ref = document.createElement('canvas'); ref.width = v.width; ref.height = v.height;
        ref.getContext('2d').drawImage(page, 0, 0, v.width, v.height);
        const src = ref.getContext('2d').getImageData(0, top, v.width, rows).data;
        let differ = 0, samples = 0, warmth = 0;
        for (let r = 0; r < rows; r += 2) for (let x = 0; x < v.width; x += 2) {
          const k = ((rows - 1 - r) * v.width + x) * 4, s = (r * v.width + x) * 4, a = src[s + 3] / 255;
          const diff = Math.max(Math.abs(px[k] - src[s] * a), Math.abs(px[k + 1] - src[s + 1] * a), Math.abs(px[k + 2] - src[s + 2] * a));
          samples++; if (diff > 40) differ++;
          warmth += px[k] - px[k + 2];
        }
        return { differ: differ / samples, warmth: warmth / samples };
      };
      // Raw native pixels of a band, for comparing two headset frames directly.
      window.__nativeBand = (y, h) => {
        const gl = __mock.gl, d = __mock.layerData.get(__mock.quad), v = d.viewport || { x: 0, y: 0, width: d.width, height: d.height };
        const sy = v.height / 2560, top = Math.floor(y * sy), rows = Math.max(1, Math.floor(h * sy));
        const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), fbo = gl.createFramebuffer();
        P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, fbo);
        P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d.tex, 0);
        const px = new Uint8Array(v.width * rows * 4);
        gl.readPixels(v.x, v.y + v.height - top - rows, v.width, rows, gl.RGBA, gl.UNSIGNED_BYTE, px);
        P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, prev); gl.deleteFramebuffer(fbo);
        return px;
      };
      window.__bandDiffer = (a, b) => { let n = 0, m = 0; for (let i = 0; i < a.length; i += 8) { m++; if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 24) n++; } return n / m; };
      window.__lamp = () => JSON.parse(document.querySelector('#page').dataset.lamp || 'null');
      window.__view = () => [document.querySelector('#page').dataset.view, document.querySelector('#page').dataset.menuPage];
      window.__stepTo = ms => { for (let i = 0; i < 400 && (__lamp()?.ms ?? 1e9) < ms && __view()[0] === 'arrival'; i++) __step(20); return __lamp(); };
      window.__bands = () => {
        const buttons = JSON.parse(document.querySelector('#page').dataset.buttons);
        const rows = buttons.filter(b => b.id.startsWith('home-work:'));
        const tab = buttons.find(b => b.id === 'home-today');
        return { header: { y: tab.y, h: rows[0].y - tab.y - 8 }, rows: rows.map(b => ({ y: b.y + 8, h: b.h - 16 })) };
      };
      __step(); __pinch();
    });
    return { p, errors };
  }

  // 1. Timeline in the actual headset image, with no per-frame page uploads.
  for (const lying of [false, true]) {
    const { p, errors } = await setup({ lying });
    assert.equal(await p.locator('#page').getAttribute('data-view'), 'arrival', 'placement did not start the arrival');
    assert.equal(Number(await p.locator('#page').getAttribute('data-arrival-ms')), 5000);
    const r = await p.evaluate(() => {
      __step(20);
      const bands = __bands(), before = { uploads: __mock.uploads, owned: __mock.ownedCanvasUploads, draws: __mock.pageSurfaceDraws };
      const glow = { lamp: __stepTo(900), opacity: __mock.quad.opacity, header: __lampRead(bands.header.y, bands.header.h), centre: __lampRead(1240, 60) };
      const header = { lamp: __stepTo(2500), header: __lampRead(bands.header.y, bands.header.h), row0: __lampRead(bands.rows[0].y, bands.rows[0].h) };
      const rows = { lamp: __stepTo(3250), row0: __lampRead(bands.rows[0].y, bands.rows[0].h), row2: __lampRead(bands.rows[2].y, bands.rows[2].h) };
      const late = __stepTo(4900);
      // Fully revealed lamp image (built from its own Today paint) must equal the real page.
      const settledBands = { header: bands.header, row0: bands.rows[0], row2: bands.rows[2], footer: { y: bands.rows[2].y + bands.rows[2].h + 16, h: 140 } };
      const settledPx = Object.fromEntries(Object.entries(settledBands).map(([k, b]) => [k, __nativeBand(b.y, b.h)]));
      const during = { uploads: __mock.uploads - before.uploads, owned: __mock.ownedCanvasUploads - before.owned, draws: __mock.pageSurfaceDraws - before.draws };
      let frames = 0; while (__view()[0] === 'arrival' && frames < 100) { __step(20); frames++; }
      __step(20); __step(20);
      const settled = Object.fromEntries(Object.entries(settledBands).map(([k, b]) => [k, __bandDiffer(settledPx[k], __nativeBand(b.y, b.h))]));
      const end = { view: __view(), lamp: __lamp(), opacity: __mock.quad.opacity, header: __lampRead(bands.header.y, bands.header.h), row2: __lampRead(bands.rows[2].y, bands.rows[2].h), centre: __lampRead(1240, 60) };
      return { glow, header, rows, late, settled, during, end, frames };
    });
    if (out) { await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, `lamp-arrival-${lying ? 'lying' : 'upright'}.json`), JSON.stringify(r, null, 2)); }
    // Lamp phase: warm glow rising, window fading in, no words yet.
    assert.ok(r.glow.lamp.glow > .3 && r.glow.lamp.header === 0 && r.glow.lamp.rows.every(a => a === 0), `glow phase wrong: ${JSON.stringify(r.glow.lamp)}`);
    assert.ok(r.glow.opacity > .2 && r.glow.opacity < 1, `window should still be fading in at 0.9 s: ${r.glow.opacity}`);
    assert.ok(r.glow.header.differ > .01, 'Today header was visible during the lamp glow');
    assert.ok(r.glow.centre.warmth > r.end.centre.warmth + 12, `glass was not visibly warmer during the glow: ${r.glow.centre.warmth} vs ${r.end.centre.warmth}`);
    // Header fades in in place; readings still hidden.
    assert.ok(r.header.lamp.header > .5 && r.header.lamp.rows[0] === 0, `header phase wrong: ${JSON.stringify(r.header.lamp)}`);
    assert.ok(r.header.header.differ < r.glow.header.differ, 'header did not appear in the headset image');
    assert.ok(r.header.row0.differ > .01, 'first reading appeared before its turn');
    // Readings rise in one after another.
    assert.ok(r.rows.lamp.rows[0] > 0 && r.rows.lamp.lifts[0] > 0 && r.rows.lamp.rows[2] === 0, `rows not staggered: ${JSON.stringify(r.rows.lamp)}`);
    assert.ok(r.rows.row2.differ > .01, 'third reading appeared with the first');
    // About five seconds, then exactly the normal Today page.
    assert.ok(r.late && r.late.ms >= 4880 && r.frames < 12, `arrival did not end at about 5 s: ${JSON.stringify(r.late)} + ${r.frames} frames`);
    for (const [band, v] of Object.entries(r.settled)) assert.ok(v < .004, `revealed lamp ${band} differs from the real Today headset image: ${JSON.stringify(r.settled)}`);
    assert.deepEqual(r.end.view, ['menu', 'today']);
    assert.equal(r.end.lamp, null);
    assert.equal(r.end.opacity, 1);
    assert.ok(r.end.header.differ < .002 && r.end.row2.differ < .002, `final headset image differs from Today: ${JSON.stringify(r.end)}`);
    assert.equal(r.during.uploads, 0, 'arrival uploaded the page into the native image');
    assert.equal(r.during.owned, 0, 'arrival re-uploaded canvas pixels after its first frame');
    assert.ok(r.during.draws > 150, `arrival was not composed on the GPU each frame (${r.during.draws})`);
    assert.deepEqual(errors, []);
    passed(`lamp arrival: glow, header, staggered readings and exact Today in the native image, no per-frame uploads${lying ? ' lying' : ''}`);
    await p.close();
  }

  // 2. Skip: only a fresh pinch begun after the placing pinch skips, and it selects nothing.
  {
    const { p, errors } = await setup();
    const r = await p.evaluate(() => {
      __step(20);
      // The placing pinch's own release and an early-begun press never skip.
      __native('selectend'); __step(20);
      __hand(.012); __native('selectstart'); __step(20);
      __stepTo(700); __hand(.05); __native('select'); __native('selectend'); __step(20);
      const early = { view: __view(), ms: __lamp()?.ms };
      __stepTo(1500);
      __hand(.05); for (let i = 0; i < 30; i++) __step(20);
      __hand(.012); __native('selectstart'); __step(60); __hand(.05); __native('select'); __native('selectend');
      const at = __lamp()?.ms; __step(20); __step(20);
      const after = { view: __view(), lamp: __lamp(), work: document.querySelector('#page').dataset.work };
      for (let i = 0; i < 40; i++) __step(20);
      return { early, at, after, later: __view() };
    });
    assert.equal(r.early.view[0], 'arrival', 'placing release or an early press skipped the arrival');
    assert.ok(r.at < 3000, `skip pinch arrived too late to prove skipping (${r.at} ms)`);
    assert.deepEqual(r.after.view, ['menu', 'today'], 'a fresh pinch did not skip straight to Today');
    assert.equal(r.after.lamp, null);
    assert.deepEqual(r.later, ['menu', 'today'], 'the skipping pinch also selected something');
    assert.deepEqual(errors, []);
    passed('lamp arrival: a fresh pinch skips straight to Today without selecting; placing and early presses never skip');
    await p.close();
  }

  // 3. Losing head tracking pauses the arrival without flashing the finished page.
  {
    const { p, errors } = await setup();
    const r = await p.evaluate(() => {
      __step(20); const bands = __bands();
      __stepTo(1000);
      __mock.poseLost = true; const lost = [];
      for (let i = 0; i < 6; i++) { __step(30); lost.push({ header: __lampRead(bands.header.y, bands.header.h).differ, ms: __lamp()?.ms }); }
      __mock.poseLost = false; __step(20);
      const resumed = __lamp();
      __finishArrival(); __step(20);
      return { lost, resumed, end: __view() };
    });
    for (const f of r.lost) assert.ok(f.header > .01, 'tracking loss revealed the finished Today page mid-arrival');
    assert.ok(r.resumed.ms <= 1100, `arrival kept running without head tracking (${r.resumed.ms} ms)`);
    assert.deepEqual(r.end, ['menu', 'today']);
    assert.deepEqual(errors, []);
    passed('lamp arrival: tracking loss pauses it and never flashes the finished page');
    await p.close();
  }

  // 4. Reduced motion: one 0.3 s fade, no glow and no movement.
  {
    const { p, errors } = await setup({ reduce: true });
    assert.equal(Number(await p.locator('#page').getAttribute('data-arrival-ms')), 300);
    const r = await p.evaluate(() => {
      __step(20); const ops = [];
      for (let i = 0; i < 30 && __view()[0] === 'arrival'; i++) { ops.push({ opacity: __mock.quad.opacity, lamp: __lamp() }); __step(20); }
      return { ops, end: __view() };
    });
    assert.ok(r.ops.every(o => o.lamp === null), 'reduced motion still played the lamp');
    assert.ok(r.ops.some(o => o.opacity > 0 && o.opacity < 1), 'reduced motion did not fade');
    assert.ok(r.ops.length <= 18, `reduced-motion arrival took ${r.ops.length} frames`);
    assert.deepEqual(r.end, ['menu', 'today']);
    assert.deepEqual(errors, []);
    passed('lamp arrival: reduced motion is a single short fade with no glow or movement');
    await p.close();
  }
};
