const assert = require('node:assert/strict');
// Automatic Drive saves after a sync: another device's newer changes are
// merged in, and a Drive copy damaged since the sync is never replaced.
module.exports = async (browser,{mock,BASE_URL,passed}) => {
  for(const later of ['other-device','damaged']) {
    const p=await browser.newPage(), writes=[], errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await mock(p,'layer',false,{practised:true,headPointer:true});
    const base={version:1,start:'2026-10-18',trackingSince:'2026-10-18',days:{},weeks:{},savedAt:'2026-10-30T18:00:00Z'};
    let remote=JSON.stringify(base);
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
    await p.addInitScript(b=>{
      if(!sessionStorage.getItem('merge-fixture')){localStorage.setItem('cabin-progress',b);sessionStorage.setItem('merge-fixture','1');}
      sessionStorage.setItem('cabin-google-token',JSON.stringify({token:'fixture-only',read:true,expires:Date.now()+3600000}));
    },JSON.stringify(base));
    // Real timers: the automatic save waits 1.5 s after a change.
    await p.goto(BASE_URL);
    // Signed in within the hour: the app syncs by itself and writes once.
    for(let i=0;i<100&&!writes.length;i++)await p.waitForTimeout(100);
    assert.equal(writes.length,1,'the opening sync writes progress once');
    remote=later==='damaged'?'{damaged-since-sync':JSON.stringify({...base,days:{'2026-10-27':{story:true}},savedAt:new Date(Date.now()+60000).toISOString()});
    // A change on this headset schedules an automatic save.
    await p.locator('#progress-file').setInputFiles({name:'progress.json',mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify({...base,days:{'2026-10-29':{poem:true}},savedAt:'2026-10-30T18:45:00Z'}))});
    await p.waitForTimeout(3000);
    const local=JSON.parse(await p.evaluate(()=>localStorage.getItem('cabin-progress')));
    assert.equal(local.days['2026-10-29'].poem,true,'the headset change is kept locally');
    if(later==='damaged') {
      assert.equal(writes.length,1,'a damaged Drive copy is never overwritten');
      assert.equal(remote,'{damaged-since-sync');
    } else {
      assert.equal(writes.length,2,'one automatic save');
      const sent=JSON.parse(writes[1]);
      assert.equal(sent.days['2026-10-27']?.story,true,'the other device\'s tick survives');
      assert.equal(sent.days['2026-10-29']?.poem,true,'this headset\'s tick is saved');
      assert.equal(local.days['2026-10-27']?.story,true,'the merged copy is also kept on the headset');
    }
    assert.deepEqual(errors,[]);await p.close();
    passed(`Automatic Drive save after a sync ${later==='damaged'?'leaves a damaged Drive copy untouched':'merges another device\'s newer changes'}`);
  }
};
