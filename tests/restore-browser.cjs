const assert = require('node:assert/strict');
// Reading places and settings travel in the Drive backup. A fresh browser
// gets them back; a browser with its own keeps every existing bookmark and
// setting, and only gains places it never had.
module.exports = async (browser,{BASE_URL,passed}) => {
  const base={version:1,start:'2026-10-18',trackingSince:'2026-10-18',days:{'2026-10-27':{poem:true}},weeks:{},savedAt:'2026-10-30T18:00:00Z'};
  const backupReading={last:'blake-sick-rose',places:{
    'blake-sick-rose':{anchor:{block:3,word:0},page:1},
    'bacon-truth':{anchor:{block:6,word:4},page:2}}};
  const backupControls={handMapRevision:9,swapped:true,size:2,night:true,practised:true};
  for(const browserState of ['fresh','returning']) {
    const p=await browser.newPage(), writes=[], errors=[];let loads=0;
    p.on('pageerror',e=>errors.push(e.message));p.on('load',()=>loads++);
    let remote=JSON.stringify({...base,headset:{reading:backupReading,controls:backupControls}});
    await p.route('https://accounts.google.com/**',route=>route.abort());
    await p.route('https://www.googleapis.com/**',route=>{
      const req=route.request(),url=new URL(req.url());
      const json=b=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(b)});
      if(req.method()!=='GET'){writes.push(req.postData());remote=req.postData();return json({id:'P'});}
      if(url.searchParams.get('alt')==='media')return route.fulfill({status:200,contentType:'application/json',body:remote});
      const q=url.searchParams.get('q')||'';
      if(q.includes('progress.json'))return json({files:[{id:'P',name:'progress.json'}]});
      if(q.includes("name = 'Bradbury Cabin'"))return json({files:[{id:'F',name:'Bradbury Cabin'}]});
      return json({files:[]});
    });
    await p.addInitScript(returning=>{
      if(returning&&!sessionStorage.getItem('restore-fixture')){
        localStorage.setItem('cabin-controls',JSON.stringify({handMapRevision:9,swapped:false,size:1,practised:true}));
        localStorage.setItem('cabin-reading',JSON.stringify({last:'bacon-truth',places:{'bacon-truth':{anchor:{block:20,word:1},page:7}}}));
      }
      sessionStorage.setItem('restore-fixture','1');
      sessionStorage.setItem('cabin-google-token',JSON.stringify({token:'fixture-only',read:true,expires:Date.now()+3600000}));
    },browserState==='returning');
    await p.goto(BASE_URL);
    for(let i=0;i<60&&writes.length<(browserState==='fresh'?2:1);i++)await p.waitForTimeout(100);
    await p.waitForTimeout(1800);
    const stored=await p.evaluate(()=>({reading:JSON.parse(localStorage.getItem('cabin-reading')),
      controls:JSON.parse(localStorage.getItem('cabin-controls')),progress:JSON.parse(localStorage.getItem('cabin-progress'))}));
    assert.equal(stored.progress.days['2026-10-27'].poem,true,'reading history comes back');
    assert.equal(stored.progress.headset,undefined,'the backup section is not mixed into local progress');
    if(browserState==='fresh') {
      assert.equal(loads,2,'one quiet reopen applies the restored places and settings');
      assert.deepEqual(stored.reading,backupReading,'every reading place and the last work are restored');
      assert.equal(stored.controls.size,2);assert.equal(stored.controls.night,true);assert.equal(stored.controls.swapped,true);
    } else {
      assert.equal(loads,1,'no reopen when nothing needed restoring');
      assert.deepEqual(stored.reading.places['bacon-truth'],{anchor:{block:20,word:1},page:7},'an existing bookmark is never moved');
      assert.equal(stored.reading.last,'bacon-truth','the last work open stays');
      assert.deepEqual(stored.reading.places['blake-sick-rose'],backupReading.places['blake-sick-rose'],'a missing place is filled in');
      assert.deepEqual(stored.controls,{handMapRevision:9,swapped:false,size:1,practised:true},'this browser keeps its own settings');
    }
    const sent=JSON.parse(writes.at(-1));
    assert.deepEqual(sent.headset.reading,stored.reading,'the Drive backup carries the reading places');
    assert.deepEqual(sent.headset.controls,stored.controls,'the Drive backup carries the settings');
    if(browserState==='fresh') {
      // The exported file is a complete backup too: import it into another
      // fresh browser without any Drive connection.
      const download=p.waitForEvent('download');
      await p.locator('#progress-export').click();
      const exported=await (await download).path();
      const q=await browser.newPage();let qLoads=0;q.on('load',()=>qLoads++);q.on('pageerror',e=>errors.push(e.message));
      await q.route('https://accounts.google.com/**',route=>route.abort());
      await q.route('https://www.googleapis.com/**',route=>route.abort());
      await q.goto(BASE_URL);
      await q.locator('#progress-file').setInputFiles(exported);
      for(let i=0;i<40&&qLoads<2;i++)await q.waitForTimeout(100);
      await q.waitForLoadState('load');
      const imported=await q.evaluate(()=>({reading:JSON.parse(localStorage.getItem('cabin-reading')),
        controls:JSON.parse(localStorage.getItem('cabin-controls')),progress:JSON.parse(localStorage.getItem('cabin-progress'))}));
      assert.equal(qLoads,2,'one quiet reopen after importing');
      assert.deepEqual(imported.reading,stored.reading);
      assert.deepEqual(imported.controls,stored.controls);
      assert.equal(imported.progress.days['2026-10-27'].poem,true);
      assert.equal(imported.progress.headset,undefined);
      await q.close();
    }
    assert.deepEqual(errors,[]);await p.close();
    passed(`Drive backup ${browserState==='fresh'?'restores reading places and settings into a fresh browser':'fills only missing places and keeps this browser\'s bookmarks and settings'}`);
  }
};
