import test from 'node:test';
import assert from 'node:assert/strict';
import {streak,streakStats,berlinDateKey} from '../progress.js';
import {MILESTONES,RESERVED_REWARD_IDS,reconcileRewards,rewardWorks,pendingRewards,acknowledgeRewards,mergeRewards,completedPieceIds,rewardFrame} from '../rewards.js';
import {SOURCE_CATALOGUE as C} from '../source-catalogue.js';
import {flameHeight,WATCH_METRES} from '../watch.js';
import {mergeProgress} from '../drive.js';
import {parsePicks} from '../picks.js';
import {withPickerContract} from '../picker-contract.js';
const full=()=>({poem:true,story:true,essay:true}),at='2026-11-02T12:00:00.000Z';
const fixture=()=>({version:1,start:'2026-10-26',trackingSince:'2026-10-26',days:{},weeks:{}});
test('only fully completed trios add a day; first weekly miss protects without credit',()=>{
 const p=fixture();p.days['2026-10-26']=full();p.days['2026-10-28']=full();
 const f=streakStats(p,'2026-10-29');assert.equal(f.current,2);assert.equal(f.completedDays,2);assert.equal(f.history.find(d=>d.date==='2026-10-27').protected,true);
 assert.equal(streak(p,'2026-10-30'),0,'second missed day in same week must break');
});
test('partial days consume the same allowance and never add a reading day',()=>{
 const p=fixture();p.days['2026-10-26']=full();p.days['2026-10-27']={poem:true,story:true};p.days['2026-10-28']=full();
 assert.equal(streak(p,'2026-10-28'),2);assert.equal(streakStats(p,'2026-10-28').completedDays,2);
});
test('protection resets Monday; Sunday then Monday can both be protected',()=>{
 const p=fixture();for(let i=26;i<=31;i++)p.days[`2026-10-${i}`]=full();p.days['2026-11-03']=full();
 const f=streakStats(p,'2026-11-03');assert.equal(f.current,7);assert.equal(f.completedDays,7);assert.ok(f.history.find(d=>d.date==='2026-11-01').protected);assert.ok(f.history.find(d=>d.date==='2026-11-02').protected);
});
test('unfinished today never spends protection; unknown past days never bridge a chain',()=>{
 const p=fixture();p.days['2026-10-26']=full();assert.equal(streak(p,'2026-10-27'),1);assert.equal(streakStats(p,'2026-10-27').protectionAvailable,true);
 p.trackingSince='2026-10-29';p.days['2026-10-28']=full();assert.equal(streak(p,'2026-10-29'),1);assert.equal(streakStats(p,'2026-10-29').completedDays,2);
});
test('Berlin dates follow local midnight across DST regardless of device timezone',()=>{
 assert.equal(berlinDateKey(new Date('2026-10-24T22:30:00Z')),'2026-10-25');
 assert.equal(berlinDateKey(new Date('2026-10-25T22:30:00Z')),'2026-10-25');
 assert.equal(berlinDateKey(new Date('2026-10-25T23:30:00Z')),'2026-10-26');
});
test('seven actual reading days earn one immediately readable exact edition',()=>{
 const p=fixture();for(let i=26;i<=31;i++)p.days[`2026-10-${i}`]=full();p.days['2026-11-01']=full();
 assert.ok(reconcileRewards(p,'2026-11-01',at));const rewards=rewardWorks(p);assert.equal(rewards.length,1);
 assert.deepEqual(rewards[0].blocks,C.find(w=>w.id===rewards[0].id).blocks);assert.equal(pendingRewards(p)[0].id,'streak-7');
 assert.equal(reconcileRewards(p,'2026-11-02',at),false);assert.equal(rewardWorks(p).length,1);
 acknowledgeRewards(p,['streak-7'],at);assert.equal(pendingRewards(p).length,0);
 p.days={};reconcileRewards(p,'2026-11-02',at);assert.equal(rewardWorks(p).length,1,'corrections do not revoke an earned pick');
});
test('thirty days are total completed trios, not a current streak',()=>{
 const p=fixture();p.start=p.trackingSince='2026-09-01';for(let i=1;i<=30;i++)p.days[`2026-09-${String(i).padStart(2,'0')}`]=full();
 reconcileRewards(p,'2026-11-02',at);assert.ok(p.rewards.awards['days-30']);assert.equal(streak(p,'2026-11-02'),0);
});
test('100 pieces deduplicate canonical editions across ledger, daily records and rereads',()=>{
 const p=fixture();p.completedWorks=Object.fromEntries(C.slice(0,100).map(w=>[w.id,at]));
 p.completedWorks.invented=at;p.days['2026-11-02']={poem:true,ids:{poem:C.find(w=>w.kind==='poem').id}};
 assert.equal(completedPieceIds(p,'2026-11-02').size,100);reconcileRewards(p,'2026-11-02',at);assert.ok(p.rewards.awards['pieces-100']);
 assert.equal(streakStats(p,'2026-11-02').completedDays,0,'reward pieces cannot fabricate a daily trio');
});
test('already assigned reserved editions are skipped; exhausted pool reports earned without invented text',()=>{
 const p=fixture();for(let i=26;i<=31;i++)p.days[`2026-10-${i}`]=full();p.days['2026-11-01']=full();
 p.days['2026-10-26'].ids={story:MILESTONES[0].pool[0]};reconcileRewards(p,'2026-11-01',at);assert.equal(p.rewards.awards['streak-7'].catalogueId,MILESTONES[0].pool[1]);
 const q=fixture();q.days=structuredClone(p.days);q.completedWorks=Object.fromEntries(MILESTONES[0].pool.map(id=>[id,at]));reconcileRewards(q,'2026-11-02',at);
 assert.equal(q.rewards.awards['streak-7'].catalogueId,null);assert.equal(pendingRewards(q)[0].work,null);
});
test('Drive preserves awards and seen receipts even when newer device has neither',()=>{
 const p=fixture();for(let i=26;i<=31;i++)p.days[`2026-10-${i}`]=full();p.days['2026-11-01']=full();reconcileRewards(p,'2026-11-01',at);acknowledgeRewards(p,['streak-7'],at);
 const b=fixture();b.savedAt='2026-11-03T12:00:00.000Z';const merged=mergeProgress(p,b);
 assert.equal(rewardWorks(merged).length,1);assert.equal(pendingRewards(merged).length,0);assert.deepEqual(mergeRewards(p.rewards,b.rewards),mergeRewards(b.rewards,p.rewards));
});
test('concurrent fallback grants retain book ownership but only one milestone receipt',()=>{
 const a={awards:{'streak-7':{at,catalogueId:MILESTONES[0].pool[0]}}},b={awards:{'streak-7':{at,catalogueId:MILESTONES[0].pool[1]}},seen:{'streak-7':at}};
 const merged=mergeRewards(a,b);assert.equal(Object.keys(merged.awards).length,1);assert.equal(Object.keys(merged.unlocked).length,2);assert.equal(pendingRewards({rewards:merged}).length,0);
 assert.deepEqual(mergeRewards({unlocked:{[MILESTONES[0].pool[0]]:at},awards:{bad:{at,catalogueId:'invented'}}},null),{awards:{},unlocked:{},seen:{}});
});
test('reserved picks are excluded from current Claude catalogue and new daily files, while old assignments survive',()=>{
 const p=fixture(),contract=JSON.parse(withPickerContract(JSON.stringify(p))).cabinPickerInstructions;
 assert.ok(contract.reservedRewardIds.length>=3);assert.ok(contract.catalogue.every(w=>!RESERVED_REWARD_IDS.includes(w.catalogueId)));
 const poem=C.find(w=>w.kind==='poem'&&!RESERVED_REWARD_IDS.includes(w.id)&&w.id!=='blake-sick-rose'&&w.id!=='whitman-astronomer'&&w.id!=='whitman-captain'),essay=C.find(w=>w.kind==='essay'&&!['bacon-studies','bacon-truth'].includes(w.id)&&!RESERVED_REWARD_IDS.includes(w.id));
 const file={version:2,date:'2026-11-02',picks:{poem:{catalogueId:poem.id},story:{catalogueId:MILESTONES[0].pool[0]},essay:{catalogueId:essay.id}}};
 assert.match(parsePicks(file,{}, {reservedIds:RESERVED_REWARD_IDS}).problems.join(),/reserved/);
 assert.equal(parsePicks(file,{'2026-11-02':{ids:{story:MILESTONES[0].pool[0]}}},{reservedIds:RESERVED_REWARD_IDS}).problems.length,0);
});
test('all reserved rewards are distinct, critic-approved original editions',()=>{
 assert.equal(new Set(RESERVED_REWARD_IDS).size,RESERVED_REWARD_IDS.length);
 for(const id of RESERVED_REWARD_IDS)assert.ok(C.find(w=>w.id===id)?.sourceEdition?.bodySha256);
});
test('celebration ends after two seconds, reduced motion fades, flame growth stays inside original watch',()=>{
 assert.equal(rewardFrame(0).alpha,0);assert.equal(rewardFrame(2000).done,true);assert.ok(rewardFrame(1000).alpha<=.65);
 assert.equal(rewardFrame(300,true).done,true);assert.ok(rewardFrame(150,true).alpha<rewardFrame(0,true).alpha);
 assert.deepEqual(WATCH_METRES,[.044,.0385]);assert.ok(flameHeight(1)<flameHeight(7));assert.ok(flameHeight(7)<flameHeight(30));assert.equal(flameHeight(100),flameHeight(999));
});
