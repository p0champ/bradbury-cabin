import test from "node:test";
import assert from "node:assert/strict";
import { rememberGuides, archivedGuide, dayGuide, mergeDayGuides } from "../guide-archive.js";
import { SOURCE_CATALOGUE } from "../source-catalogue.js";
import { LIBRARY } from "../library.js";
import { pastWork } from "../shelf-panel.js";
import { mergeProgress, DriveLink } from "../drive.js";
import { readProgress, validProgress } from "../progress.js";
const work = SOURCE_CATALOGUE.find(w => w.kind === "story" && !LIBRARY.some(x => x.id === w.id));
const other = SOURCE_CATALOGUE.find(w => w.kind === "story" && w.id !== work.id && !LIBRARY.some(x => x.id === w.id));
const date = "2026-10-27";
const guide = { context: ["Look closely at the language."], notice: ["Notice the rhythm."], themes: ["Consider the ending."], questions: ["Which detail stayed with you?"] };
const base = () => ({ version: 1, start: "2026-10-18", trackingSince: "2026-10-18", days: {}, weeks: {} });
const incoming = (w = work, notes = guide) => ({ ...w, catalogueId: w.id, guide: notes });
const archive = (w = work, savedAt = "2026-10-27T12:00:00Z", notes = guide) => {
  const p = base(); rememberGuides(p, date, [incoming(w, notes)], { savedAt }); return p;
};
test("notes reopen with the same day's edition after storage, without changing literary text or ticks", () => {
  const p = archive(); p.days[date].story = true;
  const loaded = JSON.parse(JSON.stringify(p));
  assert.equal(validProgress(loaded), true);
  const opened = pastWork(date, "story", work, loaded.days[date]);
  assert.deepEqual(opened.guide, guide);
  assert.deepEqual(opened.blocks, work.blocks);
  assert.equal(loaded.days[date].story, true);
  opened.guide.context[0] = "Changed local copy";
  assert.equal(loaded.days[date].guides.story.guide.context[0], guide.context[0]);
});
test("wrong work, changed edition, malformed records and misquoted notes never attach", () => {
  const p = archive(), record = p.days[date].guides.story;
  for (const bad of [null, [], "bad", { ...record, catalogueId: other.id }, { ...record, bodySha256: "0".repeat(64) },
    { ...record, guide: { context: ['The narrator says "These words do not exist in this story".'] } }])
    assert.equal(archivedGuide(work, bad), null);
  const switched = { ...p.days[date], ids: { story: other.id } };
  assert.equal(dayGuide(switched, "story", work), null);
  assert.equal(dayGuide(p.days[date], "poem", work), null);
});
test("cache backfill never changes a swapped selection or overwrites existing notes", () => {
  const p = archive();
  assert.equal(rememberGuides(p, date, [incoming(other)], { onlyMissing: true }), false);
  assert.equal(p.days[date].ids.story, work.id);
  const changed = { ...guide, context: ["Different notes"] };
  assert.equal(rememberGuides(p, date, [incoming(work, changed)], { onlyMissing: true }), false);
  assert.deepEqual(dayGuide(p.days[date], "story", work), guide);
  assert.equal(rememberGuides(p, "2026-02-31", [incoming()]), false);
  assert.equal(p.days["2026-02-31"], undefined);
});
test("a swap cannot carry old notes, while re-syncing without notes preserves matching ones", () => {
  const p = archive();
  rememberGuides(p, date, [incoming(work, null)]);
  assert.deepEqual(dayGuide(p.days[date], "story", work), guide);
  rememberGuides(p, date, [incoming(other, null)]);
  assert.equal(p.days[date].ids.story, other.id);
  assert.equal(dayGuide(p.days[date], "story", other), null);
});
test("guide revision time survives a later tick from an older device", () => {
  const old = archive(work, "2026-10-27T09:00:00Z");
  old.savedAt = "2026-10-28T20:00:00Z"; old.days[date].story = true;
  const revised = archive(work, "2026-10-27T14:00:00Z", { ...guide, context: ["Revised notes"] });
  revised.savedAt = "2026-10-27T14:00:00Z";
  const merged = mergeProgress(old, revised);
  assert.equal(merged.days[date].story, true);
  assert.deepEqual(dayGuide(merged.days[date], "story", work).context, ["Revised notes"]);
  const swapped = archive(other); swapped.savedAt = "2026-10-29T00:00:00Z";
  assert.equal(dayGuide(mergeProgress(old, swapped).days[date], "story", work), null);
});
test("malformed optional notes do not discard otherwise valid reading progress", () => {
  const p = archive(); p.days[date].story = true; p.days[date].guides = ["broken"];
  const loaded = readProgress({ getItem: () => JSON.stringify(p) }, "2026-10-28");
  assert.equal(loaded.recovered, false);
  assert.equal(loaded.progress.days[date].story, true);
  assert.equal(pastWork(date, "story", work, loaded.progress.days[date]).guide, null);
  mergeDayGuides(loaded.progress.days[date], null);
  assert.equal(loaded.progress.days[date].guides, undefined);
});
test("automatic Drive recovery uses only the newest historical file and only recorded selections", async () => {
  const p = base();
  p.days[date] = { ids: { story: work.id }, picks: { story: `${work.title} — ${work.author}` }, story: true };
  const kinds = ["poem", "story", "essay"];
  const picked = kinds.map(k => k === "story" ? work : SOURCE_CATALOGUE.find(w => w.kind === k && !LIBRARY.some(x => x.id === w.id)));
  const file = { version: 2, date, picks: Object.fromEntries(picked.map(w => [w.kind, { catalogueId: w.id, guide }])) };
  const calls = [];
  const d = new DriveLink({ clientId: "x", storage: { getItem: () => null }, fetchFn: async url => {
    calls.push(url);
    const listing = { files: [{ id: "NEW", name: `picks-${date}-2.json`, size: "1000", createdTime: "2026-10-27T12:00:00Z" }, { id: "OLD", name: `picks-${date}.json`, size: "1000" }] };
    return { ok: true, status: 200, json: async () => listing, text: async () => JSON.stringify(file) };
  } });
  d.token = "fake"; d.expires = Date.now() + 3600000; d.folderId = "F";
  const { parsePicks } = await import("../picks.js");
  assert.equal(await d.recoverGuides(p, "2026-10-28", parsePicks), 1);
  assert.deepEqual(dayGuide(p.days[date], "story", work), guide);
  assert.equal(p.days[date].ids.poem, undefined, "recovery must not invent unrecorded choices");
  assert.ok(calls.some(u => u.includes("/NEW?")) && !calls.some(u => u.includes("/OLD?")));
  assert.equal(p.days[date].story, true);
});

