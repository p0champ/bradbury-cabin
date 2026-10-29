const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = async function entryExitChecks(browser, { mock, BASE_URL, out, passed }) {
  const open = async (screen = 'placement') => {
    const p = await browser.newPage();
    await mock(p, 'layer', false, { practised: true, headPointer: false });
    await p.goto(BASE_URL); await p.locator('#enter').click();
    await p.evaluate(() => { __hand(.05); __step(600); });
    if (screen !== 'placement') await p.evaluate(() => __center());
    if (screen === 'home' || screen === 'settings')
      await p.evaluate(() => { __hold(); __hand(.05); __step(800); });
    if (screen === 'settings')
      await p.evaluate(async () => { await __aim('home-settings', true); __step(800); __pinch(); __step(800); });
    return p;
  };
  {
    const p = await open();
    const evidence = await p.evaluate(() => {
      const c = document.querySelector('#page'), ctx = c.getContext('2d');
      const alpha = (x,y) => ctx.getImageData(x,y,1,1).data[3];
      return { view:c.dataset.view, pose:JSON.parse(c.dataset.panelPose),
        corners:[alpha(0,0),alpha(2047,0),alpha(0,2559),alpha(2047,2559)],
        centerAlpha:alpha(1024,1280), exit:JSON.parse(c.dataset.exitRect) };
    });
    assert.equal(evidence.view, 'centering');
    assert.deepEqual(evidence.corners, [0,0,0,0]);
    assert.equal(evidence.centerAlpha,255);
    await fs.mkdir(out,{recursive:true});
    await p.locator('#page').screenshot({path:path.join(out,'entry-placement.png')});
    const displayed = evidence.pose;
    const confirmed = await p.evaluate(() => {
      __native('select');
      __mock.offsetX = .22;
      __step(16);
      return JSON.parse(document.querySelector('#page').dataset.panelPose);
    });
    confirmed.forEach((n,i)=>assert.ok(Math.abs(n-displayed[i])<1e-6,
      `confirmation moved displayed placement component ${i}`));
    await p.close();
    passed('entry: centered opaque instruction card, transparent corners and exact displayed confirmation pose');
  }
  for (const screen of ['placement','reading','home','settings']) {
    const p = await open(screen);
    const before = await p.locator('#place').textContent();
    const exit = await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).find(b=>b.id==='global-exit'));
    assert.ok(exit && exit.w>=150 && exit.h>=150,`${screen} lacks a substantial Exit target`);
    await p.evaluate(async()=>{await __aim('global-exit',true);__hand(.05);__step(800);__pinch();});
    assert.equal(await p.evaluate(()=>__mock.session.ended),true,`${screen} Exit failed`);
    assert.equal(await p.locator('#enter').isEnabled(),true);
    assert.equal(await p.locator('#place').textContent(),before,'Exit turned a reading page');
    await p.close(); passed(`exit: direct native hand click leaves ${screen} without turning a page`);
  }
  for (const reason of ['moved-off','system-owned','stale']) {
    const p=await open('reading');
    const before=await p.locator('#place').textContent();
    await p.evaluate(async reason=>{
      await __aim('global-exit',true);__hand(.05);__step(800);
      __native('selectstart');__step(16);
      if(reason==='moved-off'){await __aim({x:1024,y:1280,w:0,h:0},true);__step(16);}
      if(reason==='system-owned')__mock.sources.right.skipRendering=true;
      __native('select');__native('selectend');
      if(reason==='stale')__mock.clock+=200;
      __step(16);
    },reason);
    assert.notEqual(await p.evaluate(()=>__mock.session.ended),true,`${reason} Exit incorrectly left session`);
    assert.equal(await p.locator('#place').textContent(),before,`${reason} Exit turned a page`);
    if(reason==='stale') {
      await p.evaluate(()=>{__native('select');__step(16);});
      assert.notEqual(await p.evaluate(()=>__mock.session.ended),true,'stale Exit press survived to a later orphan release');
    }
    await p.close();passed(`exit: ${reason} press does not leave or turn the page`);
  }
  for (const screen of ['placement','reading']) {
    const p=await open(screen), before=await p.locator('#place').textContent();
    await p.evaluate(async()=>{
      await __aim('global-exit',true);
      // A controller has no XRHand/joints; retain the same target-ray space.
      __mock.sources.right.hand=null;
      __step(32);
      __native('selectstart');__step(80);
      __native('select');__native('selectend');__step(16);
    });
    assert.equal(await p.evaluate(()=>__mock.session.ended),true,`controller Exit failed during ${screen}`);
    assert.equal(await p.locator('#place').textContent(),before,'Controller Exit changed reading');
    await p.close();passed(`exit: controller target ray leaves ${screen}`);
  }
};
