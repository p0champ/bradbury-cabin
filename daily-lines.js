import { personalLine } from "./picks.js?v=35";
import { SOURCE_CATALOGUE } from "./source-catalogue.js?v=35";
const KINDS = ["poem", "story", "essay"];
const catalogueId = w => w.catalogueId || w.id;
const time = s => typeof s === "string" && Number.isFinite(Date.parse(s)) ? Date.parse(s) : 0;
const ids = works => Object.fromEntries(works.map(w => [w.kind, catalogueId(w)]));

function matching(record, works) {
  return record && Array.isArray(works) && works.length === 3 && KINDS.every(kind => {
    const w = works.find(w => w.kind === kind);
    return w && record.ids?.[kind] === catalogueId(w) &&
      w.sourceEdition?.bodySha256 && record.bodySha256s?.[kind] === w.sourceEdition.bodySha256;
  });
}
export function personalFor(day, works) {
  const record = day?.personal;
  if (!matching(record, works) || !KINDS.every(k => day.ids?.[k] === record.ids[k])) return { dedication: null, thread: null };
  return { dedication: personalLine(record.dedication, 70, works), thread: personalLine(record.thread, 160, works) };
}
export function rememberPersonal(progress, date, parsed, { onlyMissing = false, savedAt = `${date}T00:00:00.000Z` } = {}) {
  const day = progress.days[date], works = parsed?.works;
  if (!day || !Array.isArray(works) || works.length !== 3 || !KINDS.every(k => day.ids?.[k] === catalogueId(works.find(w => w.kind === k) || {}))) return false;
  if (onlyMissing && matching(day.personal, works)) return false;
  const next = {
    ids: ids(works), bodySha256s: Object.fromEntries(works.map(w => [w.kind, w.sourceEdition.bodySha256])),
    dedication: personalLine(parsed.personal?.dedication, 70, works),
    thread: personalLine(parsed.personal?.thread, 160, works),
    savedAt: time(savedAt) ? savedAt : `${date}T00:00:00.000Z`,
  };
  // Explicit empty fields are retained as a revision, preventing old-device
  // sync from resurrecting wording the newest picks file omitted or failed.
  if (JSON.stringify(day.personal) === JSON.stringify(next)) return false;
  day.personal = next;
  return true;
}
export function mergePersonal(day, other) {
  const works = KINDS.map(k => SOURCE_CATALOGUE.find(w => w.id === day.ids?.[k] && w.kind === k)).filter(Boolean);
  const records = [day.personal, other?.personal].filter(r => matching(r, works));
  records.sort((a, b) => time(b.savedAt) - time(a.savedAt));
  const r = records[0];
  if (!r) { delete day.personal; return; }
  day.personal = {
    ids: ids(works), bodySha256s: Object.fromEntries(works.map(w => [w.kind, w.sourceEdition.bodySha256])),
    dedication: personalLine(r.dedication, 70, works), thread: personalLine(r.thread, 160, works), savedAt: r.savedAt,
  };
}
// A replaced work is unread, even when the previous choice in that slot was
// read. Otherwise a new trio could reveal its closing reflection prematurely.
export function clearReplacedTicks(day, works) {
  const key = s => String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  for (const w of works) {
    const same = day.ids?.[w.kind] ? day.ids[w.kind] === catalogueId(w)
      : day.picks?.[w.kind] && key(day.picks[w.kind]) === key(`${w.title} — ${w.author}`);
    if (day[w.kind] === true && (day.ids?.[w.kind] || day.picks?.[w.kind]) && !same) day[w.kind] = false;
  }
}
