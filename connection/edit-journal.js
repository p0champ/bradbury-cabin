// Connection metadata is private to this browser, never exported.
import { collectIntents, observeRemote, acknowledgeIntents, mutableState, validIntentPath } from './managed-intents.js?v=57';
import { validProgress } from '../progress.js?v=57';
import { validAnchor } from '../reader.js?v=57';
export const EDIT_JOURNAL_KEY = 'cabin-connection-edits';
const keys = new Set(['cabin-progress', 'cabin-reading', 'cabin-controls', 'cabin-last-check']);
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const validValues = map => plain(map) && Object.keys(map).length > 0 && Object.entries(map).every(([key, value]) => keys.has(key) && (typeof value === 'string' || value === null));
function validAfter(map) {
  if (!validValues(map)) return false;
  for (const [key, raw] of Object.entries(map)) {
    let value; try { value = JSON.parse(raw); } catch { return false; }
    if (key === 'cabin-progress' && !validProgress(value)) return false;
    if (key === 'cabin-controls' && !plain(value)) return false;
    if (key === 'cabin-last-check' && value !== null && !plain(value)) return false;
    if (key === 'cabin-reading' && (!plain(value) || !plain(value.places) || !(value.last === null || typeof value.last === 'string') || Object.values(value.places).some(place => !plain(place) || !validAnchor(place.anchor) || !Number.isInteger(place.page) || place.page < 0))) return false;
  }
  return true;
}
function valid(record) {
  if (!plain(record) || record.version !== 1 || !Number.isSafeInteger(record.sequence) || record.sequence < 0 || !plain(record.observed) || !Array.isArray(record.pending) || record.pending.length > 20000) return false;
  const paths = new Set(), sequences = new Set();
  for (const op of record.pending) {
    if (!validIntentPath(op?.path) || !Number.isSafeInteger(op.sequence) || op.sequence < 1 || op.sequence > record.sequence || op.value === undefined) return false;
    const path = JSON.stringify(op.path);
    if (paths.has(path) || sequences.has(op.sequence)) return false;
    paths.add(path); sequences.add(op.sequence);
  }
  if (record.adoption !== null) {
    const a = record.adoption;
    if (!plain(a) || !validValues(a.before) || !validAfter(a.after) || JSON.stringify(Object.keys(a.before).sort()) !== JSON.stringify(Object.keys(a.after).sort()) || !plain(a.observed)) return false;
  }
  return true;
}
export class EditJournal {
  constructor(storage) {
    this.storage = storage; this.record = null;
    const raw = storage.getItem(EDIT_JOURNAL_KEY);
    if (raw !== null) {
      let record; try { record = JSON.parse(raw); } catch {}
      if (!valid(record)) throw Error('The saved connection needs recovery; your readings are kept');
      this.record = record; this.finishAdoption();
    }
  }
  persist(record) {
    if (!valid(record)) throw Error('The saved connection needs recovery; your readings are kept');
    this.storage.setItem(EDIT_JOURNAL_KEY, JSON.stringify(record));
    this.record = record;
    return structuredClone(record);
  }
  initialise(current) {
    if (this.record) return structuredClone(this.record);
    return this.persist({ version: 1, sequence: 0, pending: [], observed: mutableState(current), adoption: null });
  }
  capture(current) {
    if (!this.record || this.record.adoption) throw Error('The saved connection needs recovery; your readings are kept');
    return this.persist(collectIntents(this.record, current));
  }
  finishAdoption() {
    const adoption = this.record?.adoption;
    if (!adoption) return;
    // Before writing anything, check that an older app or another tab has
    // not made independent edits since the interrupted adoption.
    for (const key of Object.keys(adoption.after)) {
      const value = this.storage.getItem(key);
      if (value !== adoption.before[key] && value !== adoption.after[key]) throw Error('The saved connection needs recovery; your readings are kept');
    }
    for (const [key, value] of Object.entries(adoption.after)) {
      if (value === null) this.storage.removeItem(key); else this.storage.setItem(key, value);
    }
    return this.persist({ ...observeRemote(this.record, adoption.observed), adoption: null });
  }
  adopt(after, actualLocalState) {
    if (!this.record || this.record.adoption || !validAfter(after)) throw Error('The saved connection needs recovery; your readings are kept');
    const before = Object.fromEntries(Object.keys(after).map(key => [key, this.storage.getItem(key)]));
    this.persist({ ...this.record, adoption: { before, after: structuredClone(after), observed: mutableState(actualLocalState) } });
    return this.finishAdoption();
  }
  acknowledge(sequence) {
    if (!this.record || this.record.adoption) throw Error('The saved connection needs recovery; your readings are kept');
    return this.persist(acknowledgeIntents(this.record, sequence));
  }
}
