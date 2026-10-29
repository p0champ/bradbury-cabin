const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async function pointerChecks(browser,{mock,BASE_URL,out,passed}) {
 const evidence=[];
 {
  const p=await browser.newPage(); await p.goto(BASE_URL);
  const result=await p.evaluate(async()=>{
   const {Pointer}=await import('./pointer.js?v=44');
   const {renderer}=await import('./gl.js?v=44');
   const target=document.createElement('canvas'); target.width=768;target.height=1024;
   const gl=target.getContext('webgl2',{alpha:true});
   gl.makeXRCompatible=async()=>{};
   const gpu=await renderer(target),texture=gl.createTexture();
   gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,768,1024);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   let sub={colorTexture:texture,viewport:{x:20,y:40,width:720,height:900}};
   const base=document.createElement('canvas');base.width=720;base.height=900;
   const c=base.getContext('2d');c.fillStyle='rgb(20,30,40)';c.fillRect(0,0,720,900);
   gpu.copyPage(sub,base,{premultiplied:true});
   let allocations=0;const layer={};
   const pointer=new Pointer({getSubImage:()=>sub,createQuadLayer:()=>{allocations++;throw Error('Cursor must not allocate layers');}},null);
   pointer.setSurface(layer,base);
   const patches=[];const original=gpu.copyPagePatch;
   gpu.copyPagePatch=(...args)=>{patches.push({...args[2]});original(...args);};
   const sample=(x,y)=>{const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sub.colorTexture,0);const out=new Uint8Array(4);gl.readPixels(sub.viewport.x+Math.floor(x*sub.viewport.width/720),sub.viewport.y+sub.viewport.height-Math.floor(y*sub.viewport.height/900)-1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(f);return [...out];};
   const aim=(x,y)=>{pointer.update([{hand:'right',look:'dot',hit:{distance:1.1,local:{x:(x/720-.5)*.72,y:(.5-y/900)*.9}}}]);pointer.draw({},gpu,[layer]);};
   aim(200,150);const first=sample(200,150),wrongVertical=sample(200,750),n=patches.length;
   aim(200,150);const stationaryUploads=patches.length-n;
   aim(450,700);const restored=sample(200,150),moved=sample(450,700);
   pointer.clearVisible();pointer.draw({},gpu,[layer]);const cleared=sample(450,700);
   const texture2=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture2);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,512,512);
   sub={colorTexture:texture2,viewport:{x:7,y:13,width:360,height:450}};
   gpu.copyPage(sub,base,{premultiplied:true});pointer.invalidate();
   aim(200,150);const resizedTop=sample(200,150),resizedWrong=sample(200,750);
   pointer.clearVisible();pointer.draw({},gpu,[layer]);const resizedClear=sample(200,150);
   pointer.setSurface(null,base);gpu.upload(base);pointer.invalidate();
   const projectionSample=(x,y)=>{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,720,900);gpu.draw(new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));const out=new Uint8Array(4);gl.readPixels(x,900-y-1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);return [...out];};
   pointer.update([{hand:'right',look:'dot',hit:{distance:1.1,local:{x:(200/720-.5)*.72,y:(.5-150/900)*.9}}}]);pointer.drawProjection(gpu);
   const projectionTop=projectionSample(200,150),projectionWrong=projectionSample(200,750);
   pointer.clearVisible();pointer.drawProjection(gpu);const projectionClear=projectionSample(200,150);
   const error=gl.getError();gpu.dispose();gl.deleteTexture(texture);gl.deleteTexture(texture2);
   return {first,wrongVertical,restored,moved,cleared,allocations,stationaryUploads,patches,error,resizedTop,resizedWrong,resizedClear,projectionTop,projectionWrong,projectionClear};
  });
  assert.ok(result.first[0]>200 && result.moved[0]>200 && result.resizedTop[0]>200 && result.projectionTop[0]>200,'cursor ink missing at shared page coordinates');
  for(const key of ['wrongVertical','restored','cleared','resizedWrong','resizedClear','projectionWrong','projectionClear'])assert.deepEqual(result[key],[20,30,40,255],key+' has misplaced or stale cursor ink');
  assert.equal(result.allocations,0);assert.equal(result.stationaryUploads,0);assert.equal(result.error,0);
  assert.ok(result.patches.every(r=>r.w<32&&r.h<32),'cursor movement uploaded an entire page');
  passed('pointer: actual WebGL page pixels share hit coordinates, restore old ink and upload small patches');
  await p.close();
 }

 for(const lying of [false,true]) for(const hand of ['right','left']) {
  const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await mock(p,'layer',lying,{practised:true,headPointer:false});
  await p.goto(BASE_URL);await p.locator('#enter').click();
  await p.evaluate(()=>__center());
  await p.evaluate(hand=>{__hold(hand);__hand(.05,hand);__step(600);},hand);
  await p.evaluate(async()=>{await __aim('home-shelf',true);__step(800);});
  const capture=()=>p.evaluate(()=>{
   const ptr=JSON.parse(document.querySelector('#page').dataset.pointerMarks || '[]')[0];
   return {target:document.querySelector('#page').dataset.target,menu:document.querySelector('#page').dataset.menuPage,point:ptr ? [ptr.x / 2048 * .72, ptr.y / 2560 * .9, 0] : undefined};
  });
  const before=await capture();assert.equal(before.target,'home-shelf');assert.ok(before.point);
  for(const gap of [.029,.027]) {
   await p.evaluate(async ({hand,gap})=>{__hand(gap,hand);await __aim('home-settings',true);__step(1000);},{hand,gap});
   assert.equal(await p.evaluate(hand=>__mock.sources[hand].gamepad.buttons[0].pressed,hand),false);
   const relaxed=await capture();assert.equal(relaxed.target,'home-settings','relaxed fingers froze pointing before a native press');
   assert.ok(1000*Math.hypot(...relaxed.point.map((v,i)=>v-before.point[i]))>100,'dot stayed behind the live hand ray');
   await p.evaluate(async hand=>{__hand(.05,hand);await __aim('home-shelf',true);__step(800);},hand);
  }
  passed(`pointer: relaxed open hand tracks choices ${hand} ${lying?'lying':'upright'}`);
  await p.evaluate(hand=>{__hand(.012,hand);__native('selectstart',hand);__step(32);},hand);
  const pressed=await capture();
  await p.evaluate(async()=>{await __aim('home-settings',true);__step(350);});
  const drift=await capture();assert.equal(drift.target,'home-shelf');
  const travelMm=1000*Math.hypot(...pressed.point.map((v,i)=>v-drift.point[i]));
  assert.ok(travelMm<.01,`held dot moved ${travelMm}mm`);
  await p.evaluate(hand=>{__hand(.05,hand);__native('select',hand);__native('selectend',hand);__step(16);},hand);
  assert.equal((await capture()).menu,'shelf');
  evidence.push({lying,hand,scenario:'press-drift',travelMm,before,pressed,drift});
  passed(`pointer: ${hand}, ${lying?'lying':'upright'} dot and selected choice stay together`);

  // A menu replaced while a press is held must not inherit its old target.
  await p.locator('#menu').click();await p.evaluate(()=>__step(800));
  await p.locator('#menu').click();await p.evaluate(()=>__step(800));
  await p.evaluate(async hand=>{await __aim('home-today',true);__pinch(hand);__step(800);},hand);
  await p.evaluate(async hand=>{__hand(.05,hand);await __aim('home-shelf',true);__step(800);__hand(.012,hand);__native('selectstart',hand);__step(32);},hand);
  await p.locator('#menu').click();await p.evaluate(()=>__step(16));
  await p.locator('#menu').click();await p.evaluate(()=>__step(800));
  await p.evaluate(hand=>{__hand(.05,hand);__native('select',hand);__native('selectend',hand);__step(16);},hand);
  assert.equal((await capture()).menu,'today','reopened menu consumed stale press');
  passed(`pointer: ${hand}, ${lying?'lying':'upright'} changed screen cancels press`);

  await p.evaluate(async hand=>{__hand(.05,hand);await __aim('home-shelf',true);__step(800);__hand(.012,hand);__native('selectstart',hand);__step(32);__hand(null,hand);__step(64);},hand);
  assert.equal((await capture()).point,undefined,'lost hand left a visible pointer');
  await p.evaluate(hand=>{__hand(.05,hand);__native('select',hand);__native('selectend',hand);__step(16);},hand);
  assert.equal((await capture()).menu,'today','tracking recovery activated stale choice');
  await p.evaluate(()=>__step(800));
  await p.evaluate(async()=>{await __aim('home-shelf',true);__step(800);});
  await p.evaluate(hand=>__pinch(hand),hand);
  assert.equal((await capture()).menu,'shelf','fresh press must work after recovery');
  passed(`pointer: ${hand}, ${lying?'lying':'upright'} tracking loss cancels and fresh press recovers`);
  assert.deepEqual(errors,[]);
  await p.close();
 }
 {
  const p=await browser.newPage();await mock(p,'layer',false,{practised:true,headPointer:false});await p.goto(BASE_URL);await p.locator('#enter').click();await p.evaluate(()=>__center());
  const before=await p.locator('#place').textContent();
  await p.evaluate(()=>{__mock.rayLost=true;__pinch();});
  assert.notEqual(await p.locator('#place').textContent(),before,'tracked reading pinch must not require a menu ray');
  passed('pointer: unavailable aim ray preserves tracked reading pinch');
  await p.evaluate(()=>{__mock.rayLost=false;__hold();});
  await p.evaluate(async()=>{await __aim('home-shelf',true);__step(800);__hand(.012);__native('selectstart');__step(32);__mock.rayLost=true;__step(32);});
  assert.equal(await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.pointerMarks || '[]').length),0);
  await p.evaluate(()=>{__mock.rayLost=false;__hand(.05);__native('select');__native('selectend');__step(16);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today');
  passed('pointer: lost aim ray cancels menu press');
  for(const discard of ['stale','overflow']) {
   await p.evaluate(async()=>{await __aim('home-shelf',true);__hand(.05);__step(800);__hand(.012);__native('selectstart');__step(32);});
   await p.evaluate(discard=>{__hand(.05);if(discard==='stale'){__native('selectend');__mock.clock+=200;__step();}else{for(let i=0;i<62;i++)__native('selectend');__step();}},discard);
   if(discard==='stale')assert.equal(await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.pointerMarks || '[]').length),0,'stale native event resurrected a dot in its cancellation frame');
   await p.evaluate(async()=>{await __aim('home-settings',true);__step(800);});
   assert.equal(await p.locator('#page').getAttribute('data-target'),'home-settings',`${discard} discard left pointer frozen`);
   passed(`pointer: ${discard} native events clear frozen aim`);
  }
  await p.evaluate(async()=>{__hand(.05);await __aim('home-shelf',true);__step(800);__native('selectstart');__step(32);__mock.clock+=200;__step();await __aim('home-settings',true);__step(500);});
  assert.equal(await p.locator('#page').getAttribute('data-target'),'home-settings','frame gap cancellation left a locked pointer');
  await p.evaluate(()=>{__native('selectend');__hand(.05);__step(600);});
  passed('pointer: callback gap cancels the press and restores live pointing');
  await p.evaluate(async()=>{__hand(.05);await __aim({x:80,y:1000,w:0,h:0},true);__step(800);});
  assert.equal(await p.locator('#page').getAttribute('data-target'),'');
  await p.evaluate(()=>{__hand(.012);__native('selectstart');__step(32);});
  await p.evaluate(async()=>{await __aim('home-shelf',true);__step(350);__hand(.05);__native('select');__native('selectend');__step(16);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today');
  passed('pointer: pinch started on empty space cannot acquire a choice');
  await p.close();
 }
 for(const reason of ['unarmed','other-hand']) {
  const p=await browser.newPage();await mock(p,'layer',false,{practised:true,headPointer:false});await p.goto(BASE_URL);await p.locator('#enter').click();await p.evaluate(()=>{__center();__hold();__hand(.05);__step(800);});
  await p.evaluate(async reason=>{
   await __aim('home-shelf','right');__step(800);
   if(reason==='unarmed'){__mock.sources.right.skipRendering=true;__step(32);__mock.sources.right.skipRendering=false;__step(16);}
   if(reason==='cooldown'){await __aim('night','right');__step(800);__native('selectstart');__step(80);__native('select');__native('selectend');__step(16);}
   if(reason==='other-hand'){
    const right=__mock.sources.right,left=__hand(.05,'left');__mock.session.inputSources=[right,left];await __aim('home-shelf','left');__step(800);__native('selectstart','left');__step(32);
   }
   __native('selectstart','right');__step(16);await __aim('home-settings','right');__step(500);
  },reason);
  const shown=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.pointerMarks || '[]').map(d=>[d.x / 2048 * .72,d.y / 2560 * .9,0]));
  assert.ok(shown.length>0);
  if(reason!=='other-hand')assert.equal(await p.locator('#page').getAttribute('data-target'),'home-settings',reason+' rejection froze the live pointer');
  else {
   const before=shown;
   await p.evaluate(async()=>{await __aim('home-today','right');__step(500);});
   const after=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.pointerMarks || '[]').map(d=>[d.x / 2048 * .72,d.y / 2560 * .9,0]));
   assert.ok(after.some((point,i)=>Math.hypot(...point.map((v,j)=>v-before[i][j]))>.05),'rejected second-hand pointer stayed frozen');
  }
  const dl=p.waitForEvent('download');await p.locator('#export').click();const file=path.join(out,'pointer-rejected-'+reason+'.json');await(await dl).saveAs(file);
  const details=JSON.parse(await fs.readFile(file,'utf8'));
  const rejected=details.ignored||details.gestures?.ignored||[];
  // The rendered motion assertion is primary; exported reason proves the fixture hit the intended rejection.
  assert.ok(JSON.stringify(details).includes(reason==='unarmed'?'tracking-settling':reason==='other-hand'?'other-hand-owns-press':'cooldown'),reason+' fixture did not exercise rejection');
  await p.close();passed('pointer: rejected '+reason+' press keeps aiming live');
 }
 const p=await browser.newPage();await p.goto(BASE_URL);
 const filters=await p.evaluate(async()=>{
  const {PageAimFilter,OneEuro,smoothRay}=await import('./pointer.js?v=44');
  const display=new DOMMatrix().translate(0,0,-1.1);
  const plane={matrix:display.toFloat32Array(),inverse:{matrix:display.inverse().toFloat32Array()}};
  const ray=x=>{const m=new DOMMatrix(),l=Math.hypot(x,1.1);m.m31=-x/l;m.m33=1.1/l;return {matrix:m.toFloat32Array()};};
  const results=[];
  for(const hz of [60,72,90]){
   const f=new PageAimFilter(),old=new OneEuro(1,.03);f.update(ray(0),plane,.72,.9,0);smoothRay(old,ray(0),0);
   let settle=null,oldSettle=null;
   for(let i=1;i<=hz;i++){const t=i*1000/hz;const x=f.update(ray(.05),plane,.72,.9,t).local.x;const m=smoothRay(old,ray(.05),t).matrix;const oldX=-1.1*m[8]/m[10];if(settle===null&&x>=.045)settle=t;if(oldSettle===null&&oldX>=.045)oldSettle=t;}
   const noise=new PageAimFilter(),oldNoise=new OneEuro(1,.03);let aa=0,bb=0,n=0;
   for(let i=0;i<hz*3;i++){const t=i*1000/hz,x=.0005*Math.sin(2*Math.PI*12*i/hz);const y=noise.update(ray(x),plane,.72,.9,t).local.x;const m=smoothRay(oldNoise,ray(x),t).matrix,z=-1.1*m[8]/m[10];if(i>hz){aa+=y*y;bb+=z*z;n++;}}
   const recovery=new PageAimFilter();recovery.update(ray(0),plane,.72,.9,0);const lost=recovery.update(null,plane,.72,.9,20);const recovered=recovery.update(ray(.1),plane,.72,.9,40);
   const ramp=new PageAimFilter();ramp.update(ray(0),plane,.72,.9,0);let rampEndErrorMm=null,stopWithin2mmMs=null;
   for(let i=1;i<=hz*2;i++){const t=i*1000/hz,input=.2*Math.min(t/1000,1),x=ramp.update(ray(input),plane,.72,.9,t).local.x,error=Math.abs(input-x)*1000;if(i===hz)rampEndErrorMm=error;if(i>=hz&&stopWithin2mmMs===null&&error<2)stopWithin2mmMs=t-1000;}
   const edge=new PageAimFilter();edge.update(ray(.35),plane,.72,.9,0);const outside=edge.update(ray(.45),plane,.72,.9,20),edgeReturn=edge.update(ray(-.35),plane,.72,.9,40);
   results.push({hz,settleMs:settle,baselineSettleMs:oldSettle,stillNoiseRmsMm:1000*Math.sqrt(aa/n),baselineNoiseRmsMm:1000*Math.sqrt(bb/n),lost,recoveredX:recovered.local.x,rampEndErrorMm,stopWithin2mmMs,outside,edgeReturnX:edgeReturn.local.x});
  }
  return results;
 });
 for(const r of filters){assert.ok(r.settleMs<=60&&r.settleMs<r.baselineSettleMs/3);assert.ok(r.stillNoiseRmsMm<.05&&r.stillNoiseRmsMm<r.baselineNoiseRmsMm*1.2);assert.equal(r.lost,null);assert.ok(Math.abs(r.recoveredX-.1)<1e-6);assert.ok(r.rampEndErrorMm<8&&r.stopWithin2mmMs<=100);assert.equal(r.outside,null);assert.ok(Math.abs(r.edgeReturnX+.35)<1e-6);passed(`pointer: ${r.hz}Hz response, noise, ramp/stop and edge reset`);}
 await p.close();
 await fs.writeFile(path.join(out,'pointer-results.json'),JSON.stringify({syntheticXR:true,evidence,filters},null,2));
};
