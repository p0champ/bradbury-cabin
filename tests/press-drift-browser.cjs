// Pinch drift and Exit reach through the real frame loop and native events.
// Expected outcomes come from page geometry, not from the app's helpers.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = async function pressDriftChecks(browser, { mock, BASE_URL, passed }) {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname, '..', 'source-catalogue.js')).href);
  const open = async (screen, lying = false, foreignResume = false) => {
    const p = await browser.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await mock(p, 'layer', lying, { practised: true, headPointer: false });
    if (foreignResume) {
      // Exercise the adjacent Resume/Notes rows using the real three-work Home.
      // Empty Home now has a taller Begin card and a deliberate empty gap.
      await p.clock.setFixedTime(new Date(2026, 9, 29, 20));
      const excluded = new Set(['blake-sick-rose', 'whitman-astronomer', 'whitman-captain', 'ohenry-magi', 'chopin-desiree', 'bacon-studies', 'bacon-truth']);
      const works = ['poem', 'story', 'essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !excluded.has(w.id)));
      const foreign = SOURCE_CATALOGUE.find(w => w.kind === 'poem' && w.id !== works[0].id && !excluded.has(w.id));
      await p.addInitScript(({ works, foreign }) => {
        const id = `today-2026-10-28-poem-${foreign.id}`;
        localStorage.setItem('cabin-today', JSON.stringify({ version: 2, date: '2026-10-29', picks: Object.fromEntries(works.map(w => [w.kind, { catalogueId: w.id }])) }));
        localStorage.setItem('cabin-reading', JSON.stringify({ last: id, places: { [id]: { anchor: { block: 0, word: 0, section: 'text' }, page: 0 } } }));
      }, { works: works.map(({ id, kind }) => ({ id, kind })), foreign: { id: foreign.id } });
    }
    await p.goto(BASE_URL); await p.locator('#enter').click();
    await p.evaluate(() => { __hand(.06); __step(600); });
    if (screen !== 'placement') await p.evaluate(() => __center());
    if (!foreignResume && (screen === 'home' || screen === 'settings')) await p.evaluate(() => { __hold(); __hand(.06); __step(800); });
    if (screen === 'settings') await p.evaluate(async () => { await __aim('home-settings', true); __step(800); __pinch(); __step(800); });
    await p.evaluate(() => {
      const page = document.querySelector('#page');
      window.__aimPx = (x, y, hand = 'right') => {
        const pose = new DOMMatrix(JSON.parse(page.dataset.panelPose));
        const t = new DOMPoint((x / 2048 - .5) * .72, (.5 - y / 2560) * .9, 0).matrixTransform(pose);
        const h = new DOMMatrix(__headMatrix());
        const o = new DOMPoint(hand === 'left' ? -0.22 : 0.22, -0.25, -0.45).matrixTransform(h);
        __mock.rayOrigin ||= {}; __mock.rayOrigin[hand] = { x: o.x, y: o.y, z: o.z };
        let dx = t.x - o.x, dy = t.y - o.y, dz = t.z - o.z;
        const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l; const n = Math.hypot(dy, -dx, 1 - dz);
        __mock.rayByHand ||= {}; __mock.rayByHand[hand] = { x: dy / n, y: -dx / n, z: 0, w: (1 - dz) / n };
      };
      // Rest open on (x,y), then close 60→15 mm over 120 ms while the ray dips
      // by dipPx; Quest reports the pinch 30 ms after closing ends.
      window.__driftPress = (x, y, dipPx, { hand = 'right', restMs = 300, closeMs = 120, release = true, releaseAt = null } = {}) => {
        __hand(.06, hand); __aimPx(x, y, hand);
        for (let t = 0; t < restMs; t += 15) __step(15);
        const steps = Math.max(1, Math.round(closeMs / 15));
        for (let k = 1; k <= steps; k++) { __hand((60 - 45 * k / steps) / 1000, hand); __aimPx(x, y + dipPx * k / steps, hand); __step(15); }
        __step(15); __step(15);
        __native('selectstart', hand); __step(15);
        const held = JSON.parse(page.dataset.pointerMarks || '[]').find(m => m.hand === hand) || null;
        for (let t = 0; t < 180; t += 15) __step(15);
        if (!release) return held;
        if (releaseAt) __aimPx(releaseAt[0], releaseAt[1], hand);
        __hand(.06, hand); __native('select', hand); __native('selectend', hand); __step(16);
        return held;
      };
    });
    return { p, errors };
  };
  const buttons = p => p.evaluate(() => JSON.parse(document.querySelector('#page').dataset.buttons));
  const centre = b => [b.x + b.w / 2, b.y + b.h / 2];

  // 1. What you see is what you get: the pinch selects what is highlighted
  // when the headset reports it, and the held dot stays on that button.
  for (const lying of [false, true]) {
    const { p, errors } = await open('home', lying, true);
    const bs = await buttons(p), A = bs.find(b => b.id === 'home-resume'), B = bs.find(b => b.id === 'home-notes');
    const x = 300, y = A.y + A.h - 25, dip = 82; // ends inside home-notes
    const held = await p.evaluate(({ x, y, dip }) => __driftPress(x, y, dip, { release: false }), { x, y, dip });
    const shown = await p.evaluate(() => document.querySelector('#page').dataset.target);
    if (held?.look !== 'press') console.log('Press readiness diagnostics', await p.evaluate(async () => {
      const original=URL.createObjectURL; let blob;
      URL.createObjectURL=b=>{blob=b;return original(b);};
      document.querySelector('#export').click(); URL.createObjectURL=original;
      const d=JSON.parse(await blob.text());
      return { input:d.inputState, events:d.nativeEvents.slice(-16), ignored:d.ignoredPinches.slice(-6) };
    }));
    assert.equal(shown, 'home-notes', `fixture: Notes should be highlighted at the press: ${JSON.stringify({A,B,held})}`);
    assert.ok(held && held.look === 'press' && held.y >= B.y && held.y <= B.y + B.h, `held dot ${JSON.stringify(held)} not on the highlighted button`);
    await p.evaluate(() => { __hand(.06); __native('select'); __native('selectend'); __step(16); });
    assert.equal(await p.evaluate(() => document.querySelector('#page').dataset.menuPage), 'notes', 'the pinch did not select the highlighted button');
    assert.deepEqual(errors, []);
    // Documented trade-off (BUILD 051): a 29 mm drift that ends on the row below selects that row,
    // as in 043. The highlight shows it before release; 045's look-back guarded this.
    passed(`press: the pinch selects exactly the highlighted button, including after drift onto the row below ${lying ? 'lying' : 'upright'}`);
    await p.close();
  }

  // 2. Deliberate move: aim at the lower row and dwell, then pinch → lower row.
  {
    const { p } = await open('home');
    const bs = await buttons(p), B = bs.find(b => b.id === 'home-notes');
    await p.evaluate(([x, y]) => __driftPress(x, y, 0), centre(B));
    assert.equal(await p.evaluate(() => document.querySelector('#page').dataset.menuPage), 'notes', 'deliberate aim was overridden');
    passed('press: a deliberate, dwelled aim is never rolled back');
    await p.close();
  }

  // 3. Real-hand habits: still moving while pinching, and row-to-row.
  {
    // From empty space, sweep onto Resume while the fingers close.
    const { p } = await open('home');
    const bs = await buttons(p), R = bs.find(b => b.id === 'home-resume');
    await p.evaluate(({ R }) => {
      const x = R.x + 600, y0 = R.y - 260, y1 = R.y + R.h / 2;
      __hand(.06); __aimPx(x, y0); for (let t = 0; t < 400; t += 15) __step(15);
      for (let k = 1; k <= 8; k++) { __hand((60 - 45 * k / 8) / 1000); __aimPx(x, y0 + (y1 - y0) * k / 8); __step(15); }
      __step(15); __native('selectstart'); for (let t = 0; t < 150; t += 15) __step(15);
      __hand(.06); __native('select'); __native('selectend'); __step(16);
    }, { R });
    assert.equal(await p.evaluate(() => document.querySelector('#page').dataset.view), 'reading', 'pinching while arriving on Resume did not open it');
    passed('press: pinching while still moving onto a button selects it');
    await p.close();
  }
  for (const [from, to] of [['settings-appearance:paper', 'settings-type:literary'], ['settings-type:modern', 'settings-appearance:night']]) {
    // Aim at one row, move to the adjacent row, settle ~100 ms, pinch.
    const { p } = await open('settings');
    const bs = await buttons(p), A = bs.find(b => b.id === from), B = bs.find(b => b.id === to);
    const held = await p.evaluate(({ A, B }) => {
      __hand(.06); __aimPx(A.x + A.w / 2, A.y + A.h / 2); for (let t = 0; t < 400; t += 15) __step(15);
      __aimPx(B.x + B.w / 2, B.y + B.h / 2); for (let t = 0; t < 100; t += 15) __step(15);
      for (let k = 1; k <= 4; k++) { __hand((60 - 45 * k / 4) / 1000); __step(15); }
      __native('selectstart'); __step(15);
      return JSON.parse(document.querySelector('#page').dataset.pointerMarks || '[]')[0] || null;
    }, { A, B });
    assert.ok(held && held.y >= B.y - 34 && held.y <= B.y + B.h + 34, `moved to ${to} but press held ${JSON.stringify(held)}`);
    passed(`press: moving to the adjacent row and pinching selects it (${to})`);
    await p.close();
  }
  // 3b. Forgiving targets: the gap just beside a button counts as that button.
  {
    const { p } = await open('home');
    const bs = await buttons(p), R = bs.find(b => b.id === 'home-resume');
    await p.evaluate(({ R }) => { __hand(.06); __aimPx(R.x + 400, R.y - 14); for (let t = 0; t < 400; t += 15) __step(15); }, { R });
    assert.equal(await p.evaluate(() => document.querySelector('#page').dataset.target), 'home-resume', '5 mm above Resume did not hover it');
    const T = bs.find(b => b.id === 'home-today');
    await p.evaluate(({ T }) => { __aimPx(T.x + T.w / 2, T.y + T.h + 28); for (let t = 0; t < 400; t += 15) __step(15); }, { T });
    assert.equal(await p.evaluate(() => document.querySelector('#page').dataset.target), 'home-today', '10 mm below Today did not hover it');
    passed('press: a point just beside a button hovers and selects it');
    await p.close();
  }

  // 3c. Never guess between two options: a seam point selects neither.
  {
    const { p } = await open('settings');
    const bs = await buttons(p), A = bs.find(b => b.id === 'settings-appearance:paper'), B = bs.find(b => b.id === 'settings-appearance:night');
    const seamX = (A.x + A.w + B.x) / 2, y = A.y + A.h / 2;
    const seen = await p.evaluate(({ seamX, y }) => { __hand(.06); const out = new Set();
      for (let i = 0; i < 40; i++) { __aimPx(seamX + (i % 2 ? 2 : -2), y); __step(15); out.add(document.querySelector('#page').dataset.target || ''); }
      return [...out]; }, { seamX, y });
    assert.ok(!(seen.includes(A.id) && seen.includes(B.id)), `seam flickered between both options: ${seen}`);
    passed('press: the seam between two options never flips between them');
    await p.close();
  }
  // 4. Exit with drift on every surface, plus the far top-right corner.
  // Spec geometry, computed here from the surfaces, not read from the app.
  const PLACE = { x: (2048 - 600 * 2048 / 720) / 2, y: (2560 - 240 * 2048 / 720) / 2, w: 600 * 2048 / 720 };
  const expectDisc = async (p, screen) => {
    if (screen === 'reading') return { cx: 1960, cy: 88, bottom: 260 };
    if (screen === 'placement') return { cx: PLACE.x + PLACE.w - 88, cy: PLACE.y - 88, bottom: PLACE.y };
    const bs = (await buttons(p)).filter(b => b.id !== 'global-exit');
    const top = Math.min(...bs.map(b => b.y)); // card top lies above its first control
    return { cardTopAbove: top };
  };
  for (const screen of ['placement', 'reading', 'home', 'settings']) for (const part of ['upper', 'lower']) {
    const { p } = await open(screen);
    const before = await p.locator('#place').textContent();
    const d = await p.evaluate(() => JSON.parse(document.querySelector('#page').dataset.exitDisc));
    const e = await p.evaluate(() => JSON.parse(document.querySelector('#page').dataset.exitRect));
    const want = await expectDisc(p, screen);
    if (want.cx != null) {
      assert.ok(Math.abs(d.cx - want.cx) < .5 && Math.abs(d.cy - want.cy) < .5, `${screen}: Exit circle at ${d.cx},${d.cy}, spec ${want.cx},${want.cy}`);
      assert.deepEqual([e.x, e.y, e.x + e.w, e.y + e.h].map(Math.round), [want.cx - 140, want.cy - 200, want.cx + 190, Math.min(want.cy + 140, want.bottom)].map(Math.round), `${screen}: Exit zone differs from spec`);
    } else {
      assert.ok(d.cy + 88 <= want.cardTopAbove && Math.abs(d.r - 48) < .01, `${screen}: Exit circle not above its card`);
      assert.deepEqual([e.x, e.y, e.x + e.w].map(Math.round), [d.cx - 140, d.cy - 200, d.cx + 190].map(Math.round));
    }
    // Aim at the circle's upper or lower half, then the 29 mm drift.
    // Upper half with a 29 mm drift, or lower half with a 21 mm drift: both
    // stay inside the generous zone, so Exit is still highlighted at the press.
    await p.evaluate(({ d, part, screen }) => __driftPress(d.cx, part === 'upper' ? d.cy - 30 : d.cy + (screen === 'reading' ? 44 : 20), part === 'upper' ? 82 : screen === 'reading' ? 82 : 60), { d, part, screen });
    assert.equal(await p.evaluate(() => __mock.session.ended), true, `${screen}: drifting press from the ${part} half of Exit did not leave`);
    assert.equal(await p.locator('#place').textContent(), before);
    passed(`exit: drifting pinch from the ${part} half of the circle leaves from ${screen}`);
    await p.close();
  }
  // While an Exit press is held outside menus, the dot shows the chosen point.
  {
    const { p } = await open('reading');
    const held = await p.evaluate(() => __driftPress(1960, 132, 82, { release: false }));
    assert.ok(held && held.look === 'press' && held.y >= 88 - 200 && held.y <= 260, `held Exit dot ${JSON.stringify(held)}`);
    await p.evaluate(() => { __hand(.06); __native('select'); __native('selectend'); __step(16); });
    assert.equal(await p.evaluate(() => __mock.session.ended), true);
    passed('exit: a held press shows the chosen point in the press look while reading');
    await p.close();
  }
  {
    const { p } = await open('reading');
    await p.evaluate(() => __driftPress(2120, -80, 30));
    assert.equal(await p.evaluate(() => __mock.session.ended), true, 'Exit unreachable just past the top-right corner');
    passed('exit: generous zone reaches just past the page corner');
    await p.close();
  }

  // 5. Release tolerance: 15 mm outside the zone still exits, 40 mm cancels.
  for (const [mm, leaves] of [[15, true], [40, false]]) {
    const { p } = await open('reading');
    const e = await p.evaluate(() => JSON.parse(document.querySelector('#page').dataset.exitRect));
    const d = await p.evaluate(() => JSON.parse(document.querySelector('#page').dataset.exitDisc));
    const at = [e.x - mm * 2.844, d.cy];
    await p.evaluate(({ d, at }) => __driftPress(d.cx, d.cy, 0, { releaseAt: at }), { d, at });
    assert.equal(!!(await p.evaluate(() => __mock.session.ended)), leaves, `release ${mm} mm outside: expected ${leaves ? 'exit' : 'cancel'}`);
    passed(`exit: release ${mm} mm outside the zone ${leaves ? 'still leaves' : 'cancels'}`);
    await p.close();
  }

  // 5b. Leaving Exit just before a reading pinch turns the page (no dead pinch).
  {
    const { p } = await open('reading');
    const before = await p.locator('#place').textContent();
    await p.evaluate(() => {
      __hand(.06); __aimPx(1960, 88); for (let t = 0; t < 900; t += 15) __step(15);
      __aimPx(1200, 900); for (let t = 0; t < 45; t += 15) __step(15);
      for (let k = 1; k <= 6; k++) { __hand((60 - 45 * k / 6) / 1000); __step(15); }
      __native('selectstart'); for (let t = 0; t < 150; t += 15) __step(15);
      __hand(.06); __native('select'); __native('selectend'); __step(16);
    });
    assert.notEqual(await p.evaluate(() => __mock.session.ended), true, 'left the cabin after aiming away from Exit');
    assert.notEqual(await p.locator('#place').textContent(), before, 'pinch after leaving Exit did nothing');
    passed('exit: leaving the circle just before a pinch turns the page');
    await p.close();
  }
  // 6. Reading pinches just below the zone turn pages; zone never covers a button.
  {
    const { p } = await open('reading');
    const before = await p.locator('#place').textContent();
    await p.evaluate(() => __driftPress(1900, 320, 0, { restMs: 900 }));
    assert.notEqual(await p.evaluate(() => __mock.session.ended), true, 'a reading pinch below the zone left the cabin');
    assert.notEqual(await p.locator('#place').textContent(), before, 'reading pinch below the zone did not turn the page');
    passed('exit: a reading pinch below the zone turns the page');
    await p.close();
  }
  for (const screen of ['placement', 'home', 'settings']) {
    const { p } = await open(screen);
    const bs = await buttons(p), e = bs.find(b => b.id === 'global-exit');
    const d0 = await p.evaluate(() => JSON.parse(document.querySelector('#page').dataset.exitDisc));
    // Placement has no buttons; its zone must stop at the instruction frame.
    if (screen === 'placement') assert.ok(e.y + e.h <= d0.cy + 88 + .01, 'placement zone covers the instruction frame');
    else for (const b of bs.filter(b => b.id !== 'global-exit'))
      assert.ok(b.x >= e.x + e.w || b.x + b.w <= e.x || b.y >= e.y + e.h || b.y + b.h <= e.y, `${screen}: Exit zone covers ${b.id}`);
    // Hover does not change the zone.
    const d = await p.evaluate(() => JSON.parse(document.querySelector('#page').dataset.exitDisc));
    const rest = await p.evaluate(() => document.querySelector('#page').dataset.exitRect);
    await p.evaluate(d => { __hand(.06); __aimPx(d.cx, d.cy); for (let i = 0; i < 10; i++) __step(15); }, d);
    const hovered = await p.evaluate(() => document.querySelector('#page').dataset.exitRect);
    assert.equal(hovered, rest, 'hover changed the Exit zone');
    passed(`exit: zone stays clear of every ${screen} button and is unchanged by hover`);
    await p.close();
  }

  // 7. Pixels: a 96 px circle, unclipped and clear of the running head.
  for (const screen of ['reading', 'home']) {
    const { p } = await open(screen);
    const m = await p.evaluate(() => {
      const c = document.querySelector('#page'), ctx = c.getContext('2d'), d = JSON.parse(c.dataset.exitDisc);
      const bg = [...ctx.getImageData(Math.round(d.cx - 70), Math.round(d.cy), 1, 1).data];
      // Measure the left half only: in reading, the circle's right half lies
      // over the translucent glass frame (Build 054). The circle is symmetric.
      let left = null;
      for (let x = Math.round(d.cx - 70); x <= Math.round(d.cx); x++) {
        const px = [...ctx.getImageData(x, Math.round(d.cy) + 30, 1, 1).data];
        const ink = bg[3] < 255 ? px[3] > 200 : Math.max(...px.map((v, i) => Math.abs(v - bg[i]))) > 6;
        if (ink) { left = x; break; }
      }
      return { d, chord: 2 * (Math.round(d.cx) - left) + 1 };
    });
    const expected = 2 * Math.sqrt(48 * 48 - 30 * 30); // chord 30 px below centre
    assert.ok(Math.abs(m.chord - expected) <= 4, `Exit circle chord ${m.chord}, expected ${expected.toFixed(1)}`);
    assert.ok(m.d.cy - 48 >= 0 && m.d.cx + 48 <= 2048, 'Exit circle clipped by the window');
    passed(`exit: ${screen} shows an unclipped 96 px circle`);
    await p.close();
  }
};
