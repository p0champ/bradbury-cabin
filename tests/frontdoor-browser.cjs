const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function frontdoorChecks(browser, {mock, BASE_URL, out, passed}) {
  const p = await browser.newPage({viewport: {width: 1440, height: 1100}});
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => { window.__testClosedDisclosures = true; });
  await p.goto(BASE_URL);
  await p.waitForFunction(() => document.getElementById('place').textContent.includes('Page'));
  const disclosures = ['browser-settings', 'reading-help', 'preview-tools'];
  const assertClosed = async () => {
    for (const id of disclosures) assert.equal(await p.locator('#' + id).evaluate(el => el.open), false, id + ' defaults closed');
  };
  await assertClosed();
  assert.equal(await p.locator('#enter').isVisible(), true);
  assert.equal(await p.locator('#drive-sync').isVisible(), true);
  assert.equal(await p.locator('#status').isVisible(), true);
  assert.equal(await p.locator('#status').getAttribute('role'), 'status');
  assert.equal(await p.locator('#status').getAttribute('aria-live'), 'polite');
  assert.equal(await p.locator('#page').isVisible(), false);
  assert.equal(await p.locator('#ambience-volume').isVisible(), false);
  assert.equal(await p.locator('.gestures').isVisible(), false);
  assert.equal(await p.evaluate(() => [...document.querySelector('.start-row').children].map(el => el.id).join(',')), 'enter,drive-sync');
  const footer = await p.locator('footer').innerText();
  assert.match(footer, /when storage is available/);
  assert.match(footer, /Sync with Drive to share progress/);
  assert.doesNotMatch(footer, /arrives with Claude|successfully saved|everything is saved/i);
  assert.match(await p.locator('#drive-sync').textContent(), /^Sync with Drive$/);
  assert.doesNotMatch(await p.locator('#status').textContent(), /successfully saved|synced with Google Drive at/i);
  await p.screenshot({path: path.join(out, 'frontdoor-default.png'), fullPage: true});
  passed('front door: entry and live status visible; help/tools closed; unsynced Drive and storage wording truthful');

  // Native summaries must work without a mouse; closed controls must leave the tab order.
  for (const id of disclosures) {
    const summary = p.locator('#' + id + ' > summary');
    await summary.focus();
    await p.keyboard.press('Enter');
    assert.equal(await p.locator('#' + id).evaluate(el => el.open), true);
    await p.keyboard.press('Space');
    assert.equal(await p.locator('#' + id).evaluate(el => el.open), false);
    assert.equal(await summary.evaluate(el => document.activeElement === el), true);
  }
  await p.locator('#browser-settings > summary').focus();
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.parentElement.id), 'reading-help');
  await p.locator('#browser-settings > summary').focus();
  await p.keyboard.press('Enter');
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'ambience-volume');
  await p.keyboard.press('Home');
  assert.equal(await p.locator('#ambience-volume-value').textContent(), 'Off');
  await p.keyboard.press('End');
  assert.equal(await p.locator('#ambience-volume-value').textContent(), '100%');
  await p.locator('#browser-settings > summary').focus();
  await p.keyboard.press('Enter');
  passed('front door: native disclosures support Enter/Space, collapsed controls leave Tab order, volume remains keyboard operable');

  await p.locator('#preview-tools > summary').focus();
  await p.keyboard.press('Enter');
  const toolIds = ['menu', 'practice', 'pointer', 'compare', 'night', 'recenter', 'export', 'calendar', 'progress-export', 'progress-import', 'prev', 'next'];
  for (const id of toolIds) assert.equal(await p.locator('#' + id).isVisible(), true, id + ' recovered by opening tools');
  assert.equal(await p.locator('#page').isVisible(), true);
  assert.equal(await p.locator('[data-size]').count(), 3);
  assert.equal(await p.locator('#progress-file').count(), 1);
  await p.locator('#menu').click();
  assert.equal(await p.locator('#page').getAttribute('data-view'), 'menu');
  await p.locator('#menu').click();
  assert.equal(await p.locator('#page').getAttribute('data-view'), 'reading');
  await p.locator('#night').click();
  assert.equal(await p.locator('#night').getAttribute('aria-pressed'), 'true');
  await p.locator('#night').click();
  const downloadPromise = p.waitForEvent('download');
  await p.locator('#progress-export').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.json$/);
  await p.locator('#preview-tools > summary').focus();
  await p.keyboard.press('Space');
  assert.equal(await p.locator('#page').isVisible(), false);
  await p.setViewportSize({width: 360, height: 800});
  await assertClosed();
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await p.locator('#enter').isVisible(), true);
  assert.equal(await p.locator('#status').isVisible(), true);
  await p.screenshot({path: path.join(out, 'frontdoor-default-mobile.png'), fullPage: true});
  await p.emulateMedia({reducedMotion: 'reduce'});
  assert.equal(await p.locator('#enter').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  assert.equal(await p.locator('.intro > div').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(errors, []);
  await p.close();
  passed('front door: all tools recoverable; menu/night/export functional; narrow layout fits; reduced motion respected');

  const xr = await browser.newPage();
  await xr.addInitScript(() => { window.__testClosedDisclosures = true; });
  await mock(xr, 'layer', false, {practised: true, headPointer: true});
  await xr.goto(BASE_URL);
  await xr.locator('#enter:not([disabled])').click();
  await xr.evaluate(() => __center());
  await xr.evaluate(() => __mock.session.end());
  assert.equal(await xr.locator('#enter').isVisible(), true);
  assert.equal(await xr.locator('#status').isVisible(), true);
  for (const id of disclosures) assert.equal(await xr.locator('#' + id).evaluate(el => el.open), false);
  await xr.locator('#enter:not([disabled])').click();
  await xr.evaluate(() => __center());
  await xr.evaluate(() => __mock.session.end());
  await xr.close();
  passed('front door: direct exit and re-entry preserve collapsed entrance with visible status');

  // Instructions must describe the hand that actually turns forward, both
  // for an existing preference and immediately after changing Controls.
  for (const swapped of [false, true]) {
    const hands = await browser.newPage();
    await mock(hands, 'layer', false, {practised: true, headPointer: false, swapped});
    await hands.goto(BASE_URL);
    const expected = left => `Turn the page. ${left ? 'Left' : 'Right'} goes forward, ${left ? 'right' : 'left'} goes back.`;
    assert.ok((await hands.locator('#page-turn-help').textContent()).startsWith(expected(swapped)));
    await hands.locator('#enter:not([disabled])').click();
    await hands.evaluate(() => { __step(); __pinch(); __step(1000); });
    for (const id of ['home-settings', 'settings-more', 'settings-controls', `settings-next:${swapped ? 'right' : 'left'}`]) {
      await hands.evaluate(async id => { await __aim(id, true); __pinch(); __step(500); }, id);
    }
    assert.ok((await hands.locator('#page-turn-help').textContent()).startsWith(expected(!swapped)));
    await hands.evaluate(() => __mock.session.end());
    await hands.reload();
    assert.ok((await hands.locator('#page-turn-help').textContent()).startsWith(expected(!swapped)));
    await hands.close();
    passed(`front door: ${swapped ? 'left' : 'right'} forward-hand instructions follow Controls and survive reload`);
  }
};
