const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
// Critic item 1: with no daily three yet, Today says so, names the usual
// request to Claude, and opens yesterday's three in one step.
module.exports = async (browser,{mock,BASE_URL,out,passed}) => {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
  const starter=['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'];
  const pick=k=>SOURCE_CATALOGUE.find(w=>w.kind===k&&!starter.includes(w.id));
  const [poem,story,essay]=['poem','story','essay'].map(pick);
  const progress={version:1,start:'2026-10-18',trackingSince:'2026-10-18',weeks:{},savedAt:'2026-10-28T20:00:00Z',days:{
    '2026-10-28':{poem:true,ids:{poem:poem.id,story:story.id,essay:essay.id},
      picks:{poem:`${poem.title} — ${poem.author}`,story:`${story.title} — ${story.author}`,essay:`${essay.title} — ${essay.author}`}}}};
  const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.clock.setFixedTime(new Date(2026,9,29,20));
  await mock(p,'layer',false,{practised:true,headPointer:true,visits:4});
  await p.addInitScript(pr=>{
    if(!sessionStorage.getItem('missing-fixture')){localStorage.setItem('cabin-progress',pr);sessionStorage.setItem('missing-fixture','1');}
    window.__pageText=[];
    const fill=CanvasRenderingContext2D.prototype.fillRect, draw=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){if(this.canvas.id==='page'&&w===2048&&h===2560)__pageText=[];return fill.call(this,x,y,w,h);};
    CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.id==='page')__pageText.push(String(t));return draw.call(this,t,...a);};
  },JSON.stringify(progress));
  const view=async()=>[await p.locator('#page').getAttribute('data-view'),await p.locator('#page').getAttribute('data-menu-page')];
  await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
  // The centring helper resumes reading when Today has no works; open the menu.
  if((await view())[0]==='reading')await p.evaluate(()=>__hold());
  assert.deepEqual(await view(),['menu','today']);
  await p.evaluate(()=>__step(700));
  const text=(await p.evaluate(()=>__pageText)).join(' ');
  assert.ok(text.includes('Today’s three aren’t here yet · ask Claude for the daily three'),'Today explains the missing three: '+text);
  assert.ok(text.includes('Yesterday’s three →'));
  await p.locator('#page').screenshot({path:path.join(out,'today-missing-three.png')});
  await p.evaluate(async()=>{await __aim('home-day:2026-10-28');__pinch();__step(700);});
  assert.deepEqual(await view(),['menu','shelfday'],'one pinch opens yesterday’s three');
  const day=(await p.evaluate(()=>__pageText)).join(' ');
  for(const w of [poem,story,essay])assert.ok(day.includes(w.author),`yesterday’s ${w.kind} is listed`);
  assert.deepEqual(errors,[]);await p.close();
  passed('Today explains missing daily three, names the Claude request and opens yesterday’s three');
};
