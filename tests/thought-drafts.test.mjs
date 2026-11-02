import test from 'node:test';
import assert from 'node:assert/strict';
import {thoughtDraftFor,setThoughtDraft,mergeThoughtDrafts} from '../thought-drafts.js';
import {setFeedback,feedbackFor} from '../feedback.js';
import {mergeProgress} from '../drive.js';
import {SOURCE_CATALOGUE} from '../source-catalogue.js';
const work=SOURCE_CATALOGUE[0],at=new Date('2026-10-31T10:00:00.000Z');
const state=()=>({version:1,start:'2026-10-18',trackingSince:'2026-10-18',days:{},weeks:{}});
test('a complete unapproved draft belongs to the exact edition and never becomes feedback',()=>{
 const p=state(),text='An unfinished thought.\nStill reviewing it.';
 assert.equal(setThoughtDraft(p,work,text,at),true);assert.equal(thoughtDraftFor(p,{id:`today-2026-10-31-${work.kind}-${work.id}`}),text);
 assert.equal(feedbackFor(p,work).thought,'');assert.equal(p.unapprovedThoughtDrafts[work.id].approved,false);
 assert.equal(thoughtDraftFor(p,SOURCE_CATALOGUE[1]),null);
 assert.equal(setThoughtDraft(p,work,'' ,at),true);assert.equal(thoughtDraftFor(p,work),'','an intentionally blank unsaved edit is restored too');
});
test('Save and Clear leave deletion-aware draft records even with an unchanged clock',()=>{
 const p=state();setThoughtDraft(p,work,'pending',at);const old=structuredClone(p);
 setFeedback(p,work,'thought','pending',at);setThoughtDraft(p,work,null,at);
 let merged=mergeProgress(p,old);assert.equal(thoughtDraftFor(merged,work),null);assert.equal(feedbackFor(merged,work).thought,'pending');
 setFeedback(p,work,'thought',null,at);setThoughtDraft(p,work,null,at);
 merged=mergeProgress(old,p);assert.equal(thoughtDraftFor(merged,work),null);assert.equal(feedbackFor(merged,work).thought,'');
 setThoughtDraft(p,work,'a genuinely new draft',at);assert.equal(thoughtDraftFor(p,work),'a genuinely new draft');
});
test('draft merges are deterministic and a newer approved thought invalidates an old draft',()=>{
 const a=state(),b=state();setThoughtDraft(a,work,'draft',at);setThoughtDraft(b,work,null,at);
 assert.deepEqual(mergeThoughtDrafts(a.unapprovedThoughtDrafts,b.unapprovedThoughtDrafts),mergeThoughtDrafts(b.unapprovedThoughtDrafts,a.unapprovedThoughtDrafts));
 setFeedback(a,work,'thought','approved later',new Date(at.getTime()+1000));assert.equal(thoughtDraftFor(a,work),null);
 assert.equal(mergeThoughtDrafts(a.unapprovedThoughtDrafts,null,a.feedback)[work.id].value,null);
});
test('bad or oversized draft records are rejected without cutting or replacing a good draft',()=>{
 const p=state();setThoughtDraft(p,work,'kept',at);
 assert.equal(setThoughtDraft(p,work,'x'.repeat(12001),at),false);assert.equal(thoughtDraftFor(p,work),'kept');
 assert.equal(setThoughtDraft(p,{id:'invented'},'no',at),false);
 assert.deepEqual(mergeThoughtDrafts({[work.id]:{value:'not approved',at:at.toISOString(),approved:true}},null),{});
});
