const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
module.exports=async(browser,{mock,BASE_URL,out,passed})=>{
 const {SOURCE_CATALOGUE:C}=await import(pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
 const {MILESTONES,RESERVED_REWARD_IDS}=await import(pathToFileURL(path.join(__dirname,'..','rewards.js')).href);
 const excluded=['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth',...RESERVED_REWARD_IDS];
 const works=['poem','story','essay'].map(k=>C.find(w=>w.kind===k&&!excluded.includes(w.id)));
 const date='2026-11-02',assigned=w=>`today-${date}-${w.kind}-${w.id}`;
 const target=(p,id)=>p.evaluate(async id=>{await __aim(id,true);__pinch();__step(800);},id);
 async function setup({reduce=false,multiple=false,failSave=false}={}){
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.emulateMedia({reducedMotion:reduce?'reduce':'no-preference'});
  await mock(p,'layer',false,{practised:true,headPointer:false,visits:4});await p.clock.setFixedTime(new Date(2026,10,2,20));
  await p.addInitScript(({works,date,multiple,C,failSave})=>{
   if(!sessionStorage.getItem('rewards-seeded')){
    const days={};for(let i=26;i<=31;i++)days[`2026-10-${i}`]={poem:true,story:true,essay:true};
    days[date]={story:true,essay:true,ids:Object.fromEntries(works.map(w=>[w.kind,w.id])),picks:Object.fromEntries(works.map(w=>[w.kind,`${w.title} — ${w.author}`]))};
    if(multiple)for(let i=1;i<=24;i++)days[`2026-09-${String(i).padStart(2,'0')}`]={poem:true,story:true,essay:true};
    const ledger=multiple?Object.fromEntries(C.slice(0,99).map(w=>[w.id,'2026-11-01T10:00:00.000Z'])):{};
    delete ledger[works[0].id];if(multiple){const extra=C.find(w=>!ledger[w.id]&&w.id!==works[0].id);ledger[extra.id]='2026-11-01T10:00:00.000Z';}
    localStorage.setItem('cabin-progress',JSON.stringify({version:1,start:multiple?'2026-09-01':'2026-10-26',trackingSince:multiple?'2026-09-01':'2026-10-26',days,weeks:{},completedWorks:ledger}));
    localStorage.setItem('cabin-today',JSON.stringify({version:2,date,picks:Object.fromEntries(works.map(w=>[w.kind,{catalogueId:w.id}]))}));sessionStorage.setItem('rewards-seeded','1');
   }
   window.__rewardText=[];const fill=CanvasRenderingContext2D.prototype.fillText,clear=CanvasRenderingContext2D.prototype.clearRect;
   CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='page')__rewardText=[];return clear.apply(this,args);};
   CanvasRenderingContext2D.prototype.fillText=function(s,...a){if(this.canvas.id==='page')__rewardText.push(String(s));return fill.call(this,s,...a);};
   const save=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='cabin-progress'&&window.__failRewardSave)throw Error('quota');return save.call(this,k,v);};
   window.__failRewardSave=failSave;
  },{works,date,multiple,C:C.map(({id})=>({id})),failSave});
  await p.goto(BASE_URL);await p.locator('#enter').click();await p.evaluate(()=>__center());return{p,errors};
 }
 async function finishPoem(p){
  await target(p,`home-work:${assigned(works[0])}`);
  for(let i=0;i<60 && await p.locator('#page').getAttribute('data-menu-page')!=='closing';i++)await p.evaluate(()=>{__pinch('right');__step(700);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'closing');await target(p,'end-mark');
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'feedback');
 }
 {
  const {p,errors}=await setup();await finishPoem(p);
  let data=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')));assert.ok(data.rewards.awards['streak-7']);assert.equal(Object.keys(data.rewards.awards).length,1);
  await target(p,'feedback-done');assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'reward');
  await p.evaluate(()=>__step(200));assert.ok(await p.evaluate(()=>document.querySelector('#page').dataset.rewardGlow),'warm rim motion must reach native composition');
  await p.evaluate(()=>{__welcomeScene();document.querySelector('#welcome-scene').lastElementChild.textContent='DESKTOP PREVIEW · QUEST CHECK PENDING';});
  await p.locator('#welcome-scene').screenshot({path:path.join(out,'hearthlight-warm-rim.png')});
  await p.evaluate(()=>__step(2500));assert.ok(await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).some(b=>b.id==='reward-read')));
  await p.locator('#page').screenshot({path:path.join(out,'hearthlight-reward-card.png')});
  await target(p,'reward-later');assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'library');
  await target(p,'home-rewards');assert.ok(await p.evaluate(()=>__rewardText.some(t=>t.includes('TELL-TALE'))));
  await p.locator('#page').screenshot({path:path.join(out,'hearthlight-rewards-shelf.png')});
  await target(p,'reward-detail:streak-7');await target(p,'reward-read');
  assert.equal(await p.locator('#page').getAttribute('data-work'),MILESTONES[0].pool[0]);assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
  data=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')));assert.equal(data.days[date].poem,true);assert.ok(data.rewards.seen['streak-7']);
  await p.reload();await p.locator('#enter').click();await p.evaluate(()=>__center());
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today','reload must not replay celebration');
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')));assert.equal(Object.keys(saved.rewards.unlocked).length,1);assert.ok(saved.rewards.seen['streak-7']);
  assert.deepEqual(errors,[]);passed('rewards: finishing all three earns one real offline pick, celebrates after feedback, persists on shelf and never replays on reload');await p.close();
 }
 {
  const {p,errors}=await setup({reduce:true});await finishPoem(p);await p.evaluate(()=>{__hold();__step(400);});
  assert.ok(await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).some(b=>b.id==='reward-read')),'reduced motion must reach the card within a short fade');
  assert.deepEqual(errors,[]);passed('rewards: reduced motion reveals the same earned card through a short fade');await p.close();
 }
 {
  const {p,errors}=await setup({multiple:true});await finishPoem(p);await target(p,'feedback-done');await target(p,'reward-skip');
  const d=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')));
  assert.equal(Object.keys(d.rewards.awards).length,3,'all three milestones earned once');assert.equal(Object.keys(d.rewards.seen).length,3,'one shared ceremony acknowledges the trio');
  await target(p,'reward-later');assert.ok(await p.evaluate(()=>__rewardText.includes('Thirty complete reading days')));
  await target(p,'reward-later');assert.ok(await p.evaluate(()=>__rewardText.includes('One hundred different pieces read')));
  await target(p,'reward-later');assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'library');
  assert.deepEqual(errors,[]);passed('rewards: simultaneous milestones share one ceremony with three permanent, optional gifts');await p.close();
 }
 {
  const {p,errors}=await setup({failSave:true});await finishPoem(p);await target(p,'feedback-done');await p.evaluate(()=>__step(3000));
  assert.ok(await p.evaluate(()=>__rewardText.some(t=>t.includes('Could not save rewards'))));
  assert.deepEqual(errors,[]);passed('rewards: failed storage is reported on the reward card without claiming a durable save');await p.close();
 }
};