test("oversized downloaded histories cannot starve older notes; metadata scans are bounded and resume", async () => {
  const p = base(), dates = Array.from({ length: 13 }, (_, i) => `2026-10-${String(27 - i).padStart(2, "0")}`);
  for (const d of dates) p.days[d] = { ids: { story: work.id } };
  const selected = ["poem", "story", "essay"].map(k => k === "story" ? work : SOURCE_CATALOGUE.find(w => w.kind === k && !LIBRARY.some(x => x.id === w.id)));
  const file = { version: 2, date: dates.at(-1), picks: Object.fromEntries(selected.map(w => [w.kind, { catalogueId: w.id, guide }])) };
  let downloads = 0;
  const d = new DriveLink({ clientId: "x", storage: { getItem: () => null }, fetchFn: async url => {
    const date = /picks-(\d{4}-\d{2}-\d{2})/.exec(decodeURIComponent(url))?.[1];
    return { ok: true, status: 200,
      json: async () => ({ files: [{ id: date, name: `picks-${date}.json`, size: "10" }] }),
      text: async () => { downloads++; return url.includes(dates.at(-1)) ? JSON.stringify(file) : "x".repeat(1_500_001); } };
  } });
  d.token = "fake"; d.expires = Date.now() + 3600000; d.folderId = "F";
  const { parsePicks } = await import("../picks.js");
  assert.equal(await d.recoverGuides(p, "2026-10-28", parsePicks), 0);
  assert.equal(downloads, 12);
  assert.ok(dates.slice(0, 12).every(date => p.days[date].guideRecovery));
  assert.equal(await d.recoverGuides(p, "2026-10-28", parsePicks), 1);
  assert.equal(downloads, 13, "old oversized revisions were not re-downloaded");
  assert.deepEqual(dayGuide(p.days[dates.at(-1)], "story", work), guide);
  const many = base();
  for (let i = 1; i <= 27; i++) many.days[`2026-09-${String(i).padStart(2, "0")}`] = { ids: { story: work.id } };
  let scans = [];
  d.fetch = async url => { scans.push(decodeURIComponent(url)); return { ok: true, status: 200, json: async () => ({ files: [] }) }; };
  await d.recoverGuides(many, "2026-10-28", parsePicks);
  assert.equal(scans.length, 24);
  const last = many.guideRecoveryCursor;
  scans = [];
  await d.recoverGuides(many, "2026-10-28", parsePicks);
  assert.ok(scans[0].includes('picks-2026-09-03'), last + " continuation reaches older days");
});
