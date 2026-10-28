const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function guideChecks(browser, { mock, BASE_URL, out, passed }) {
  const observe = async p => p.addInitScript(() => {
    window.__pageText = [];
    const rect = CanvasRenderingContext2D.prototype.fillRect;
    const text = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillRect = function(x,y,w,h) {
      if (this.canvas.id === 'page' && w === 2048 && h === 2560) __pageText = [];
      return rect.call(this,x,y,w,h);
    };
    CanvasRenderingContext2D.prototype.fillText = function(t,...args) {
      if (this.canvas.id === 'page') __pageText.push(t);
      return text.call(this,t,...args);
    };
  });
  for (const lying of [false, true]) {
    const p = await browser.newPage({ viewport: { width:1440, height:1100 } }), errors=[];
    p.on('pageerror', e => errors.push(e.message));
    await mock(p,'layer',lying); await observe(p);
    await p.goto(BASE_URL);
    await p.locator('#enter:not([disabled])').click(); await p.evaluate(() => __center());
    const section = () => p.locator('#page').getAttribute('data-section');
    const work = () => p.locator('#page').getAttribute('data-work');
    const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('cabin-reading')));
    const choose = async id => {
      await p.evaluate(async id => __aim(id),id);
      await p.evaluate(() => __pinch());
    };
    const menu = async () => {
      if (await p.locator('#page').getAttribute('data-view') === 'reading')
        await p.evaluate(() => { __mock.look=null; __step(600); });
      await p.evaluate(() => __hold());
    };
    const turn = async (hand='right') => p.evaluate(hand => {
      __mock.look=null; __step(600); __pinch(hand);
    }, hand);
    const until = async target => {
      for (let i=0; await section()!==target; i++) {
        assert.ok(i<40,'section reachable: '+target);
        await turn();
      }
    };
    await menu(); await choose('library');
    await choose({x:274,y:824,w:1500,h:112});
    assert.equal(await work(),'blake-sick-rose');
    assert.equal(await section(),'before','new work opens with introduction');
    assert.ok((await p.evaluate(()=>__pageText)).includes('Before reading'));
    assert.ok(!(await p.evaluate(()=>__pageText)).includes('After reading — spoilers'));
    const suffix=lying?'-lying':'';
    await p.locator('#page').screenshot({path:path.join(out,`flow-before${suffix}.png`)});
    await menu();
    assert.ok(!(await p.evaluate(()=>__pageText)).includes('Study guide'),'no guide menu task remains');
    await menu();
    await until('text');
    assert.ok((await p.evaluate(()=>__pageText)).includes('O rose, thou art sick!'));
    assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
    assert.ok((await p.evaluate(()=>__pageText)).includes(await p.locator('#place').textContent()), 'turn feedback and page label agree');
    const textPlace=await saved();
    assert.equal(textPlace.last,'blake-sick-rose');
    assert.equal(textPlace.places['blake-sick-rose'].anchor.section,'text');
    await p.locator('#page').screenshot({path:path.join(out,`flow-text${suffix}.png`)});
    await p.evaluate(()=>{__mock.look=null;__step();__welcomeScene();});
    await p.locator('#welcome-scene').screenshot({path:path.join(out,`flow-native-${lying?'lying':'front'}.png`)});
    await p.evaluate(()=>{__mock.offsetX=.25;__step();__welcomeScene();});
    await p.locator('#welcome-scene').screenshot({path:path.join(out,`flow-native-${lying?'lying':'front'}-side.png`)});
    await p.evaluate(()=>{__mock.offsetX=0;__step();});
    await until('after');
    assert.ok((await p.evaluate(()=>__pageText)).includes('After reading — spoilers'),JSON.stringify(await p.evaluate(()=>__pageText)));
    assert.equal(await work(),'blake-sick-rose');
    assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
    await p.locator('#page').screenshot({path:path.join(out,`flow-after${suffix}.png`)});
    await turn('left');
    assert.equal(await section(),'text','back from after returns to the last text page');
    await turn('left');
    assert.equal(await section(),'before','back from text returns to the introduction');
    await until('after');
    passed('normal page turns flow before → full text → after and back, without opening a menu'+suffix);

    await menu(); await choose('mood'); await choose('night'); await choose('size'); await menu();
    assert.equal(await section(),'after','reflow stays in after notes, not source block 0');
    await p.locator('#page').screenshot({path:path.join(out,`flow-after-modern-night${suffix}.png`)});
    if (await p.locator('#next').isEnabled()) await p.locator('#next').click();
    const afterPlace=await saved();
    assert.equal(afterPlace.last,'blake-sick-rose');
    assert.equal(afterPlace.places['blake-sick-rose'].anchor.section,'after');
    await p.reload();
    await p.waitForFunction(()=>document.querySelector('#page').dataset.work==='blake-sick-rose');
    assert.equal(await section(),'after','reload resumes same section under the real work id');
    assert.equal((await saved()).last,'blake-sick-rose');
    passed('notes retain their own anchors on size/style change and reload; last work remains real'+suffix);

    await p.locator('#enter:not([disabled])').click(); await p.evaluate(()=>__center());
    await menu(); await choose('library');
    await choose({x:274,y:1320,w:1500,h:112});
    assert.equal(await work(),'chopin-desiree'); assert.equal(await section(),'before');
    await until('text');
    for(let i=0;i<3;i++)await turn();
    const sourcePlace=await saved();
    assert.equal(sourcePlace.places['chopin-desiree'].anchor.section,'text');
    await p.reload();
    await p.waitForFunction(()=>document.querySelector('#page').dataset.work==='chopin-desiree');
    assert.equal(await section(),'text');
    assert.deepEqual((await saved()).places['chopin-desiree'], sourcePlace.places['chopin-desiree']);
    await p.locator('#enter:not([disabled])').click(); await p.evaluate(()=>__center());
    await menu(); await choose('library');
    await choose({x:274,y:700,w:1500,h:112});
    assert.equal(await work(),'sampler'); assert.equal(await section(),'text');
    assert.ok(!(await p.evaluate(()=>__pageText)).includes('No study guide for this text.'));
    await turn(); assert.match(await p.locator('#place').textContent(),/Page 2 of 2/);
    assert.deepEqual(errors,[]);
    passed('long-story resume and sampler reading stay direct without empty guide pages'+suffix);
    await p.close();
  }
  {
    const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{
      if(!sessionStorage.getItem('legacy-seeded')){
        localStorage.setItem('cabin-reading',JSON.stringify({last:'chopin-desiree',places:{'chopin-desiree':{anchor:{block:5,word:0},page:2}}}));
        sessionStorage.setItem('legacy-seeded','yes');
      }
    });
    await p.goto(BASE_URL);
    await p.waitForFunction(()=>document.querySelector('#page').dataset.work==='chopin-desiree');
    assert.equal(await p.locator('#page').getAttribute('data-section'),'text','Build 023 anchors refer to the original text');
    assert.deepEqual(errors,[]);await p.close();
    passed('existing saved source anchors migrate into the text without becoming guide anchors');
  }
  {
    const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026,9,28,20));await mock(p,'layer',false);await observe(p);
    // A complete trio of real catalogue references; the shortest poem fits one page.
    const { SOURCE_CATALOGUE } = await import(require('node:url').pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
    const lines = w => w.blocks.reduce((n,b)=>n+b.lines.length,0);
    const shortPoem = SOURCE_CATALOGUE.filter(w=>w.kind==='poem').sort((a,b)=>lines(a)-lines(b))[0];
    const ref = k => ({catalogueId:(k==='poem'?shortPoem:SOURCE_CATALOGUE.find(w=>w.kind===k&&!['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'].includes(w.id))).id});
    const cached = {version:2,date:'2026-10-28',picks:{poem:{...ref('poem'),text:'FORGED CACHED TEXT',guide:{context:'Intro notes.',themes:'After notes.'}},story:ref('story'),essay:ref('essay')}};
    await p.addInitScript(c=>localStorage.setItem('cabin-today',c),JSON.stringify(cached));
    await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    await p.evaluate(()=>__hold());await p.evaluate(async()=>__aim('library'));await p.evaluate(()=>__pinch());
    await p.evaluate(async()=>__aim({x:274,y:700,w:1500,h:112}));await p.evaluate(()=>__pinch());
    const id=await p.locator('#page').getAttribute('data-work');assert.equal(id,`today-2026-10-28-poem-${shortPoem.id}`);
    assert.equal(await p.locator('#page').getAttribute('data-section'),'before');
    await p.clock.setFixedTime(new Date(2026,9,29,0,0,5));
    await p.evaluate(()=>{__mock.look=null;__step(600);__pinch();});
    assert.equal(await p.locator('#page').getAttribute('data-work'),id);
    assert.equal(await p.locator('#page').getAttribute('data-section'),'text');
    // A long verse line wraps with a hanging indent, so compare across draws.
    const shown=(await p.evaluate(()=>__pageText)).join(' ').replace(/\s+/g,' ');
    assert.ok(shortPoem.blocks.every(b=>b.lines.every(l=>shown.includes(l.text))),'every line of the catalogue poem is shown');
    assert.ok(!shown.includes('FORGED'),'cached model text never appears');
    await p.evaluate(()=>__pinch());
    assert.equal(await p.locator('#page').getAttribute('data-section'),'after');
    assert.ok((await p.evaluate(()=>__pageText)).includes('After notes.'));
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-reading')).last),id);
    assert.deepEqual(errors,[]);await p.close();
    passed('cached catalogue trio flows through all sections offline across midnight; forged cached text ignored');
  }
};
