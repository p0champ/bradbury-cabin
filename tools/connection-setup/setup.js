import { ManagedLink, finishConnectionReturn, CONNECTION_KEY, CONNECTION_DEVICE_KEY, CONNECTION_RESULT_KEY } from '/managed-drive.js';
import { DriveLink, preloadGoogle } from '/drive.js';
import { GoogleRecovery } from '/connection/google-recovery.js';
import { EditJournal } from '/connection/edit-journal.js';
import { GOOGLE_CLIENT_ID } from '/config.js';
import { CONNECTION_URL } from '/config.js';
import { validProgress } from '/progress.js';
const $ = id => document.getElementById(id);
const returned = await finishConnectionReturn({ url: CONNECTION_URL });
if (returned.handled) {
  $('status').textContent = returned.message;
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  if (returned.connected) window.close();
} else {
  const link = new ManagedLink({ url: CONNECTION_URL }); let backup = null; const direct = new DriveLink({clientId:GOOGLE_CLIENT_ID, identity:true}); preloadGoogle();
  const paint = () => { $('check').disabled = !link.connected; $('disconnect').disabled = !link.connected; $('download').disabled = !backup; $('fallback').disabled = !backup || !link.ownerSubject; };
  const run = async action => {
    for (const button of document.querySelectorAll('button')) button.disabled = true;
    try { await action(); } catch { $('status').textContent = 'The check did not finish. Your existing progress is kept; please return to the chat.'; }
    finally { $('connect').disabled = false; paint(); }
  };
  $('connect').onclick = () => run(async () => { await link.signIn(); $('status').textContent = 'Connected. The private check is ready.'; });
  $('check').onclick = () => run(async () => {
    const result = await link.api('connection-check', { body: {} });
    if (result.renewed !== true || result.safeConditional !== true || result.cleanup !== true) throw Error('Incomplete connection check');
    const text = await link.read('progress.json');
    if (text === null || !validProgress(JSON.parse(text))) throw Error('No complete original backup');
    backup = text;
    const state = JSON.parse(text), days = Object.keys(state.days).length, places = Object.keys(state.headset?.reading?.places || {}).length;
    $('status').textContent = 'Google renewal passed. Safe file updates passed. The disposable file was removed. Your complete backup was read from private storage.';
    $('summary').textContent = `${days} recorded days; ${places} saved reading places. The existing Google progress file was left untouched.`;
  });
  $('fallback').onclick = () => run(async () => {
    if (!direct.connected) await direct.signIn();
    const journal = new EditJournal(localStorage), snapshot = JSON.parse(backup);
    journal.initialise(snapshot); journal.persist({...journal.record,initialClaimed:true,joined:true});
    link.journal = journal;
    const copies = new GoogleRecovery(direct,journal,{ownerSubject:link.ownerSubject,deviceId:localStorage.getItem(CONNECTION_DEVICE_KEY)});
    const envelope = await link.prepareRecovery({payload:backup,id:crypto.randomUUID()});
    await copies.save(envelope);
    const restored = await copies.readProgress();
    if (!validProgress(restored)) throw Error('Incomplete safety backup');
    const after = JSON.parse(await link.read('progress.json'));
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    const data = value => {const{savedAt,cabinPickerInstructions,cabinRecoveryCursor,...personal}=value;return JSON.stringify(canonical(personal));};
    if (data(snapshot)!==data(after)) throw Error('The restored backup did not match');
    $('status').textContent='The Google safety copy was recovered. Checking the normal Google backup too…';
    const deadline=Date.now()+90000;let current;
    do {
      current=await link.refreshStatus();
      if(current.driveCurrent)break;
      if(current.mirrorProblem?.code==='drive_changed'||Date.now()>deadline)throw Error('The normal Google backup was not confirmed');
      await new Promise(resolve=>setTimeout(resolve,1500));
    } while(true);
    const google=await copies.readProgress();
    if(data(snapshot)!==data(current.state)||data(snapshot)!==data(google))throw Error('The complete Google backup did not match');
    backup=JSON.stringify(current.state);
    $('status').textContent='The complete tap-to-Sync copy was saved, read back and recovered. The normal Google backup was checked too. Your reading data matches.';
    $('summary').textContent='Your existing reading history, thoughts, drafts, places and settings were preserved.';
  });
  $('download').onclick = () => {
    if (!backup) return;
    const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = 'bradbury-complete-owner-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('disconnect').onclick = () => run(async () => {
    await link.api('disconnect', { body: {} }); link.token = null; backup = null;
    for (const key of [CONNECTION_KEY, CONNECTION_DEVICE_KEY, CONNECTION_RESULT_KEY]) localStorage.removeItem(key);
    $('status').textContent = 'This setup page is disconnected. Your private backups and Google connection are kept.'; $('summary').textContent = '';
  });
  paint();
}
