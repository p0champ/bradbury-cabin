const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async function personalChecks(browser,{mock,BASE_URL,out,passed}){
 const ids={poem:'william-blake-experience-the-tiger',story:'kate-chopin-a-pair-of-silk-stockings',essay:'francis-bacon-of-travel'};
 for(const lying of [false,true]) for(const read of [0,2,3]){
  const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.clock.setFixedTime(new Date(2026,9,28,20));await mock(p,'layer',lying);
  const dedication='Take a quiet moment. There is time to look more closely today.';
  const thread='Across these three works, attention changes what we see. Leave room for the small details, and for whatever connection you found for yourself.';
  await p.addInitScript(({ids,read,dedication,thread})=>{
   if(!sessionStorage.getItem('personal-seed')){
    const day={ids,poem:read>=1,story:read>=2,essay:read>=3};
    localStorage.setItem('cabin-progress',JSON.stringify({version:1,start:'2026-10-18',trackingSince:'2026-10-18',days:{'2026-10-28':day},weeks:{}}));
    localStorage.setItem('cabin-today',JSON.stringify({version:2,date:'2026-10-28',picks:Object.fromEntries(Object.entries(ids).map(([k,id])=>[k,{catalogueId:id}])),dedication,thread}));
    sessionStorage.setItem('personal-seed','yes');
   }
   window.__pageText=[];
   const fill=CanvasRenderingContext2D.prototype.fillRect,draw=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){if(this.canvas.id==='page'&&w===2048&&h===2560)__pageText=[];return fill.call(this,x,y,w,h)};
   CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.id==='page')__pageText.push(String(t));return draw.call(this,t,...a)};
  },{ids,read,dedication,thread});
  await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>{__center();__step(1600)});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today');
  const text=await p.evaluate(()=>__pageText.join(' '));
  assert.equal(text.includes(dedication),read<3);assert.equal(text.includes(thread),read===3);
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')).days['2026-10-28']);
  assert.equal(saved.personal.dedication,dedication);assert.equal(saved.personal.thread,thread);assert.equal(saved.essay,read===3);
  await p.locator('#page').screenshot({path:path.join(out,`personal-${read}-${lying?'lying':'front'}.png`)});
  await p.evaluate(()=>{__mock.offsetX=.25;__step();__welcomeScene()});
  await p.locator('#welcome-scene').screenshot({path:path.join(out,`personal-${read}-${lying?'lying':'front'}-side.png`)});
  await p.evaluate(async()=>{__mock.offsetX=0;__step();const {todayButtons}=await import('./today-panel.js?v=37.1');await __aim(todayButtons([]).find(b=>b.id==='today-full-library'));__pinch()});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'library');
  await p.reload();await p.waitForFunction(()=>document.querySelector('#place').textContent.includes('Page'));
  const restored=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')).days['2026-10-28'].personal);
  assert.equal(restored.thread,thread);assert.deepEqual(errors,[]);await p.close();
  passed(`optional lines: ${read}/3 read, Library opens directly and copy survives reload${lying?' lying':''}`);
 }
};

