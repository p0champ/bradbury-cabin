import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedRecovery,recoveryName,recoveryTime,advanceRecovery,orderedRecovery,checkedCursor,recoveryQuery} from '../connection/recovery-protocol.js';
import {GoogleRecovery} from '../connection/google-recovery.js';
import {importRecoveryCopies} from '../connection/import-recovery.js';
const base={version:1,start:'2026-10-18',trackingSince:'2026-10-31',days:{'2026-10-31':{poem:false}},weeks:{},feedback:{'blake-sick-rose':{thought:{value:null,at:'2026-10-31T12:00:00Z'}}},unapprovedThoughtDrafts:{'ohenry-magi':{value:'Not approved.\nStill considering.',at:'2026-10-31T12:00:00Z',approved:false}},headset:{controls:{night:true},reading:{last:'ohenry-magi',places:{'ohenry-magi':{page:1,anchor:{block:3,word:4}}}}}};
const envelope={version:1,device:'a'.repeat(64),requestId:'fixture-request-1',payload:JSON.stringify(base),sequence:1,operations:[{path:['days','2026-10-31','poem'],value:false,sequence:1}]};
const file={id:'Z',name:recoveryName(envelope),createdTime:'2026-10-31T12:00:00.123456Z'};
test('complete Google recovery preserves unticks, removed thoughts, unapproved drafts and exact reading anchors',()=>{const parsed=checkedRecovery(JSON.stringify(envelope),file);assert.deepEqual(parsed.state,base);assert.deepEqual(parsed.envelope,envelope);});
test('foreign filenames, bad state, invalid/prototype operations and impossible sequences are refused without a partial result',()=>{assert.throws(()=>checkedRecovery(JSON.stringify(envelope),{...file,name:'progress.json'}));for(const change of [{payload:'{}'},{payload:'{bad'},{sequence:0},{operations:[{path:['__proto__','polluted'],value:true,sequence:1}]},{operations:[...envelope.operations,...envelope.operations]}])assert.throws(()=>checkedRecovery(JSON.stringify({...envelope,...change}),file));assert.equal({}.polluted,undefined);});
test('same instant with a newly created lower file ID stays discoverable and microseconds retain their order',()=>{const first=advanceRecovery(null,file),next={...file,id:'A'};assert.equal(orderedRecovery([next,file],first).length,1);assert.equal(orderedRecovery([next,file],first)[0].id,'A');const second=advanceRecovery(first,next);assert.deepEqual(new Set(second.ids),new Set(['Z','A']));assert.deepEqual(orderedRecovery([next,file],second),[]);const early={...file,id:'E',createdTime:'2026-10-31T12:00:00.123455Z'};assert.deepEqual(orderedRecovery([file,early],null).map(f=>f.id),['E','Z']);assert.equal(recoveryTime(early.createdTime),'2026-10-31T12:00:00.123455000Z');});
test('a corrupt scan marker or calendar date cannot silently become an empty recovery history',()=>{for(const bad of [{at:'bad',ids:[]},{at:recoveryTime(file.createdTime),ids:['Z','Z']},{at:recoveryTime(file.createdTime),ids:['../P']}])assert.throws(()=>checkedCursor(bad));assert.throws(()=>recoveryTime('2026-02-31T12:00:00Z'));assert.throws(()=>orderedRecovery([{...file,createdTime:'bad'}],null));});

