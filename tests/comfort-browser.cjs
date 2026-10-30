const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async (browser, {mock,BASE_URL,out,passed}) => {
  async function setup(preferences={},reduce=false) {
    const p=await browser.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.emulateMedia({reducedMotion:reduce?'reduce':'no-preference'});
    await mock(p,'layer',false,{practised:true,headPointer:false,visits:4,...preferences});
    await p.clock.setFixedTime(new Date(2026,9,30,20));
    await p.route('https://api.dictionaryapi.dev/**',r=>r.fulfill({headers:{'access-control-allow-origin':'*'},json:[{meanings:[{definitions:[{definition:r.request().url().endsWith('/crimson')?'A deep red colour.':'A country in northwestern Europe.'}]}]}]}));
    await p.route('https://en.wikipedia.org/**',r=>r.fulfill({headers:{'access-control-allow-origin':'*'},json:{query:{pages:{1:{title:'England',extract:'England is a country that forms part of the United Kingdom.'}}}}}));
    await p.goto(BASE_URL);await p.locator('#enter').click();
    try { await p.evaluate(()=>{__center(); if(document.querySelector('#page').dataset.view !== 'reading') document.querySelector('#menu').click();__step(1000);}); } catch(e) {console.log('SETUP',errors,await p.evaluate(()=>({status:document.querySelector('#status').textContent,view:document.querySelector('#page').dataset.view,trace:__mock.session.ended})));throw e;}
    assert.equal(await p.locator('#page').getAttribute('data-view'),'reading');
    return {p,errors};
  }
  {
    const {p,errors}=await setup({focusDim:.96});
    const r=await p.evaluate(()=>{
      __step(3500);
      const gl=__mock.gl,P=WebGL2RenderingContext.prototype,f=gl.createFramebuffer(),px=new Uint8Array(4);
      const read=(texture,x,y)=>{P.bindFramebuffer.call(gl,gl.READ_FRAMEBUFFER,f);P.framebufferTexture2D.call(gl,gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);return Array.from(px);};
      const dim=read(__mock.projectionTexture,50,50),paper=read(__mock.texture,120,1280);
      P.framebufferTexture2D.call(gl,gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,null,0);P.bindFramebuffer.call(gl,gl.READ_FRAMEBUFFER,null);gl.deleteFramebuffer(f);
      const matrix=Array.from(__mock.quad.transform.matrix);__mock.look={x:0,y:.12,z:0,w:Math.sqrt(1-.12**2)};__step(1000);
      return {dim,paper,stays:JSON.stringify(matrix)===JSON.stringify(Array.from(__mock.quad.transform.matrix)),setting:document.querySelector('#page').dataset.focusDim};
    });
    assert.ok(r.dim[3]>=243 && r.dim[3]<=246);assert.equal(r.paper[3],255);assert.ok(r.paper[0]>200);assert.equal(r.stays,true);
    await p.locator('#menu').click();await p.evaluate(()=>__step(3500));
    assert.equal(Number(await p.locator('#page').getAttribute('data-focus-dim')),0);
    assert.deepEqual(errors,[]);passed('comfort: dim reaches almost black behind opaque paper, restores in menu, page stays anchored');await p.close();
  }
  {
    const {p,errors}=await setup();
    await p.evaluate(async()=>{
      const w=JSON.parse(document.querySelector('#page').dataset.words).find(w=>w.word==='thou');
      window.__chosenWord=w;await __aim(w,true);__pinch();__step(100);
    });
    await p.waitForFunction(()=>document.querySelector('#word-note-text').textContent.includes('old word'));
    assert.match(await p.locator('#place').textContent(),/Page 1/);
    const r=await p.evaluate(()=>{__step(100);const entries=[...__mock.layerData].filter(([l,d])=>d.comfort&&d.width===800&&l.opacity>0);return {count:entries.length,position:entries[0]?.[0].transform.position,page:__mock.quad.transform.position,visible:__mock.session.renderState.layers.includes(entries[0]?.[0])};});
    assert.equal(r.count,1);assert.equal(r.visible,true);assert.ok(Math.abs(r.position.x-r.page.x)>.50);
    await p.locator('#word-card').screenshot({path:path.join(out,'quiet-folio-word-card.png')});
    await p.evaluate(async()=>{await __aim(__chosenWord,true);__pinch();__step(100);});
    assert.equal(await p.locator('#word-note').isHidden(),true);
    await p.evaluate(async()=>{await __aim(__chosenWord,true);__pinch();__step(100);document.querySelector('#next').click();__step(700);});
    assert.equal(await p.locator('#word-note').isHidden(),true);
    assert.deepEqual(errors,[]);passed('comfort: real word pinch opens an off-page glass note without turning; repeat pinch and page turn close it');await p.close();
  }
  {
    const {p,errors}=await setup();
    await p.evaluate(async()=>{document.querySelector('#menu').click();__step(800);await __navigate('settings-comfort',true);__pinch();__step(800);});
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'comfort');
    await p.evaluate(async()=>{
      const b=JSON.parse(document.querySelector('#page').dataset.buttons).find(b=>b.id==='settings-dim');
      await __aim({...b,x:b.x+b.w*.72,w:1},true);__hand(.05);__step(600);__hand(.012);__native('selectstart','right');__step(1700);
      await __aim({...b,x:b.x+b.w*.90,w:1},true);__step(500);__hand(.05);__native('select','right');__native('selectend','right');__step(800);
    });
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'comfort');
    const value=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-controls')).focusDim);assert.ok(value>.83&&value<.9,`saved dim ${value}`);
    assert.ok(Number(await p.locator('#page').getAttribute('data-focus-dim'))>.7,'the slider previews the dim room while adjusting');
    await p.evaluate(async()=>{await __aim('settings-seasons',true);__pinch();__step(800);});
    assert.equal(await p.locator('#page').getAttribute('data-seasons'),'true');
    await p.locator('#page').screenshot({path:path.join(out,'quiet-folio-settings.png')});
    await p.reload();assert.equal(await p.locator('#page').getAttribute('data-seasons'),'true');assert.ok(Number(await p.locator('#page').getAttribute('data-focus-dim-setting'))>.83);
    assert.deepEqual(errors,[]);passed('comfort: dim slider supports a long pinch drag, settings stay open, dim and Seasons persist');await p.close();
  }
  {
    const {p,errors}=await setup();
    await p.evaluate(async()=>{
      const w=JSON.parse(document.querySelector('#page').dataset.words).find(w=>w.word==='crimson');
      await __aim(w,true);__pinch();__step(100);
    });
    await p.waitForFunction(()=>document.querySelector('#word-note-text').textContent.includes('deep red'));
    await p.evaluate(async()=>{
      const w=JSON.parse(document.querySelector('#page').dataset.words).find(w=>w.word==='England');
      await __aim(w,true);__pinch();__step(100);
    });
    await p.waitForFunction(()=>document.querySelector('#word-note-text').textContent.includes('United Kingdom'));
    assert.match(await p.locator('#word-note-text').textContent(),/Wikipedia/);
    await p.evaluate(()=>{__step(100);__welcomeScene();const scene=document.querySelector('#welcome-scene');scene.style.background='#777970';});
    await p.locator('#welcome-scene').screenshot({path:path.join(out,'quiet-folio-reading.png')});
    assert.match(await p.locator('#place').textContent(),/Page 1/);
    await p.evaluate(()=>{__mock.poseLost=true;__step(16);});
    assert.equal(await p.locator('#word-note').isHidden(),true);
    assert.equal(await p.evaluate(()=>__mock.projection.opacity),0);
    assert.deepEqual(errors,[]);passed('comfort: dictionary and reference responses reach the native card; tracking loss hides the card and dim layer');await p.close();
  }
  {
    const {p,errors}=await setup({headPointer:true});
    await p.evaluate(async()=>{const w=JSON.parse(document.querySelector('#page').dataset.words).find(w=>w.word==='thou');await __aim(w,true);__step(500);__pinch();__step(100);});
    await p.waitForFunction(()=>document.querySelector('#word-note-text').textContent.includes('old word'));
    assert.match(await p.locator('#place').textContent(),/Page 1/);
    assert.deepEqual(errors,[]);passed('comfort: hand word selection still works with the saved head-pointer menu mode without turning the page');await p.close();
  }
  {
    const {p,errors}=await setup({seasons:true});
    assert.equal(await p.locator('#page').getAttribute('data-season'),'autumn');
    const r=await p.evaluate(()=>{__step(92000);const page=document.querySelector('#page');return {detail:page.dataset.seasonDetail,small:[...__mock.layerData].filter(([l,d])=>d.comfort&&d.width===96&&l.opacity>0).length};});
    assert.equal(r.detail,'autumn');assert.equal(r.small,1);
    await p.evaluate(()=>__step(7000));assert.equal(await p.locator('#page').getAttribute('data-season-detail'),'');
    assert.deepEqual(errors,[]);passed('comfort: autumn detail arrives rarely outside the page and disappears');await p.close();
  }
  {
    const {p,errors}=await setup({seasons:true},true);
    await p.evaluate(()=>__step(93000));assert.equal(await p.locator('#page').getAttribute('data-season-detail'),'');
    assert.deepEqual(errors,[]);passed('comfort: reduced motion retains seasonal colour without drifting detail');await p.close();
  }
  {
    const {p,errors}=await setup();
    assert.equal(await p.locator('#page').getAttribute('data-seasons'),'false');
    await p.evaluate(()=>__step(93000));assert.equal(await p.locator('#page').getAttribute('data-season-detail'),'');
    assert.deepEqual(errors,[]);passed('comfort: seasons are off by default');await p.close();
  }
};
