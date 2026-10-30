const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function guideChecks(browser, { mock, BASE_URL, out, passed }) {
  // Navigate actual compact rows, including the Library's three-work pages.
  const aimLibrary = async (p, id) => {
    if (await p.locator('#page').getAttribute('data-menu-page') !== 'library') {
      await p.evaluate(async()=>__navigate('home-library')); await p.evaluate(()=>__pinch());
    }
    for (let i=0;i<100;i++) {
      const ids=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons||'[]').map(b=>b.id));
      if(ids.includes('home-work:'+id)){await p.evaluate(async id=>__aim('home-work:'+id),id);return;}
      assert.ok(ids.includes('home-earlier'),'Library work remains reachable: '+id);
      await p.evaluate(async()=>{await __aim('home-earlier');__pinch();__step(700);});
    }
    assert.fail('Library pagination did not reach '+id);
  };
  const aimRow = async (p, index) => p.evaluate(async index=>{
    const b=JSON.parse(document.querySelector('#page').dataset.buttons||'[]').filter(b=>b.id.startsWith('home-work:'))[index];
    if(!b)throw Error('Missing compact work row '+index);await __aim(b.id);
  },index);
  const observe = async p => p.addInitScript(() => {
    window.__pageText = [];
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function(x,y,w,h) {
      if(this.canvas.id==='page'&&w===2048&&h===2560)__pageText=[];
      return clear.call(this,x,y,w,h);
    };
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
      await p.evaluate(async id => __navigate(id),id);
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
    // No picks today: the row opens Your shelf, then the whole Library.
    await menu(); await aimLibrary(p,'blake-sick-rose'); await p.evaluate(()=>__pinch());
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
    await menu(); await aimLibrary(p,'chopin-desiree'); await p.evaluate(()=>__pinch());
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
    await menu(); await aimLibrary(p,'sampler'); await p.evaluate(()=>__pinch());
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
    await p.clock.setFixedTime(new Date(2026,9,28,20));await mock(p,'layer',false,{practised:true,headPointer:true,visits:4});await observe(p);
    // A complete trio of real catalogue references; the shortest poem fits one page.
    const { SOURCE_CATALOGUE } = await import(require('node:url').pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
    const lines = w => w.blocks.reduce((n,b)=>n+b.lines.length,0);
    const shortPoem = SOURCE_CATALOGUE.filter(w=>w.kind==='poem').sort((a,b)=>lines(a)-lines(b))[0];
    const ref = k => ({catalogueId:(k==='poem'?shortPoem:SOURCE_CATALOGUE.find(w=>w.kind===k&&!['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'].includes(w.id))).id});
    const cached = {version:2,date:'2026-10-28',picks:{poem:{...ref('poem'),text:'FORGED CACHED TEXT',guide:{context:'Intro notes.',themes:'After notes.'}},story:ref('story'),essay:ref('essay')}};
    await p.addInitScript(c=>localStorage.setItem('cabin-today',c),JSON.stringify(cached));
    await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    // Today appears by itself on the first entry of the day.
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today');
    await p.evaluate(()=>__step(700));
    await aimRow(p,0);await p.evaluate(()=>__pinch());
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
  for (const night of [false, true]) {
    const p=await browser.newPage({ viewport: { width:1440, height:1100 } }),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026,9,28,20));await mock(p,'layer',false,{practised:true,headPointer:true,visits:4});await observe(p);
    const { SOURCE_CATALOGUE } = await import(require('node:url').pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
    const shelf=['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'];
    const lines = w => w.blocks.reduce((n,b)=>n+b.lines.length,0);
    const poem = SOURCE_CATALOGUE.filter(w=>w.kind==='poem').sort((a,b)=>lines(a)-lines(b))[0];
    const story = SOURCE_CATALOGUE.find(w=>w.kind==='story'&&!shelf.includes(w.id));
    const essay = SOURCE_CATALOGUE.find(w=>w.kind==='essay'&&!shelf.includes(w.id));
    const cached = {version:2,date:'2026-10-28',picks:{poem:{catalogueId:poem.id},story:{catalogueId:story.id},essay:{catalogueId:essay.id}}};
    await p.addInitScript(([c,n])=>{localStorage.setItem('cabin-today',c);if(n&&!sessionStorage.getItem('night-fixture')){const c=JSON.parse(localStorage.getItem('cabin-controls')||'{}');localStorage.setItem('cabin-controls',JSON.stringify({...c,night:true}));sessionStorage.setItem('night-fixture','1');}},[JSON.stringify(cached),night]);
    const view = async () => [await p.locator('#page').getAttribute('data-view'), await p.locator('#page').getAttribute('data-menu-page')];
    const text = async () => (await p.evaluate(()=>__pageText)).join(' ');
    await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    assert.deepEqual(await view(),['menu','today'],'Today appears by itself once the cabin settles');
    const t=await text();
    assert.ok(t.includes('Today') && t.includes('Wednesday evening · Day 11'), 'dateline from the real date: '+t);
    for (const w of [poem,story,essay]) assert.ok(t.includes(w.author), w.id);
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')).days['2026-10-28'].ids.poem),poem.id,'the displayed trio is saved under the real day');
    await p.locator('#page').screenshot({path:path.join(out,`today${night?'-night':''}.png`)});
    await aimRow(p,0);await p.evaluate(()=>__pinch());
    assert.equal(await p.locator('#page').getAttribute('data-work'),`today-2026-10-28-poem-${poem.id}`);
    // Read to the end: the closing page follows the last page.
    for (let i=0;i<20&&(await view())[0]==='reading';i++) await p.evaluate(()=>__pinch());
    assert.deepEqual(await view(),['menu','closing'],
      `stuck at ${await p.locator('#page').getAttribute('data-work')} ${await p.locator('#page').getAttribute('data-section')} · ${await p.locator('#place').textContent()} · ${await p.locator('#status').textContent()} · ${(await p.evaluate(()=>__pageText)).slice(-4).join(' | ')}`);
    assert.ok((await text()).includes('Mark as read'));
    assert.ok((await text()).includes('Pinch NEXT again'),'completion clearly explains the second NEXT');
    await p.locator('#page').screenshot({path:path.join(out,`today-closing${night?'-night':''}.png`)});
    // Reaching the end is not completion. A queued release cannot confirm it;
    // a separate, freshly started NEXT does so without pointing at a button.
    const ticks=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress'))?.days['2026-10-28']||{});
    assert.notEqual((await ticks()).poem,true,'opening confirmation must not mark the work');
    await p.evaluate(()=>{__native('select');__native('selectend');__step(16);});
    assert.notEqual((await ticks()).poem,true,'an unpaired release cannot mark the work');
    await p.evaluate(()=>{__step(700);__pinch();__step(700);});
    assert.equal((await ticks()).poem,true,'fresh NEXT ticks today\'s exact poem');
    assert.deepEqual(await view(),['menu','library']);
    assert.ok((await text()).includes('Read ✓'),'Library shows immediate completion instead of Continue');
    assert.ok(await p.evaluate(id=>JSON.parse(localStorage.getItem('cabin-progress')).completedWorks[id],poem.id),'canonical edition completion is saved');
    await p.evaluate(async()=>{await __aim('home-today');__pinch();__step(700);});
    await p.evaluate(async id=>{await __aim('home-work:'+id);__pinch();},`today-2026-10-28-story-${story.id}`);
    assert.equal(await p.locator('#page').getAttribute('data-work'),`today-2026-10-28-story-${story.id}`);
    assert.equal((await view())[0],'reading');
    // The main menu names Today, with how the day stands; More stays at index 6.
    await p.evaluate(()=>__hold());
    assert.deepEqual(await view(),['menu','today']);
    assert.equal((await ticks()).poem,true,'home preserves the completed poem');
    // Re-entering later the same day opens on Today again (no rebuild);
    // holding a pinch continues reading.
    await p.reload();await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    assert.deepEqual(await view(),['menu','today']);
    assert.ok((await text()).includes('Today'),'re-entry presents the compact home');
    await p.evaluate(()=>__hold());
    assert.equal((await view())[0],'reading');
    assert.deepEqual(errors,[]);await p.close();
    passed(`Today opens a work; a separate NEXT marks its exact edition and immediately shows it Read in Library${night?' (night)':''}`);
  }
  {
    const p=await browser.newPage({ viewport: { width:1440, height:1100 } }),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026,9,28,23,59,50));await mock(p,'layer',false,{practised:true,headPointer:true,visits:4});await observe(p);
    const { SOURCE_CATALOGUE } = await import(require('node:url').pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
    const shelf=['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'];
    const pickOf = k => SOURCE_CATALOGUE.find(w=>w.kind===k&&!shelf.includes(w.id));
    const cached = {version:2,date:'2026-10-28',picks:{poem:{catalogueId:pickOf('poem').id},story:{catalogueId:pickOf('story').id},essay:{catalogueId:pickOf('essay').id}}};
    await p.addInitScript(c=>localStorage.setItem('cabin-today',c),JSON.stringify(cached));
    const view = async () => [await p.locator('#page').getAttribute('data-view'), await p.locator('#page').getAttribute('data-menu-page')];
    const text = async () => (await p.evaluate(()=>__pageText)).join(' ');
    await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    assert.deepEqual(await view(),['menu','today']);
    // The two tabs are direct peers on the compact home.
    await p.evaluate(()=>__step(700));
    await p.evaluate(async()=>{await __aim('home-shelf');__pinch();});
    assert.deepEqual(await view(),['menu','shelf']);
    await p.evaluate(async()=>{await __aim('home-today');__pinch();});
    assert.deepEqual(await view(),['menu','today'],'the Today tab opens Today');
    // Midnight with Today open: no crash, the session continues on the Library.
    await p.clock.setFixedTime(new Date(2026,9,29,0,0,5));
    await p.evaluate(async()=>{__step(100);await __aim('home-settings');__step(100);});
    assert.deepEqual(await view(),['menu','today'],'the compact home stays on Today after midnight');
    const midnightButtons=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).map(b=>b.id));
    assert.ok(!midnightButtons.some(id=>id.startsWith('home-work:today-2026-10-28-')),'yesterday is never presented as today');
    assert.ok(midnightButtons.includes('home-library'),'an empty new day still reaches the Library');
    assert.ok(!/stopped/.test(await p.locator('#status').textContent()),'the VR session keeps running');
    await p.locator('#page').screenshot({path:path.join(out,'today-midnight.png')});
    // Starter Library works use the same explicit completion as Today.
    await p.evaluate(()=>__step(700));
    await p.evaluate(async()=>__navigate('home-library'));await p.evaluate(()=>__pinch());
    assert.deepEqual(await view(),['menu','library']);
    await p.evaluate(()=>__step(700));
    await aimLibrary(p,'blake-sick-rose');
    assert.equal(await p.locator('#page').getAttribute('data-target'),'home-work:blake-sick-rose');
    await p.evaluate(()=>__pinch());
    for (let i=0;i<12&&(await view())[0]==='reading';i++) await p.evaluate(()=>__pinch());
    assert.deepEqual(await view(),['menu','closing'],'Library works also offer completion');
    await p.evaluate(()=>{__step(700);__pinch();__step(700);});
    assert.deepEqual(await view(),['menu','library']);
    assert.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')).completedWorks['blake-sick-rose']));
    assert.deepEqual(errors,[]);await p.close();
    passed('Today tabs lead where they say; Today survives midnight; Library works finish explicitly');
  }
  {
    // Your shelf: earlier days from progress, by saved ID or exact label.
    const p=await browser.newPage({ viewport: { width:1440, height:1100 } }),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026,9,29,20));await mock(p,'layer',false,{practised:true,headPointer:true,visits:4});await observe(p);
    const { SOURCE_CATALOGUE } = await import(require('node:url').pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
    const find = id => SOURCE_CATALOGUE.find(w=>w.id===id);
    const tiger=find('william-blake-experience-the-tiger'), stockings=find('kate-chopin-a-pair-of-silk-stockings'), travel=find('francis-bacon-of-travel');
    const progress={version:1,start:'2026-10-18',trackingSince:'2026-10-18',weeks:{},savedAt:'2026-10-29T08:00:00Z',days:{
      '2026-10-21':{missed:true,picks:{poem:'The Guest House — Rumi',story:'The Story of an Hour — Kate Chopin',essay:'The Death of the Moth — Virginia Woolf'}},
      '2026-10-28':{poem:true,ids:{poem:tiger.id,story:stockings.id,essay:travel.id},picks:{poem:`${tiger.title} — ${tiger.author}`,story:`${stockings.title} — ${stockings.author}`,essay:`${travel.title} — ${travel.author}`}}}};
    await p.addInitScript(pr=>{if(!sessionStorage.getItem('shelf-fixture')){localStorage.setItem('cabin-progress',pr);sessionStorage.setItem('shelf-fixture','1');}},JSON.stringify(progress));
    const view = async () => [await p.locator('#page').getAttribute('data-view'), await p.locator('#page').getAttribute('data-menu-page')];
    const text = async () => (await p.evaluate(()=>__pageText)).join(' ');
    await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    assert.equal((await view())[0],'reading','no picks today: no Today page');
    await p.evaluate(()=>__hold());
    assert.ok((await text()).includes('Shelf'),'home offers the Shelf tab');
    await p.evaluate(()=>__step(700));
    await p.evaluate(async()=>__navigate('home-shelf'));await p.evaluate(()=>__pinch());
    assert.deepEqual(await view(),['menu','shelf']);
    const t=await text();
    assert.ok(t.includes('28 October') && t.includes('21 October'),'both saved dates are visible');
    assert.ok(t.indexOf('28 October')<t.indexOf('21 October'));
    assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')).days['2026-10-28'].poem),true,'saved read status survives home entry');
    await p.locator('#page').screenshot({path:path.join(out,'shelf.png')});
    // A quick repeated pinch cannot open a day; a deliberate one can.
    await p.evaluate(async()=>__aim('home-day:2026-10-28'));
    await p.evaluate(()=>{__hand(0.05,'right');__step(420);__hand(0.012,'right');__native('selectstart','right');__step(120);__hand(0.05,'right');__native('select','right');__native('selectend','right');__step(16);});
    assert.deepEqual(await view(),['menu','shelf'],'too quick after opening the shelf');
    await p.evaluate(()=>__step(700));await p.evaluate(()=>__pinch());
    assert.deepEqual(await view(),['menu','shelfday']);
    assert.ok((await text()).includes(tiger.title) && (await text()).includes('Read'),'saved read label is displayed');
    await p.locator('#page').screenshot({path:path.join(out,'shelf-day.png')});
    // The essay opens as the exact catalogue edition, under that day's id.
    await p.evaluate(()=>__step(700));
    await aimRow(p,2);await p.evaluate(()=>__pinch());
    const id=`today-2026-10-28-essay-${travel.id}`;
    assert.equal(await p.locator('#page').getAttribute('data-work'),id);
    assert.equal((await view())[0],'reading');
    const shown=(await p.evaluate(()=>__pageText)).join(' ').replace(/\s+/g,' ');
    assert.ok(shown.includes(travel.blocks[0].text.split(' ').slice(0,8).join(' ')),'the edition\'s own words');
    // After a reload the same earlier work is still open.
    await p.reload();await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    assert.equal(await p.locator('#page').getAttribute('data-work'),id);
    // The older day lists works outside the catalogue without opening them.
    await p.evaluate(()=>__hold());await p.evaluate(()=>__step(700));
    await p.evaluate(async()=>__navigate('home-shelf'));await p.evaluate(()=>__pinch());
    await p.evaluate(()=>__step(700));
    await p.evaluate(async()=>__aim('home-day:2026-10-21'));await p.evaluate(()=>__pinch());
    assert.deepEqual(await view(),['menu','shelfday']);
    assert.ok((await text()).includes('Not in the cabin'));
    await p.evaluate(()=>__step(700));
    await p.evaluate(async()=>{const {HOME_FRAME,HOME_SCALE}=await import('./home-panel.js?v=51');await __aim({x:40*HOME_SCALE,y:HOME_FRAME.y+120*HOME_SCALE,w:620*HOME_SCALE,h:80*HOME_SCALE});});
    assert.equal(await p.locator('#page').getAttribute('data-target'),'','an unchecked work is not a target');
    await p.evaluate(()=>__pinch());
    assert.deepEqual(await view(),['menu','shelfday']);
    assert.deepEqual(errors,[]);await p.close();
    passed('Your shelf lists earlier days, opens their exact editions, keeps them after reload and never opens unchecked works');
  }
  for (const skip of [false, 'essay', 'shelf']) {
    // Build 039: Today is complete immediately; a fresh pinch chooses directly.
    const p=await browser.newPage({ viewport: { width:1440, height:1100 } }),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.clock.setFixedTime(new Date(2026,9,28,20));await mock(p,'layer',false,{practised:true,headPointer:true,visits:4});await observe(p);
    await p.addInitScript(()=>{window.__paints=0;const r=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(x,y,w,h){if(this.canvas.id==='page'&&w===2048&&h===2560)window.__paints++;return r.call(this,x,y,w,h);};});
    const { SOURCE_CATALOGUE } = await import(require('node:url').pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
    const shelf=['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'];
    const lines = w => w.blocks.reduce((n,b)=>n+b.lines.length,0);
    const poem = SOURCE_CATALOGUE.filter(w=>w.kind==='poem').sort((a,b)=>lines(a)-lines(b))[0];
    const story = SOURCE_CATALOGUE.find(w=>w.kind==='story'&&!shelf.includes(w.id));
    const essay = SOURCE_CATALOGUE.find(w=>w.kind==='essay'&&!shelf.includes(w.id));
    await p.addInitScript(c=>localStorage.setItem('cabin-today',c),JSON.stringify({version:2,date:'2026-10-28',picks:{poem:{catalogueId:poem.id},story:{catalogueId:story.id},essay:{catalogueId:essay.id}}}));
    const view = async () => [await p.locator('#page').getAttribute('data-view'), await p.locator('#page').getAttribute('data-menu-page')];
    const text = async () => (await p.evaluate(()=>__pageText)).join(' ');
    await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();
    // Centre and let the arrival settle, stepping frame by frame.
    await p.evaluate(()=>{__mock.clock=Math.max(__mock.clock,performance.now());__step();__pinch();});
    let opened=null;
    for (let i=0;i<120&&!opened;i++){await p.evaluate(()=>__step(40));const v=(await view())[1];if(v==='welcome')await p.evaluate(()=>__welcomeChoose(false));else if(v==='today'&&(await view())[0]==='menu')opened=await p.evaluate(()=>window.__paints);}
    assert.ok(opened,'Today opened after the arrival');
    let t=await text();
    assert.ok(t.includes('Wednesday evening · Day 11') && [poem,story,essay].every(w=>t.includes(w.title)) && t.includes('Shelf'),'complete choices on the first Today frame');
    await aimRow(p,2);
    assert.equal(await p.locator('#page').getAttribute('data-target'),`home-work:today-2026-10-28-essay-${essay.id}`,'the visible essay is immediately targetable');
    await p.evaluate(async()=>__aim('home-shelf'));
    assert.equal(await p.locator('#page').getAttribute('data-target'),'home-shelf','visible archive target is ready');
    if (skip) {
      // Choose directly on the first eligible fresh press, retaining the
      // existing short guard against a release leaking between screens.
      if(skip==='shelf')await p.evaluate(async()=>__aim('home-shelf'));else await aimRow(p,2);
      await p.evaluate(()=>{__hand(0.05,'right');__step(480);__hand(0.012,'right');__native('selectstart','right');__step(240);__hand(0.05,'right');__native('select','right');__native('selectend','right');__step(16);});
      if(skip==='essay'){
        assert.equal((await view())[0],'reading','first eligible pinch opens the essay');
        assert.equal(await p.locator('#page').getAttribute('data-work'),`today-2026-10-28-essay-${essay.id}`);
        await p.evaluate(()=>__hold());
      }else{
        assert.deepEqual(await view(),['menu','shelf'],'first eligible pinch opens the shelf');
        await p.evaluate(async()=>__aim('home-today'));await p.evaluate(()=>__pinch());
      }
      await p.evaluate(async()=>__aim('home-today'));await p.evaluate(()=>__pinch());
      assert.deepEqual(await view(),['menu','today']);
    } else {
      // Every frame has the complete choices, with no reveal repaints.
      const seen=[];
      for (let i=0;i<30;i++){await p.evaluate(()=>__step(40));const s=await text();seen.push([poem,story,essay].map(w=>s.includes(w.title)).join(''));}
      const order=seen.filter((s,i)=>s!==seen[i-1]).filter(s=>s!=='falsefalsefalse');
      assert.deepEqual(order,['truetruetrue'],'all three throughout');
      assert.ok((await text()).includes('Shelf'));
      const paints=await p.evaluate(()=>window.__paints)-opened;
      assert.ok(paints<=6,`only a few repaints while building (${paints})`);
      const before=await p.evaluate(()=>window.__paints);
      await p.evaluate(()=>__step(1000));
      assert.equal(await p.evaluate(()=>window.__paints),before,'still once built');
      await p.locator('#page').screenshot({path:path.join(out,'today-built.png')});
    }
    // Bookmark: marks for today's three while reading one of them.
    await p.evaluate(()=>__step(700));
    await aimRow(p,1);await p.evaluate(()=>__pinch());
    assert.equal(await p.locator('#page').getAttribute('data-work'),`today-2026-10-28-story-${story.id}`);
    const marks=async()=>(await p.evaluate(()=>__pageText)).filter(s=>s==='◆'||s==='◇');
    assert.deepEqual(await marks(),['◇','◇','◇'],'three open marks, none read');
    if (!skip) await p.locator('#page').screenshot({path:path.join(out,'bookmark.png')});
    await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('cabin-progress'));(d.days['2026-10-28']||={}).story=true;localStorage.setItem('cabin-progress',JSON.stringify(d));});
    await p.reload();await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
    assert.deepEqual(await view(),['menu','today'],'every entry opens on Today');
    await p.evaluate(()=>__hold());
    assert.equal((await view())[0],'reading','holding a pinch continues reading');
    assert.deepEqual(await marks(),['◇','◆','◇'],'the story (middle) is read');
    // Starter works keep the plain running head.
    await p.evaluate(()=>__hold());await p.evaluate(()=>__step(700));
    await p.evaluate(async()=>__navigate('home-library'));await p.evaluate(()=>__pinch());
    assert.deepEqual(await view(),['menu','library']);
    await p.evaluate(()=>__step(700));
    await aimLibrary(p,'bacon-truth');
    assert.equal(await p.locator('#page').getAttribute('data-target'),'home-work:bacon-truth');
    await p.evaluate(()=>__pinch());
    assert.deepEqual(await marks(),[],'no marks on a starter work');
    assert.deepEqual(errors,[]);await p.close();
    passed(skip?`first eligible Today pinch chooses ${skip} directly; bookmark follows today's reading`
      :'Today is complete from its first frame and stays still; starter works have no bookmark');
  }
};
