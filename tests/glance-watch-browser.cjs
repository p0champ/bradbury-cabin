const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// "Glance face" (Build 053): the real wrist layer is Apple Watch sized, fades
// over a quarter second, and paints only the time, today's actual reading
// and the streak.
module.exports = async function glanceWatchChecks(browser, { mock, BASE_URL, passed }) {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname, '..', 'source-catalogue.js')).href);
  const excluded = new Set(['blake-sick-rose', 'whitman-astronomer', 'whitman-captain', 'ohenry-magi', 'chopin-desiree', 'bacon-studies', 'bacon-truth']);
  const works = ['poem', 'story', 'essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !excluded.has(w.id)));
  const p = await browser.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
  await mock(p, 'layer', false, { practised: true, headPointer: false, visits: 4 });
  await p.addInitScript(w => {
    localStorage.setItem('cabin-today', JSON.stringify({ version: 2, date: '2026-10-29', picks: Object.fromEntries(w.map(x => [x.kind, { catalogueId: x.id }])) }));
    // Record what is painted on the 512 × 448 wrist canvas.
    window.__watchText = [];
    const fill = CanvasRenderingContext2D.prototype.fillText, clear = CanvasRenderingContext2D.prototype.clearRect;
    const isWatch = c => c.width === 512 && c.height === 448 && c.id !== 'page';
    CanvasRenderingContext2D.prototype.clearRect = function (...a) { if (isWatch(this.canvas) && a[2] === 512) __watchText = []; return clear.call(this, ...a); };
    CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { if (isWatch(this.canvas)) __watchText.push(String(t)); return fill.call(this, t, ...a); };
  }, works.map(({ id, kind }) => ({ id, kind })));
  await p.clock.setFixedTime(new Date(2026, 9, 29, 21, 47));
  await p.goto(BASE_URL); await p.locator('#enter').click();
  await p.evaluate(() => __center());
  const r = await p.evaluate(() => {
    window.__glance = () => {
      const s = __hand(.05, 'right'), H = new DOMMatrix(__headMatrix());
      for (const [name, v] of [['wrist', [.03, -.08, -.35]], ['index-finger-metacarpal', [-.04, -.10, -.35]], ['pinky-finger-metacarpal', [-.03, -.06, -.35]], ['middle-finger-metacarpal', [-.05, -.08, -.35]]]) {
        const q = new DOMPoint(...v).matrixTransform(H); s.testJoints.set(name, { pose: { x: q.x, y: q.y, z: q.z } });
      }
      return s;
    };
    const watch = () => [...__mock.layerData].find(([, d]) => d.watch);
    const ramp = [];
    for (let t = 0; t < 900; t += 16) { __glance(); __step(16); ramp.push(watch()?.[0].opacity || 0); }
    const [layer, d] = watch();
    return { ramp, metres: [d.metresWide, d.metresHigh], text: __watchText.slice(), uploaded: (__mock.versions.get(d.tex) || 0) > 0, opacity: layer.opacity };
  });
  assert.ok(r.metres[0] <= .046 && r.metres[1] <= .04, `wrist face is not Apple Watch sized: ${r.metres}`);
  assert.equal(r.opacity, 1);
  const first = r.ramp.findIndex(o => o > 0), full = r.ramp.findIndex(o => o === 1);
  assert.ok(first >= 0 && full > first, 'wrist face never faded in');
  const fadeMs = (full - first) * 16;
  assert.ok(fadeMs >= 200 && fadeMs <= 300, `fade took ${fadeMs} ms, expected about 250`);
  assert.ok(r.uploaded, 'wrist texture was never uploaded');
  assert.deepEqual(r.text.slice(0, 1), ['21:47'], `time missing: ${JSON.stringify(r.text)}`);
  assert.ok(r.text.includes('Poem · ') && r.text.some(t => works[0].title.startsWith(t.replace(/…$/, ''))), `today's real poem missing: ${JSON.stringify(r.text)}`);
  assert.ok(r.text.at(-1).endsWith('streak') || r.text.at(-1) === 'Begin a streak today', `streak missing: ${JSON.stringify(r.text)}`);
  assert.equal(r.text.length, 4, `face painted more than time, reading and streak: ${JSON.stringify(r.text)}`);
  assert.deepEqual(errors, []);
  passed('glance watch: Apple Watch sized, quarter-second fade, only time, today\'s real reading and streak');
  await p.close();
};
