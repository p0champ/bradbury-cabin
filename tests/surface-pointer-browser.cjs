const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Native subimage pixels, not pointer diagnostics, establish what is visible.
module.exports = async function surfacePointerChecks(browser, { mock, BASE_URL, out, passed }) {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname, '..', 'source-catalogue.js')).href);
  const excluded = new Set(['blake-sick-rose', 'whitman-astronomer', 'whitman-captain', 'ohenry-magi', 'chopin-desiree', 'bacon-studies', 'bacon-truth']);
  const works = ['poem', 'story', 'essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !excluded.has(w.id)));
  function installSurfaceProbe() {
    const P = WebGL2RenderingContext.prototype;
    window.__surfaceAim = (x, y, hand = 'right') => {
      const page = document.querySelector('#page'), matrix = new DOMMatrix(JSON.parse(page.dataset.panelPose));
      const t = new DOMPoint((x / 2048 - .5) * .72, (.5 - y / 2560) * .9, 0).matrixTransform(matrix);
      const o = new DOMPoint(hand === 'left' ? -.22 : .22, -.25, -.45).matrixTransform(new DOMMatrix(__headMatrix()));
      let dx = t.x - o.x, dy = t.y - o.y, dz = t.z - o.z;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      const n = Math.hypot(dy, -dx, 1 - dz);
      __mock.rayOrigin ||= {}; __mock.rayOrigin[hand] = { x: o.x, y: o.y, z: o.z };
      __mock.rayByHand ||= {}; __mock.rayByHand[hand] = { x: dy / n, y: -dx / n, z: 0, w: (1 - dz) / n };
    };
    window.__surfaceSettle = (x, y) => {
      __surfaceAim(x, y);
      // Advance the stationary filter clock without rendering forty
      // identical software-GPU frames through __step's subdivision loop.
      __mock.clock += 800; __step(16); __mock.clock += 800; __step(16);
    };
    window.__surfaceHash = () => {
      const page = document.querySelector('#page'), bytes = page.getContext('2d').getImageData(0, 0, page.width, page.height).data;
      const words = new Uint32Array(bytes.buffer); let hash = 2166136261;
      window.__surfaceLastPixels = bytes;
      for (let i = 0; i < words.length; i++) hash = Math.imul(hash ^ words[i], 16777619);
      return hash >>> 0;
    };
    window.__surfaceRead = (want = null, full = false) => {
      const gl = __mock.gl, page = document.querySelector('#page'), d = __mock.layerData.get(__mock.quad);
      const v = d.viewport || { x: 0, y: 0, width: d.width, height: d.height };
      const scaleX = v.width / page.width, scaleY = v.height / page.height;
      const x = full || !want ? 0 : Math.max(0, Math.floor((want.x - 64) * scaleX));
      const y = full || !want ? 0 : Math.max(0, Math.floor((want.y - 64) * scaleY));
      const width = full || !want ? v.width : Math.min(v.width - x, Math.ceil(128 * scaleX));
      const height = full || !want ? v.height : Math.min(v.height - y, Math.ceil(128 * scaleY));
      const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), fbo = gl.createFramebuffer();
      P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, fbo);
      P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d.tex, 0);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(v.x + x, v.y + v.height - y - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
      P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, previous); gl.deleteFramebuffer(fbo);
      const ref = document.createElement('canvas'); ref.width = v.width; ref.height = v.height;
      const c = ref.getContext('2d'); c.drawImage(page, 0, 0, v.width, v.height);
      const source = c.getImageData(x, y, width, height).data;
      let count = 0, far = 0, sumX = 0, sumY = 0, samples = 0;
      const stride = full ? 3 : 1;
      for (let py = 0; py < height; py += stride) for (let px = 0; px < width; px += stride) {
        const k = ((height - 1 - py) * width + px) * 4, s = (py * width + px) * 4, alpha = source[s + 3] / 255;
        const diff = Math.max(Math.abs(pixels[k] - source[s] * alpha), Math.abs(pixels[k + 1] - source[s + 1] * alpha), Math.abs(pixels[k + 2] - source[s + 2] * alpha), Math.abs(pixels[k + 3] - source[s + 3]));
        samples++;
        if (diff > 28) {
          const sx = (x + px + .5) / scaleX, sy = (y + py + .5) / scaleY;
          count++; sumX += sx; sumY += sy;
          if (want && Math.hypot(sx - want.x, sy - want.y) > 38) far++;
        }
      }
      return { count, far, samples, centroid: count ? { x: sumX / count, y: sumY / count } : null,
        viewport: v, seen: d.seen?.size || 0, surfaceDraws: __mock.pageSurfaceDraws,
        canvasUploads: __mock.ownedCanvasUploads, pageUploads: __mock.uploads,
        target: page.dataset.target, sourceSurface: page.dataset.pointerSurface,
        separate: [...__mock.layerData].filter(([layer, data]) => data.pointer && layer.opacity > 0 && __mock.session.renderState.layers.includes(layer)).length };
    };
  }
  const target = (p, id) => p.evaluate(async id => { await __aim(id, true); __pinch(); __step(700); }, id);
  async function setup(scenario, lying) {
    const p = await browser.newPage(), errors = []; p.on('pageerror', error => errors.push(error.message));
    await mock(p, scenario, lying, { practised: true, headPointer: false, visits: 4 });
    await p.addInitScript(works => localStorage.setItem('cabin-today', JSON.stringify({ version: 2, date: '2026-10-29', picks: Object.fromEntries(works.map(w => [w.kind, { catalogueId: w.id }])) })), works.map(({ id, kind }) => ({ id, kind })));
    await p.clock.setFixedTime(new Date(2026, 9, 29, 20));
    await p.goto(BASE_URL); await p.locator('#enter').click();
    await p.evaluate(() => { __center(); if (document.querySelector('#page').dataset.view !== 'menu') __hold(); __hand(.05); __step(800); });
    await p.evaluate(installSurfaceProbe);
    return { p, errors };
  }
  function assertDot(r, want, label) {
    assert.equal(r.separate, 0, `${label}: native menu cursor is still on a separate depth plane`);
    assert.ok(r.count > 2, `${label}: no cursor ink in native page subimage`);
    assert.ok(r.centroid && Math.hypot(r.centroid.x - want.x, r.centroid.y - want.y) < 9, `${label}: native cursor does not match requested page point: ${JSON.stringify(r.centroid)} vs ${JSON.stringify(want)}`);
    assert.equal(r.far, 0, `${label}: native page contains stale ink away from the current dot (${r.far} samples)`);
  }
  for (const [scenario, lying] of (process.env.CABIN_SURFACE_SWEEP_ONLY ? [] : [['layer', false], ['layer', true], ['offset-layer', false], ['clamped-offset-layer', true]])) {
    console.log(`CHECK surface setup ${scenario} ${lying ? 'lying' : 'upright'}`);
    const { p, errors } = await setup(scenario, lying);
    for (const route of ['today', 'settings']) {
      console.log(`CHECK surface pixels ${scenario} ${route}`);
      if (route === 'settings') await target(p, 'home-settings');
      const rows = await p.evaluate(() => JSON.parse(document.querySelector('#page').dataset.buttons).filter(b => b.id !== 'global-exit'));
      for (const row of rows) {
        // A 6mm inset avoids the control edge's antialiasing while exercising
        // the full extent of each card rather than testing its center alone.
        const inset = Math.min(18, row.w / 4, row.h / 4);
        for (const [x, y] of [[row.x + inset, row.y + inset], [row.x + row.w - inset, row.y + inset], [row.x + inset, row.y + row.h - inset], [row.x + row.w - inset, row.y + row.h - inset], [row.x + row.w / 2, row.y + row.h / 2]]) {
          const r = await p.evaluate(({ x, y }) => { __surfaceSettle(x, y); return __surfaceRead({ x, y }); }, { x, y });
          assert.equal(r.target, row.id, `${scenario}/${route}: displayed point must hit ${row.id}`);
          assertDot(r, { x, y }, `${scenario}/${lying ? 'lying' : 'upright'}/${route}/${row.id}`);
        }
      }
    }
    if (scenario.includes('offset')) {
      const v = await p.evaluate(() => __surfaceRead().viewport);
      assert.ok(v.x > 0 && v.y > 0, 'offset fixture did not expose a nonzero subimage origin');
      if (scenario.includes('clamped')) assert.equal(v.width, 1024, 'clamped fixture must resize the actual native subimage');
    }
    assert.deepEqual(errors, []);
    await p.close(); passed(`surface pointer: native pixels and hits agree at every Home/Settings control corner and center ${scenario} ${lying ? 'lying' : 'upright'}`);
  }
  {
    const { p, errors } = await setup('layer', false);
    const trace = await p.evaluate(() => {
      const row = JSON.parse(document.querySelector('#page').dataset.buttons).find(b => b.id.startsWith('home-work:'));
      const y = row.y + row.h / 2, left = row.x + 60, right = row.x + row.w - 60;
      __surfaceAim(left + (right - left) * .2, y); for (let i = 0; i < 24; i++) __step(16);
      const before = { source: __surfaceHash(), uploads: __mock.ownedCanvasUploads, pageUploads: __mock.uploads, draws: __mock.pageSurfaceDraws, target: document.querySelector('#page').dataset.target };
      const beforePixels = __surfaceLastPixels;
      const frames = [];
      for (let i = 0; i < 12; i++) {
        const x = left + (right - left) * (i % 2 ? .8 : .2);
        // Continuous frames preserve gesture readiness. The long moves exceed
        // the existing filter reset distance, so these are exact settled points.
        __surfaceAim(x, y); __step(16); __step(16);
        frames.push({ want: { x, y }, pixels: __surfaceRead({ x, y }, true) });
      }
      const after = { source: __surfaceHash(), uploads: __mock.ownedCanvasUploads, pageUploads: __mock.uploads, draws: __mock.pageSurfaceDraws, target: document.querySelector('#page').dataset.target };
      let changed = 0, maxDifference = 0; const examples = [];
      for (let i = 0; i < beforePixels.length; i++) if (beforePixels[i] !== __surfaceLastPixels[i]) {
        changed++; maxDifference = Math.max(maxDifference, Math.abs(beforePixels[i] - __surfaceLastPixels[i]));
        if (examples.length < 8) examples.push({ x: Math.floor(i / 4) % 2048, y: Math.floor(i / 8192), channel: i % 4, before: beforePixels[i], after: __surfaceLastPixels[i] });
      }
      return { before, frames, after, sourceDifference: { changed, maxDifference, examples } };
    });
    if (out) { await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'surface-pointer-metrics.json'), JSON.stringify(trace, null, 2)); }
    for (const f of trace.frames) assertDot(f.pixels, f.want, 'rotating native swapchain');
    // Canvas readback can round a handful of translucent edge channels by one
    // unit after drawImage uses its backing store. A cursor changes hundreds
    // of pixels by tens/hundreds of units; retain a strict bound on both.
    assert.ok(trace.after.source === trace.before.source || (trace.sourceDifference.maxDifference <= 1 && trace.sourceDifference.changed <= 32),
      `cursor-only motion changed pristine page pixels: ${JSON.stringify(trace.sourceDifference)}`);
    assert.equal(trace.after.uploads, trace.before.uploads, 'cursor-only motion uploaded CPU canvas pixels');
    assert.equal(trace.after.pageUploads, trace.before.pageUploads, 'cursor-only motion used native texSubImage2D instead of GPU composition');
    assert.ok(trace.after.draws > trace.before.draws, 'cursor-only motion did not redraw the acquired native subimage');
    assert.equal(trace.frames.at(-1).pixels.seen, 3, 'test did not visit all native swapchain images');
    // Loss must remove ink from every rotated image, even without another aim.
    const lost = await p.evaluate(() => { __mock.session.inputSources = []; const frames = []; for (let i = 0; i < 10; i++) { __step(30); frames.push(__surfaceRead(null, true)); } return frames; });
    for (const r of lost) assert.equal(r.count, 0, 'input loss left a cursor in a native swapchain image');
    const poseLost = await p.evaluate(() => {
      const row = JSON.parse(document.querySelector('#page').dataset.buttons).find(b => b.id.startsWith('home-work:'));
      __hand(.05); __surfaceSettle(row.x + row.w / 2, row.y + row.h / 2);
      const before = __surfaceRead({ x: row.x + row.w / 2, y: row.y + row.h / 2 });
      __mock.poseLost = true; const frames = [];
      for (let i = 0; i < 5; i++) { __step(30); frames.push(__surfaceRead(null, true)); }
      __mock.poseLost = false; __step(30);
      return { before, frames };
    });
    assert.ok(poseLost.before.count > 2, 'viewer-pose loss check never established a visible native cursor');
    for (const r of poseLost.frames) assert.equal(r.count, 0, 'viewer-pose loss left cursor ink baked into the native page');
    await p.evaluate(() => { __hold(); __step(800); });
    assert.equal(await p.locator('#page').getAttribute('data-view'), 'reading');
    assert.ok((await p.evaluate(() => __surfaceRead(null, true))).count === 0, 'menu close leaked cursor ink into reading');
    assert.deepEqual(errors, []);
    await p.close(); passed(`surface pointer: all three swapchain images stay clean, source pristine, zero CPU uploads; ${trace.after.draws - trace.before.draws} GPU draws`);
  }
  {
    const { p, errors } = await setup('layer', true);
    const r = await p.evaluate(() => {
      const page = document.querySelector('#page'), b = JSON.parse(page.dataset.buttons).find(b => b.id === 'home-settings');
      const want = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      __surfaceSettle(want.x, want.y);
      // Re-arm through continuous open-hand frames after stationary clock
      // settling; a tracking sample gap deliberately cancels pending input.
      for (let i = 0; i < 32; i++) __step(16);
      __hand(.012); __native('selectstart'); __step(20);
      const started = { pixels: __surfaceRead(want, true), marks: JSON.parse(page.dataset.pointerMarks || '[]') };
      const shelf = JSON.parse(page.dataset.buttons).find(b => b.id === 'home-shelf');
      __surfaceAim(shelf.x + shelf.w / 2, shelf.y + shelf.h / 2); for (let i = 0; i < 10; i++) __step(20);
      const held = __surfaceRead(want, true);
      __hand(.05); __native('select'); __native('selectend'); __step(20);
      return { want, started, held, route: page.dataset.menuPage };
    });
    assert.ok(r.started.marks.some(mark => mark.hand === 'right' && mark.look === 'press'), `native press was not accepted before drift: ${JSON.stringify(r.started.marks)}`);
    assertDot(r.started.pixels, r.want, 'accepted native press before drift');
    assertDot(r.held, r.want, 'fresh held native press');
    assert.equal(r.held.target, 'home-settings');
    assert.equal(r.route, 'settings', 'held press selected where the raw hand drifted rather than the displayed dot');
    assert.deepEqual(errors, []); await p.close(); passed('surface pointer: fresh held press keeps native cursor, highlight and selected target together while lying down');
  }
};
