// Connection: explicit local edits, independent of remote reads or clock skew.
// Replayed edits carry the same sequence, so a lost acknowledgement cannot
// reassert an old untick or old setting over another device's later change.
import { mergeDayGuides } from '../guide-archive.js?v=57';
import { mergePersonal } from '../daily-lines.js?v=57';
import { mergeSelections } from '../feedback.js?v=57';
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = v => v === undefined ? undefined : structuredClone(v);
const safe = key => typeof key === 'string' && !['__proto__', 'prototype', 'constructor'].includes(key);
const same = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (!plain(a) || !plain(b)) return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && same(a[k], b[k]));
};
const calendarFields = new Set(['poem', 'story', 'essay', 'missed']);
const weeklyFields = new Set(['submitted', 'grade', 'title']);
export function validIntentPath(path) {
  if (!Array.isArray(path) || path.some(k => !safe(k))) return false;
  if (path[0] === 'days') return /^\d{4}-\d{2}-\d{2}$/.test(path[1]) && ((path.length === 3 && calendarFields.has(path[2])) || (path.length === 4 && ['picks', 'ids'].includes(path[2]) && ['poem', 'story', 'essay'].includes(path[3])));
  if (path[0] === 'weeks') return path.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(path[1]) && weeklyFields.has(path[2]);
  if (path[0] === 'cabinPickerInstructions') return path.length === 2 && path[1] === 'lastCheck';
  if (path[0] !== 'headset') return false;
  if (path[1] === 'controls') return path.length === 3;
  if (path[1] !== 'reading') return false;
  if (path[2] === 'last') return path.length === 3;
  return path.length === 4 && path[2] === 'places' && /^[a-z0-9-]{1,180}$/.test(path[3]);
}
function mutableFields(state) {
  const out = new Map();
  const add = (path, value, edition) => { if (value !== undefined && validIntentPath(path)) out.set(JSON.stringify(path), { path, value: clone(value), ...(edition ? { edition } : {}) }); };
  for (const [date, day] of Object.entries(state?.days || {})) {
    for (const field of calendarFields) add(['days', date, field], day?.[field], field === 'missed' ? null : day?.ids?.[field]);
    for (const field of ['picks', 'ids']) for (const kind of ['poem', 'story', 'essay']) add(['days', date, field, kind], day?.[field]?.[kind]);
  }
  for (const [date, week] of Object.entries(state?.weeks || {})) for (const field of weeklyFields) add(['weeks', date, field], week?.[field]);
  for (const [key, value] of Object.entries(state?.headset?.controls || {})) add(['headset', 'controls', key], value);
  add(['headset', 'reading', 'last'], state?.headset?.reading?.last);
  for (const [key, value] of Object.entries(state?.headset?.reading?.places || {})) add(['headset', 'reading', 'places', key], value);
  add(['cabinPickerInstructions', 'lastCheck'], state?.cabinPickerInstructions?.lastCheck);
  return out;
}
export function mutableState(state) {
  const result = {};
  for (const { path, value } of mutableFields(state).values()) {
    let target = result;
    for (const key of path.slice(0, -1)) target = target[key] ||= {};
    target[path.at(-1)] = clone(value);
  }
  return result;
}
export function collectIntents(record, current) {
  if (!record || !Number.isSafeInteger(record.sequence) || record.sequence < 0 || !Array.isArray(record.pending)) throw Error('The saved connection needs recovery');
  const previous = mutableFields(record.observed), fields = mutableFields(current), pending = new Map(record.pending.map(op => [JSON.stringify(op.path), clone(op)]));
  let sequence = record.sequence;
  for (const [key, field] of fields) if (!same(field.value, previous.get(key)?.value) || field.edition !== previous.get(key)?.edition) {
    if (sequence >= Number.MAX_SAFE_INTEGER) throw Error('The saved connection needs recovery');
    pending.set(key, { ...field, sequence: ++sequence });
  }
  // Missing history is not a deletion. Intentional removals use existing
  // explicit false/null or the feedback/draft timestamped tombstones.
  return { ...clone(record), sequence, observed: mutableState(current), pending: [...pending.values()] };
}
export function observeRemote(record, actualLocalState) {
  // Caller must use the adoption journal before changing local state, so a
  // process interruption cannot turn a received update into a new local edit.
  return { ...clone(record), observed: mutableState(actualLocalState) };
}
export function acknowledgeIntents(record, sequence) {
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > record.sequence) throw Error('The connection gave an unreadable acknowledgement');
  return { ...clone(record), pending: record.pending.filter(op => op.sequence > sequence) };
}
export function mergeWithIntents(local, remote, operations, seenSequence, mergeProgress) {
  if (!Number.isSafeInteger(seenSequence) || seenSequence < 0 || !Array.isArray(operations) || operations.length > 20000) throw Error('Invalid changes');
  const seenPaths = new Set(), seenCounters = new Set();
  for (const op of operations) {
    const key = JSON.stringify(op?.path);
    if (!validIntentPath(op?.path) || !Number.isSafeInteger(op.sequence) || op.sequence < 1 || op.value === undefined || seenPaths.has(key) || seenCounters.has(op.sequence)) throw Error('Invalid changes');
    if (op.edition !== undefined && (!/^[a-z0-9-]{1,120}$/.test(op.edition) || op.path[0] !== 'days' || op.path.length !== 3 || !['poem', 'story', 'essay'].includes(op.path[2]))) throw Error('Invalid changes');
    seenPaths.add(key); seenCounters.add(op.sequence);
  }
  const { headset: localHeadset, ...lp } = local;
  if (!remote) return { state: clone(local), sequence: Math.max(seenSequence, ...operations.map(op => op.sequence)) };
  const { headset: remoteHeadset, ...rp } = remote;
  const state = mergeProgress(lp, rp);
  // Calendar and headset values change only through an explicit new local
  // action. Other fields keep the established edition/feedback/reward rules.
  for (const [date, day] of Object.entries(state.days || {})) for (const field of calendarFields) {
    if (Object.hasOwn(remote.days?.[date] || {}, field)) day[field] = remote.days[date][field]; else delete day[field];
  }
  for (const [date, day] of Object.entries(state.days || {})) for (const field of ['picks', 'ids']) {
    if (remote.days?.[date]?.[field] !== undefined) day[field] = clone(remote.days[date][field]); else delete day[field];
  }
  for (const [date, week] of Object.entries(state.weeks || {})) for (const field of weeklyFields) {
    if (Object.hasOwn(remote.weeks?.[date] || {}, field)) week[field] = remote.weeks[date][field]; else delete week[field];
  }
  if (remoteHeadset !== undefined) state.headset = clone(remoteHeadset);
  if (state.cabinPickerInstructions) {
    if (remote.cabinPickerInstructions?.lastCheck !== undefined) state.cabinPickerInstructions.lastCheck = clone(remote.cabinPickerInstructions.lastCheck); else delete state.cabinPickerInstructions.lastCheck;
  }
  const pending = operations.filter(op => op.sequence > seenSequence).sort((a, b) => a.sequence - b.sequence);
  // Establish the exact selections before applying edition-bound ticks from
  // the same atomic request. An old piece cannot mark a newly swapped one read.
  const bound = op => op.path[0] === 'days' && op.path.length === 3 && ['poem', 'story', 'essay'].includes(op.path[2]);
  for (const op of [...pending.filter(op => !bound(op)), ...pending.filter(bound)]) {
    if (op.edition && state.days?.[op.path[1]]?.ids?.[op.path[2]] !== op.edition) continue;
    let target = state;
    for (const key of op.path.slice(0, -1)) { if (!plain(target[key])) target[key] = {}; target = target[key]; }
    target[op.path.at(-1)] = clone(op.value);
  }
  for (const [date, day] of Object.entries(state.days || {})) for (const other of [local.days?.[date], remote.days?.[date]]) {
    mergeDayGuides(day, other); mergePersonal(day, other); mergeSelections(day, other);
  }
  return { state, sequence: Math.max(seenSequence, ...operations.map(op => op.sequence)) };
}
