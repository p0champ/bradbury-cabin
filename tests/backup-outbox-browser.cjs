const assert=require('node:assert/strict');
module.exports=async(browser,{mock,BASE_URL,passed})=>{
 async function setup(){
  const p=await browser.newPage(),errors=[],writes=[];let offline=false,hold=false,release=null;
  let remote=JSON.stringify({version:1,start:'2026-10-18',trackingSince:'2026-10-18',days:{},weeks:{}});
  p.on('pageerror',e=>errors.push(e.message));await mock(p,'layer',false,{practised:true,headPointer:true});
  await p.route('https://accounts.google.com/**',r=>r.abort());
  await p.route('https://www.googleapis.com/**',async r=>{
   if(offline)return r.abort();
   const req=r.request(),url=new URL(req.url()),json=b=>r.fulfill({contentType:'application/json',body:JSON.stringify(b)});
   if(req.method()!=='GET'){
    assert.equal(req.method(),'PATCH');remote=req.postData();writes.push(JSON.parse(remote));
    if(hold){hold=false;await new Promise(resolve=>{release=resolve;});}
    return json({id:'P'});
   }
   if(url.searchParams.get('alt')==='media')return r.fulfill({contentType:'application/json',body:remote});
   const q=url.searchParams.get('q')||'';
   return json({files:q.includes('progress.json')?[{id:'P'}]:q.includes("name = 'Bradbury Cabin'")?[{id:'F'}]:[]});
  });
  await p.addInitScript(()=>{
   sessionStorage.setItem('cabin-google-token',JSON.stringify({token:'fixture-only',read:true,expires:Date.now()+3600000}));
   if(!sessionStorage.getItem('outbox-seeded')){localStorage.setItem('cabin-reading',JSON.stringify({last:'ohenry-magi',places:{}}));sessionStorage.setItem('outbox-seeded','1');}
  });
  await p.goto(BASE_URL);
  const settled=()=>p.waitForFunction(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')||'null')?.acknowledged===true);
  await settled();await p.waitForTimeout(1800);await settled();
  return {p,errors,writes,settled,setOffline:v=>{offline=v;},holdNext:()=>{hold=true;},release:()=>{assert.ok(release);release();},held:()=>!!release};
 }
 {
  const t=await setup(),{p,writes}=t;const before=writes.length;
  await p.locator('#night').click();await p.waitForTimeout(1800);await t.settled();
  assert.equal(writes.length,before+1,'a settings-only change schedules one complete backup');assert.equal(writes.at(-1).headset.controls.night,true);
  await p.locator('#next').click();await p.waitForTimeout(1800);await t.settled();
  const reading=writes.at(-1).headset.reading;assert.equal(reading.places[reading.last].page,1,'a page-only change reaches Drive');
  assert.equal(writes.length,before+2);assert.deepEqual(t.errors,[]);await p.close();passed('backup queue: reading places and settings each back up without a completion change');
 }
 {
  const t=await setup(),{p,writes}=t;t.setOffline(true);await p.locator('#night').click();await p.waitForTimeout(2200);
  let queued=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')));assert.equal(queued.acknowledged,false);assert.equal(JSON.parse(queued.payload).headset.controls.night,true);
  const count=writes.length;await p.reload();await p.waitForTimeout(600);assert.equal(writes.length,count);
  assert.equal(await p.locator('#night').getAttribute('aria-pressed'),'true');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')).acknowledged),false);
  t.setOffline(false);await p.evaluate(()=>dispatchEvent(new Event('online')));await t.settled();
  assert.equal(writes.at(-1).headset.controls.night,true);assert.deepEqual(t.errors,[]);await p.close();passed('backup queue: failed backup survives reopening and retries when the connection returns');
 }
 {
  const t=await setup(),{p,writes}=t;t.holdNext();await p.locator('#night').click();
  for(let i=0;i<70&&!t.held();i++)await p.waitForTimeout(100);assert.ok(t.held());
  const sent=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')).id);
  await p.evaluate(()=>{const el=document.querySelector('#ambience-volume');el.value='41';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.notEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')).id),sent);
  t.release();await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')).acknowledged),false,'old acknowledgement cannot clear a newer edit');
  await p.evaluate(()=>dispatchEvent(new Event('online')));await t.settled();
  assert.equal(writes.at(-1).headset.controls.ambienceVolume,.41);assert.equal(writes.at(-1).headset.controls.night,true);
  assert.deepEqual(t.errors,[]);await p.close();passed('backup queue: an edit during a slow save stays pending and reaches Drive afterward');
 }
};
