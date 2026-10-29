const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
module.exports=async function coherentChecks(browser,{mock,BASE_URL,out,passed}){
 const {SOURCE_CATALOGUE}=await import(pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
 const excluded=new Set(['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth']);
 const works=['poem','story','essay'].map(kind=>SOURCE_CATALOGUE.find(w=>w.kind===kind&&!excluded.has(w.id)));
 for(const lying of [false,true]) for(const reduce of [false,true]){
  const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.emulateMedia({reducedMotion:reduce?'reduce':'no-preference'});await p.clock.setFixedTime(new Date(2026,9,29,20));
  await mock(p,'layer',lying,{practised:true,headPointer:true});
  await p.addInitScript(works=>{
   localStorage.setItem('cabin-today',JSON.stringify({version:2,date:'2026-10-29',picks:Object.fromEntries(works.map(w=>[w.kind,{catalogueId:w.id}]))}));
   window.__coherentText=[];const fill=CanvasRenderingContext2D.prototype.fillText,rect=CanvasRenderingContext2D.prototype.fillRect;
   CanvasRenderingContext2D.prototype.fillText=function(t,...args){if(this.canvas.id==='page')__coherentText.push({text:String(t),font:this.font});return fill.call(this,t,...args);};
   CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){if(this.canvas.id==='page'&&w===2048&&h===2560)__coherentText=[];return rect.call(this,x,y,w,h);};
  },works.map(w=>({id:w.id,kind:w.kind})));
  await p.goto(BASE_URL);await p.locator('#enter').click();
  await p.evaluate(()=>{__step();__pinch();});
  assert.equal(await p.locator('#page').getAttribute('data-welcome-complete'),'true');
  assert.equal(Number(await p.locator('#page').getAttribute('data-arrival-ms')),reduce?1:200);
  const anchor=await p.evaluate(()=>__mock.placed.at(-1));
  await p.evaluate(()=>{__native('selectstart');__native('select');__native('selectend');__step(40);__mock.offsetX=.12;__step(240);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'welcome','placing/arrival input leaked');
  assert.deepEqual(await p.evaluate(()=>__mock.placed.at(-1)),anchor,'arrival moved the chosen window');
  assert.ok(await p.evaluate(()=>__coherentText.some(x=>x.text==='Today’s three')));
  await p.evaluate(async()=>{await __aim({x:274,y:1250,w:1500,h:170});__pinch();});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today','fresh welcome choice dismissed decoration instead of choosing');
  assert.equal(await p.locator('#page').getAttribute('data-today-complete'),'true');
  const text=await p.evaluate(()=>__coherentText.map(x=>x.text).join(' '));for(const w of works)assert.ok(text.includes(w.title),w.title+' missing on first Today frame');
  assert.deepEqual(await p.evaluate(()=>__mock.placed.at(-1)),anchor,'welcome to Today recentered the menu');
  const navPixel=await p.evaluate(()=>Array.from(document.querySelector('#page').getContext('2d').getImageData(100,1000,1,1).data));
  assert.deepEqual(navPixel,[51,62,61,255]);
  await p.evaluate(async()=>{await __aim({x:1394,y:380,w:380,h:120});__pinch();});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'main');
  const command=await p.evaluate(()=>__coherentText.find(x=>x.text==='More settings'));
  assert.ok(command&&!command.font.includes('Literata'),'functional command inherited reading font');
  if(!lying&&!reduce){await p.locator('#page').screenshot({path:path.join(out,'navigation-main.png')});}
  await p.evaluate(()=>{__mock.offsetX=-.12;__step(40);});
  await p.evaluate(async()=>{await __aim('library');__pinch();});
  assert.deepEqual(await p.evaluate(()=>__mock.placed.at(-1)),anchor,'opening Today during browsing moved the menu');
  if(!lying&&!reduce)await p.locator('#page').screenshot({path:path.join(out,'navigation-today.png')});
  await p.evaluate(()=>__hold());
  assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
  assert.deepEqual(await p.evaluate(()=>__mock.placed.at(-1)),anchor,'reader anchor changed');
  const paperPixel=await p.evaluate(()=>Array.from(document.querySelector('#page').getContext('2d').getImageData(100,1000,1,1).data));
  assert.deepEqual(paperPixel,[246,242,233,255]);
  await p.locator('#practice').click();await p.evaluate(()=>__step(16));
  assert.equal(await p.locator('#page').getAttribute('data-view'),'practice');
  const practicePixel=await p.evaluate(()=>Array.from(document.querySelector('#page').getContext('2d').getImageData(180,710,1,1).data));
  assert.deepEqual(practicePixel,[65,78,74,255],'practice must pair the navigation foreground with its dark card');
  if(!lying&&!reduce)await p.locator('#page').screenshot({path:path.join(out,'navigation-practice.png')});
  assert.deepEqual(errors,[]);await p.close();passed(`coherent: complete first choices, protected placement, fixed browsing and distinct reading ${lying?'lying':'upright'} ${reduce?'reduced motion':'normal motion'}`);
 }
};