function directFixture(){
 const files=new Map(),calls=[],journal={record:{},persist(value){if(this.fail)throw Error('fixture local storage full');this.record=structuredClone(value);return this.record;}};let reserved=0,posts=0,profile='owner',mode='normal';
 const drive={token:'fixture-access',connected:true,signOut(){this.connected=false;this.token=null;},async folder(){calls.push('folder');return'F';},async call(url,init={}){calls.push(url);if(url.includes('userinfo'))return Response.json({email_verified:true,sub:profile});if(url.includes('generateIds'))return Response.json({ids:['R'+(++reserved)]});if(init.method==='POST'){posts++;if(mode==='quota')throw Object.assign(Error('fixture Google quota'),{status:429});const parts=[...init.body.matchAll(/\r\n\r\n({[^\r\n]+})\r\n--/g)].map(m=>m[1]),metadata=JSON.parse(parts[0]);assert.notEqual(metadata.name,'progress.json');files.set(metadata.id,{...metadata,raw:mode==='bad'?'{}':parts[1]});if(mode==='lost')throw Error('fixture lost upload reply');return Response.json({id:metadata.id});}const id=new URL(url).pathname.split('/').at(-1);if(!files.has(id))throw Object.assign(Error('fixture not found'),{status:404});return new Response(files.get(id).raw);}};
 return {drive,journal,files,calls,mode:value=>{mode=value},profile:value=>{profile=value},counts:()=>({reserved,posts})};
}
async function directEnvelope(){const deviceId='D'.repeat(43),device=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(deviceId)))].map(v=>v.toString(16).padStart(2,'0')).join('');return{deviceId,envelope:{...envelope,device}};}
test('a direct safety copy is checked completely, is immutable, and never writes the main progress file or exports credentials',async()=>{const f=directFixture(),data=await directEnvelope(),writer=new GoogleRecovery(f.drive,f.journal,{ownerSubject:'owner',deviceId:data.deviceId});const receipt=await writer.save(data.envelope);assert.equal(receipt.verified,true);assert.equal(f.files.size,1);const saved=[...f.files.values()][0];assert.deepEqual(JSON.parse(saved.raw),data.envelope);assert.equal(saved.raw.includes('fixture-access'),false);await writer.save(data.envelope);assert.deepEqual(f.counts(),{reserved:1,posts:1});await assert.rejects(writer.save({...data.envelope,payload:JSON.stringify({...base,extra:true})}),/identity/);assert.deepEqual(f.counts(),{reserved:1,posts:1});});
test('a lost upload reply reuses its saved file identity and checks the first complete copy instead of creating a duplicate',async()=>{const f=directFixture(),data=await directEnvelope(),writer=new GoogleRecovery(f.drive,f.journal,{ownerSubject:'owner',deviceId:data.deviceId});f.mode('lost');await assert.rejects(writer.save(data.envelope));assert.equal(f.journal.record.googleRecovery[data.envelope.requestId].verified,false);f.mode('normal');assert.equal((await writer.save(data.envelope)).verified,true);assert.deepEqual(f.counts(),{reserved:1,posts:1});});
test('Google limits, wrong readback and local storage failure cannot acknowledge a safety copy or overwrite the main backup',async()=>{for(const mode of ['quota','bad','storage']){const f=directFixture(),data=await directEnvelope(),writer=new GoogleRecovery(f.drive,f.journal,{ownerSubject:'owner',deviceId:data.deviceId});if(mode==='storage')f.journal.fail=true;else f.mode(mode);await assert.rejects(writer.save(data.envelope));assert.notEqual(f.journal.record.googleRecovery?.[data.envelope.requestId]?.verified,true);if(mode==='storage')assert.equal(f.counts().posts,0);assert.equal([...f.files.values()].some(file=>file.name==='progress.json'),false);}});
test('a wrong Google account is refused before opening the folder, and no known owner means no fallback credential is guessed',async()=>{for(const known of [true,false]){const f=directFixture(),data=await directEnvelope();f.profile('someone-else');const writer=new GoogleRecovery(f.drive,f.journal,{ownerSubject:known?'owner':null,deviceId:data.deviceId});await assert.rejects(writer.save(data.envelope));assert.equal(f.calls.includes('folder'),false);assert.deepEqual(f.counts(),{reserved:0,posts:0});if(known)assert.equal(f.drive.connected,false);}});

