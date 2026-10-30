const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
// The app is already open when Claude saves the daily three or a swap: the
// once-a-minute check picks it up, and only a new file starts a sync. A
// reader mid-story stays on the same page.
module.exports = async (browser,{mock,BASE_URL,passed}) => {
  const { SOURCE_CATALOGUE } = await import(pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
  const { berlinDateKey } = await import(pathToFileURL(path.join(__dirname,'..','progress.js')).href);
  const starter=['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'];
  const fresh=SOURCE_CATALOGUE.filter(w=>!starter.includes(w.id));
  const [poem,swapPoem]=fresh.filter(w=>w.kind==='poem');
  const story=fresh.find(w=>w.kind==='story'), essay=fresh.find(w=>w.kind==='essay');
  for(const where of ['browser page','mid-story']) {
    const today=berlinDateKey();
    const picksFile=(p)=>JSON.stringify({version:2,date:today,picks:{poem:{catalogueId:p.id},story:{catalogueId:story.id},essay:{catalogueId:essay.id}}});
    const p=await browser.newPage(), errors=[], files=[];let progressWrites=0, remote=null;
    p.on('pageerror',e=>errors.push(e.message));
    if(where==='mid-story')await mock(p,'layer',false,{practised:true,headPointer:true});
    await p.route('https://accounts.google.com/**',route=>route.abort());
    await p.route('https://www.googleapis.com/**',route=>{
      const req=route.request(),url=new URL(req.url());
      const json=b=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(b)});
      if(req.method()!=='GET'){progressWrites++;const b=req.postData();remote=req.method()==='PATCH'?b:b.slice(b.indexOf('{"cabinPickerInstructions"'),b.lastIndexOf('\r\n--'));return json({id:'P'});}
      const media=url.pathname.match(/files\/([^/]+)$/);
      if(url.searchParams.get('alt')==='media'&&media){
        if(media[1]==='P')return route.fulfill({status:200,contentType:'application/json',body:remote});
        const f=files.find(f=>f.id===media[1]);return route.fulfill({status:200,contentType:'application/json',body:f.body});
      }
      const q=url.searchParams.get('q')||'';
      if(q.includes('progress.json'))return json({files:remote?[{id:'P',name:'progress.json'}]:[]});
      if(q.includes("name = 'Bradbury Cabin'"))return json({files:[{id:'F',name:'Bradbury Cabin'}]});
      return json({files:[...files].reverse().map(({body,...f})=>f)});
    });
    await p.addInitScript(()=>{
      sessionStorage.setItem('cabin-google-token',JSON.stringify({token:'fixture-only',read:true,expires:Date.now()+3600000}));
      // Run the once-a-minute check on demand instead of waiting a minute.
      const every=window.setInterval;window.__minute=[];
      window.setInterval=(f,ms,...a)=>{if(ms===60000)__minute.push(f);return every(f,ms,...a);};
      // Words drawn on the reading page, to see that the same page stays open.
      window.__pageText=[];
      const fill=CanvasRenderingContext2D.prototype.fillRect, draw=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){if(this.canvas.id==='page'&&w===2048&&h===2560)__pageText=[];return fill.call(this,x,y,w,h);};
      CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(this.canvas.id==='page')__pageText.push(String(t));return draw.call(this,t,...a);};
    });
    await p.goto(BASE_URL);
    for(let i=0;i<60&&!progressWrites;i++)await p.waitForTimeout(100);
    assert.equal(progressWrites,1,'the opening sync writes once');
    const minute=async()=>{await p.evaluate(()=>Promise.all(__minute.map(f=>f())));await p.waitForTimeout(400);};
    // Nothing new: a check makes no sync.
    await minute();
    assert.equal(progressWrites,1,'an unchanged folder starts no sync');
    let before=null;
    if(where==='mid-story') {
      await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
      if((await p.locator('#page').getAttribute('data-view'))==='menu')await p.evaluate(()=>__hold());
      assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
      // Turn a page: the reader has started (an untouched arrival may still
      // be greeted by Today when the three arrive).
      await p.evaluate(()=>{__step(700);__pinch();__step(700);});
      assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
      before=await p.evaluate(()=>[...__pageText]);
    }
    // Claude saves today's three while the app is open.
    files.push({id:'T1',name:`picks-${today}.json`,createdTime:new Date().toISOString(),body:picksFile(poem)});
    await minute();
    assert.equal(progressWrites,2,'a new picks file starts one sync');
    let days=JSON.parse(await p.evaluate(()=>localStorage.getItem('cabin-progress'))).days;
    assert.equal(days[today].ids.poem,poem.id,'today\'s three arrived');
    // "Swap the poem": a newer file for the same day.
    files.push({id:'T2',name:`picks-${today}-2.json`,createdTime:new Date(Date.now()+1000).toISOString(),body:picksFile(swapPoem)});
    await minute();
    assert.equal(progressWrites,3,'the swap starts one sync');
    days=JSON.parse(await p.evaluate(()=>localStorage.getItem('cabin-progress'))).days;
    assert.equal(days[today].ids.poem,swapPoem.id,'the swapped poem replaced the old one');
    assert.equal(days[today].ids.story,story.id,'the other two stay');
    await minute();
    assert.equal(progressWrites,3,'no repeat sync once the swap is in');
    if(where==='mid-story') {
      assert.equal(await p.locator('#page').getAttribute('data-view'),'reading','the reader is not pulled out of the story');
      // Drawn words accumulate across repaints; the last page drawn counts.
      const lastPage=t=>t.slice(t.lastIndexOf('Bradbury Cabin')).join(' ');
      const after=lastPage(await p.evaluate(()=>[...__pageText]));
      assert.match(lastPage(before),/The first leaf.*2 (\/|of) 2/,'the reader had turned to page 2');
      assert.match(after,/The first leaf.*2 (\/|of) 2/,'the same page stays open');
    }
    assert.equal(JSON.parse(await p.evaluate(()=>localStorage.getItem('cabin-today'))).picks.poem.catalogueId,swapPoem.id,'Today shows the swapped poem');
    assert.deepEqual(errors,[]);await p.close();
    passed(`New daily three and a swap arrive within a minute while the app is open (${where})`);
  }
};
