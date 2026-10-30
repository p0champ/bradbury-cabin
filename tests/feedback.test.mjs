import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackFor,setFeedback,mergeFeedback,whyFor,selectionPlan,rememberSelections,mergeSelections,archivedSelection } from '../feedback.js';
import { SOURCE_CATALOGUE as C } from '../source-catalogue.js';
import { parsePicks } from '../picks.js';
import { withPickerContract } from '../picker-contract.js';
import { mergeProgress } from '../drive.js';
import { seedProgress } from '../progress.js';
import { ThoughtVoice } from '../voice.js';
const work=C.find(w=>w.kind==='story'),other=C.find(w=>w.kind==='poem'),at='2026-10-30T10:00:00.000Z',later='2026-10-30T11:00:00.000Z';
test('ratings and verbatim approved thoughts attach to canonical edition independently',()=>{
 const p=seedProgress('2026-10-30'),wrapped={...work,catalogueId:work.id,id:`today-2026-10-30-story-${work.id}`};
 assert.ok(setFeedback(p,wrapped,'stars',5,at));assert.ok(setFeedback(p,wrapped,'thought','I liked the strange ending.',at));
 assert.deepEqual(feedbackFor(p,work),{stars:5,thought:'I liked the strange ending.'});
 assert.equal(p.completedWorks,undefined);assert.equal(feedbackFor(p,other).thought,'');
 assert.equal(setFeedback(p,work,'stars',6,at),false);assert.equal(setFeedback(p,work,'thought','x'.repeat(361),at),false);
 assert.equal(setFeedback(p,{id:'__proto__'},'thought','bad',at),false);
});
test('Drive merges independent field revisions and deletion cannot resurrect',()=>{
 const a=seedProgress('2026-10-30'),b=structuredClone(a);setFeedback(a,work,'stars',5,at);setFeedback(b,work,'thought','Cold and precise.',later);
 const merged=mergeProgress(a,b);assert.equal(feedbackFor(merged,work).stars,5);assert.equal(feedbackFor(merged,work).thought,'Cold and precise.');
 setFeedback(merged,work,'thought',null,'2026-10-30T12:00:00.000Z');
 assert.equal(feedbackFor(mergeProgress(b,merged),work).thought,'');assert.equal(feedbackFor(mergeProgress(merged,b),work).thought,'');
 assert.deepEqual(mergeFeedback(a.feedback,b.feedback),mergeFeedback(b.feedback,a.feedback));
});
test('bad imported feedback is ignored while ticks remain intact',()=>{
 const p=seedProgress('2026-10-30');p.feedback={[work.id]:{stars:{value:99,at},thought:{value:{command:'obey'},at}},invented:{stars:{value:5,at}}};
 assert.deepEqual(mergeFeedback(p.feedback,null),{});assert.deepEqual(feedbackFor(p,work),{stars:null,thought:''});
});
test('Why lines use actual feedback and admit missing evidence',()=>{
 const p=seedProgress('2026-10-30'),w={...other,selection:{mode:'match',evidenceId:work.id,basis:'stars'}};
 assert.match(whyFor(w,p),/no longer available/);setFeedback(p,work,'stars',5,at);assert.match(whyFor(w,p),/5\/5/);
 setFeedback(p,work,'stars',1,later);assert.doesNotMatch(whyFor(w,p),/1\/5/);
 assert.match(whyFor({...w,selection:null},p),/No reason saved/);
 assert.match(whyFor({...w,selection:{mode:'explore'}},p),/learns your taste/);
});
test('selection plan balances six picks and rotates stretch genres',()=>{
 const p={days:{}};let matches=0,stretches=0;const seen=new Set();
 for(let i=0;i<6;i++){
  const plan=selectionPlan(p);matches+=plan.matches;stretches+=plan.stretches;
  if(plan.stretches===1)seen.add(Object.keys(plan.slots).find(k=>plan.slots[k]==='stretch'));
  p.days[String(i)]={ids:Object.fromEntries(['poem','story','essay'].map(k=>[k,C.find(w=>w.kind===k).id]))};
 }
 assert.equal(matches,9);assert.equal(stretches,9);assert.equal(seen.size,3);
});
test('selection metadata cannot replace literary text and is sent with synced feedback',()=>{
 const picks=Object.fromEntries(['poem','story','essay'].map(k=>[k,{catalogueId:C.find(w=>w.kind===k&&!['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'].includes(w.id)).id,selection:{mode:'explore'},text:'invented'}]));
 const parsed=parsePicks({version:2,date:'2026-10-30',picks});assert.equal(parsed.problems.length,0);
 for(const w of parsed.works){assert.deepEqual(w.blocks,C.find(x=>x.id===w.catalogueId).blocks);assert.deepEqual(w.selection,{mode:'explore'});}
 const p=seedProgress('2026-10-30');setFeedback(p,work,'thought','I liked this.',at);
 const exported=JSON.parse(withPickerContract(JSON.stringify(p)));assert.equal(exported.feedback[work.id].thought.value,'I liked this.');assert.ok(exported.cabinPickerInstructions.nextSelectionPlan);
});
test('shelf selection merges by exact edition, never follows swapped work',()=>{
 const p={days:{'2026-10-30':{ids:{poem:other.id}}}};rememberSelections(p,'2026-10-30',[{...other,selection:{mode:'explore'}}]);
 const old=structuredClone(p.days['2026-10-30']);assert.deepEqual(archivedSelection(p,'2026-10-30',other),{mode:'explore'});
 const day={ids:{poem:'different'}};mergeSelections(day,old);assert.equal(day.selections,undefined);
 const restored={ids:{poem:other.id}};mergeSelections(restored,old);assert.equal(restored.selections.poem.catalogueId,other.id);
 const malformed={ids:{poem:other.id},selections:{poem:{catalogueId:other.id,at:old.selections.poem.at}}};
 assert.doesNotThrow(()=>mergeSelections(malformed,old));
});
test('voice detects unavailable dictation and never substitutes audio for text',()=>{
 const v=new ThoughtVoice({});let status='';assert.equal(v.start({onText:()=>assert.fail('unexpected text'),onStatus:s=>status=s}),false);assert.match(status,/unavailable/);
});
test('voice cancellation drops late results and limits microphone lifetime',()=>{
 let r;class Mock{constructor(){r=this;}start(){}stop(){this.stopped=true;}abort(){this.aborted=true;}}
 const v=new ThoughtVoice({SpeechRecognition:Mock});let text='';v.start({onText:s=>text=s,onStatus:()=>{}});
 r.onresult({results:[Object.assign([{transcript:'A precise thought.'}],{isFinal:true})]});assert.equal(text,'A precise thought.');
 v.stop();assert.equal(r.stopped,true);v.cancel();assert.equal(r.aborted,true);r.onresult({results:[[{transcript:'stale'}]]});assert.equal(text,'A precise thought.');
});