import {BackupCoordinator} from '../connection/backup-coordinator.js';
import {validProgress,berlinDateKey} from '../progress.js';
import {mergeProgress} from '../drive.js';
import {CabinOwner} from '../connection/worker.js';
class RecoveryStorage{
 constructor(){this.data=new Map();this.alarm=null;this.failCursor=false;}
 async get(key){return Array.isArray(key)?new Map(key.filter(k=>this.data.has(k)).map(k=>[k,structuredClone(this.data.get(k))])):structuredClone(this.data.get(key));}
 async put(key,value){if(key==='recoveryCursor'&&this.failCursor)throw Error('fixture lost cursor write');if(typeof key==='string')this.data.set(key,structuredClone(value));else for(const[k,v]of Object.entries(key))this.data.set(k,structuredClone(v));}
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])this.data.delete(key);}
 async getAlarm(){return this.alarm;} async setAlarm(value){this.alarm=value;}async deleteAlarm(){this.alarm=null;}
 async transaction(fn){const tx=new RecoveryStorage();tx.data=structuredClone(this.data);tx.alarm=this.alarm;const value=await fn(tx);this.data=tx.data;this.alarm=tx.alarm;return value;}
}
async function serverFixture(){const storage=new RecoveryStorage();await storage.put('cabinTokens',{hash:{device:envelope.device}});const initial=structuredClone(base);initial.days['2026-10-31'].poem=true;const backups=new BackupCoordinator(storage,{validate:validProgress,mergeProgress,readInitial:async()=>JSON.stringify(initial),dayKey:berlinDateKey,now:()=>new Date('2026-10-31T14:00:00Z')});await backups.state(envelope.device);const copies=new Map();let listings=0;const files={async listRecovery(){listings++;return [...copies.values()].map(({wire,...metadata})=>metadata);},async readRecovery(file){return copies.get(file.id).wire;}};const add=(value=envelope,index=1)=>{const metadata={id:'G'+index,name:recoveryName(value),createdTime:`2026-10-31T12:00:${String(index).padStart(2,'0')}Z`,wire:JSON.stringify(value)};copies.set(metadata.id,metadata);};return{storage,backups,files,copies,add,listings:()=>listings};}
test('Google safety copies rejoin the actual private backup through the same checked sequenced save protocol',async()=>{const f=await serverFixture();f.add();await importRecoveryCopies(f.storage,f.files,f.backups);const saved=await f.backups.state(envelope.device);assert.equal(saved.state.days['2026-10-31'].poem,false);assert.equal(saved.sequence,1);assert.deepEqual(saved.state.unapprovedThoughtDrafts,base.unapprovedThoughtDrafts);assert.deepEqual(saved.state.feedback,base.feedback);assert.equal(f.copies.size,1);assert.ok(await f.storage.get('recoveryCursor'));});
test('a crash after snapshot commit but before the scan marker cannot replay an old untick over a later independent correction',async()=>{const f=await serverFixture();f.add();f.storage.failCursor=true;await assert.rejects(importRecoveryCopies(f.storage,f.files,f.backups));const other='b'.repeat(64),before=await f.backups.state(other),changed=structuredClone(before.state);changed.days['2026-10-31'].poem=true;await f.backups.save(other,{requestId:'other-later-correction',payload:JSON.stringify(changed),revision:before.revision,baselineRevision:before.baselineRevision,sequence:1,operations:[{sequence:1,path:['days','2026-10-31','poem'],value:true}]});f.storage.failCursor=false;await importRecoveryCopies(f.storage,f.files,f.backups);assert.equal((await f.backups.state(other)).state.days['2026-10-31'].poem,true);assert.ok(await f.storage.get('recoveryCursor'));});
test('private writes can force a fresh recovery scan even after a recent empty read, while ordinary reads are bounded',async()=>{const f=await serverFixture();await importRecoveryCopies(f.storage,f.files,f.backups,{now:()=>100000});f.add();await importRecoveryCopies(f.storage,f.files,f.backups,{now:()=>100001});assert.equal(f.listings(),1);assert.equal((await f.backups.state(envelope.device)).state.days['2026-10-31'].poem,true);await importRecoveryCopies(f.storage,f.files,f.backups,{now:()=>100002,force:true});assert.equal(f.listings(),2);assert.equal((await f.backups.state(envelope.device)).state.days['2026-10-31'].poem,false);});
test('a long recovery backlog advances only through complete accepted copies and continues in the next bounded batch',async()=>{const f=await serverFixture();for(let n=1;n<=9;n++){const value={...envelope,requestId:'fixture-recovery-'+n,sequence:n,payload:JSON.stringify({...base,days:{'2026-10-31':{poem:n%2===0}}}),operations:[{sequence:n,path:['days','2026-10-31','poem'],value:n%2===0}]};f.add(value,n);}await importRecoveryCopies(f.storage,f.files,f.backups);assert.equal((await f.backups.state(envelope.device)).sequence,8);await importRecoveryCopies(f.storage,f.files,f.backups);assert.equal((await f.backups.state(envelope.device)).sequence,9);assert.equal(f.copies.size,9);});
test('bad or unpaired Google copies never replace the private snapshot or advance past unrecovered data',async()=>{for(const bad of ['unpaired','corrupt']){const f=await serverFixture(),before=(await f.backups.state(envelope.device)).state;f.add(bad==='unpaired'?{...envelope,device:'c'.repeat(64)}:envelope);if(bad==='corrupt')f.copies.get('G1').wire='{}';await assert.rejects(importRecoveryCopies(f.storage,f.files,f.backups));assert.deepEqual((await f.backups.state(envelope.device)).state,before);assert.equal(await f.storage.get('recoveryCursor'),undefined);assert.equal(f.copies.size,1);}});

