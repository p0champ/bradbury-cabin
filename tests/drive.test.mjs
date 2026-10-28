import test from "node:test";
import assert from "node:assert/strict";
import { parsePicks, textToBlocks, pickLabels } from "../picks.js";
import { mergeProgress, DriveLink } from "../drive.js";
const poem = "I wandered lonely as a cloud\n  That floats on high o'er vales and hills,\n\nContinuous as the stars that shine";
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
test("a good today.json becomes three works with labels", () => {
  const file = {
    version: 1,
    date: "2026-10-28",
    picks: {
      poem: { title: "Daffodils", author: "William Wordsworth", year: 1807, place: "England", source: "Project Gutenberg", text: poem },
      story: { title: "The Necklace", author: "Guy de Maupassant", year: 1884, text: "Para one.\n\nPara two." },
      essay: { title: "Of Love", author: "Francis Bacon", year: 1625, text: "It is impossible to love, and to be wise." },
    },
  };
  const r = parsePicks(JSON.stringify(file));
  assert.equal(r.date, "2026-10-28");
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.works.map((w) => w.kind), ["poem", "story", "essay"]);
  assert.ok(r.works.every((w) => w.today && w.id.startsWith("today-2026-10-28-")));
  assert.deepEqual(pickLabels(r.works), {
    poem: "Daffodils — William Wordsworth",
    story: "The Necklace — Guy de Maupassant",
    essay: "Of Love — Francis Bacon",
  });
});
test("bad files and bad entries never crash; they are reported", () => {
  assert.deepEqual(parsePicks("{nope").works, []);
  assert.deepEqual(parsePicks({}).works, []);
  const r = parsePicks({ date: "x", picks: { poem: { title: "T" }, story: { title: "S", author: "A", text: "ok" } } });
  assert.equal(r.works.length, 1);
  assert.ok(r.problems.some((p) => /date/.test(p)));
  assert.ok(r.problems.some((p) => /poem/.test(p)));
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
    if (url.includes("/files/OLD?alt=media")) return ok('{"date":"2026-10-27","picks":{"poem":{"title":"P","author":"A","text":"x"}}}');
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

test("today's file wins over a newer malformed or older file; non-picks files are ignored", async () => {
  const listed = [
    { id: "BAD", name: "picks-2026-10-28-2.json", size: "10" },
    { id: "GOOD", name: "picks-2026-10-28.json", size: "100" },
    { id: "NOTE", name: "picks notes.json", size: "10" },
  ];
  const body = { BAD: "{oops", GOOD: '{"date":"2026-10-28","picks":{"essay":{"title":"E","author":"B","text":"t"}}}' };
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
  assert.equal(got.parsed.works[0].title, "E");
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
test("a swapped pick gets a new id, so it starts at the beginning", () => {
  const a = parsePicks({ date: "2026-10-28", picks: { poem: { title: "One", author: "A", text: "x" } } });
  const b = parsePicks({ date: "2026-10-28", picks: { poem: { title: "Two", author: "A", text: "x" } } });
  assert.notEqual(a.works[0].id, b.works[0].id);
});

test("among today's files the most complete wins; older files are not all downloaded", async () => {
  const listed = [
    { id: "TWO", name: "picks-2026-10-28-2.json", size: "10" },
    { id: "THREE", name: "picks-2026-10-28.json", size: "10" },
    { id: "Y1", name: "picks-2026-10-27.json", size: "10" },
    { id: "Y2", name: "picks-2026-10-26.json", size: "10" },
  ];
  const w = (k) => `"${k}":{"title":"${k}","author":"A","text":"t"}`;
  const body = {
    TWO: `{"date":"2026-10-28","picks":{${w("poem")},${w("story")}}}`,
    THREE: `{"date":"2026-10-28","picks":{${w("poem")},${w("story")},${w("essay")}}}`,
    Y1: `{"date":"2026-10-27","picks":{${w("poem")}}}`,
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
  assert.equal((await d.readPicksFor("2026-10-28", parsePicks)).parsed.works.length, 3);
  opened.length = 0;
  const old = await d.readPicksFor("2026-10-29", parsePicks);
  assert.equal(old.parsed.date, "2026-10-28");
  assert.ok(opened.length <= 2, "stops once it has the newest older picks: " + opened);
});
