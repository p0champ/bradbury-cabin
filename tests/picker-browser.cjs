const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');

module.exports = async function pickerChecks(browser, { mock, BASE_URL, out, passed }) {
  const workflow = (await fs.readFile(path.join(__dirname, '..', 'CLAUDE_SKILL_DAILY_THREE.md'), 'utf8')).replace(/\r\n/g, '\n');
  for (const lying of [false, true]) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026, 9, 28, 20));
    await mock(p, 'layer', lying);
    let picks = { version: 1, date: '2026-10-28', picks: { poem: { title: 'UNSUPPORTED MODEL COPY', author: 'Unknown', text: 'FORGED' } } };
    const writes = [];
    await p.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: `window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'fake-token',expires_in:3600})})}}};` }));
    await p.route('https://www.googleapis.com/**', async r => {
      const url = decodeURIComponent(r.request().url()), method = r.request().method();
      const json = b => r.fulfill({ contentType: 'application/json', body: JSON.stringify(b) });
      if (method !== 'GET') {
        const body = r.request().postData();
        const payload = method === 'PATCH' ? JSON.parse(body) : JSON.parse(body.slice(body.indexOf('{"cabinPickerInstructions"'), body.lastIndexOf('\r\n--')));
        writes.push(payload);
        return json({ id: 'P' });
      }
      if (url.includes('files?q=') && url.includes('Bradbury Cabin')) return json({ files: [{ id: 'F' }] });
      if (url.includes('files?q=') && url.includes('progress.json')) return json({ files: writes.length ? [{ id: 'P' }] : [] });
      if (url.includes('files?q=') && url.includes('in parents')) return json({ files: [{ id: 'T', name: 'picks-2026-10-28.json', size: '1000' }] });
      if (url.includes('/files/T?alt=media')) return json(picks);
      if (url.includes('/files/P?alt=media')) return json(writes.at(-1));
      return r.fulfill({ status: 404, body: '' });
    });
    await p.goto(BASE_URL);
    await p.locator('#drive-sync:not([disabled])').click();
    await p.waitForFunction(() => document.querySelector('#status').textContent.includes('failed the source checks'));
    const contract = writes.at(-1).cabinPickerInstructions;
    assert.equal(Object.keys(writes.at(-1))[0], 'cabinPickerInstructions');
    assert.equal(contract.workflow, workflow);
    assert.equal(contract.lastCheck.accepted, false);
    assert.ok(contract.lastCheck.problems.length);
    assert.ok(contract.workflow.includes('disableConversionToGoogleType'));
    assert.ok(contract.workflow.includes('download_file_content'));
    assert.equal(await p.evaluate(() => localStorage.getItem('cabin-today')), null, 'old unchecked text stays rejected');

    // Exercise the wire format a picker can construct from Drive alone.
    // This is a synthetic producer, NOT a claim that real Claude ran.
    picks = { version: 2, date: '2026-10-28', picks: {}, dedication: 'A quiet moment for yourself.', thread: 'Three ways of looking closely.' };
    const chosen = [];
    for (const kind of ['poem', 'story', 'essay']) {
      const w = contract.catalogue.find(w => w.kind === kind && !contract.shelfIds.includes(w.catalogueId));
      chosen.push(w);
      picks.picks[kind] = { catalogueId: w.catalogueId, guide: { context: 'Look closely at the language.', notice: ['Notice the rhythm.'], themes: 'Consider how the form shapes the meaning.', questions: ['Which detail stayed with you?'] } };
    }
    await p.locator('#drive-sync:not([disabled])').click();
    await p.waitForFunction(() => document.querySelector('#status').textContent.includes("Today's three are ready"));
    assert.equal(writes.at(-1).cabinPickerInstructions.lastCheck.accepted, true);
    assert.equal(writes.at(-1).days['2026-10-28'].personal.dedication, picks.dedication);
    assert.equal(writes.at(-1).days['2026-10-28'].personal.thread, picks.thread);
    assert.deepEqual(writes.at(-1).days['2026-10-28'].ids, Object.fromEntries(chosen.map(w => [w.kind, w.catalogueId])));
    await p.locator('#enter:not([disabled])').click();
    await p.evaluate(() => { __center(); __step(1600); });
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'), 'today');
    await p.locator('#page').screenshot({ path: path.join(out, `picker-today${lying ? '-lying' : ''}.png`) });
    await p.evaluate(() => { __mock.offsetX = .25; __step(); __welcomeScene(); });
    await p.locator('#welcome-scene').screenshot({ path: path.join(out, `picker-native-side${lying ? '-lying' : ''}.png`) });
    assert.deepEqual(errors, []);
    await p.close();
    passed('Drive delivers full workflow + rejection reasons, then accepts checked references without a skill import' + (lying ? ' lying' : ''));
  }
};
