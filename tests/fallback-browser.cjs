const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
module.exports = async (browser, { mock, BASE_URL, passed }) => {
  const { connectionFixture } = await import(pathToFileURL(path.join(__dirname,'connection-browser-fixture.mjs')).href);
  const { seedProgress, berlinDateKey } = await import(pathToFileURL(path.join(__dirname,'..','progress.js')).href);
  async function reader(fixture, credentials, { fresh = false } = {}) {
    const context=await browser.newContext();await fixture.routeContext(context);
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    if (!fresh) await mock(page,'layer',false,{practised:true,headPointer:true},'managed');
    await page.addInitScript(({credentials,fresh})=>{
      if(!sessionStorage.getItem('fallback-seeded')){
        localStorage.setItem('cabin-connection',credentials.token);localStorage.setItem('cabin-connection-device',credentials.device);
        localStorage.setItem('cabin-connection-owner',credentials.ownerSubject);
        if (!fresh) localStorage.setItem('cabin-reading',JSON.stringify({last:'ohenry-magi',places:{}}));
        sessionStorage.setItem('fallback-seeded','1');
      }
      document.addEventListener('DOMContentLoaded',()=>{for(const d of document.querySelectorAll('details'))d.open=true;});
      const every=setInterval;globalThis.__fallbackMinute=[];
      globalThis.setInterval=(fn,ms,...args)=>{if(ms===60000)__fallbackMinute.push(fn);return every(fn,ms,...args);};
    },{credentials,fresh});
    await page.goto(BASE_URL);
    const settled=()=>page.waitForFunction(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')||'null')?.acknowledged===true,null,{timeout:30000});
    const minute=()=>page.evaluate(()=>Promise.all(__fallbackMinute.map(fn=>fn())));
    return{context,page,errors,settled,minute};
  }
  {
    const initial=seedProgress(berlinDateKey());initial.days[berlinDateKey()]={poem:true,story:true,essay:true};
    const fixture=await connectionFixture(BASE_URL,{initial});let t;
    try{
      const credentials=await fixture.authorise(), freshCredentials=await fixture.authorise();t=await reader(fixture,credentials);await t.settled();await t.page.waitForTimeout(1800);await t.settled();
      assert.equal(await t.page.evaluate(day=>JSON.parse(localStorage.getItem('cabin-progress')).days[day].poem,berlinDateKey()),true);
      await fixture.mirror(credentials.token);const before=fixture.main();
      fixture.setAPI('html-limit');await t.page.locator('#night').click();await t.page.locator('#next').click();await t.page.waitForTimeout(2200);
      assert.equal(await t.page.evaluate(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')).acknowledged),false);
      fixture.addPicks();await t.page.locator('#drive-sync:not([disabled])').click();
      await t.page.waitForFunction(()=>!document.querySelector('#drive-sync').disabled && document.querySelector('#status').textContent.includes('Google backup was checked'),null,{timeout:30000});
      assert.ok(fixture.recoveryFiles().length>0);assert.deepEqual(fixture.main(),before,'outage backup must not become a second writer of progress.json');
      assert.equal(await t.page.evaluate(()=>__fixtureDirectPrompts),1);
      assert.equal(await t.page.evaluate(()=>localStorage.getItem('cabin-connection')),credentials.token);
      const queue=await t.page.evaluate(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')));
      assert.equal(queue.acknowledged,false,'a Google safety copy is never a private acknowledgement');
      const snapshot=JSON.parse(queue.payload);assert.equal(snapshot.headset.controls.night,true);assert.ok(snapshot.headset.reading.places[snapshot.headset.reading.last].page>0);
      assert.equal(snapshot.days[berlinDateKey()].ids.poem,fixture.works.poem.id);
      const count=fixture.recoveryFiles().length;await t.minute();assert.equal(fixture.recoveryFiles().length,count,'unchanged retry must reuse its immutable identity');
      const empty=await reader(fixture,freshCredentials,{fresh:true});
      try {
        await empty.page.waitForFunction(()=>!document.querySelector('#drive-sync').disabled);
        await empty.page.locator('#drive-sync').click();
        await empty.page.waitForFunction(()=>JSON.parse(localStorage.getItem('cabin-controls')||'{}').night===true,null,{timeout:30000});
        const restored=await empty.page.evaluate(()=>JSON.parse(localStorage.getItem('cabin-reading')));
        assert.equal(restored.places[snapshot.headset.reading.last].page,snapshot.headset.reading.places[snapshot.headset.reading.last].page);
        assert.deepEqual(empty.errors,[]);
        passed('fallback: a separate empty browser restores the complete Google safety copy while the private provider is unavailable');
      } finally {await empty.context.close();}
      fixture.setAPI('normal');await t.minute();await t.settled();
      const recovered=await fixture.state(credentials.token);assert.equal(recovered.state.headset.controls.night,true);
      assert.equal(recovered.state.headset.reading.places[snapshot.headset.reading.last].page,snapshot.headset.reading.places[snapshot.headset.reading.last].page);
      await fixture.mirror(credentials.token);assert.equal((await fixture.state(credentials.token)).driveCurrent,true);
      assert.equal(fixture.main().headset.controls.night,true);assert.ok(fixture.main().cabinRecoveryCursor);
      assert.deepEqual(t.errors,[]);
      passed('fallback: Cloudflare limits allow the same Sync tap to check a complete Google safety copy and receive Claude picks; return reconciles without clearing a newer local save');
      passed('fallback: a fresh browser retains an already completed full trio; pending Google files rejoin the sole main backup writer and are never deleted');
    }finally{if(t)await t.context.close();await fixture.dispose();}
  }
  {
    const fixture=await connectionFixture(BASE_URL);let t;
    try{
      const credentials=await fixture.authorise();t=await reader(fixture,credentials);await t.settled();
      fixture.setAPI('offline');await t.page.locator('#night').click();await t.page.waitForTimeout(2200);
      fixture.setDirectProfile('another-owner');const before=fixture.directCalls();await t.page.locator('#drive-sync:not([disabled])').click();
      await t.page.waitForFunction(()=>!document.querySelector('#drive-sync').disabled&&document.querySelector('#status').textContent.includes('Choose the Google account'));
      assert.equal(fixture.directCalls(),before+1,'wrong account is stopped before any folder or file read');
      assert.equal(fixture.recoveryFiles().length,0);assert.equal(await t.page.evaluate(()=>localStorage.getItem('cabin-connection')),credentials.token);
      fixture.setDirectProfile('fixture-owner');fixture.setGoogle('limit');await t.page.locator('#drive-sync').click();
      await t.page.waitForFunction(()=>!document.querySelector('#drive-sync').disabled);
      await t.page.locator('#next').click();assert.equal(await t.page.evaluate(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')).acknowledged),false);
      assert.equal(await t.page.locator('#night').getAttribute('aria-pressed'),'true');assert.deepEqual(t.errors,[]);
      fixture.setGoogle('normal');fixture.setAPI('normal');await t.minute();await t.settled();
      assert.equal((await fixture.state(credentials.token)).state.headset.controls.night,true);
      passed('fallback: a wrong Google account is refused before touching files; simultaneous provider failure keeps reading and pending changes, then retries safely');
    }finally{if(t)await t.context.close();await fixture.dispose();}
  }
};
