const assert = require('node:assert/strict');
module.exports = async function pointerVisibilityChecks(browser,{mock,BASE_URL,out,passed}) {
  async function open(lying, hand='right') {
    const p=await browser.newPage();await mock(p,'layer',lying,{practised:true,headPointer:false});await p.goto(BASE_URL+'?pointerDiagnostics=1');await p.locator('#enter').click();await p.evaluate(()=>{__center();__hold();__hand(.05);__step(800);});
    await p.evaluate(hand=>{
      window.__edgePosition={x:.22,y:-.25,z:-.45};
      const original=__hand;
      window.__hand=(distance,side=hand)=>{
        const source=original(distance,side),H=new DOMMatrix(__headMatrix()),v=__edgePosition;
        const wrist=new DOMPoint(v.x,v.y,v.z).matrixTransform(H);
        source.testJoints.set('wrist',{pose:distance==null?null:{x:wrist.x,y:wrist.y,z:wrist.z}});
        for(const [name,offset] of [['index-finger-tip',0],['thumb-tip',distance||0]]) {
          const tip=new DOMPoint(v.x+offset,v.y+.02,v.z-.04).matrixTransform(H);
          source.testJoints.get(name).pose=distance==null?null:{x:tip.x,y:tip.y,z:tip.z};
        }
        return source;
      };
      window.__edgeAim=id=>{
        const b=JSON.parse(document.querySelector('#page').dataset.buttons).find(b=>b.id===id),M=new DOMMatrix(__mock.quad.transform.matrix);
        const target=new DOMPoint(((b.x+b.w/2)/2048-.5)*__mock.quad.width,(.5-(b.y+b.h/2)/2560)*__mock.quad.height,0).matrixTransform(M);
        const source=__hand(.05,hand),o=source.testJoints.get('wrist').pose;
        __mock.rayOrigin||={};__mock.rayOrigin[hand]={...o};
        let x=target.x-o.x,y=target.y-o.y,z=target.z-o.z;const length=Math.hypot(x,y,z);x/=length;y/=length;z/=length;
        const n=Math.hypot(y,-x,1-z);__mock.rayByHand||={};__mock.rayByHand[hand]={x:y/n,y:-x/n,z:0,w:(1-z)/n};
      };
    },hand);
    return p;
  }
  for(const lying of [false,true])for(const hand of ['right','left'])for(const [edge,position,target,route] of [
    ['right',{x:.54,y:-.25,z:-.45},'home-settings','settings'],
    ['left',{x:-.54,y:-.25,z:-.45},'home-shelf','shelf'],
    ['above',{x:.22,y:.43,z:-.45},'home-settings','settings'],
    ['below',{x:.22,y:-.43,z:-.45},'home-library','library']]) {
    const p=await open(lying,hand);
    await p.evaluate(({position,target})=>{__edgePosition=position;__edgeAim(target);__step(800);},{position,target});
    assert.equal(await p.locator('#page').getAttribute('data-target'),target,`valid tracked ${edge} hand lost its menu highlight`);
    const marks=await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.pointerMarks));
    assert.ok(marks.some(m=>m.hand===hand),'valid tracked hand lost its visible cursor');
    await p.evaluate(hand=>{__pinch(hand);__step(700);},hand);
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'),route,'visible tracked menu aim must remain clickable');
    await p.close();passed(`menu visibility: ${edge} tracked wrist keeps its own dot and selection ${hand} ${lying?'lying':'upright'}`);
  }
  for(const lying of [false,true]) {
    const p=await open(lying);await p.locator('#menu').click();await p.evaluate(()=>{__edgePosition={x:.54,y:-.25,z:-.45};__hand(.05);__step(800);});
    const before=await p.locator('#place').textContent();await p.evaluate(()=>{__pinch();__step(700);});
    assert.equal(await p.locator('#place').textContent(),before,'reading hand-in-view gate must remain unchanged');
    await p.close();passed(`menu visibility: reading retains its physical viewing gate ${lying?'lying':'upright'}`);
  }
  for(const reason of ['system-owned','lost-wrist','lost-ray','behind-viewer','too-near']) {
    const p=await open(false);await p.evaluate(()=>{__edgePosition={x:.54,y:-.25,z:-.45};__edgeAim('home-settings');__step(800);});
    await p.evaluate(reason=>{const source=__mock.sources.right;__hand(.012);if(reason==='system-owned')source.skipRendering=true;if(reason==='lost-wrist')source.testJoints.get('wrist').pose=null;if(reason==='lost-ray')__mock.rayLost=true;if(reason==='behind-viewer'||reason==='too-near'){__edgePosition={x:.22,y:-.25,z:reason==='behind-viewer'?.2:-.08};__edgeAim('home-settings');__hand(.012);}__step(64);__native('selectstart');__step(64);__native('select');__native('selectend');__step(16);},reason);
    assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'today');
    assert.equal(await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.pointerMarks).length),0,'invalid tracked input must not leave a pointer');
    await p.close();passed(`menu visibility: ${reason} cannot exploit the menu ray allowance`);
  }
};
