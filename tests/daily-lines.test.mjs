import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePicks, personalLine } from '../picks.js';
import { rememberPersonal, personalFor, mergePersonal, clearReplacedTicks } from '../daily-lines.js';
import { paintToday, paintClosing, wrapPersonal } from '../today-panel.js';
const date = '2026-10-28';
const fixture = () => ({version:2,date,picks:{poem:{catalogueId:'william-blake-experience-the-tiger'},story:{catalogueId:'kate-chopin-a-pair-of-silk-stockings'},essay:{catalogueId:'francis-bacon-of-travel'}},dedication:'A quiet moment for yourself.',thread:'Three different ways of looking closely.'});
test('optional copy fails independently without losing complete originals',()=>{
 const good=parsePicks(fixture()); assert.equal(good.works.length,3); assert.deepEqual(good.problems,[]);
 for(const value of ['x'.repeat(71),'a\nb',{},[], 'Notice "utterly invented words".', 'Notice "[invented]".', 'An "unfinished']) {
  const parsed=parsePicks({...fixture(),dedication:value});
  assert.equal(parsed.personal.dedication,null,JSON.stringify(value)); assert.equal(parsed.personal.thread,fixture().thread); assert.equal(parsed.works.length,3); assert.deepEqual(parsed.problems,[]);
 }
 assert.equal(parsePicks({...fixture(),thread:'x'.repeat(161)}).personal.thread,null);
 assert.equal(personalLine('🌙'.repeat(70),70,good.works),'🌙'.repeat(70));
 assert.equal(personalLine('🌙'.repeat(71),70,good.works),null);
});
test('even one-word quotes must be complete literal source words',()=>{
 const works=['woman can\'t rose-red','other','else'].map(text=>({title:'Title',blocks:[{type:'para',text}]}));
 for(const fragment of ['man','can','red','[invented]']) assert.equal(personalLine(`Notice "${fragment}".`,70,works),null,fragment);
 assert.equal(personalLine('Notice "woman" and "other".',70,works),'Notice "woman" and "other".');
});
test('saved lines bind to all three editions and null revisions prevent resurrection',()=>{
 const parsed=parsePicks(fixture()), ids=Object.fromEntries(parsed.works.map(w=>[w.kind,w.catalogueId]));
 const progress={days:{[date]:{ids}}};
 assert.equal(rememberPersonal(progress,date,parsed,{savedAt:'2026-10-28T10:00:00Z'}),true);
 const old=structuredClone(progress.days[date]);
 assert.deepEqual(personalFor(old,parsed.works),parsed.personal);
 const changed=structuredClone(parsed.works);changed[0].sourceEdition.bodySha256='changed';
 assert.deepEqual(personalFor(old,changed),{dedication:null,thread:null});
 rememberPersonal(progress,date,{...parsed,personal:{}},{savedAt:'2026-10-28T11:00:00Z'});
 mergePersonal(progress.days[date],old);assert.equal(progress.days[date].personal.thread,null);
 const forged=structuredClone(old);forged.personal.ids.poem='wrong';mergePersonal(forged,null);assert.equal(forged.personal,undefined);
 const wrong=structuredClone(old);wrong.ids.poem='wrong';mergePersonal(wrong,null);assert.equal(wrong.personal,undefined);
 old.personal.thread='Notice "utterly invented words".';assert.equal(personalFor(old,parsed.works).thread,null);
});
test('only a known replaced selection clears its reading checkmark',()=>{
 const {works}=parsePicks(fixture()),ids=Object.fromEntries(works.map(w=>[w.kind,w.catalogueId]));
 const day={ids:{...ids,essay:'old'},poem:true,story:true,essay:true};clearReplacedTicks(day,works);
 assert.equal(day.poem,true);assert.equal(day.story,true);assert.equal(day.essay,false);
 const legacy={poem:true,story:true,essay:true};clearReplacedTicks(legacy,works);assert.equal(legacy.essay,true);
 const same={ids,poem:true,story:true,essay:true};clearReplacedTicks(same,works);assert.equal(same.essay,true);
});
const colours={bg:'#fff',ink:'#111',muted:'#333',card:'#eee',accent:'#ddd',gold:'#555',serif:'serif',italic:''};
function canvas(){return {drawn:[],font:'40px serif',measureText(t){return {width:Array.from(t).length*Number(/(\d+)px/.exec(this.font)[1])}},fillText(t,x,y){this.drawn.push({t,x,y})},fillRect(){},strokeRect(){},beginPath(){},rect(){},roundRect(){},fill(){}}}
test('opening appears before completion; reflection appears only after all three are read',()=>{
 const parsed=parsePicks(fixture());
 for(let read=0;read<=3;read++){
  const ctx=canvas();paintToday(ctx,{works:parsed.works,personal:parsed.personal,facts:{dateline:'Today',read,allRead:read===3,closing:''},statuses:{},c:colours});
  assert.equal(ctx.drawn.some(d=>d.t===parsed.personal.dedication),read!==3);
  assert.equal(ctx.drawn.some(d=>d.t===parsed.personal.thread),read===3);
  const closing=canvas();paintClosing(closing,{work:parsed.works[2],next:null,read:true,allRead:read===3,thread:parsed.personal.thread,c:colours});
  assert.equal(closing.drawn.map(d=>d.t).join(' ').includes(parsed.personal.thread),read===3);
 }
});
test('maximum editorial copy wraps completely without truncation or overflow',()=>{
 const ctx=canvas();for(const size of [32,34,42]){ctx.font=`${size}px serif`;const text='W'.repeat(160),lines=wrapPersonal(ctx,text,1500);assert.equal(lines.join(''),text);assert.ok(lines.every(l=>ctx.measureText(l).width<=1500));}
});
