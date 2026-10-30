const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async function sessionDetailsChecks(browser, { mock, BASE_URL, out, passed }) {
  for (const diagnostics of [false, true]) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    await mock(p, 'layer', false, { practised: true, headPointer: false });
    await p.addInitScript(() => { window.__testClosedDisclosures = true; });
    await p.goto(BASE_URL + (diagnostics ? '?pointerDiagnostics=1' : ''));
    assert.equal(await p.locator('#session-details').isVisible(), diagnostics);
    assert.equal(await p.locator('#preview-tools').evaluate(d => d.open), false);
    await p.locator('#enter').click();
    await p.evaluate(async () => {
      __center(); __hold(); __hand(.05); __step(800);
      await __aim('home-settings', true); __pinch(); __step(700);
      await __aim('settings-size:0', true); __pinch(); __step(700);
    });
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'), 'settings');
    const geometry = await p.evaluate(() => ({ width: __mock.quad.width, height: __mock.quad.height, transform: Array.from(__mock.quad.transform.matrix) }));
    await p.evaluate(() => __mock.session.end());
    // The synthetic compositor appends a 1200px evidence canvas to the body.
    // It is not part of the browser page being checked for mobile overflow.
    await p.addStyleTag({content:'#xr-preview, #welcome-scene { display:none !important; }'});
    assert.equal(await p.locator('#session-details').isVisible(), true);
    assert.equal(await p.locator('#preview-tools').evaluate(d => d.open), false, 'export must not require opening advanced tools');
    const b = await p.locator('#session-export').boundingBox();
    assert.ok(b && b.x >= 0 && b.x + b.width <= 390 && b.y >= 0 && b.y + b.height <= 844, 'export shortcut must be in view after exit');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'shortcut must fit narrow screens');
    const dl = p.waitForEvent('download'); await p.locator('#session-export').click();
    const download = await dl;
    assert.equal(download.suggestedFilename(), 'bradbury-test-details-build-051.json');
    const report = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(report.build, 'gestures-051');
    assert.equal(report.pointer.diagnosticsEnabled, diagnostics);
    assert.equal(report.pointer.nativeQuad.width, geometry.width);
    assert.equal(report.pointer.nativeQuad.height, geometry.height);
    assert.deepEqual(report.pointer.nativeQuad.transform, geometry.transform, 'exiting must preserve the actual native window geometry');
    assert.ok(report.pointer.nativeQuad.upload.viewport.width > 0, 'actual upload viewport lost on exit');
    if (diagnostics) {
      assert.ok(report.pointer.samples.length > 0);
      const start = report.nativeEvents.find(e => e.stage === 'received' && e.kind === 'selectstart' && e.shownTarget === 'settings-size:0');
      assert.ok(start && start.shownPx && start.eventPx && start.hasHand && start.pointerMode === 'hand');
      assert.equal(start.uiHover, 'settings-size:0');
      assert.ok(report.nativeEvents.some(e => e.stage === 'pointer-selection' && e.selectedTarget === 'settings-size:0'), 'report must identify the dispatched click as well as the displayed aim');
    } else assert.equal(report.pointer.samples.length, 0, 'detailed frame traces remain opt-in');
    if (out) { await fs.mkdir(out, {recursive:true}); await download.saveAs(path.join(out, `session-details-${diagnostics ? 'diagnostics' : 'normal'}.json`)); await p.screenshot({path:path.join(out, `session-details-${diagnostics ? 'diagnostics' : 'normal'}.png`),fullPage:true}); }
    assert.deepEqual(errors, []); await p.close();
    passed(`session details: visible mobile export after exit retains actual geometry${diagnostics ? ', displayed aim and dispatched click' : ' without detailed opt-in traces'}`);
  }
};
