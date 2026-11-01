const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
// Critic 6: after the explicit "Mark as read", the optional stars card
// offers the next unread piece of today's three in one pinch, with the
// Library beside it. Completion is still saved before the card appears.
module.exports = async function finishNextChecks(browser, { mock, BASE_URL, out, passed }) {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
  const starter = ['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'];
  const lines = w => w.blocks.reduce((n,b)=>n+b.lines.length,0);
  const poem = SOURCE_CATALOGUE.filter(w=>w.kind==='poem'&&!starter.includes(w.id)).sort((a,b)=>lines(a)-lines(b))[0];
  const works = [poem, ...['story','essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !starter.includes(w.id)))];
  const today = '2026-10-29';
  const p = await browser.newPage({viewport:{width:1440,height:1100}}), errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-29T20:00:00+01:00'));
  await mock(p,'layer',false,{practised:true,headPointer:false,visits:4});
  await p.addInitScript(({works,today}) => {
    if(!sessionStorage.getItem('finish-next-seeded')) {
      localStorage.setItem('cabin-today',JSON.stringify({version:2,date:today,picks:Object.fromEntries(works.map(w=>[w.kind,{catalogueId:w.id}]))}));
      localStorage.setItem('cabin-progress',JSON.stringify({version:1,start:'2026-10-18',trackingSince:today,weeks:{},days:{[today]:{
        ids:Object.fromEntries(works.map(w=>[w.kind,w.id])),picks:Object.fromEntries(works.map(w=>[w.kind,`${w.title} — ${w.author}`]))}}}));
      localStorage.removeItem('cabin-reading');
      sessionStorage.setItem('finish-next-seeded','yes');
    }
    window.__cardText=[];
    const fill=CanvasRenderingContext2D.prototype.fillText,clear=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.id==='page')__cardText=[];return clear.call(this,...a);};
    CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.id==='page')__cardText.push(String(t));return fill.call(this,t,...a);};
  },{works:works.map(({id,kind,title,author})=>({id,kind,title,author})),today});
  const target = id => p.evaluate(async id => { await __aim(id,true); __pinch(); __step(700); },id);
  const menu = () => p.locator('#page').getAttribute('data-menu-page');
  await p.goto(BASE_URL); await p.locator('#enter').click(); await p.evaluate(()=>__center());
  await target(`home-work:today-${today}-poem-${poem.id}`);
  for(let i=0;i<100 && await menu()!=='closing';i++)await p.evaluate(()=>{__pinch('right');__step(700);});
  assert.equal(await menu(),'closing');
  await p.evaluate(async()=>{await __aim({x:0,y:0,w:1,h:1},true);__step(700);__pinch('right');__step(700);});
  assert.equal(await menu(),'feedback','the optional stars card still follows a fresh finish');
  assert.ok(await p.evaluate(id=>JSON.parse(localStorage.getItem('cabin-progress')).completedWorks?.[id],poem.id),'completion is saved before the card');
  const ids = await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).map(b=>b.id));
  assert.ok(ids.includes('feedback-continue') && ids.includes('feedback-done'),'Next and Library sit side by side: '+ids);
  const card = (await p.evaluate(()=>__cardText)).join(' ');
  assert.ok(card.includes('Next: ') && card.includes('Library'),'the card names the next piece: '+card);
  assert.ok(card.includes(works[1].title.slice(0,6)),'the next piece is today\'s story: '+card);
  await p.locator('#page').screenshot({path:path.join(out,'finish-next-card.png')});
  await target('feedback-continue');
  assert.equal(await p.locator('#page').getAttribute('data-view'),'reading','one pinch opens the next piece');
  const reading = await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-reading')));
  assert.equal(reading.last,`today-${today}-story-${works[1].id}`,'the story is now the work open');
  assert.deepEqual(errors,[]);
  passed('finishing: the stars card offers the next unread piece in one pinch, Library beside it');
  await p.close();
};
