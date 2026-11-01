const assert=require('node:assert/strict');
const path=require('node:path');const{pathToFileURL}=require('node:url');
module.exports=async(browser,{BASE_URL,passed})=>{
 const{connectionFixture}=await import(pathToFileURL(path.join(__dirname,'connection-browser-fixture.mjs')).href);
 const fixture=await connectionFixture(BASE_URL),context=await browser.newContext();const errors=[];
 try{
  const credentials=await fixture.authorise();await fixture.routeContext(context);
  await context.addInitScript(({credentials,origin})=>{
   if(location.origin!==origin)return;
   if(!localStorage.getItem('cabin-connection')){localStorage.setItem('cabin-connection',credentials.token);localStorage.setItem('cabin-connection-device',credentials.device);}
   document.addEventListener('DOMContentLoaded',()=>{for(const d of document.querySelectorAll('details'))d.open=true;});
  },{credentials,origin:new URL(BASE_URL).origin});
  const open=async()=>{const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE_URL);return page;};
  const settled=page=>page.waitForFunction(()=>JSON.parse(localStorage.getItem('cabin-backup-outbox')||'null')?.acknowledged===true,null,{timeout:30000});
  const personal=page=>page.evaluate(()=>Object.fromEntries(['cabin-progress','cabin-reading','cabin-controls','cabin-last-check','cabin-backup-outbox','cabin-connection-edits'].map(key=>[key,localStorage.getItem(key)])));
  const a=await open();await settled(a);await a.locator('#night').click();await a.waitForTimeout(2000);await settled(a);
  const before=await personal(a),b=await open();
  await b.waitForFunction(()=>document.querySelector('#status').textContent.includes('another tab'));
  assert.equal(await b.locator('#enter').isDisabled(),true);assert.equal(await b.locator('#drive-sync').isDisabled(),true);
  assert.deepEqual(await personal(b),before,'a second reader must not even initialise over the live journal or queue');
  await a.close();await b.reload();await b.waitForFunction(()=>!document.querySelector('#drive-sync').disabled);
  await b.evaluate(()=>{const input=document.querySelector('#ambience-volume');input.value='41';input.dispatchEvent(new Event('input',{bubbles:true}));});await b.waitForTimeout(2000);await settled(b);
  let saved=await fixture.state(credentials.token);assert.equal(saved.state.headset.controls.ambienceVolume,0.41);assert.equal(saved.state.headset.controls.night,true);
  passed('reader tabs: only one document can own the saved journal; closing it and reopening the second preserves both settings in the checked outside backup');
  await b.goto('about:blank');const c=await open();await settled(c);
  await c.evaluate(()=>{const input=document.querySelector('#ambience-volume');input.value='63';input.dispatchEvent(new Event('input',{bubbles:true}));});await c.waitForTimeout(2000);await settled(c);
  const current=await personal(c);await b.goBack();await b.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('another tab'));
  assert.deepEqual(await personal(c),current,'Back must never revive an old document as another writer');
  saved=await fixture.state(credentials.token);assert.equal(saved.state.headset.controls.ambienceVolume,0.63);assert.deepEqual(errors,[]);
  passed('reader tabs: leaving releases the lease, and browser Back cannot revive stale saves over the newly active reading tab');
 }finally{await context.close();await fixture.dispose();}
};
