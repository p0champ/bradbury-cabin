// Drafts are never feedback. Only the existing explicit Save action approves
// a thought; null draft records prevent an old backup resurrecting a draft.
import {canonicalWorkId,validCompletion} from './progress.js?v=58';
import {feedbackField} from './feedback.js?v=58';
import {SOURCE_CATALOGUE} from './source-catalogue.js?v=58';
const known=new Set(SOURCE_CATALOGUE.map(w=>w.id));
const valid=(id,r)=>known.has(id) && r && r.approved===false && validCompletion(id,r.at) &&
  (r.value===null || typeof r.value==='string' && r.value.length<=12000);
export function mergeThoughtDrafts(a,b,feedback={}) {
  const result={};
  for(const id of new Set([...Object.keys(a||{}),...Object.keys(b||{})])) {
    const records=[a?.[id],b?.[id]].filter(r=>valid(id,r));
    records.sort((x,y)=>y.at.localeCompare(x.at) || (y.value===null)-(x.value===null) || String(y.value).localeCompare(String(x.value)));
    if(!records.length)continue;
    let {value,at}=records[0];
    const approved=feedbackField(id,feedback[id],'thought');
    if(approved && approved.at>=at){value=null;at=approved.at;}
    result[id]={value,at,approved:false};
  }
  return result;
}
export function thoughtDraftFor(progress,work) {
  return mergeThoughtDrafts(progress.unapprovedThoughtDrafts,null,progress.feedback)[canonicalWorkId(work)]?.value ?? null;
}
export function setThoughtDraft(progress,work,value,clock=new Date()) {
  const id=canonicalWorkId(work),old=progress.unapprovedThoughtDrafts?.[id],approved=feedbackField(id,progress.feedback?.[id],'thought');
  const time=Math.max(new Date(clock).getTime(),valid(id,old)?Date.parse(old.at)+1:0,approved?Date.parse(approved.at)+1:0);
  if(!Number.isFinite(time))return false;
  const r={value,at:new Date(time).toISOString(),approved:false};
  if(!valid(id,r))return false;
  progress.unapprovedThoughtDrafts=mergeThoughtDrafts(progress.unapprovedThoughtDrafts,null,progress.feedback);
  progress.unapprovedThoughtDrafts[id]=r;return true;
}
