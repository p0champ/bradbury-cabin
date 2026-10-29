const assert = require('node:assert/strict');

// Native events may arrive together between two animation frames. They must
// select the choice displayed when the press began, never a later head pose.
module.exports = async function selectionChecks(browser, { mock, BASE_URL, passed }) {
  for (const burst of [true, false]) {
    const p = await browser.newPage();
    await mock(p, 'layer', false, { practised: true, headPointer: true });
    await p.goto(BASE_URL);
    await p.locator('#enter').click();
    await p.evaluate(() => { __center(); __hold(); __hand(.05); __step(800); });
    const before = await p.evaluate(async burst => {
      await __aim('home-settings'); __hand(.05); __step(800);
      const laterLook = __mock.look;
      await __aim('home-shelf'); __hand(.05); __step(800);
      const shown = document.querySelector('#page').dataset.target;
      __native('selectstart');
      if (!burst) __step(16);
      if (burst) { __native('select'); __native('selectend'); }
      __mock.look = laterLook;
      __step(16);
      return shown;
    }, burst);
    assert.equal(before, 'home-shelf');
    if (!burst) {
      assert.equal(await p.locator('#page').getAttribute('data-target'), 'home-shelf',
        'head press highlight moved away from its held selection');
      await p.evaluate(() => { __native('select'); __native('selectend'); __step(16); });
    }
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'), 'shelf',
      'queued head click selected a choice that was not displayed at press time');
    await p.close();
    passed(`selection: head ${burst ? 'queued event burst' : 'held press'} keeps displayed target`);
  }
};
