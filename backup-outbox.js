// One latest complete snapshot replaces older queued snapshots. Keep the
// acknowledged copy too: comparing it at startup catches a close between a
// local save and the queue write. No account credentials belong in this copy.
export const OUTBOX_KEY = 'cabin-backup-outbox';
let serial=0;
const queueId=()=>globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}-${++serial}`;
export class BackupOutbox {
  constructor(storage, makeId = queueId) {
    this.storage=storage;this.makeId=makeId;this.entry=null;this.persisted=true;
    try {
      const e=JSON.parse(storage.getItem(OUTBOX_KEY)||'null');
      if(e && typeof e.id==='string' && typeof e.payload==='string' && typeof e.acknowledged==='boolean')this.entry=e;
    } catch { this.persisted=false; }
  }
  get pending(){return !!this.entry && !this.entry.acknowledged;}
  keep(entry){
    this.entry=entry;
    try {this.storage.setItem(OUTBOX_KEY,JSON.stringify(entry));this.persisted=true;}
    catch {this.persisted=false;}
    return entry;
  }
  enqueue(payload){
    if(this.entry?.payload===payload)return this.persisted?this.entry:this.keep(this.entry);
    return this.keep({id:this.makeId(),payload,acknowledged:false});
  }
  acknowledge(id){
    if(this.entry?.id!==id)return false;
    // A late response in this tab cannot clear a newer queued copy in another.
    if(this.persisted){
      try {if(JSON.parse(this.storage.getItem(OUTBOX_KEY)||'null')?.id!==id)return false;}catch{}
    }
    this.keep({...this.entry,acknowledged:true});return true;
  }
}