test('fresh Google restore joins complete pending copies but cannot replay files already represented in the checked main backup',async()=>{
  const f=directFixture(), main=structuredClone(base), cursor=advanceRecovery(null,file);
  main.days['2026-10-31'].poem=true; main.cabinRecoveryCursor=cursor;
  f.drive.read=async name=>{assert.equal(name,'progress.json');return JSON.stringify(main);};
  const newer={...envelope,device:'b'.repeat(64),requestId:'later-device-copy',payload:JSON.stringify({...base,headset:{...base.headset,controls:{night:false}},days:{'2026-10-30':{story:true}}})};
  const pending={id:'NEW',name:recoveryName(newer),createdTime:'2026-10-31T13:00:00Z'};
  f.files.set(file.id,{...file,raw:JSON.stringify(envelope)});f.files.set(pending.id,{...pending,raw:JSON.stringify(newer)});
  f.drive.listFiles=async query=>{assert.ok(query.endsWith(` and createdTime >= '${cursor.at}'`));return[file,pending];};
  const reader=new GoogleRecovery(f.drive,f.journal,{ownerSubject:'owner'}),restored=await reader.readProgress();
  assert.equal(restored.days['2026-10-31'].poem,true);
  assert.equal(restored.days['2026-10-30'].story,true);
  assert.deepEqual(restored.cabinRecoveryCursor,cursor);
  assert.deepEqual(restored.feedback,base.feedback);assert.deepEqual(restored.unapprovedThoughtDrafts,base.unapprovedThoughtDrafts);
  assert.equal(f.calls.some(call=>call.includes('/files/Z?')),false);
  f.files.get(pending.id).raw='{}';await assert.rejects(reader.readProgress());
  assert.deepEqual(main.cabinRecoveryCursor,cursor);
});

test('listing retains the complete nanosecond boundary without scanning already accepted years of immutable files',()=>{
  assert.equal(recoveryQuery(null),'');
  const cursor=advanceRecovery(null,file);assert.equal(recoveryQuery(cursor),` and createdTime >= '2026-10-31T12:00:00.123456000Z'`);
  assert.throws(()=>recoveryQuery({at:"2026-10-31' or trashed=true",ids:[]}));
});

test('actual production bootstrap establishes the main backup cursor before an old recovery file can replay its untick',async()=>{
  const storage=new RecoveryStorage(),main=structuredClone(base),cursor=advanceRecovery(null,file);
  main.days['2026-10-31'].poem=true;main.cabinRecoveryCursor=cursor;
  await storage.put('cabinTokens',{fixture:{device:envelope.device}});
  let reads=0,listings=0;
  const files={readProgressVersion:async()=>({id:'P',etag:'"original"',raw:JSON.stringify(main)}),listRecovery:async received=>{listings++;assert.deepEqual(received,cursor);return[file];},readRecovery:async()=>{reads++;return JSON.stringify(envelope);}};
  const owner=new CabinOwner({storage},{SERVICE_URL:'https://connection.example/',CABIN_URL:'https://reader.example/cabin/',GOOGLE_CLIENT_ID:'fixture-client',GOOGLE_CLIENT_SECRET:'fixture-secret',MASTER_KEY:'A'.repeat(43),OWNER_EMAIL:'reader@example.com'});
  const backups=owner.backups(files);
  await importRecoveryCopies(storage,files,backups);
  assert.equal(listings,1);assert.equal(reads,0);
  assert.equal((await backups.state(envelope.device)).state.days['2026-10-31'].poem,true);
  assert.deepEqual(await storage.get('recoveryCursor'),cursor);
  assert.equal((await storage.get('driveMirrorHead')).id,'P');
});

test('a new browser restored from an older Google copy cannot claim its stale calendar as a new local edit on returning',async()=>{
  const f=await serverFixture(),other='b'.repeat(64),current=await f.backups.state(envelope.device),corrected=structuredClone(current.state);
  corrected.days['2026-10-31'].poem=false;
  await f.backups.save(envelope.device,{requestId:'private-later-untick',payload:JSON.stringify(corrected),sequence:1,operations:[{sequence:1,path:['days','2026-10-31','poem'],value:false}],revision:current.revision,baselineRevision:current.baselineRevision});
  await f.storage.put('cabinTokens',{fixture:{device:other}});
  const oldGoogle=structuredClone(corrected);oldGoogle.days['2026-10-31'].poem=true;oldGoogle.savedAt='2026-10-31T15:00:00Z';
  f.add({version:1,device:other,requestId:'fresh-browser-outage',payload:JSON.stringify(oldGoogle),sequence:0,operations:[],bootstrap:false});
  await importRecoveryCopies(f.storage,f.files,f.backups);
  assert.equal((await f.backups.state(other)).state.days['2026-10-31'].poem,false);
});
