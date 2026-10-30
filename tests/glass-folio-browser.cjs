const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// "Glass folio" (Build 054): glass frame and warm paper in the native image,
// book typesetting, a GPU slide-and-fade page turn, and a rim highlight that
// stays on the glass.
module.exports = async function glassFolioChecks(browser, { mock, BASE_URL, passed }) {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname, '..', 'source-catalogue.js')).href);
  const excluded = new Set(['blake-sick-rose', 'whitman-astronomer', 'whitman-captain', 'ohenry-magi', 'chopin-desiree', 'bacon-studies', 'bacon-truth']);
  const works = ['poem', 'story', 'essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !excluded.has(w.id)));
  async function setup({ reduce = false } = {}) {
    const p = await browser.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
    await mock(p, 'layer', false, { practised: true, headPointer: false, visits: 4 });
    await p.addInitScript(w => {
      localStorage.setItem('cabin-today', JSON.stringify({ version: 2, date: '2026-10-29', picks: Object.fromEntries(w.map(x => [x.kind, { catalogueId: x.id }])) }));
      window.__folioText = [];
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...a) {
        if (this.canvas.height === 1920 && this.canvas.width === 2048) __folioText.push({ text: String(t), font: this.font });
        return fill.call(this, t, ...a);
      };
    }, works.map(({ id, kind }) => ({ id, kind })));
    await p.clock.setFixedTime(new Date(2026, 9, 29, 20));
    await p.goto(BASE_URL); await p.locator('#enter').click();
    await p.evaluate(() => {
      __center();
      const P = WebGL2RenderingContext.prototype;
      window.__nativeImage = () => {
        const gl = __mock.gl, d = __mock.layerData.get(__mock.quad), v = d.viewport || { x: 0, y: 0, width: d.width, height: d.height };
        const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), fbo = gl.createFramebuffer();
        P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, fbo); P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d.tex, 0);
        const px = new Uint8Array(v.width * v.height * 4); gl.readPixels(v.x, v.y, v.width, v.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
        P.framebufferTexture2D.call(gl, gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0); P.bindFramebuffer.call(gl, gl.READ_FRAMEBUFFER, prev); gl.deleteFramebuffer(fbo);
        return { px, v };
      };
      // Native pixel at page coordinates (top-left origin).
      window.__at = (n, x, y) => { const k = ((n.v.height - 1 - Math.floor(y * n.v.height / 2560)) * n.v.width + Math.floor(x * n.v.width / 2048)) * 4; return Array.from(n.px.slice(k, k + 4)); };
      // Rows (page px) where the native image differs from the clean canvas.
      window.__diffRows = (n) => {
        const ref = document.createElement('canvas'); ref.width = n.v.width; ref.height = n.v.height;
        ref.getContext('2d').drawImage(document.querySelector('#page'), 0, 0, n.v.width, n.v.height);
        const src = ref.getContext('2d').getImageData(0, 0, n.v.width, n.v.height).data;
        let maxY = -1, count = 0;
        for (let y = 0; y < n.v.height; y += 2) for (let x = 0; x < n.v.width; x += 2) {
          const k = ((n.v.height - 1 - y) * n.v.width + x) * 4, s = (y * n.v.width + x) * 4, a = src[s + 3] / 255;
          if (Math.max(Math.abs(n.px[k] - src[s] * a), Math.abs(n.px[k + 1] - src[s + 1] * a), Math.abs(n.px[k + 2] - src[s + 2] * a)) > 12) { count++; maxY = Math.max(maxY, y * 2560 / n.v.height); }
        }
        return { count, maxY };
      };
    });
    const open = kind => p.evaluate(async id => { await __aim(id, true); __pinch(); __step(700); for (let i = 0; i < 10; i++) __step(40); },
      `home-work:today-2026-10-29-${kind}-${works[['poem', 'story', 'essay'].indexOf(kind)].id}`);
    return { p, errors, open };
  }

  // 1. Glass, paper and book typesetting.
  {
    const { p, errors, open } = await setup();
    await open('story');
    assert.equal(await p.locator('#page').getAttribute('data-view'), 'reading');
    const r = await p.evaluate(() => { const n = __nativeImage(); return { glass: __at(n, 26, 1280), paper: __at(n, 120, 1280), text: __folioText.slice() }; });
    assert.ok(r.glass[3] > 60 && r.glass[3] < 220, `glass frame is not translucent: ${r.glass}`);
    assert.equal(r.paper[3], 255, 'paper is not opaque');
    assert.ok(r.paper[0] > r.paper[1] && r.paper[1] > r.paper[2], `paper is not warm: ${r.paper}`);
    const story = works[1];
    const title = r.text.find(t => t.text.includes(story.title.split(' ')[0].replace("'", '’')) && /66px/.test(t.font));
    assert.ok(title && /small-caps/.test(title.font), `title not in small capitals: ${JSON.stringify(title)}`);
    assert.ok(r.text.some(t => /small-caps 36px/.test(t.font)), 'author line not in small capitals');
    const cap = r.text.find(t => t.text.length === 1 && Number(/(\d+)px/.exec(t.font)[1]) > 100);
    assert.ok(cap, 'story has no opening letter');
    assert.ok(r.text.some(t => /^\d+ \/ \d+$/.test(t.text) && /Literata/.test(t.font)), 'book folio missing');
    await p.evaluate(() => { __folioText = []; __hold(); __step(600); });
    await open('poem');
    const poem = await p.evaluate(() => __folioText.slice());
    assert.ok(!poem.some(t => t.text.length === 1 && Number(/(\d+)px/.exec(t.font)[1]) > 100), 'a poem got an opening letter');
    assert.deepEqual(errors, []);
    passed('glass folio: translucent glass frame, warm opaque paper, small-capital title and author, opening letter for prose only, book folio');
    await p.close();
  }

  // 2. Page turn: GPU slide-and-fade both ways, then the exact page.
  for (const reduce of [false, true]) {
    const { p, errors, open } = await setup({ reduce });
    await open('story');
    const r = await p.evaluate(() => {
      const run = hand => {
        const before = { owned: __mock.ownedCanvasUploads, draws: __mock.pageSurfaceDraws };
        __pinch(hand);
        const frames = [];
        for (let i = 0; i < 60; i++) { const t = document.querySelector('#page').dataset.pageTurn; if (t) frames.push(JSON.parse(t)); else if (frames.length) break; __step(16); }
        for (let i = 0; i < 4; i++) __step(16);
        const n = __nativeImage();
        return { frames, place: document.querySelector('#place').textContent, motion: document.querySelector('#page').dataset.pageMotion || null,
          owned: __mock.ownedCanvasUploads - before.owned, draws: __mock.pageSurfaceDraws - before.draws, rest: __diffRows(n) };
      };
      return { next: run('right'), prev: run('left') };
    });
    for (const [name, t, dir] of [['next', r.next, 1], ['prev', r.prev, -1]]) {
      assert.ok(t.frames.length >= 8, `${name}: turn was not animated (${t.frames.length} frames)`);
      assert.ok(t.frames.every(f => f.dir === dir), `${name}: wrong direction`);
      const mid = t.frames.find(f => f.old.alpha < .9 && f.old.alpha > .1);
      assert.ok(mid, `${name}: old words never faded`);
      if (reduce) assert.ok(t.frames.every(f => f.old.dx === 0 && f.next.dx === 0), `${name}: reduced motion still slid`);
      else assert.ok(Math.sign(mid.old.dx) === -dir && Math.abs(mid.old.dx) > 5, `${name}: old words did not slide away`);
      assert.ok(t.frames.at(-1).next.alpha === 1 && t.frames.at(-1).next.dx === 0, `${name}: new words did not come to rest`);
      assert.ok(t.draws >= t.frames.length, `${name}: turn not composed on the GPU`);
      assert.ok(t.owned <= 3, `${name}: turn uploaded ${t.owned} canvases`);
      assert.equal(t.motion, null);
      assert.equal(t.rest.count, 0, `${name}: headset image differs from the page after the turn`);
    }
    assert.match(r.next.place, /Page 2/); assert.match(r.prev.place, /Page 1/);
    assert.deepEqual(errors, []);
    passed(`glass folio: page turns ${reduce ? 'crossfade in place with reduced motion' : 'slide the words out and in both ways'} on the GPU and rest on the exact page`);
    await p.close();
  }

  // 3. Rim highlight: about every 25 s, on the top glass only, then gone.
  {
    const { p, errors, open } = await setup();
    await open('poem');
    const r = await p.evaluate(() => {
      let seen = null, out = null;
      for (let i = 0; i < 900 && !(seen && !document.querySelector('#page').dataset.glassShimmer); i++) {
        __step(40);
        const s = document.querySelector('#page').dataset.glassShimmer;
        if (s && !seen && JSON.parse(s).alpha > .6) { seen = JSON.parse(s); out = __diffRows(__nativeImage()); }
      }
      for (let i = 0; i < 3; i++) __step(16);
      return { seen, during: out, after: __diffRows(__nativeImage()), motion: document.querySelector('#page').dataset.pageMotion || null };
    });
    assert.ok(r.seen, 'no rim highlight within about 25 s of reading');
    assert.ok(r.during.count > 0, 'highlight not visible in the headset image');
    assert.ok(r.during.maxY < 56, `highlight reached below the glass band (y ${r.during.maxY})`);
    assert.equal(r.after.count, 0, 'highlight left marks after its pass');
    assert.equal(r.motion, null);
    assert.deepEqual(errors, []);
    passed('glass folio: rim highlight passes on the top glass only, never over the words, and leaves no trace');
    await p.close();
  }
};
