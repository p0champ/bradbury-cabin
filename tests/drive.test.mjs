import test from "node:test";
import assert from "node:assert/strict";
import { parsePicks, textToBlocks, pickLabels } from "../picks.js";
import { mergeProgress, DriveLink, READ_SCOPE_MISSING } from "../drive.js";
import { SOURCE_CATALOGUE } from "../source-catalogue.js";
import { LIBRARY } from "../library.js";
import { withPickerContract } from "../picker-contract.js";
import { readFileSync } from "node:fs";
const shelf = new Set(LIBRARY.map(w => w.id));
const originals = Object.fromEntries(["poem", "story", "essay"].map(k => [k, SOURCE_CATALOGUE.find(w => w.kind === k && !shelf.has(w.id))]));
const ref = k => ({ catalogueId: originals[k].id });
const daily = (kinds = ["poem", "story", "essay"], date = "2026-10-28") => ({ version: 2, date, picks: Object.fromEntries(kinds.map(k => [k, ref(k)])) });
const poem = "I wandered lonely as a cloud\n  That floats on high o'er vales and hills,\n\nContinuous as the stars that shine";
test("Drive carries the complete maintained workflow first, replacing stale instructions without losing progress", () => {
  const progress = base("2026-10-28T20:00:00Z", { "2026-10-28": { poem: true } });
  progress.cabinPickerInstructions = { version: 1, workflow: "OLD TEXT IMPORT FORMAT" };
  const verdict = { accepted: false, problems: ["story has no matching verified edition"] };
  const raw = withPickerContract(JSON.stringify(progress), verdict);
  const sent = JSON.parse(raw), { cabinPickerInstructions: c, ...saved } = sent;
  const { cabinPickerInstructions: old, ...expected } = progress;
  assert.deepEqual(saved, expected);
  assert.equal(Object.keys(sent)[0], "cabinPickerInstructions");
  assert.equal(c.version, 2);
  assert.equal(c.protocol, "bradbury-daily-three/v2");
  assert.equal(c.timezone, "Europe/Berlin");
  assert.equal(c.workflow, readFileSync(new URL("../CLAUDE_SKILL_DAILY_THREE.md", import.meta.url), "utf8").replace(/\r\n/g, "\n"));
  assert.deepEqual(c.lastCheck, verdict);
  assert.ok(c.workflow.includes("disableConversionToGoogleType"));
  assert.ok(c.workflow.includes("download_file_content"));
  assert.ok(c.workflow.includes("catalogueId"));
  assert.ok(!raw.includes("OLD TEXT IMPORT FORMAT"));
  assert.deepEqual(c.catalogue.map(w => w.catalogueId), SOURCE_CATALOGUE.map(w => w.id));
  assert.ok(c.catalogue.every(w => !('blocks' in w) && !('text' in w)));
});
test("both initial and subsequent Drive writes include the current workflow and current rejection reasons", async () => {
  const bodies = [];
  const d = new DriveLink({ clientId: "x", storage: { getItem: () => null }, fetchFn: async (url, init = {}) => {
    if (init.body) bodies.push(init.body);
    const data = url.includes("uploadType=multipart") ? { id: "P" } : { files: [] };
    return { ok: true, status: 200, json: async () => data };
  } });
  d.token = "fake"; d.expires = Date.now() + 3600000; d.folderId = "F";
  await d.writeProgress(JSON.stringify(base("2026-10-28T20:00:00Z", {})));
  assert.ok(bodies[0].includes('"workflow":'));
  d.lastCheck = { accepted: false, problems: ["essay needs a checked source"] };
  await d.writeProgress(JSON.stringify(base("2026-10-28T20:01:00Z", {})));
  const update = JSON.parse(bodies[1]);
  assert.equal(update.cabinPickerInstructions.lastCheck.problems[0], "essay needs a checked source");
  assert.ok(update.cabinPickerInstructions.workflow.includes("guide"));
  assert.equal(update.savedAt, "2026-10-28T20:01:00Z");
});
test("poem text keeps lines, stanzas and indents", () => {
  const b = textToBlocks("poem", poem);
  assert.equal(b.length, 2);
  assert.equal(b[0].lines[1].text, "That floats on high o'er vales and hills,");
  assert.equal(b[0].lines[1].indent, 1);
  assert.equal(b[1].lines[0].text, "Continuous as the stars that shine");
});
test("prose text joins wrapped lines into paragraphs", () => {
  const b = textToBlocks("story", "One line\nwrapped here.\r\n\r\nSecond para.\n\n\n");
  assert.deepEqual(b, [
    { type: "para", text: "One line wrapped here." },
    { type: "para", text: "Second para." },
  ]);
});
test("catalogue references become canonical originals with separate notes", () => {
  const file = daily();
  file.picks.poem.guide = { context: "Original notes" };
  const r = parsePicks(JSON.stringify(file));
  assert.equal(r.date, file.date);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.works.map(w => w.kind), ["poem", "story", "essay"]);
  for (const work of r.works) {
    assert.deepEqual(work.blocks, originals[work.kind].blocks);
    assert.deepEqual(work.sourceEdition, originals[work.kind].sourceEdition);
    assert.equal(work.id, `today-${file.date}-${work.kind}-${originals[work.kind].id}`);
  }
  assert.deepEqual(pickLabels(r.works), Object.fromEntries(Object.entries(originals).map(([k,w]) => [k, `${w.title} — ${w.author}`])));
  assert.deepEqual(r.works[0].guide.context, ["Original notes"]);
});
test("changed, missing and forged model text never enters the reader", () => {
  for (const text of ["CHANGED WORDS", "", "Missing ending", undefined]) {
    const file = daily(["story"]);
    Object.assign(file.picks.story, { text, verified: true, sha256: "forged", blocks: [{type:"para",text:"FORGED"}], source: "https://fake.invalid" });
    const work = parsePicks(file).works[0];
    assert.deepEqual(work.blocks, originals.story.blocks);
    assert.equal(work.source, originals.story.source);
  }
});
test("legacy exact metadata replaces unsafe text with the verified edition", () => {
  const p = originals.story;
  const file = { version: 1, date: "2026-10-28", picks: { story: { title:p.title, author:p.author, text:"WRONG", source:"fake" } } };
  assert.deepEqual(parsePicks(file).works[0].blocks, p.blocks);
  file.picks.story.text = "x".repeat(150001);
  const tooLong = parsePicks(file);
  assert.equal(tooLong.works.length, 0);
  assert.match(tooLong.problems[0], /limit/);
});
test("unknown, mismatched and unverified references fail closed with partial errors", () => {
  const cases = [
    { version:1, picks:{story:{title:"Unverified",author:"Unknown",text:"full text",verified:true}} },
    { version:2, picks:{story:{catalogueId:"unknown",verified:true}} },
    { version:2, picks:{story:ref("poem")} },
    { version:2, picks:{story:{...ref("story"),title:"Wrong title"}} },
    { version:2, picks:{story:{...ref("story"),author:"Wrong author"}} },
  ];
  for (const bad of cases) {
    const result = parsePicks({ date:"2026-10-28", ...bad });
    assert.equal(result.works.length, 0);
    assert.ok(result.problems.length);
  }
  const partial = daily(["poem"]);
  partial.picks.story = {catalogueId:"unknown"};
  assert.equal(parsePicks(partial).works.length, 1);
  assert.match(parsePicks(partial).problems[0], /story/);
});
test("cached files are checked afresh and cannot mutate the catalogue", () => {
  const file = JSON.stringify(daily(["story"]));
  const a = parsePicks(file);
  a.works[0].blocks[0].text = "MUTATED";
  assert.deepEqual(parsePicks(file).works[0].blocks, originals.story.blocks);
  assert.deepEqual(parsePicks('{"date":"2026-10-28","picks":{"story":{"text":"fake","verified":true}}}').works, []);
});
test("bad files and bad entries never crash; they are reported", () => {
  assert.deepEqual(parsePicks("{nope").works, []);
  assert.deepEqual(parsePicks({}).works, []);
  const file = daily(["story"], "x");
  file.picks.poem = { catalogueId:"unknown" };
  const r = parsePicks(file);
  assert.equal(r.works.length, 1);
  assert.ok(r.problems.some(p => /date/.test(p)));
  assert.ok(r.problems.some(p => /poem/.test(p)));
});
test("impossible dates are rejected, not rolled over", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-10-28T00:00", 20261028, null]) {
    const r = parsePicks(daily(["story"], date));
    assert.equal(r.date, null);
    assert.ok(r.problems.some(p => /date/.test(p)));
  }
});
test("a work given on an earlier day is refused, whatever its title case", () => {
  const w = originals.story;
  const days = { "2026-10-20": { picks: { story: `${w.title.toUpperCase()} — ${w.author}` } } };
  const r = parsePicks(daily(), days);
  assert.deepEqual(r.works.map(x => x.kind), ["poem", "essay"]);
  assert.match(r.problems[0], /story was already given on 2026-10-20/);
  // Today's own entry (a re-sync of the same file) is not a repeat.
  assert.equal(parsePicks(daily(), { "2026-10-28": days["2026-10-20"] }).works.length, 3);
});
test("guide quotations must be the edition's exact words", () => {
  const words = originals.story.blocks[0].text.split(" ");
  const exact = words.slice(0, 6).join(" ");
  const later = words.slice(10, 14).join(" ");
  const ok = (guide) => parsePicks({ ...daily(["story"]), picks: { story: { ...ref("story"), guide } } });
  assert.equal(ok({ notice: [`Notice “${exact}” at the start.`] }).works.length, 1);
  assert.equal(ok({ notice: [`See "${exact} ... ${later}".`] }).works.length, 1);
  assert.equal(ok({ notice: ["Titles like \"Ode\" and a two-word \"short quote\" pass."] }).works.length, 1);
  const altered = [words[0], words[1], "CHANGED", ...words.slice(3, 6)].join(" ");
  for (const bad of [altered, words.slice(0, 6).reverse().join(" "), `${later} ... ${exact}`]) {
    const r = ok({ themes: `As the narrator says, "${bad}".` });
    assert.equal(r.works.length, 0, bad);
    assert.match(r.problems[0], /misquote/);
  }
  // Ordinary quoting habits are accepted when the words are exact.
  const lower = exact[0].toLowerCase() + exact.slice(1);
  assert.equal(ok({ notice: [`It begins with "${lower}".`] }).works.length, 1);
  assert.equal(ok({ notice: [`See "${exact} . . . ${later}".`] }).works.length, 1);
  assert.equal(ok({ notice: [`The title "${originals.story.title}" matters.`] }).works.length, 1);
  const verse = originals.poem.blocks[0].lines.slice(0, 2).map(l => l.text);
  const poemRef = (guide) => parsePicks({ ...daily(["poem"]), picks: { poem: { ...ref("poem"), guide } } });
  assert.equal(poemRef({ notice: [`Read "${verse.join(" / ")}" aloud.`] }).works.length, 1);
  assert.equal(poemRef({ notice: [`Read "${verse.join(" / ")} and more" aloud.`] }).works.length, 0);
});
test("every published catalogue work carries an independent critic acceptance", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const verdicts = JSON.parse(readFileSync(new URL("../tools/critic/verdicts.json", import.meta.url), "utf8")).verdicts;
  // Python json.dumps(sort_keys=True, ensure_ascii=False) with default separators.
  const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(", ") + "]"
    : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ": " + canon(v[k])).join(", ") + "}"
    : JSON.stringify(v);
  assert.ok(SOURCE_CATALOGUE.length > 0);
  for (const w of SOURCE_CATALOGUE) {
    const v = verdicts[w.id];
    assert.equal(v?.status, "accepted", w.id);
    assert.equal(createHash("sha256").update(canon(w.blocks)).digest("hex"), v.blocksSha256, w.id);
  }
});
const base = (savedAt, days, weeks = {}) => ({ version: 1, start: "2026-10-18", trackingSince: "2026-10-28", days, weeks, savedAt });
test("merging keeps ticks from both sides and lets the newer copy untick", () => {
  const local = base("2026-10-28T10:00:00Z", { "2026-10-28": { poem: true } });
  const remote = base("2026-10-28T09:00:00Z", { "2026-10-27": { essay: true }, "2026-10-28": { story: true } });
  const m = mergeProgress(local, remote);
  assert.deepEqual(m.days["2026-10-28"], { poem: true, story: true });
  assert.deepEqual(m.days["2026-10-27"], { essay: true });
  const untick = base("2026-10-28T11:00:00Z", { "2026-10-28": { poem: false } });
  assert.equal(mergeProgress(untick, local).days["2026-10-28"].poem, false);
  assert.equal(mergeProgress(local, null), local);
});
test("merging keeps the earliest tracking start and weekly submissions", () => {
  const a = { ...base("2026-10-29T00:00:00Z", {}), trackingSince: "2026-10-29" };
  const b = { ...base("2026-10-28T00:00:00Z", {}, { "2026-11-01": { submitted: true } }), trackingSince: "2026-10-28" };
  const m = mergeProgress(a, b);
  assert.equal(m.trackingSince, "2026-10-28");
  assert.equal(m.weeks["2026-11-01"].submitted, true);
});
test("Drive link reads picks from the folder and creates progress.json once", async () => {
  const calls = [];
  const files = { folder: "F1", today: "T1" };
  const fetchFn = async (url, init = {}) => {
    calls.push([init.method || "GET", url]);
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
    if (url.includes("files?q=")) {
      const q = decodeURIComponent(url);
      if (q.includes("Bradbury Cabin")) return ok({ files: [{ id: files.folder }] });
      if (q.includes("progress.json")) return ok({ files: [] });
      if (q.includes("in parents")) return ok({ files: [
        { id: "OLD", name: "picks-2026-10-27.json", size: "50" },
        { id: "X", name: "notes.txt", size: "5" },
      ] });
    }
    if (url.includes("/files/OLD?alt=media")) return ok(JSON.stringify(daily(["poem"], "2026-10-27")));
    if (url.includes("uploadType=multipart")) return ok({ id: "P1" });
    if (url.includes("uploadType=media")) return ok({});
    return { ok: false, status: 404 };
  };
  const mem = new Map();
  const d = new DriveLink({ clientId: "x", fetchFn, storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
  d.token = "tok";
  d.expires = Date.now() + 3600e3;
  const got = await d.readPicksFor("2026-10-28", parsePicks);
  assert.equal(got.parsed.date, "2026-10-27", "falls back to the newest valid file and says it is old");
  assert.equal(await d.read("progress.json"), null);
  await d.writeProgress("{}");
  assert.equal(d.progressId, "P1");
  await d.writeProgress("{}");
  assert.ok(calls.some(([m, u]) => m === "PATCH" && u.includes("/files/P1?uploadType=media")), "second write updates in place");
});
test("an expired Google session is reported, never used", async () => {
  const d = new DriveLink({ clientId: "x", fetchFn: async () => ({ ok: false, status: 401 }), storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  await assert.rejects(d.readPicksFor("2026-10-28", parsePicks), /Not signed in/);
  d.token = "t";
  d.expires = Date.now() + 3600e3;
  await assert.rejects(d.readPicksFor("2026-10-28", parsePicks), /expired/);
  assert.equal(d.connected, false);
});

test("a malformed newest file is refused rather than silently replaced with older picks", async () => {
  const listed = [
    { id: "BAD", name: "picks-2026-10-28-2.json", size: "10" },
    { id: "GOOD", name: "picks-2026-10-28.json", size: "100" },
    { id: "NOTE", name: "picks notes.json", size: "10" },
  ];
  const body = { BAD: "{oops", GOOD: JSON.stringify(daily(["essay"])) };
  const fetchFn = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => b });
    const q = decodeURIComponent(url);
    if (q.includes("Bradbury Cabin")) return ok({ files: [{ id: "F" }] });
    if (q.includes("in parents")) return ok({ files: listed });
    const id = /files\/(\w+)\?alt/.exec(url)?.[1];
    return ok(body[id]);
  };
  const d = new DriveLink({ clientId: "x", fetchFn, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  d.token = "t";
  d.expires = Date.now() + 3600e3;
  const got = await d.readPicksFor("2026-10-28", parsePicks);
  assert.equal(got.parsed.works.length, 0);
  assert.ok(got.parsed.problems.length);
  assert.equal(got.raw, null);
});
test("concurrent progress writes never create two files", async () => {
  let creates = 0;
  const fetchFn = async (url, init = {}) => {
    const ok = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => "" });
    await new Promise((r) => setTimeout(r, 20));
    const q = decodeURIComponent(url);
    if (q.includes("Bradbury Cabin") && !init.method) return ok({ files: [{ id: "F" }] });
    if (q.includes("progress.json")) return ok({ files: [] });
    if (url.includes("uploadType=multipart")) {
      creates++;
      return ok({ id: "P" });
    }
    return ok({});
  };
  const d = new DriveLink({ clientId: "x", fetchFn, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  d.token = "t";
  d.expires = Date.now() + 3600e3;
  await Promise.all([d.writeProgress("{}"), d.writeProgress("{}"), d.writeProgress("{}")]);
  assert.equal(creates, 1);
});
test("a swapped catalogue pick starts with a separate edition id", () => {
  const poems = SOURCE_CATALOGUE.filter(w => w.kind === "poem");
  assert.ok(poems.length >= 2);
  const a = parsePicks({version:2,date:"2026-10-28",picks:{poem:{catalogueId:poems[0].id}}});
  const b = parsePicks({version:2,date:"2026-10-28",picks:{poem:{catalogueId:poems[1].id}}});
  assert.notEqual(a.works[0].id, b.works[0].id);
});

test("the newest file is authoritative even when incomplete; older files are not downloaded", async () => {
  const listed = [
    { id: "TWO", name: "picks-2026-10-28-2.json", size: "10" },
    { id: "THREE", name: "picks-2026-10-28.json", size: "10" },
    { id: "Y1", name: "picks-2026-10-27.json", size: "10" },
    { id: "Y2", name: "picks-2026-10-26.json", size: "10" },
  ];
  const body = {
    TWO: JSON.stringify(daily(["poem", "story"])),
    THREE: JSON.stringify(daily()),
    Y1: JSON.stringify(daily(["poem"], "2026-10-27")),
  };
  const opened = [];
  const fetchFn = async (url) => {
    const ok = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => b });
    const q = decodeURIComponent(url);
    if (q.includes("Bradbury Cabin")) return ok({ files: [{ id: "F" }] });
    if (q.includes("in parents")) return ok({ files: listed });
    const id = /files\/(\w+)\?alt/.exec(url)[1];
    opened.push(id);
    return ok(body[id]);
  };
  const d = new DriveLink({ clientId: "x", fetchFn, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  d.token = "t";
  d.expires = Date.now() + 3600e3;
  assert.equal((await d.readPicksFor("2026-10-28", parsePicks)).parsed.works.length, 2);
  assert.deepEqual(opened, ["TWO"]);
  opened.length = 0;
  const old = await d.readPicksFor("2026-10-29", parsePicks);
  assert.equal(old.parsed.date, "2026-10-28");
  assert.deepEqual(opened, ["TWO"], "never downloads an older substitute");
  // A file dated after today (a wrong date from Claude) is never opened or used.
  listed.unshift({ id: "FUTURE", name: "picks-2026-10-30.json", size: "10" });
  body.FUTURE = JSON.stringify(daily(undefined, "2026-10-30"));
  opened.length = 0;
  const now = await d.readPicksFor("2026-10-28", parsePicks);
  assert.equal(now.parsed.date, "2026-10-28");
  assert.deepEqual(opened, ["TWO"]);
});

// Google's consent screen lets people untick drive.readonly. Then the cabin
// only sees its own files and Claude's picks are invisible: say so, and ask
// again with the full consent screen.
test("a partial Google grant is refused and the next sign-in asks for consent", async () => {
  const prompts = [];
  let scope = "https://www.googleapis.com/auth/drive.file";
  globalThis.document = { querySelector: () => true };
  globalThis.google = {
    accounts: { oauth2: { initTokenClient: (cfg) => ({ requestAccessToken: (o) => {
      prompts.push(o.prompt);
      cfg.callback({ access_token: "t", expires_in: 3600, scope });
    } }) } },
  };
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const d = new DriveLink({ clientId: "x", storage });
  await assert.rejects(d.signIn(), (e) => e.message === READ_SCOPE_MISSING);
  assert.equal(d.connected, false);
  assert.equal(mem.size, 0);
  scope = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file";
  await d.signIn();
  assert.deepEqual(prompts, ["", "consent"]);
  assert.equal(d.connected, true);
  assert.equal(new DriveLink({ clientId: "x", storage }).connected, true);
  delete globalThis.google;
  delete globalThis.document;
});

test("a token saved by an older build (no read flag) is not reused", () => {
  const saved = JSON.stringify({ token: "old", expires: Date.now() + 3e6 });
  const d = new DriveLink({ clientId: "x", storage: { getItem: () => saved, setItem() {}, removeItem() {} } });
  assert.equal(d.connected, false);
});
test("catalogue titles are unique per author, so a repeat check never blocks a different work", () => {
  const keys = SOURCE_CATALOGUE.map(w => `${w.author}|${w.title.toLowerCase()}`);
  assert.equal(new Set(keys).size, keys.length);
  const [a, b] = ["william-blake-innocence-introduction", "william-blake-experience-introduction"].map(id => SOURCE_CATALOGUE.find(w => w.id === id));
  const days = { "2026-10-20": { picks: { poem: `${a.title} — ${a.author}` } } };
  const r = parsePicks({ version: 2, date: "2026-10-28", picks: { poem: { catalogueId: b.id } } }, days);
  assert.deepEqual(r.problems, []);
});
test("starter-shelf works are refused as daily picks", () => {
  const r = parsePicks({ version: 2, date: "2026-10-28", picks: { story: { catalogueId: "ohenry-magi" } } });
  assert.equal(r.works.length, 0);
  assert.match(r.problems[0], /starter shelf/);
});
test("a Blake note may quote its own edition heading without the book label", () => {
  const w = SOURCE_CATALOGUE.find(x => x.id === "william-blake-innocence-a-cradle-song");
  const r = parsePicks({ version: 2, date: "2026-10-28", picks: { poem: { catalogueId: w.id, guide: { context: 'Blake\'s "A Cradle Song" is gentle.' } } } });
  assert.deepEqual(r.problems, []);
});
