const assert=require('node:assert/strict');
const path=require('node:path');const {pathToFileURL}=require('node:url');
module.exports=async function coherentChecks(browser,{mock,BASE_URL,out,passed}){
 const {SOURCE_CATALOGUE}=await import(pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
 const excluded=new Set(['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth']);
 const works=['poem','story','essay'].map(kind=>SOURCE_CATALOGUE.find(w=>w.kind===kind&&!excluded.has(w.id)));
 const target=async(p,id,head=false)=>{await p.evaluate(async ({id,head})=>{await __aim(id,!head);__pinch();__step(500);},{id,head});};
 const crop=async(p,name)=>{const box=await p.locator('#page').boundingBox(),r=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.activeBounds));await p.screenshot({path:path.join(out,name),fullPage:true,clip:{x:box.x+r.x/2048*box.width,y:box.y+r.y/2560*box.height,width:r.w/2048*box.width,height:r.h/2560*box.height}});};
 for(const lying of [false,true])for(const reduce of [false,true]){
  const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.emulateMedia({reducedMotion:reduce?'reduce':'no-preference'});await p.clock.setFixedTime(new Date(2026,9,29,20));
  await mock(p,'layer',lying,{practised:true,headPointer:false,visits:4});
  await p.addInitScript(works=>{localStorage.setItem('cabin-today',JSON.stringify({version:2,date:'2026-10-29',picks:Object.fromEntries(works.map(w=>[w.kind,{catalogueId:w.id}]))}));window.__coherentText=[];const fill=CanvasRenderingContext2D.prototype.fillText,clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.id==='page')__coherentText=[];return clear.call(this,...a);};CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.id==='page')__coherentText.push({text:String(t),font:this.font});return fill.call(this,t,...a);};},works.map(w=>({id:w.id,kind:w.kind})));
  await p.goto(BASE_URL);await p.locator('#enter').click();await p.evaluate(()=>{__step();__pinch();__step(240);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today','entry must land directly in content home');
  assert.equal(Number(await p.locator('#page').getAttribute('data-arrival-ms')),reduce?300:5000);
  const snapshot=await p.evaluate(()=>({buttons:JSON.parse(document.querySelector('#page').dataset.buttons),bounds:JSON.parse(document.querySelector('#page').dataset.activeBounds),text:__coherentText,alpha:document.querySelector('#page').getContext('2d').getImageData(1024,200,1,1).data[3]}));
  assert.equal(snapshot.buttons.filter(b=>b.id.startsWith('home-work:')).length,3);
  assert.ok(Math.abs(snapshot.bounds.h/2560*.9-.5)<1e-6);assert.equal(snapshot.alpha,0,'transparent margin became a portrait slab');
  assert.ok(!snapshot.text.some(x=>/BRADBURY CABIN|More settings|Leave the cabin|Good evening/.test(x.text)));
  for(const w of works)assert.ok(snapshot.text.some(x=>x.text===w.title||x.text.includes(w.title.split(' ').slice(0,3).join(' '))),'missing complete initial work '+w.title);
  await p.evaluate(()=>__finishArrival());
  const anchor=await p.evaluate(()=>__mock.placed.at(-1));
  await p.evaluate(()=>{__mock.offsetX=.08;__step(120);__native('select');__native('selectend');__step(40);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today','placing/released input picked a title');
  if(!lying&&!reduce)await crop(p,'home-today.png');
  await target(p,'home-settings');assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'settings');
  const b=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.activeBounds));
  assert.ok(Math.abs(b.w/2048*.72-.58)<1e-6);assert.ok(Math.abs(b.h/2560*.9-.4)<1e-6);
  assert.deepEqual(await p.evaluate(()=>__mock.placed.at(-1)),anchor,'switching windows moved the reading anchor');
  if(!lying&&!reduce)await crop(p,'home-settings.png');
  await target(p,'settings-size:2');await target(p,'settings-done');
  await target(p,'home-work:today-2026-10-29-poem-'+works[0].id);
  assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
  assert.equal(await p.locator('#page').getAttribute('data-work'),'today-2026-10-29-poem-'+works[0].id);
  const paper=await p.evaluate(()=>Array.from(document.querySelector('#page').getContext('2d').getImageData(100,1000,1,1).data));assert.deepEqual(paper,[246,242,233,255]);
  await p.evaluate(()=>__hold());assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today');
  const current=await p.evaluate(()=>__coherentText.filter(x=>x.text==='Continue →').length);assert.equal(current,1,'home must identify one current work');
  await target(p,'home-shelf');if(!lying&&!reduce)await crop(p,'home-shelf.png');
  await p.evaluate(()=>__hold());assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
  await p.evaluate(()=>__hold());assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'shelf','menu must remember selected home tab');
  await target(p,'home-settings');await target(p,'settings-more');await target(p,'settings-controls');await target(p,'settings-pointer:head');
  assert.ok(await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).some(b=>b.id==='settings-pointer:head'&&b.selected)));
  await target(p,'settings-back',true);await target(p,'settings-back',true);await target(p,'settings-exit',true);
  assert.equal(await p.locator('#enter').isEnabled(),true,'leaving did not restore browser entry');
  assert.deepEqual(errors,[]);await p.close();passed(`content home: real targets, transparent bounds, saved reading, settings, remembered tabs and exit ${lying?'lying':'upright'} ${reduce?'reduced':'normal'}`);
 }
 const {seedProgress}=await import(pathToFileURL(path.join(__dirname,'..','progress.js')).href);
 const longest=[...SOURCE_CATALOGUE].sort((a,b)=>b.title.length-a.title.length)[0];
 const savedId=`today-2026-10-28-${longest.kind}-${longest.id}`,seed=seedProgress('2026-10-29');
 seed.days['2026-10-28']={...seed.days['2026-10-28'],ids:{[longest.kind]:longest.id},picks:{[longest.kind]:`${longest.title} — ${longest.author}`,story:'Unmatched imported story label '.repeat(45)}};
 const p=await browser.newPage();await p.clock.setFixedTime(new Date(2026,9,29,20));await mock(p,'layer',false,{practised:true,headPointer:false,visits:4});
 await p.addInitScript(({seed,savedId,works})=>{
  localStorage.setItem('cabin-progress',JSON.stringify(seed));localStorage.setItem('cabin-reading',JSON.stringify({last:savedId,places:{[savedId]:{anchor:{block:0,word:0,section:'text'},page:0}}}));
  localStorage.setItem('cabin-today',JSON.stringify({version:2,date:'2026-10-29',picks:Object.fromEntries(works.map(w=>[w.kind,{catalogueId:w.id}]))}));
  window.__resumeText=[];const f=CanvasRenderingContext2D.prototype.fillText,r=CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.id==='page')__resumeText=[];return r.call(this,...a);};
  CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.id==='page'){const point=this.getTransform().transformPoint({x:a[0],y:a[1]});__resumeText.push({text:String(t),font:this.font,y:point.y});}return f.call(this,t,...a);};
 },{seed,savedId,works:works.map(w=>({id:w.id,kind:w.kind}))});
 await p.goto(BASE_URL);await p.locator('#enter').click();await p.evaluate(()=>{__step();__pinch();__step(1000);});
 const rendered=await p.evaluate(()=>__resumeText);
 const resume=rendered.filter(x=>x.font.startsWith('500 18px')).map(x=>x.text).join(' ');
 assert.ok(resume.includes(longest.title),'longest real Resume title was shortened: '+resume);
 assert.ok(!resume.includes('…'));const todayRows=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).filter(b=>b.id.startsWith('home-work:')));assert.equal(rendered.filter(x=>x.text==='Continue →'&&todayRows.some(b=>x.y>=b.y&&x.y<=b.y+b.h)).length,0,'other-day reading falsely marks a Today row current');
 await crop(p,'home-long-resume.png');
 await p.evaluate(async()=>{await __aim({x:900,y:140,w:0,h:0},true);__hand(.05);__step(500);});
 assert.equal(await p.evaluate(()=>[...__mock.layerData].filter(([l,d])=>d.pointer&&l.opacity>0).length),0,'transparent portrait margin still shows a pointer');
 await target(p,'home-library');assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'library');
 const selected=await p.evaluate(()=>{const c=document.querySelector('#page').getContext('2d'),s=2048/720,y=(2560-500*s)/2;return {today:c.getImageData(30*s,y+30*s,1,1).data[0],shelf:c.getImageData(137*s,y+30*s,1,1).data[0]};});
 assert.ok(selected.shelf>selected.today+5,'Library falsely marks Today selected');
 await target(p,'home-back-shelf');await target(p,'home-calendar');await target(p,'day:2026-10-28');
 assert.ok(await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).some(b=>b.id==='day-notes')),'long imported labels lost their full-title route');
 await target(p,'day-notes');assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'notes');
 const notePages=[];
 for(let i=0;i<20;i++){
  notePages.push(await p.evaluate(()=>__resumeText.map(x=>x.text).join(' ')));
  if(!await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).some(b=>b.id==='notes-next')))break;
  await target(p,'notes-next');
 }
 assert.ok(notePages.join(' ').includes('Unmatched imported story label'),'full imported title text was discarded');
 await target(p,'notes-home');assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'day');
 await p.close();passed('content home: full longest Resume, truthful Library, pointer margins and full imported title pagination');
 for(const scenario of ['no-layer','no-layers-feature']){
  const q=await browser.newPage();await mock(q,scenario,false,{practised:true,headPointer:false,visits:4});await q.goto(BASE_URL);await q.locator('#enter').click();await q.evaluate(()=>{__step();__pinch();__step(1000);});
  assert.equal(await q.locator('#page').getAttribute('data-menu-page'),'today');await target(q,'home-settings');
  assert.equal(await q.locator('#page').getAttribute('data-menu-page'),'settings','projection fallback did not use visible target');
  await target(q,'settings-done');await target(q,'home-resume');assert.equal(await q.locator('#page').getAttribute('data-view'),'reading');await q.close();passed('content home: actual native targets and reading return on '+scenario+' fallback');
 }
};
