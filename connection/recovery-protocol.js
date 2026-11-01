// Google recovery copies never contain account credentials or replace progress.json.
import { validProgress } from '../progress.js?v=57';
import { mergeProgress } from '../drive.js?v=57';
import { mergeWithIntents } from './managed-intents.js?v=57';
export const RECOVERY_PREFIX = 'cabin-recovery-';
export const MAX_RECOVERY_BYTES = 10_000_000;
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
const requestId = value => typeof value === 'string' && /^[A-Za-z0-9-]{8,100}$/.test(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = () => Error('An earlier Google backup needs checking; your saved readings are kept');
export const recoveryName = envelope => `${RECOVERY_PREFIX}${envelope.device}-${envelope.requestId}.json`;
export function checkedRecovery(text, metadata) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_RECOVERY_BYTES) throw failure();
  let value, state; try { value = JSON.parse(text); state = JSON.parse(value.payload); } catch { throw failure(); }
  if (!plain(value) || value.version !== 1 || !/^[a-f0-9]{64}$/.test(value.device || '') || !requestId(value.requestId) || !Number.isSafeInteger(value.sequence) || value.sequence < 0 || typeof value.payload !== 'string' || new TextEncoder().encode(value.payload).length > 8_000_000 || !validProgress(state) || !Array.isArray(value.operations) || value.operations.length > 20000 || value.operations.some(op => !Number.isSafeInteger(op?.sequence) || op.sequence > value.sequence)) throw failure();
  if (metadata && (!id(metadata.id) || metadata.name !== recoveryName(value))) throw failure();
  if (value.bootstrap !== undefined && typeof value.bootstrap !== 'boolean') throw failure();
  try { mergeWithIntents(state, state, value.operations, value.sequence, mergeProgress); } catch { throw failure(); }
  return { envelope: value, state };
}
export function recoveryTime(value) {
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,19) !== match[1]) throw failure();
  return `${match[1]}.${(match[2] || '').padEnd(9,'0')}Z`;
}
export function checkedCursor(cursor) {
  if (cursor === undefined || cursor === null) return null;
  if (!plain(cursor) || recoveryTime(cursor.at) !== cursor.at || !Array.isArray(cursor.ids) || cursor.ids.length > 4096 || new Set(cursor.ids).size !== cursor.ids.length || cursor.ids.some(value => !id(value))) throw failure();
  return cursor;
}
// Keep old immutable files available without listing years of acknowledged
// backups on every ordinary sync. Include the boundary's whole instant.
// https://developers.google.com/workspace/drive/api/guides/search-files
export function recoveryQuery(cursor) {
  const checked = checkedCursor(cursor);
  return checked ? ` and createdTime >= '${checked.at}'` : '';
}
export function recoveryAfter(file, cursor) {
  if (!id(file?.id) || typeof file.name !== 'string' || !file.name.startsWith(RECOVERY_PREFIX)) throw failure();
  const time = recoveryTime(file.createdTime), checked = checkedCursor(cursor);
  return !checked || time > checked.at || (time === checked.at && !checked.ids.includes(file.id));
}
export function advanceRecovery(cursor, file) {
  checkedCursor(cursor); const at = recoveryTime(file.createdTime);
  if (cursor && at < cursor.at) throw failure();
  return checkedCursor({ at, ids: cursor?.at === at ? [...new Set([...cursor.ids,file.id])] : [file.id] });
}
export function orderedRecovery(files, cursor) {
  if (!Array.isArray(files)) throw failure(); checkedCursor(cursor);
  return files.filter(file => recoveryAfter(file,cursor)).sort((a,b) => recoveryTime(a.createdTime).localeCompare(recoveryTime(b.createdTime)) || a.id.localeCompare(b.id));
}
