import { ManagedLink, finishConnectionReturn, CONNECTION_KEY, CONNECTION_DEVICE_KEY, CONNECTION_RESULT_KEY } from '/managed-drive.js';
import { CONNECTION_URL } from '/config.js';
import { validProgress } from '/progress.js';
const $ = id => document.getElementById(id);
const returned = await finishConnectionReturn({ url: CONNECTION_URL });
if (returned.handled) {
  $('status').textContent = returned.message;
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  if (returned.connected) window.close();
} else {
  const link = new ManagedLink({ url: CONNECTION_URL }); let backup = null;
  const paint = () => { $('check').disabled = !link.connected; $('disconnect').disabled = !link.connected; $('download').disabled = !backup; };
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
