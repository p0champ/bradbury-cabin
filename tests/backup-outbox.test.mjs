import test from 'node:test';
import assert from 'node:assert/strict';
import {BackupOutbox,OUTBOX_KEY} from '../backup-outbox.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
test('pending complete snapshot survives restart and only its own acknowledgement clears it',()=>{
 const s=storage(),q=new BackupOutbox(s);const first=q.enqueue('{"thought":"first"}');
 assert.equal(q.pending,true);const restarted=new BackupOutbox(s);assert.deepEqual(restarted.entry,first);
 const second=restarted.enqueue('{"thought":"second"}');assert.notEqual(second.id,first.id);
 assert.equal(restarted.acknowledge(first.id),false);assert.equal(restarted.pending,true);
 assert.equal(restarted.acknowledge(second.id),true);assert.equal(new BackupOutbox(s).pending,false);
});
test('last acknowledged payload detects a close between local state saving and queue writing',()=>{
 const s=storage(),q=new BackupOutbox(s),first=q.enqueue('old state');q.acknowledge(first.id);
 const reopened=new BackupOutbox(s);assert.equal(reopened.enqueue('old state').id,first.id);assert.equal(reopened.pending,false);
 reopened.enqueue('new locally saved state');assert.equal(reopened.pending,true);
 assert.equal(new BackupOutbox(s).entry.payload,'new locally saved state');
});
test('another tab replacing the queued snapshot cannot be cleared by an old response',()=>{
 const s=storage(),a=new BackupOutbox(s),first=a.enqueue('first'),b=new BackupOutbox(s);b.enqueue('second');
 assert.equal(a.acknowledge(first.id),false);assert.equal(new BackupOutbox(s).pending,true);assert.equal(new BackupOutbox(s).entry.payload,'second');
});
test('queue storage failure retains the snapshot in memory, can acknowledge a real backup and retries storage',()=>{
 const s=storage(),put=s.setItem;let fail=true;s.setItem=(...a)=>{if(fail)throw Error('quota');put(...a);};
 const q=new BackupOutbox(s),e=q.enqueue('complete state');assert.equal(q.persisted,false);assert.equal(q.pending,true);
 assert.equal(q.acknowledge(e.id),true);assert.equal(q.pending,false);
 fail=false;q.enqueue('complete state');assert.equal(q.persisted,true);assert.equal(new BackupOutbox(s).pending,false);
});
test('unreadable queue metadata does not change primary reader data',()=>{
 const s=storage();s.setItem(OUTBOX_KEY,'{bad');s.setItem('cabin-progress','kept original');
 const q=new BackupOutbox(s);q.enqueue('fresh complete state');assert.equal(q.pending,true);assert.equal(s.getItem('cabin-progress'),'kept original');
});
