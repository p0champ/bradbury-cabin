// Optional notes travel with the day's exact source edition. They never
// supply literary text, choose another edition, or erase reading ticks.
import { normalizeGuide } from "./study-guide.js?v=57";
import { misquote } from "./picks.js?v=57";
import { SOURCE_CATALOGUE } from "./source-catalogue.js?v=57";

const KINDS = ["poem", "story", "essay"];
const labelKey = s => String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stamp = s => typeof s === "string" && /^\d{4}-\d\d-\d\dT/.test(s) && Number.isFinite(Date.parse(s)) ? Date.parse(s) : 0;
const plain = v => !!v && typeof v === "object" && !Array.isArray(v);

export function matchesDay(day, kind, work) {
  if (!day || !work || work.kind !== kind) return false;
  if (day.ids?.[kind] && day.ids[kind] !== work.id) return false;
  if (day.picks?.[kind] && labelKey(day.picks[kind].replace(" — ", " ")) !== labelKey(`${work.title} ${work.author}`)) return false;
  return true;
}

export function archivedGuide(work, record) {
  if (!plain(record) || record.catalogueId !== work.id ||
      !work.sourceEdition?.bodySha256 || record.bodySha256 !== work.sourceEdition.bodySha256) return null;
  const guide = normalizeGuide(record.guide);
  return guide && !misquote(work, guide) ? guide : null;
}

export function dayGuide(day, kind, work) {
  return matchesDay(day, kind, work) ? archivedGuide(work, day?.guides?.[kind]) : null;
}

// onlyMissing is used for cached/old files: never substitute a day's picks or
// overwrite newer saved notes. Accepted current picks may replace selections.
export function rememberGuides(progress, date, works, { savedAt = `${date}T00:00:00.000Z`, onlyMissing = false } = {}) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(works)) return false;
  const parsedDate = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return false;
  let changed = false;
  const day = progress.days[date] || {};
  for (const incoming of works) {
    const kind = incoming.kind;
    const work = SOURCE_CATALOGUE.find(w => w.id === (incoming.catalogueId || incoming.id) && w.kind === kind);
    if (!work || !KINDS.includes(kind) || (onlyMissing && !matchesDay(day, kind, work))) continue;
    const old = day.guides?.[kind];
    const prior = archivedGuide(work, old);
    if (onlyMissing && prior) continue;
    const guide = normalizeGuide(incoming.guide);
    if (guide && misquote(work, guide)) continue;
    const nextGuide = guide || prior;
    const label = `${work.title} — ${work.author}`;
    day.picks ||= {};
    day.ids ||= {};
    if (day.picks[kind] !== label || day.ids[kind] !== work.id) changed = true;
    day.picks[kind] = label;
    day.ids[kind] = work.id;
    if (!nextGuide) {
      if (day.guides?.[kind]) { delete day.guides[kind]; changed = true; }
      continue;
    }
    // A resync of the same notes does not make them newer than a real revision.
    if (prior && JSON.stringify(prior) === JSON.stringify(nextGuide)) continue;
    const record = { catalogueId: work.id, bodySha256: work.sourceEdition.bodySha256,
      savedAt: stamp(savedAt) ? savedAt : `${date}T00:00:00.000Z`, guide: nextGuide };
    day.guides = plain(day.guides) ? day.guides : {};
    day.guides[kind] = record;
    changed = true;
  }
  if (changed) progress.days[date] = day;
  return changed;
}

// A later tick on an old device must not overwrite a newer guide revision.
// Conversely, notes for a swapped work must never follow a different pick.
export function mergeDayGuides(day, other) {
  const result = {};
  for (const kind of KINDS) {
    const a = day.guides?.[kind], b = other?.guides?.[kind];
    const records = [a, b].filter(r => {
      const w = SOURCE_CATALOGUE.find(w => w.id === r?.catalogueId && w.kind === kind);
      return w && matchesDay(day, kind, w) && archivedGuide(w, r);
    });
    records.sort((x, y) => stamp(y.savedAt) - stamp(x.savedAt));
    if (records[0]) result[kind] = structuredClone(records[0]);
  }
  if (Object.keys(result).length) day.guides = result;
  else delete day.guides;
}

export function missingGuideKinds(day) {
  return KINDS.filter(kind => {
    const work = day.ids?.[kind] ? SOURCE_CATALOGUE.find(w => w.id === day.ids[kind] && w.kind === kind)
      : SOURCE_CATALOGUE.find(w => w.kind === kind && labelKey(`${w.title} ${w.author}`) === labelKey(String(day.picks?.[kind] || "").replace(" — ", " ")));
    return work && matchesDay(day, kind, work) && !dayGuide(day, kind, work);
  });
}
