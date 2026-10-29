import test from 'node:test';
import assert from 'node:assert/strict';
import {PoseFollower} from '../follow-pose.js';
const q={x:0,y:0,z:0,w:1}, p={x:0,y:0,z:0};
test('pose follower bounds sudden translation and rotation',()=>{
 const f=new PoseFollower(); f.update(p,q,0);
 const n=f.update({x:8,y:0,z:0},{x:0,y:1,z:0,w:0},16);
 assert.ok(n.position.x<=.01200001); assert.ok(2*Math.acos(n.orientation.w)<=.100001); assert.equal(n.moving,true);
});
test('tracking loss holds pose, fades after grace, and bounded reacquisition',()=>{
 const f=new PoseFollower(); f.update(p,q,0);
 assert.equal(f.update(null,null,100).lossOpacity,1);
 assert.equal(f.update(null,null,300).lossOpacity,.5);
 assert.equal(f.update(null,null,450).lossOpacity,0);
 assert.equal(f.update(null,null,450).position.x,0);
 assert.ok(f.update({x:5,y:0,z:0},q,500).position.x<=.01200001);
});
test('quaternion sign changes remain stable and normalised',()=>{
 const f=new PoseFollower(); f.update(p,q,0);
 const n=f.update(p,{x:0,y:0,z:0,w:-2},16);
 assert.equal(n.moving,false); assert.equal(n.orientation.w,1);
 f.reset(); assert.equal(f.update(null,null,20),null);
});
test('small aim motion catches up smoothly and settles',()=>{
 const f=new PoseFollower(); f.update(p,q,0);
 let n=f.update({x:.01,y:0,z:0},q,16);
 assert.ok(n.position.x>0 && n.position.x<.01);
 for(let t=32;t<1500;t+=16)n=f.update({x:.01,y:0,z:0},q,t);
 assert.ok(Math.abs(n.position.x-.01)<.00001); assert.equal(n.moving,false);
});
import {HandBadges} from '../hand-badges.js';
function badgesFixture() {
 let paints=0, uploads=0;
 const context=new Proxy({}, {get:(t,k)=>t[k] ?? (()=>{ if(k==='clearRect')paints++; }),set:(t,k,v)=>(t[k]=v,true)});
 globalThis.document={createElement:()=>({getContext:()=>context})};
 globalThis.XRRigidTransform=class{constructor(position,orientation){Object.assign(this,{position,orientation});}};
 const badges=new HandBadges({createQuadLayer:()=>({opacity:0,destroy(){}}),getSubImage:()=>({})},{});
 const viewer={position:p,orientation:q};
 const source={}, sample={source,hand:'right',position:{x:0,y:0,z:-.4}};
 const engine={hands:new Map([[source,{armed:true}]]),cooldownUntil:0,progress:()=>0};
 return {badges,sample,engine,update:(time,samples=[sample],opts={})=>badges.update(samples,viewer,engine,{time,...opts}),
 draw:()=>badges.draw({}, {copyPage(){uploads++;}}, [...badges.visible,...badges.pendingPreloads()]),counts:()=>({paints,uploads})};
}
test('prepared hand textures upload while hidden and only once',()=>{
 const f=badgesFixture(); const layers=f.badges.prepare();
 assert.equal(layers.length,2);assert.ok(layers.every(l=>l.opacity===0));
 f.draw();assert.equal(f.badges.pendingPreloads().length,0); assert.equal(f.counts().uploads,2);
 f.draw();assert.equal(f.counts().uploads,2);
});
test('readiness does not prevent idle fade; real movement wakes disc',()=>{
 const f=badgesFixture(); f.update(0); const layer=f.badges.entries.get('right').layer;
 assert.equal(layer.opacity,.55); f.update(5200);assert.equal(layer.opacity,0);
 f.sample.position.x=.01;f.update(5216);assert.equal(layer.opacity,.55);
 f.update(5232,[f.sample],{nearPage:true});assert.equal(layer.opacity,.9);
});
test('moving hand defers texture repaint and upload until settled',()=>{
 const f=badgesFixture();f.update(0);f.draw();const first=f.counts();
 f.sample.position.x=.2;f.badges.pulse('right',16,'turned');f.update(16);f.draw();
 assert.deepEqual(f.counts(),first);
 for(let t=32;t<2000;t+=16)f.update(t);f.draw();
 assert.ok(f.counts().paints>first.paints);assert.ok(f.counts().uploads>first.uploads);
});
test('brief loss holds layer while sustained loss and system gestures hide it',()=>{
 const f=badgesFixture();f.update(0);f.update(100,[]);assert.equal(f.badges.visible.length,1);
 f.update(500,[]);assert.equal(f.badges.visible.length,0);
 f.update(520);f.sample.systemGesture=true;f.update(536);assert.equal(f.badges.visible.length,0);
});
