const assert = require('node:assert/strict');
module.exports = async (browser,{mock,BASE_URL,passed}) => {
  for(const broken of ['local','remote','empty']) {
    const p=await browser.newPage(), mutations=[], requests=[], errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await mock(p,'layer',false,{practised:true,headPointer:true});
    await p.clock.setFixedTime(new Date('2026-10-30T19:00:00Z'));
    await p.route('https://accounts.google.com/**',route=>route.abort());
    await p.route('https://www.googleapis.com/**',route=>{
      const req=route.request(),url=new URL(req.url());requests.push(req.url());
      if(req.method()!=='GET')mutations.push(req.method());
      if(url.searchParams.get('alt')==='media')return route.fulfill({status:200,body:broken==='empty'?'':'{unreadable-cloud-copy'});
      const q=url.searchParams.get('q')||'';
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({files:[{id:q.includes('progress.json')?'P':'F',name:q.includes('progress.json')?'progress.json':'Bradbury Cabin'}]})});
    });
    await p.addInitScript(broken=>{
      localStorage.setItem('cabin-progress',broken==='local'?'{unreadable-local-copy':JSON.stringify({version:1,start:'2026-10-18',trackingSince:'2026-10-30',days:{},weeks:{}}));
      sessionStorage.setItem('cabin-google-token',JSON.stringify({token:'fixture-only',read:true,expires:Date.now()+3600000}));
      // The later headset-support line can replace the notice; keep every status shown.
      window.__statusSeen=[];
      new MutationObserver(records=>{for(const r of records)if(r.target.id==='status')for(const n of r.addedNodes)__statusSeen.push(n.textContent);})
        .observe(document,{childList:true,subtree:true});
    },broken);
    await p.goto(BASE_URL);
    await p.waitForFunction(()=>__statusSeen.some(t=>t.includes('needs recovery')));
    await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    await p.waitForTimeout(1800);
    assert.deepEqual(mutations,[],'recovery must never write a replacement to Drive');
    if(broken==='local') {
      assert.equal(requests.length,0,'a damaged local original must not start cloud replacement');
      assert.equal(await p.evaluate(()=>localStorage.getItem('cabin-progress')),'{unreadable-local-copy');
    }
    assert.ok(await p.locator('#page').getAttribute('data-view'),'reader still renders');
    assert.deepEqual(errors,[]);await p.close();
    passed(`Recovery preserves unreadable ${broken} progress without any cloud mutation and keeps the reader available`);
  }
};
