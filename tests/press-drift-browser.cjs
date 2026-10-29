// Pinch drift and Exit reach through the real frame loop and native events.
// Expected outcomes come from page geometry, not from the app's helpers.
const assert = require('node:assert/strict');

module.exports = async function pressDriftChecks(browser, { mock, BASE_URL, passed }) {
  const open = async (screen, lying = false) => {
    const p = await browser.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await mock(p, 'layer', lying, { practised: true, headPointer: false });
    await p.goto(BASE_URL); await p.locator('#enter').click();
    await p.evaluate(() => { __hand(.06); __step(600); });
    if (screen !== 'placement') await p.evaluate(() => __center());
    if (screen === 'home' || screen === 'settings') await p.evaluate(() => { __hold(); __hand(.06); __step(800); });
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

  // 1. Drift into the button below: the aimed button opens, the dot shows it.
  for (const lying of [false, true]) {
    const { p, errors } = await open('home', lying);
    const bs = await buttons(p), A = bs.find(b => b.id === 'home-resume'), B = bs.find(b => b.id === 'home-notes');
    const x = 300, y = A.y + A.h - 25, dip = 82; // 29 mm: ends inside home-notes
    assert.ok(y + dip > B.y && y + dip < B.y + B.h, 'fixture dip must land on the lower button');
    const held = await p.evaluate(({ x, y, dip }) => __driftPress(x, y, dip, { release: false }), { x, y, dip });
    assert.ok(held && Math.abs(held.y - y) < 8 && held.y < A.y + A.h, `press dot at y ${held?.y}, aimed ${y}`);
    assert.equal(held.look, 'press');
    await p.evaluate(() => { __hand(.06); __native('select'); __native('selectend'); __step(16); });
    const after = await p.evaluate(() => ({ menuOpen: document.querySelector('#page').dataset.view, menu: document.querySelector('#page').dataset.menuPage }));
    assert.notEqual(after.menu, 'notes', 'pinch drift opened the button below the aimed one');
    assert.ok(!['home'].includes(after.menu), `aimed Resume did not open (${JSON.stringify(after)})`);
    assert.deepEqual(errors, []);
    passed(`press: pinch drift into the row below still opens the aimed row ${lying ? 'lying' : 'upright'}`);
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

  // 3. Large dip beyond the look-back bound falls back to the press-time aim.
  {
    const { p } = await open('home');
    const bs = await buttons(p), A = bs.find(b => b.id === 'home-today');
    const held = await p.evaluate(([x, y]) => __driftPress(x, y, 160, { release: false }), centre(A));
    assert.ok(held && held.y > centre(A)[1] + 120, 'a 56 mm move was treated as drift');
    passed('press: a move larger than the drift bound is not rolled back');
    await p.close();
  }

  // 4. Exit with drift on every surface, plus the far top-right corner.
  // Spec geometry, computed here from the surfaces, not read from the app.
  const PLACE = { x: (2048 - 600 * 2048 / 720) / 2, y: (2560 - 240 * 2048 / 720) / 2, w: 600 * 2048 / 720 };
  const expectDisc = async (p, screen) => {
    if (screen === 'reading') return { cx: 1960, cy: 88, bottom: 200 };
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
    await p.evaluate(({ d, part }) => __driftPress(d.cx, part === 'upper' ? d.cy - 30 : d.cy + 44, 82), { d, part });
    assert.equal(await p.evaluate(() => __mock.session.ended), true, `${screen}: drifting press from the ${part} half of Exit did not leave`);
    assert.equal(await p.locator('#place').textContent(), before);
    passed(`exit: drifting pinch from the ${part} half of the circle leaves from ${screen}`);
    await p.close();
  }
  // While an Exit press is held outside menus, the dot shows the chosen point.
  {
    const { p } = await open('reading');
    const held = await p.evaluate(() => __driftPress(1960, 132, 82, { release: false }));
    assert.ok(held && held.look === 'press' && Math.abs(held.y - 132) < 8, `held Exit dot ${JSON.stringify(held)}`);
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

  // 6. Reading pinches just below the zone turn pages; zone never covers a button.
  {
    const { p } = await open('reading');
    const before = await p.locator('#place').textContent();
    await p.evaluate(() => __driftPress(1900, 260, 0, { restMs: 900 }));
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
      let left = null, right = null;
      for (let x = Math.round(d.cx - 70); x <= Math.round(d.cx + 70); x++) {
        const px = [...ctx.getImageData(x, Math.round(d.cy) + 30, 1, 1).data];
        const ink = bg[3] < 255 ? px[3] > 200 : Math.max(...px.map((v, i) => Math.abs(v - bg[i]))) > 6;
        if (ink) { left ??= x; right = x; }
      }
      return { d, chord: right - left + 1 };
    });
    const expected = 2 * Math.sqrt(48 * 48 - 30 * 30); // chord 30 px below centre
    assert.ok(Math.abs(m.chord - expected) <= 4, `Exit circle chord ${m.chord}, expected ${expected.toFixed(1)}`);
    assert.ok(m.d.cy - 48 >= 0 && m.d.cx + 48 <= 2048, 'Exit circle clipped by the window');
    passed(`exit: ${screen} shows an unclipped 96 px circle`);
    await p.close();
  }
};
