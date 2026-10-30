const assert=require('node:assert/strict');
module.exports=async function feelChecks(browser,{mock,BASE_URL,passed}){
 const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await mock(p,'layer',false,{practised:true,headPointer:false});await p.goto(BASE_URL);await p.locator('#enter').click();
 await p.evaluate(()=>{__step();});
 assert.ok(await p.evaluate(()=>[...__mock.layerData].filter(([l,d])=>d.badge||d.watch).every(([l,d])=>(__mock.versions.get(d.tex)||0)>0)),'textures uploaded before welcome');
 passed('feel: hand and wrist textures preloaded before welcome');
 await p.evaluate(()=>__center());
 await p.evaluate(()=>{
  window.__glance=()=>{
   const s=__hand(.05,'right'),H=new DOMMatrix(__headMatrix());
   for(const [name,v] of [['wrist',[.03,-.08,-.35]],['index-finger-metacarpal',[-.04,-.10,-.35]],['pinky-finger-metacarpal',[-.03,-.06,-.35]],['middle-finger-metacarpal',[-.05,-.08,-.35]]]){
    const q=new DOMPoint(...v).matrixTransform(H);s.testJoints.set(name,{pose:{x:q.x,y:q.y,z:q.z}});
   }return s;
  };
  window.__watchOpacity=()=>[...__mock.layerData].find(([l,d])=>d.watch)?.[0].opacity||0;
  __glance();
  for(let t=0;t<600;t+=16){
   const source=__glance();
   for(const n of ['wrist','index-finger-metacarpal','pinky-finger-metacarpal','middle-finger-metacarpal'])source.testJoints.get(n).pose.x+=.008*Math.sin(t/90);
   __step(16);
  }
 });
 assert.equal(await p.evaluate(()=>__watchOpacity()),1);
 passed('feel: right-wrist glance appears during continuous small movement');
 const before=await p.locator('#place').textContent();
 for(const interruption of ['tracking','system','emulated-viewer','screen','queued-screen']){
  await p.evaluate(()=>{__glance();__step(600);__native('selectstart');if(!window.__skipStartFrame)__step(32);});
  if(interruption==='tracking')await p.evaluate(()=>{const s=__mock.sources.right;s.testJoints.get('wrist').pose=null;__step(40);__glance();__step(600);});
  if(interruption==='system'){await p.evaluate(()=>{__mock.sources.right.skipRendering=true;__step(40);});assert.equal(await p.evaluate(()=>__watchOpacity()),0);await p.evaluate(()=>{__mock.sources.right.skipRendering=false;__step(600);});}
  if(interruption==='emulated-viewer'){await p.evaluate(()=>{__mock.emulatedViewer=true;__step(40);});assert.equal(await p.evaluate(()=>__watchOpacity()),0);await p.evaluate(()=>{__mock.emulatedViewer=false;__step(600);});}
  if(interruption==='screen'||interruption==='queued-screen'){
   if(interruption==='queued-screen')await p.evaluate(()=>__native('selectstart'));
   await p.locator('#menu').click();await p.evaluate(()=>__step(40));
   await p.locator('#menu').click();await p.evaluate(()=>__step(600));
  }
  await p.evaluate(()=>{__native('select');__native('selectend');__step(40);});
  assert.equal(await p.locator('#page').getAttribute('data-view'),'reading',`${interruption} reused an old wrist pinch`);
  assert.equal(await p.locator('#place').textContent(),before);
  passed(`feel: interrupted wrist pinch cancels on ${interruption}`);
 }
 await p.evaluate(()=>{__glance();__step(600);__native('selectstart');__step(200);__native('select');__native('selectend');__step(40);});
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'shelf');
 assert.equal(await p.locator('#place').textContent(),before);
 passed('feel: fresh right-wrist pinch opens shelf and preserves reading place');
 await p.locator('#menu').click();
 await p.evaluate(()=>{const s=__mock.sources.right;for(const n of ['wrist','index-finger-metacarpal','pinky-finger-metacarpal','middle-finger-metacarpal'])s.testJoints.delete(n);__hand(.05);__step(6400);});
 assert.ok(await p.evaluate(()=>[...__mock.layerData].some(([l,d])=>d.badge&&l.opacity===.96)));
 await p.evaluate(()=>{const s=__mock.sources.right;for(const n of ['thumb-tip','index-finger-tip'])s.testJoints.get(n).pose.x+=.02;__step(16);});
 assert.ok(await p.evaluate(()=>[...__mock.layerData].some(([l,d])=>d.badge&&l.opacity>.5)));
 passed('feel: tracked idle hand discs stay clearly visible and follow movement');
 const contrast=await p.evaluate(async()=>{
  const {paintHandBadge}=await import('/hand-badges.js?v=54');
  const linear=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};
  const luminance=p=>.2126*linear(p[0])+.7152*linear(p[1])+.0722*linear(p[2]);
  return ['#ffffff','#080a0b','#f6f2e9'].flatMap(background=>[true,false].map(available=>{
   const badge=document.createElement('canvas');badge.width=badge.height=256;paintHandBadge(badge,{available,ready:true});
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
   c.fillStyle=background;c.fillRect(0,0,256,256);c.globalAlpha=.96;c.drawImage(badge,0,0);c.globalAlpha=1;
   const symbol=luminance(c.getImageData(118,106,1,1).data),backing=luminance(c.getImageData(128,185,1,1).data);
   return {background,available,ratio:(Math.max(symbol,backing)+.05)/(Math.min(symbol,backing)+.05)};
  }));
 });
 assert.ok(contrast.every(x=>x.ratio>=4.5),JSON.stringify(contrast));
 passed('feel: resting and unavailable symbols retain contrast over bright, dark and paper backgrounds');
 assert.deepEqual(errors,[]);await p.close();
};
