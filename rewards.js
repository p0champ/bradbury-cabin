import { SOURCE_CATALOGUE } from './source-catalogue.js?v=57';
import { LIBRARY } from './library.js?v=57';
import { streakStats, validCompletion, berlinDateKey, KINDS } from './progress.js?v=57';
const catalogue=new Map(SOURCE_CATALOGUE.map(w=>[w.id,w]));
export const MILESTONES=Object.freeze([
  {id:'streak-7',label:'Seven reading days in your streak',short:'7-day streak',metric:'streak',target:7, pool:['edgar-allan-poe-the-tell-tale-heart','edgar-allan-poe-the-black-cat','edgar-allan-poe-the-cask-of-amontillado']},
  {id:'days-30',label:'Thirty complete reading days',short:'30 reading days',metric:'days',target:30,pool:['w-b-yeats-the-song-of-wandering-aengus','w-b-yeats-aedh-wishes-for-the-cloths-of-heaven','w-b-yeats-the-secret-rose']},
  {id:'pieces-100',label:'One hundred different pieces read',short:'100 pieces',metric:'pieces',target:100,pool:['thomas-de-quincey-on-the-knocking-at-the-gate-in-macbeth','w-b-yeats-the-hosting-of-the-sidhe','edgar-allan-poe-the-facts-in-the-case-of-m-valdemar']},
]);
export const RESERVED_REWARD_IDS=Object.freeze(MILESTONES.flatMap(g=>g.pool));
for(const id of RESERVED_REWARD_IDS)if(!catalogue.get(id)?.sourceEdition?.bodySha256 || LIBRARY.some(w=>w.id===id))throw Error(`Reward needs a reviewed, non-starter edition: ${id}`);
const plain=v=>v && typeof v==='object'&&!Array.isArray(v);
const stamp=s=>typeof s==='string'&&validCompletion('reward',s);
export function completedPieceIds(progress,today) {
  const ids=new Set();
  for(const [id,at] of Object.entries(progress.completedWorks || {}))if(catalogue.has(id)&&validCompletion(id,at)&&berlinDateKey(new Date(at))<=today)ids.add(id);
  for(const [date,day] of Object.entries(progress.days || {})) {
    if(date>today)continue;
    for(const kind of KINDS)if(day[kind]===true) {
      const w=catalogue.get(day.ids?.[kind]);
      if(w?.kind===kind)ids.add(w.id);
      else if(typeof day.picks?.[kind]==='string') {
        const matches=SOURCE_CATALOGUE.filter(w=>w.kind===kind&&`${w.title} — ${w.author}`===day.picks[kind]);
        if(matches.length===1)ids.add(matches[0].id);
      }
    }
  }
  return ids;
}
function validAward(goal,r) {return plain(r)&&stamp(r.at)&&(r.catalogueId===null||goal.pool.includes(r.catalogueId));}
// Achievements merge by ID; book entitlements merge by union. If two offline
// devices selected different unread fallbacks, keep both already granted books,
// while retaining one deterministic achievement and one seen receipt.
export function mergeRewards(a,b) {
  const out={awards:{},unlocked:{},seen:{}};
  for(const g of MILESTONES) {
    const records=[a?.awards?.[g.id],b?.awards?.[g.id]].filter(r=>validAward(g,r));
    records.sort((x,y)=>(x.catalogueId===null)-(y.catalogueId===null)||x.at.localeCompare(y.at)||String(x.catalogueId).localeCompare(String(y.catalogueId)));
    if(records[0])out.awards[g.id]={at:records[0].at,catalogueId:records[0].catalogueId};
    for(const r of records)if(r.catalogueId)out.unlocked[r.catalogueId]=r.at;
    const seen=[a?.seen?.[g.id],b?.seen?.[g.id]].filter(stamp).sort();if(seen[0]&&out.awards[g.id])out.seen[g.id]=seen[0];
  }
  for(const data of [a,b])for(const [id,at] of Object.entries(data?.unlocked || {}))if(MILESTONES.some(g=>g.pool.includes(id)&&out.awards[g.id])&&stamp(at)) {
    if(!out.unlocked[id] || at<out.unlocked[id])out.unlocked[id]=at;
  }
  return out;
}
function alreadyGiven(progress) {
  const ids=new Set([...LIBRARY.map(w=>w.id),...Object.keys(progress.completedWorks || {}),...Object.keys(progress.rewards?.unlocked || {})]);
  for(const day of Object.values(progress.days || {}))for(const kind of KINDS) {
    if(day.ids?.[kind])ids.add(day.ids[kind]);
    for(const w of SOURCE_CATALOGUE)if(day.picks?.[kind]===`${w.title} — ${w.author}`)ids.add(w.id);
  }
  return ids;
}
export function rewardFacts(progress,today) {
  const days=streakStats(progress,today),pieces=completedPieceIds(progress,today).size;
  return {...days,pieces};
}
export function reconcileRewards(progress,today,clock=new Date()) {
  const old=JSON.stringify(progress.rewards || null),state=mergeRewards(progress.rewards,null),facts=rewardFacts(progress,today);
  progress.rewards=state;
  const given=alreadyGiven(progress),at=new Date(clock).toISOString();
  for(const g of MILESTONES) {
    const reached=(g.metric==='streak'?facts.best:g.metric==='days'?facts.completedDays:facts.pieces)>=g.target;
    if(!state.awards[g.id]&&!reached)continue;
    if(!state.awards[g.id] || !state.awards[g.id].catalogueId) {
      const id=g.pool.find(id=>!given.has(id)) || null;
      state.awards[g.id]={at:state.awards[g.id]?.at || at,catalogueId:id};
      if(id){state.unlocked[id]=at;given.add(id);}
    }
  }
  return old!==JSON.stringify(state);
}
export function rewardWorks(progress) {
  const state=mergeRewards(progress.rewards,null);
  return Object.keys(state.unlocked).map(id=>({...catalogue.get(id),reward:true}));
}
export function pendingRewards(progress) {
  return rewardEntries(progress).filter(r=>!progress.rewards?.seen?.[r.id]);
}
export function rewardEntries(progress) {
  const state=mergeRewards(progress.rewards,null);
  return MILESTONES.filter(g=>state.awards[g.id]).map(g=>({...g,...state.awards[g.id],work:catalogue.get(state.awards[g.id].catalogueId)||null}));
}
export function acknowledgeRewards(progress,goals,clock=new Date()) {
  progress.rewards=mergeRewards(progress.rewards,null);
  for(const id of goals)if(progress.rewards.awards[id])progress.rewards.seen[id] ||= new Date(clock).toISOString();
}
export function rewardFrame(ms,reduced=false) {
  const duration=reduced?300:2000,p=Math.max(0,Math.min(1,ms/duration));
  return {done:p>=1,alpha:reduced?.28*(1-p):.65*Math.sin(Math.PI*p)**2};
}
