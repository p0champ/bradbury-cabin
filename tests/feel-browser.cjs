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
  __glance();__step(520);
 });
 assert.equal(await p.evaluate(()=>__watchOpacity()),1);
 const before=await p.locator('#place').textContent();
 for(const interruption of ['tracking','system','screen','queued-screen']){
  await p.evaluate(()=>{__glance();__step(600);__native('selectstart');if(!window.__skipStartFrame)__step(32);});
  if(interruption==='tracking')await p.evaluate(()=>{const s=__mock.sources.right;s.testJoints.get('wrist').pose=null;__step(40);__glance();__step(600);});
  if(interruption==='system')await p.evaluate(()=>{__mock.sources.right.skipRendering=true;__step(40);__mock.sources.right.skipRendering=false;__step(600);});
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
 assert.equal(await p.evaluate(()=>[...__mock.layerData].filter(([l,d])=>d.badge&&l.opacity>0).length),0);
 await p.evaluate(()=>{const s=__mock.sources.right;for(const n of ['thumb-tip','index-finger-tip'])s.testJoints.get(n).pose.x+=.02;__step(16);});
 assert.ok(await p.evaluate(()=>[...__mock.layerData].some(([l,d])=>d.badge&&l.opacity>.5)));
 passed('feel: idle hand discs fade and wake on movement');
 assert.deepEqual(errors,[]);await p.close();
};
