import test from 'node:test';
import assert from 'node:assert/strict';
import { clampDim, FocusDim, seasonFor, seasonalDetail, wordBounds, wordAt } from '../comfort.js';
import { lookupWord } from '../word-lookup.js';
import { GestureEngine } from '../gestures.js';

test('focus dim eases, clamps and restores without a page change', () => {
  const d = new FocusDim(); d.update(0, .96);
  const values = Array.from({length:70}, (_,i)=>d.update((i+1)*50,.96));
  assert.ok(values[0] > 0 && values[0] < .2); assert.equal(values.at(-1), .96);
  assert.ok(values.every((x,i)=>i===0 || x>=values[i-1]));
  for(let t=3550;t<8000;t+=50)d.update(t,0);
  assert.equal(d.value,0); assert.equal(clampDim(9),.96); assert.equal(clampDim(-2),0); assert.equal(clampDim(NaN),.32);
});
test('real seasons follow local months and selected hemisphere', () => {
  for (const [month, season] of [[0,'winter'],[2,'spring'],[5,'summer'],[8,'autumn'],[11,'winter']]) assert.equal(seasonFor(new Date(2026,month,1)),season);
  assert.equal(seasonFor(new Date(2026,9,30),'south'),'spring');
});
test('rare seasonal motion stays outside the page and respects reduced motion', () => {
  assert.equal(seasonalDetail(89999,0,'autumn'),null);
  const detail=seasonalDetail(93000,0,'autumn'); assert.ok(detail.x < -.38); assert.ok(detail.alpha > 0);
  assert.equal(seasonalDetail(97000,0,'autumn'),null);
  assert.equal(seasonalDetail(93000,0,'autumn',true),null);
});
test('word bounds follow measured typography, ignore whitespace and reconstruct opening letters', () => {
  const c={save(){},restore(){},measureText(t){return {width:t.length*10}}};
  const items=[{kind:'line',text:'Hello world.',x:200,y:500,font:50},{kind:'line',text:'ne dollar',x:270,y:600,font:50,dropCap:{letter:'O',x:200,dy:70,separate:false}}];
  const words=wordBounds(c,items,{body:'serif',title:'italic'});
  assert.equal(wordAt(words,{x:210,y:470}).word,'Hello');
  assert.equal(wordAt(words,{x:255,y:470}),null);
  assert.equal(wordAt(words,{x:220,y:580}).word,'One');
  assert.equal(wordAt(words,{x:280,y:570}).word,'One');
});
function rig(context='reading') {
  const g=new GestureEngine();g.setContext(context);const key={}; let time=0;
  const run=ms=>{for(let n=0;n<ms;n+=20){time+=20;g.update(key,{time,hand:'right',tracked:true,inView:true,attentive:true,open:true});}};
  run(600); return {g,key,run,get time(){return time;}};
}
test('pinching a word selects it without turning; hold still opens menu', () => {
  const r=rig();r.g.handle('selectstart',r.key,r.time,'word:0:0');r.run(240);
  assert.equal(r.g.handle('select',r.key,r.time,'word:0:0').type,'select');
  const h=rig();h.g.handle('selectstart',h.key,h.time,'word:0:0');h.run(1500);assert.equal(h.g.tick(h.time).type,'menu');
});
test('lost tracking and moved word targets cannot turn a page or select a word', () => {
  const r=rig();r.g.handle('selectstart',r.key,r.time,'word:0:0');r.run(240);
  assert.equal(r.g.handle('select',r.key,r.time,'word:0:5'),null);
  const h=rig();h.g.handle('selectstart',h.key,h.time,'word:0:0');h.g.update(h.key,{time:h.time+10,tracked:false});
  assert.equal(h.g.handle('select',h.key,h.time+20,'word:0:0'),null);
});
test('dragging dim beyond hold duration never opens or closes the menu', () => {
  const r=rig('menu');r.g.handle('selectstart',r.key,r.time,'settings-dim');r.run(1700);
  assert.equal(r.g.tick(r.time),null);assert.equal(r.g.holdCharge(r.time),0);
  assert.equal(r.g.handle('select',r.key,r.time,'settings-dim').type,'select');
});
test('offline glossary gives plain meanings and real reference notes', async () => {
  assert.match((await lookupWord('parsimony')).meaning,/spend money/);
  assert.match((await lookupWord('Magi')).background,/Jesus/);
});
test('network failures return a truthful retry state', async () => {
  const old=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline')};
  try { assert.match((await lookupWord('unavailablexyz')).meaning,/connection/); }
  finally { globalThis.fetch=old; }
});
test('dictionary and exact reference lookups are bounded and reject ambiguous references', async () => {
  const old=globalThis.fetch;const requests=[];
  globalThis.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('dictionaryapi')?[{meanings:[{definitions:[{definition:'A short meaning.'}]}]}]:{query:{pages:{1:{title:'Testcity',extract:'A city in a story.',pageprops:{disambiguation:''}}}}}};};
  try { const result=await lookupWord('Testcity');assert.equal(result.meaning,'A short meaning.');assert.equal(result.background,undefined);assert.equal(requests.length,2);assert.ok(requests.every(u=>!u.includes('reading'))); }
  finally {globalThis.fetch=old;}
});

test('a reference without a dictionary entry still separates meaning and background', async () => {
  const old=globalThis.fetch;
  globalThis.fetch=async url=>url.includes('dictionaryapi')?{ok:false}:{ok:true,json:async()=>({query:{pages:{1:{title:'Testisland',extract:'Testisland is an island. It was settled long ago.'}}}})};
  try { const result=await lookupWord('Testisland');assert.equal(result.meaning,'Testisland is an island.');assert.equal(result.background,'It was settled long ago.'); }
  finally {globalThis.fetch=old;}
});
