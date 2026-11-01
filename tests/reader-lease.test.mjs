import test from 'node:test';
import assert from 'node:assert/strict';
import { readerLease } from '../reader-lease.js';
test('the lifecycle guard rejects every late personal write after leaving, then reloads a frozen restored document',async()=>{
 const events=new EventTarget(),values=new Map();let reloads=0,held=false;
 const locks={request:async(name,options,callback)=>{assert.equal(options.ifAvailable,true);assert.equal(name,'bradbury-cabin-reader');held=true;try{await callback({name});}finally{held=false;}}};
 const lease=await readerLease({locks,events,reload:()=>reloads++});
 const store=lease.wrap({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)});
 store.setItem('progress','original');assert.equal(held,true);
 events.dispatchEvent(new Event('pagehide'));await Promise.resolve();assert.equal(lease.active,false);
 assert.throws(()=>store.setItem('progress','stale'),/kept/);assert.throws(()=>store.removeItem('progress'),/kept/);assert.equal(store.getItem('progress'),'original');
 events.dispatchEvent(Object.assign(new Event('pageshow'),{persisted:true}));assert.equal(reloads,1);
});
test('a held or denied browser lock stops the second reader before it can obtain a writable store',async()=>{
 for(const request of [async(name,options,callback)=>callback(null),async()=>{throw Error('denied');}]){
  const lease=await readerLease({locks:{request},events:new EventTarget()});assert.equal(lease.active,false);assert.equal(lease.wrap,undefined);
 }
});
test('browsers without the optional lock API still prevent stale writes after leaving',async()=>{
 const events=new EventTarget(),lease=await readerLease({locks:null,events});assert.equal(lease.active,true);events.dispatchEvent(new Event('pagehide'));assert.equal(lease.active,false);
});
