const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
module.exports = async function finishChecks(browser, { mock, BASE_URL, passed }) {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
  const tiger = SOURCE_CATALOGUE.find(w => w.id === 'william-blake-experience-the-tiger');
  const works = [tiger, ...['story','essay'].map(kind => SOURCE_CATALOGUE.find(w => w.kind === kind && !['ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'].includes(w.id)))];
  const today = '2026-10-29', past = '2026-10-28';
  const target = async (p,id) => p.evaluate(async id => { await __aim(id,true); __pinch(); __step(700); },id);
  const menu = p => p.locator('#page').getAttribute('data-menu-page');
  for (const origin of ['today','library','archive']) {
    const p = await browser.newPage(), errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026,9,29,20));
    await mock(p,'layer',false,{practised:true,headPointer:false,visits:4});
    const assignedWorks=origin==='archive' ? works.map(w=>w.kind==='poem' ? SOURCE_CATALOGUE.find(x=>x.kind==='poem'&&x.id!==tiger.id&&!['blake-sick-rose','whitman-astronomer','whitman-captain'].includes(x.id)) : w) : works;
    await p.addInitScript(({works,today,past,tiger,origin}) => {
      if(!sessionStorage.getItem('finish-test-seeded')) {
      localStorage.setItem('cabin-today',JSON.stringify({version:2,date:today,picks:Object.fromEntries(works.map(w=>[w.kind,{catalogueId:w.id}]))}));
      const day = {ids:Object.fromEntries(works.map(w=>[w.kind,w.id])),picks:Object.fromEntries(works.map(w=>[w.kind,`${w.title} — ${w.author}`]))};
      const days = {[today]:day};
      if(origin==='archive')days[past]={ids:{poem:tiger.id},picks:{poem:`${tiger.title} — ${tiger.author}`}};
      localStorage.setItem('cabin-progress',JSON.stringify({version:1,start:'2026-10-18',trackingSince:today,days,weeks:{}}));
      sessionStorage.setItem('finish-test-seeded','yes');
      }
      window.__finishText=[];
      const fill=CanvasRenderingContext2D.prototype.fillText,clear=CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect=function(...a){if(this.canvas.id==='page')__finishText=[];return clear.call(this,...a);};
      CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.id==='page')__finishText.push(String(t));return fill.call(this,t,...a);};
    },{works:assignedWorks.map(({id,kind,title,author})=>({id,kind,title,author})),today,past,tiger:{id:tiger.id,title:tiger.title,author:tiger.author},origin});
    await p.goto(BASE_URL); await p.locator('#enter').click(); await p.evaluate(()=>__center());
    let canonical=tiger.id;
    if(origin==='today')await target(p,`home-work:today-${today}-poem-${tiger.id}`);
    if(origin==='archive'){
      await target(p,'home-shelf'); await target(p,`home-day:${past}`);
      await target(p,`home-work:today-${past}-poem-${tiger.id}`);
    }
    if(origin==='library'){
      canonical='blake-sick-rose';
      await target(p,'home-shelf'); await target(p,'home-library');
      for(let i=0;i<12;i++){
        const ids=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).map(b=>b.id));
        if(ids.includes(`home-work:${canonical}`))break;
        await target(p,'home-earlier');
      }
      await target(p,`home-work:${canonical}`);
    }
    assert.equal(await p.locator('#page').getAttribute('data-view'),'reading',`${origin}: work opened`);
    for(let i=0;i<100 && await menu(p)!=='closing';i++)await p.evaluate(()=>{__pinch('right');__step(700);});
    assert.equal(await menu(p),'closing',`${origin}: NEXT beyond final page opens confirmation`);
    const record = () => p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')));
    assert.equal((await record()).completedWorks?.[canonical],undefined,'opening confirmation completed the work');
    await p.evaluate(()=>{__native('select');__native('selectend');__step(100);});
    assert.equal((await record()).completedWorks?.[canonical],undefined,'unpaired release completed the work');
    await p.evaluate(async()=>{await __aim('end-back',true);__step(700);__pinch('right');__step(700);});
    assert.equal(await p.locator('#page').getAttribute('data-view'),'reading','BACK cancels completion');
    await p.evaluate(()=>{__pinch('right');__step(700);});
    assert.equal(await menu(p),'closing');
    // The confirmation uses the familiar NEXT hand, without aiming at a row.
    if(origin==='library')await p.evaluate(async()=>{await __aim('end-mark',true);__hand(.05,'left');__step(800);__pinch('left');__step(700);});
    else await p.evaluate(async()=>{await __aim({x:0,y:0,w:1,h:1},true);__step(700);__pinch('right');__step(700);});
    assert.equal(await menu(p),'library',`${origin}: fresh NEXT opens Library`);
    const saved=await record();
    assert.ok(saved.completedWorks?.[canonical],`${origin}: completion saved immediately`);
    assert.equal(saved.days[today].poem,origin==='today'?true:undefined,'unrelated daily work tick changed');
    if(origin==='archive')assert.equal(saved.days[past].poem,true);
    assert.ok(await p.evaluate(()=>__finishText.some(t=>/^Read\s*✓(?:\s|$)/.test(t))),'Library must show Read even on the current work');
    assert.ok(await p.evaluate(id=>JSON.parse(document.querySelector('#page').dataset.buttons).some(b=>b.id.includes(id)),canonical),'Library must show the completed edition on the selected page');
    await p.reload(); await p.locator('#enter').click(); await p.evaluate(()=>__center());
    assert.ok((await record()).completedWorks?.[canonical],'reload lost completion');
    assert.deepEqual(errors,[]);
    passed(`completion: ${origin} finish is explicit, immediate, readable and survives reload`);
    await p.close();
  }
};
