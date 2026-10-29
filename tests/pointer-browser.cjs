const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async function pointerChecks(browser,{mock,BASE_URL,out,passed}) {
 const evidence=[];
 for(const lying of [false,true]) for(const hand of ['right','left']) {
  const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await mock(p,'layer',lying,{practised:true,headPointer:false});
  await p.goto(BASE_URL);await p.locator('#enter').click();
  await p.evaluate(()=>__center());
  await p.evaluate(hand=>{__hold(hand);__hand(.05,hand);__step(600);},hand);
  await p.evaluate(async()=>{await __aim('library',true);__step(800);});
  const capture=()=>p.evaluate(()=>{
   const ptr=[...__mock.layerData].find(([l,d])=>d.pointer&&l.opacity>0);
   return {target:document.querySelector('#page').dataset.target,menu:document.querySelector('#page').dataset.menuPage,point:ptr?.[1].matrix?.slice(12,15)};
  });
  const before=await capture();assert.equal(before.target,'library');assert.ok(before.point);
  await p.evaluate(hand=>{__hand(.012,hand);__native('selectstart',hand);__step(32);},hand);
  const pressed=await capture();
  await p.evaluate(async()=>{await __aim('mood',true);__step(350);});
  const drift=await capture();assert.equal(drift.target,'library');
  const travelMm=1000*Math.hypot(...pressed.point.map((v,i)=>v-drift.point[i]));
  assert.ok(travelMm<.01,`held dot moved ${travelMm}mm`);
  await p.evaluate(hand=>{__hand(.05,hand);__native('select',hand);__native('selectend',hand);__step(16);},hand);
  assert.equal((await capture()).menu,'shelf');
  evidence.push({lying,hand,scenario:'press-drift',travelMm,before,pressed,drift});
  passed(`pointer: ${hand}, ${lying?'lying':'upright'} dot and selected choice stay together`);

  // A menu replaced while a press is held must not inherit its old target.
  await p.locator('#menu').click();await p.evaluate(()=>__step(800));
  await p.locator('#menu').click();await p.evaluate(()=>__step(800));
  await p.evaluate(async hand=>{__hand(.05,hand);await __aim('library',true);__step(800);__hand(.012,hand);__native('selectstart',hand);__step(32);},hand);
  await p.locator('#menu').click();await p.evaluate(()=>__step(16));
  await p.locator('#menu').click();await p.evaluate(()=>__step(800));
  await p.evaluate(hand=>{__hand(.05,hand);__native('select',hand);__native('selectend',hand);__step(16);},hand);
  assert.equal((await capture()).menu,'main','reopened menu consumed stale press');
  passed(`pointer: ${hand}, ${lying?'lying':'upright'} changed screen cancels press`);

  await p.evaluate(async hand=>{__hand(.05,hand);await __aim('library',true);__step(800);__hand(.012,hand);__native('selectstart',hand);__step(32);__hand(null,hand);__step(64);},hand);
  assert.equal((await capture()).point,undefined,'lost hand left a visible pointer');
  await p.evaluate(hand=>{__hand(.05,hand);__native('select',hand);__native('selectend',hand);__step(16);},hand);
  assert.equal((await capture()).menu,'main','tracking recovery activated stale choice');
  await p.evaluate(()=>__step(800));
  await p.evaluate(async()=>{await __aim('library',true);__step(800);});
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
  await p.evaluate(async()=>{await __aim('library',true);__step(800);__hand(.012);__native('selectstart');__step(32);__mock.rayLost=true;__step(32);});
  assert.equal(await p.evaluate(()=>[...__mock.layerData].filter(([l,d])=>d.pointer&&l.opacity>0).length),0);
  await p.evaluate(()=>{__mock.rayLost=false;__hand(.05);__native('select');__native('selectend');__step(16);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'main');
  passed('pointer: lost aim ray cancels menu press');
  for(const discard of ['stale','overflow']) {
   await p.evaluate(async()=>{await __aim('library',true);__hand(.05);__step(800);__hand(.012);__native('selectstart');__step(32);});
   await p.evaluate(discard=>{__hand(.05);if(discard==='stale'){__native('selectend');__mock.clock+=200;__step();}else{for(let i=0;i<62;i++)__native('selectend');__step();}},discard);
   await p.evaluate(async()=>{await __aim('mood',true);__step(800);});
   assert.equal(await p.locator('#page').getAttribute('data-target'),'mood',`${discard} discard left pointer frozen`);
   passed(`pointer: ${discard} native events clear frozen aim`);
  }
  await p.evaluate(async()=>{__hand(.05);await __aim({x:80,y:1000,w:0,h:0},true);__step(800);});
  assert.equal(await p.locator('#page').getAttribute('data-target'),'');
  await p.evaluate(()=>{__hand(.012);__native('selectstart');__step(32);});
  await p.evaluate(async()=>{await __aim('library',true);__step(350);__hand(.05);__native('select');__native('selectend');__step(16);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'main');
  passed('pointer: pinch started on empty space cannot acquire a choice');
  await p.close();
 }
 const p=await browser.newPage();await p.goto(BASE_URL);
 const filters=await p.evaluate(async()=>{
  const {PageAimFilter,OneEuro,smoothRay}=await import('./pointer.js?v=40');
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
