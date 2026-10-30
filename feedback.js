// Feedback belongs to an exact catalogue edition, independently of daily ticks.
import { canonicalWorkId, validCompletion } from './progress.js?v=56';
import { SOURCE_CATALOGUE } from './source-catalogue.js?v=56';
import { LIBRARY } from './library.js?v=56';
const plain = v => v && typeof v === 'object' && !Array.isArray(v);
const known = id => SOURCE_CATALOGUE.some(w => w.id === id);
export function feedbackField(id, record, name) {
  const f = record?.[name];
  if (!known(id) || !plain(f) || !validCompletion(id, f.at)) return null;
  if (name === 'stars' && !(f.value === null || Number.isInteger(f.value) && f.value >= 1 && f.value <= 5)) return null;
  if (name === 'thought' && !(f.value === null || typeof f.value === 'string' && f.value.length <= 360 && f.value.trim() && !/[\u0000-\u001f\u007f]/.test(f.value))) return null;
  return { value: f.value, at: f.at };
}
export function feedbackFor(progress, work) {
  const id = canonicalWorkId(work), r = progress.feedback?.[id];
  return { stars: feedbackField(id, r, 'stars')?.value ?? null, thought: feedbackField(id, r, 'thought')?.value ?? '' };
}
export function setFeedback(progress, work, name, value, clock = new Date()) {
  const id = canonicalWorkId(work);
  if (!id || !['stars', 'thought'].includes(name)) return false;
  if (name === 'thought' && typeof value === 'string') value = value.trim().replace(/\s+/g, ' ') || null;
  const field = { value, at: new Date(clock).toISOString() };
  if (!feedbackField(id, { [name]: field }, name)) return false;
  if (!plain(progress.feedback)) progress.feedback = {};
  if (!plain(progress.feedback[id])) progress.feedback[id] = {};
  progress.feedback[id][name] = field;
  return true;
}
// Merge fields separately. Explicit nulls are tombstones: deleting a thought
// must survive an old headset syncing later. Equal timestamps resolve identically.
export function mergeFeedback(a, b) {
  const out = {};
  for (const id of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    for (const name of ['stars', 'thought']) {
      const fields = [feedbackField(id, a?.[id], name), feedbackField(id, b?.[id], name)].filter(Boolean);
      fields.sort((x, y) => y.at.localeCompare(x.at) || JSON.stringify(y.value).localeCompare(JSON.stringify(x.value)));
      if (fields[0]) { out[id] ||= {}; out[id][name] = fields[0]; }
    }
  }
  return out;
}
export function selectionFor(value) {
  if (!plain(value) || !['match', 'stretch', 'explore'].includes(value.mode)) return null;
  if (value.mode !== 'match') return { mode: value.mode };
  if (!known(value.evidenceId) || !['stars', 'thought'].includes(value.basis)) return null;
  return { mode: 'match', evidenceId: value.evidenceId, basis: value.basis };
}
export function whyFor(work, progress) {
  const s = selectionFor(work?.selection);
  if (!s) return 'No reason saved for this pick.';
  if (s.mode === 'explore') return 'An introductory pick while Claude learns your taste.';
  const author = work.author;
  const readAuthors = new Set([...LIBRARY.map(w=>w.author), ...Object.values(progress.days || {}).flatMap(d => Object.values(d.ids || {})).filter(id => id !== canonicalWorkId(work)).map(id => SOURCE_CATALOGUE.find(w => w.id === id)?.author)]);
  for(const day of Object.values(progress.days || {}))for(const label of Object.values(day.picks || {}))if(typeof label==='string' && label.includes(' — ') && label!==`${work.title} — ${work.author}`)readAuthors.add(label.split(' — ').at(-1));
  for (const id of Object.keys(progress.feedback || {})) if (feedbackFor(progress, { id }).stars || feedbackFor(progress, { id }).thought) readAuthors.add(SOURCE_CATALOGUE.find(w => w.id === id)?.author);
  if (s.mode === 'stretch') return readAuthors.has(author) ? 'Picked to explore a different work.' : `A new writer in your recorded reading: ${author}.`;
  const evidence = SOURCE_CATALOGUE.find(w => w.id === s.evidenceId), f = feedbackFor(progress, evidence);
  if (s.basis === 'stars' && f.stars >= 4) return `Picked because you rated ${evidence.title} ${f.stars}/5.`;
  if (s.basis === 'thought' && f.thought) return `Picked using your thought on ${evidence.title}.`;
  return 'The feedback behind this pick is no longer available.';
}
export function rememberSelections(progress, date, works, onlyMissing = false) {
  const day = progress.days[date];
  if (!day) return false;
  if (!plain(day.selections)) day.selections = {};
  let changed = false;
  for (const w of works) {
    if (day.ids?.[w.kind] !== canonicalWorkId(w)) continue;
    if (onlyMissing && day.selections[w.kind]?.catalogueId === canonicalWorkId(w)) continue;
    day.selections[w.kind] = { catalogueId: canonicalWorkId(w), selection: selectionFor(w.selection), at: new Date().toISOString() };
    changed = true;
  }
  return changed;
}
export function mergeSelections(day, other) {
  const result = {};
  for (const kind of ['poem','story','essay']) {
    const id=day.ids?.[kind];
    const records=[day.selections?.[kind],other?.selections?.[kind]].filter(r=>r?.catalogueId===id && known(id) && validCompletion(id,r.at));
    records.sort((a,b)=>b.at.localeCompare(a.at) || JSON.stringify(b.selection ?? null).localeCompare(JSON.stringify(a.selection ?? null)));
    if(records[0])result[kind]={catalogueId:id,selection:selectionFor(records[0].selection),at:records[0].at};
  }
  if(Object.keys(result).length)day.selections=result;else delete day.selections;
}
export function selectionPlan(progress) {
  const kinds=['poem','story','essay'];
  const count=Object.values(progress.days || {}).filter(d=>kinds.every(k=>SOURCE_CATALOGUE.some(w=>w.id===d.ids?.[k] && w.kind===k))).length;
  const matches=count%2===0?2:1, start=Math.floor(count/2)%3;
  return { acceptedTrios:count, matches, stretches:3-matches, slots:Object.fromEntries(kinds.map((k,i)=>[k, (i-start+3)%3 < 3-matches?'stretch':'match'])) };
}
export function archivedSelection(progress, date, work) {
  const r = progress.days[date]?.selections?.[work.kind];
  return r?.catalogueId === canonicalWorkId(work) ? selectionFor(r.selection) : null;
}
