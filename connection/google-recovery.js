// Tap-to-Sync safety copy: immutable files, never a second progress.json writer.
import { checkedRecovery, recoveryName, orderedRecovery, recoveryQuery, MAX_RECOVERY_BYTES } from './recovery-protocol.js?v=57';
import { mergeManagedState } from './managed-state.js?v=57';
import { mergeProgress } from '../drive.js?v=57';
import { validProgress } from '../progress.js?v=57';
const API='https://www.googleapis.com/drive/v3',UPLOAD='https://www.googleapis.com/upload/drive/v3';
const fileId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(id);
const sha=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function textOf(response,limit=MAX_RECOVERY_BYTES){
  if(Number(response.headers.get('Content-Length'))>limit)throw Error('The complete backup could not be checked; your readings are kept');
  const reader=response.body?.getReader();if(!reader)throw Error('The complete backup could not be checked; your readings are kept');
  const parts=[];let count=0;try{for(;;){const{value,done}=await reader.read();if(done)break;count+=value.byteLength;if(count>limit){await reader.cancel();throw Error('The complete backup could not be checked; your readings are kept');}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(count);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export class GoogleRecovery {
  constructor(drive,journal,{ownerSubject,deviceId,now=()=>new Date()}={}){this.drive=drive;this.journal=journal;this.ownerSubject=ownerSubject;this.deviceId=deviceId;this.now=now;this.queue=Promise.resolve();this.verifiedToken=null;}
  async verifyOwner(){
    if(!/^[A-Za-z0-9_-]{1,255}$/.test(this.ownerSubject||''))throw Error('The cabin needs its first account check before using this backup; your readings are kept');
    if(this.verifiedToken===this.drive.token&&this.verifiedSubject===this.ownerSubject&&this.drive.connected)return;
    const profile=JSON.parse(await textOf(await this.drive.call('https://openidconnect.googleapis.com/v1/userinfo'),64000));
    if(profile.email_verified!==true||profile.sub!==this.ownerSubject){this.drive.signOut();throw Error('Choose the Google account you used for the cabin. Your saved readings are kept');}
    this.verifiedToken=this.drive.token;
    this.verifiedSubject=this.ownerSubject;
  }
  async listRecovery(cursor){const folder=await this.drive.folder();if(!folder)return[];return this.drive.listFiles(`'${folder}' in parents and trashed = false and name contains 'cabin-recovery-'${recoveryQuery(cursor)}`,'id,name,size,createdTime','createdTime asc',1000);}
  async readProgress(){
    await this.verifyOwner();const original=await this.drive.read('progress.json');let combined=null;
    if(original!==null){try{combined=JSON.parse(original);}catch{}if(!validProgress(combined))throw Error('The Google backup needs recovery; it has been left untouched and your readings are kept');}
    const cursor=combined?.cabinRecoveryCursor;
    const pending=orderedRecovery(await this.listRecovery(cursor),cursor);
    // The latest complete copy per device contains that device's still-pending
    // edits. Earlier immutable copies remain on Google for recovery.
    const latest=new Map();for(const file of pending){const match=/^cabin-recovery-([a-f0-9]{64})-/.exec(file.name);if(!match)throw Error('An earlier Google backup needs checking; your readings are kept');latest.set(match[1],file);}
    const selected=pending.filter(file=>[...latest.values()].some(last=>last.id===file.id));
    if(selected.length>16)throw Error('The Google backups need checking; your existing readings are kept');
    for(const file of selected){if(Number(file.size)>MAX_RECOVERY_BYTES)throw Error('The complete Google backup is too large; nothing was cut');const{state}=checkedRecovery(await textOf(await this.drive.call(`${API}/files/${file.id}?alt=media`)),file);combined=combined?mergeManagedState(combined,state,null,mergeProgress):state;}
    if(combined&&cursor!==undefined)combined.cabinRecoveryCursor=cursor;
    return combined;
  }
  save(envelope){const run=this.queue.then(()=>this.saveOne(envelope));this.queue=run.catch(()=>{});return run;}
  async saveOne(envelope){
    await this.verifyOwner();const wire=JSON.stringify(envelope);checkedRecovery(wire);
    if(await sha(this.deviceId)!==envelope.device)throw Error('The saved account needs checking; your readings are kept');
    const fingerprint=await sha(wire);let copy=this.journal.record.googleRecovery?.[envelope.requestId];
    if(copy&&copy.digest!==fingerprint)throw Error('The earlier backup identity needs checking; your readings are kept');
    if(copy?.verified===true)return structuredClone(copy);
    const retain=value=>{const copies={...(this.journal.record.googleRecovery||{}),[envelope.requestId]:value};for(const key of Object.keys(copies).slice(0,-32))delete copies[key];this.journal.persist({...this.journal.record,googleRecovery:copies});copy=value;};
    if(!copy){const reserved=JSON.parse(await textOf(await this.drive.call(`${API}/files/generateIds?count=1&space=drive&type=files`),64000));if(!Array.isArray(reserved.ids)||reserved.ids.length!==1||!fileId(reserved.ids[0]))throw Error('Google did not prepare the backup; your readings are kept');retain({id:reserved.ids[0],digest:fingerprint,verified:false});}
    if(!fileId(copy.id))throw Error('The earlier backup needs checking; your readings are kept');
    const read=async()=>textOf(await this.drive.call(`${API}/files/${copy.id}?alt=media`));let existing;
    try{existing=await read();}catch(error){if(error.status!==404)throw error;}
    if(existing===undefined){const folder=await this.drive.folder();if(!folder)throw Error('Ask Claude for the daily three first; your readings are kept');const boundary='cabin'+crypto.randomUUID().replaceAll('-',''),metadata={id:copy.id,name:recoveryName(envelope),parents:[folder],mimeType:'application/json'};
      const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${wire}\r\n--${boundary}--`;
      await this.drive.call(`${UPLOAD}/files?uploadType=multipart&fields=id`,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});existing=await read();}
    if(existing!==wire)throw Error('Google did not confirm the complete backup; your readings are kept');
    retain({...copy,verified:true,at:this.now().toISOString()});return structuredClone(copy);
  }
}
