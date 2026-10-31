import test from 'node:test';
import assert from 'node:assert/strict';
import {DriveLink} from '../drive.js';
import {parsePicks} from '../picks.js';
import {SOURCE_CATALOGUE} from '../source-catalogue.js';
import {LIBRARY} from '../library.js';
const date='2026-10-28', token='next /?& page';
const starters=new Set(LIBRARY.map(w=>w.id));
const works=['poem','story','essay'].map(kind=>SOURCE_CATALOGUE.find(w=>w.kind===kind&&!starters.has(w.id)));
const picks=JSON.stringify({version:2,date,picks:Object.fromEntries(works.map(w=>[w.kind,{catalogueId:w.id,guide:{context:'A note before reading.'}}]))});
const reply=data=>({ok:true,status:200,json:async()=>data,text:async()=>data});
function link(fetchFn){const d=new DriveLink({storage:{getItem:()=>null},fetchFn});d.token='fixture';d.expires=Date.now()+3600000;d.folderId='F';return d;}

test('daily picks and arrival stamp follow empty and busy pages, preserving newest-file authority',async()=>{
 for(const broken of [false,true]){
  const pages=[],opened=[];
  const d=link(async raw=>{
   const url=new URL(raw);
   if(url.searchParams.get('alt')==='media'){const id=url.pathname.split('/').at(-1);opened.push(id);return reply(broken?'{broken':picks);}
   const page=url.searchParams.get('pageToken');pages.push(page);
   assert.match(url.searchParams.get('fields'),/nextPageToken/);
   if(!page)return reply({files:Array.from({length:20},(_,i)=>({id:`noise${i}`,name:`picks-${date}-draft-${i}.txt`})),nextPageToken:token});
   if(page===token)return reply({files:[],nextPageToken:'last'});
   assert.equal(page,'last');return reply({files:[{id:'NEW',name:`picks-${date}-2.json`,createdTime:'new',modifiedTime:'changed'}, {id:'OLD',name:`picks-${date}.json`}]});
  });
  assert.equal(await d.newestPicksStamp(date),'NEW:new:changed');assert.deepEqual(pages,[null,token,'last']);pages.length=0;
  const found=await d.readPicksFor(date,parsePicks);
  assert.equal(found.parsed.works.length,broken?0:3);assert.equal(found.parsed.problems.length>0,broken);
  assert.deepEqual(opened,['NEW'],'never download an older substitute');assert.deepEqual(pages,[null,token,'last']);
 }
});

test('progress lookup and old guide recovery follow later pages too',async()=>{
 const opened=[];
 const d=link(async raw=>{
  const url=new URL(raw),q=url.searchParams.get('q');
  if(url.searchParams.get('alt')==='media'){const id=url.pathname.split('/').at(-1);opened.push(id);return reply(id==='P'?'kept progress':picks);}
  if(!url.searchParams.has('pageToken'))return reply({files:[],nextPageToken:token});
  assert.equal(url.searchParams.get('pageToken'),token);
  return reply({files:[{id:q.includes('progress.json')?'P':'T',name:q.includes('progress.json')?'progress.json':`picks-${date}.json`,createdTime:'2026-10-28T10:00:00Z'}]});
 });
 assert.equal(await d.read('progress.json'),'kept progress');assert.equal(d.progressId,'P');
 const progress={days:{[date]:{ids:Object.fromEntries(works.map(w=>[w.kind,w.id]))}}};
 assert.equal(await d.recoverGuides(progress,'2026-10-29',parsePicks),1);
 assert.deepEqual(opened,['P','T']);assert.ok(progress.days[date].guides);
});

test('incomplete, malformed, looping and interrupted listings fail instead of claiming a complete result',async()=>{
 for(const bad of [{incompleteSearch:true},{files:'broken'},{nextPageToken:5}]){
  const d=link(async()=>reply(bad));await assert.rejects(d.readPicksFor(date,parsePicks),/couldn't (list|finish)/);
 }
 let calls=0;
 const looping=link(async()=>{calls++;return reply({files:[],nextPageToken:'repeat'});});
 await assert.rejects(looping.readPicksFor(date,parsePicks),/couldn't finish/);assert.equal(calls,2);
 let opened=0;
 const interrupted=link(async raw=>{const url=new URL(raw);if(url.searchParams.has('pageToken'))throw Error('offline');if(url.searchParams.get('alt')==='media')opened++;return reply({files:[{id:'T',name:`picks-${date}.json`}],nextPageToken:'more'});});
 await assert.rejects(interrupted.readPicksFor(date,parsePicks),/Couldn't reach Google Drive/);assert.equal(opened,0);
});
