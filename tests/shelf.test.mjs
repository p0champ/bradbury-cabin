import test from "node:test";
import assert from "node:assert/strict";
import { resolveDay, shelfDays, pastWork, shelfButtons, shelfHit, dayButtons, paintShelf, paintShelfDay, DAYS_PER_PAGE } from "../shelf-panel.js";
import { validProgress } from "../progress.js";
import { mergeProgress } from "../drive.js";
import { SOURCE_CATALOGUE } from "../source-catalogue.js";

const find = (id) => SOURCE_CATALOGUE.find((w) => w.id === id);
const tiger = find("william-blake-experience-the-tiger");
const stockings = find("kate-chopin-a-pair-of-silk-stockings");
const travel = find("francis-bacon-of-travel");
const label = (w) => `${w.title} — ${w.author}`;
const base = (days) => ({ version: 1, start: "2026-10-18", trackingSince: "2026-10-18", days, weeks: {} });

test("a past day resolves by saved ID, else by an exact title match, else stays out of the cabin", () => {
  const p = base({
    "2026-10-28": { ids: { poem: tiger.id }, picks: { story: label(stockings), essay: "The Death of the Moth — Virginia Woolf" }, story: true },
  });
  const [poem, story, essay] = resolveDay(p, "2026-10-28", SOURCE_CATALOGUE);
  assert.equal(poem.work.id, tiger.id, "a saved ID opens its edition when the day has no label for it");
  assert.equal(story.work.id, stockings.id);
  assert.equal(story.read, true);
  assert.equal(essay.work, null, "a work outside the catalogue is never opened");
  assert.equal(essay.label, "The Death of the Moth — Virginia Woolf");
});
test("labels match regardless of case and quote style, but never ambiguously or across kinds", () => {
  const upper = base({ "2026-10-20": { picks: { story: `${stockings.title.toLowerCase()} — ${stockings.author}` } } });
  assert.equal(resolveDay(upper, "2026-10-20", SOURCE_CATALOGUE)[0].work.id, stockings.id);
  // Two works with the same title and author: a label alone must not choose.
  const twins = [{ ...tiger, id: "twin-a" }, { ...tiger, id: "twin-b" }];
  assert.equal(resolveDay(base({ "2026-10-20": { picks: { poem: label(tiger) } } }), "2026-10-20", twins)[0].work, null);
  // Blake's two Introductions differ only by the book label; the bare title matches neither.
  const bare = base({ "2026-10-20": { picks: { poem: "INTRODUCTION — William Blake" } } });
  assert.equal(resolveDay(bare, "2026-10-20", SOURCE_CATALOGUE)[0].work, null);
  const wrongKind = base({ "2026-10-20": { ids: { poem: stockings.id } } });
  assert.equal(resolveDay(wrongKind, "2026-10-20", SOURCE_CATALOGUE)[0].work, null);
  const unknownId = base({ "2026-10-20": { ids: { essay: "no-such-work" } } });
  assert.equal(resolveDay(unknownId, "2026-10-20", SOURCE_CATALOGUE)[0].work, null);
});
test("the shelf lists earlier days with picks, newest first, never today or future", () => {
  const p = base({
    "2026-10-21": { picks: { poem: "x — y" } }, "2026-10-25": { poem: true },
    "2026-10-27": { ids: { essay: travel.id } }, "2026-10-28": { picks: { poem: label(tiger) } },
    "2026-10-30": { picks: { poem: label(tiger) } },
  });
  assert.deepEqual(shelfDays(p, "2026-10-28"), ["2026-10-27", "2026-10-21"]);
});
test("a past work keeps the id it had on its day and is a separate copy of the edition", () => {
  const w = pastWork("2026-10-28", "poem", tiger);
  assert.equal(w.id, `today-2026-10-28-poem-${tiger.id}`);
  assert.equal(w.today, false);
  assert.equal(w.shelfDate, "2026-10-28");
  assert.deepEqual(w.blocks, tiger.blocks);
  w.blocks[0].lines[0].text = "CHANGED";
  assert.notEqual(tiger.blocks[0].lines[0].text, "CHANGED");
});
test("shelf pages hold six days with Earlier and Later only where they lead somewhere", () => {
  const days = Array.from({ length: 13 }, (_, i) => `2026-10-${String(30 - i).padStart(2, "0")}`);
  const ids = (page) => shelfButtons(days, page).map((b) => b.id);
  assert.equal(ids(0).filter((id) => id.startsWith("shelfday:")).length, DAYS_PER_PAGE);
  assert.ok(ids(0).includes("shelf-earlier") && !ids(0).includes("shelf-later"));
  assert.ok(ids(1).includes("shelf-earlier") && ids(1).includes("shelf-later"));
  assert.deepEqual(ids(2).filter((id) => id.startsWith("shelfday:")), ["shelfday:2026-10-18"]);
  assert.ok(!ids(2).includes("shelf-earlier"));
  for (const page of [0, 1, 2]) {
    const buttons = shelfButtons(days, page);
    for (const [i, a] of buttons.entries()) {
      assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= 2048 && a.y + a.h <= 2560, a.id);
      for (const b of buttons.slice(i + 1))
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} overlaps ${b.id}`);
    }
  }
  const first = shelfButtons(days, 0)[1];
  assert.equal(shelfHit(first.x + 10, first.y + 10, days, 0), "shelfday:2026-10-30");
});
test("a day page offers only works the cabin holds", () => {
  const entries = resolveDay(base({ "2026-10-21": { picks: { poem: "The Guest House — Rumi", story: label(stockings) } } }), "2026-10-21", SOURCE_CATALOGUE);
  assert.deepEqual(dayButtons(entries).map((b) => b.id), ["day-back", "pastwork:story"]);
});
test("saved IDs are validated and survive a Drive merge", () => {
  const ok = base({ "2026-10-28": { ids: { poem: tiger.id } } });
  assert.equal(validProgress(ok), true);
  for (const bad of [{ poem: 5 }, { song: tiger.id }, { poem: "Bad ID!" }, ["x"]])
    assert.equal(validProgress(base({ "2026-10-28": { ids: bad } })), false, JSON.stringify(bad));
  const local = { ...base({ "2026-10-28": { poem: true } }), savedAt: "2026-10-28T20:00:00Z" };
  const remote = { ...base({ "2026-10-28": { ids: { poem: tiger.id } } }), savedAt: "2026-10-28T19:00:00Z" };
  assert.deepEqual(mergeProgress(local, remote).days["2026-10-28"].ids, { poem: tiger.id });
});
function fakeCtx() {
  const drawn = [];
  const check = (...n) => { for (const v of n) assert.ok(Number.isFinite(v), "finite geometry"); };
  return {
    drawn, font: "40px Arial", textAlign: "left", fillStyle: "",
    measureText(t) { return { width: String(t).length * (parseFloat(/(\d+)px/.exec(this.font)[1]) * 0.55) }; },
    fillText(t, x, y) { check(x, y); drawn.push(t); },
    fillRect(x, y, w, h) { check(x, y, w, h); }, beginPath() {}, rect() {}, roundRect(x, y, w, h) { check(x, y, w, h); }, fill() {},
  };
}
const colours = { bg: "#000", ink: "#111", muted: "#222", card: "#333", accent: "#444", gold: "#555", serif: "Literata", italic: "" };
test("the shelf and a day page paint safely when empty, full or long", () => {
  const empty = fakeCtx();
  paintShelf(empty, { days: [], page: 0, entriesFor: () => [], hover: null, c: colours });
  assert.ok(empty.drawn.includes("Each day's three will gather here."));
  const p = base({ "2026-10-27": { ids: { poem: tiger.id, story: stockings.id, essay: travel.id }, poem: true, story: true, essay: true } });
  const full = fakeCtx();
  paintShelf(full, { days: shelfDays(p, "2026-10-28"), page: 0, entriesFor: (d) => resolveDay(p, d, SOURCE_CATALOGUE), hover: null, c: colours });
  assert.ok(full.drawn.includes("✓  All three read"));
  const day = fakeCtx();
  paintShelfDay(day, { date: "2026-10-27", entries: resolveDay(p, "2026-10-27", SOURCE_CATALOGUE), hover: null, c: colours });
  assert.ok(day.drawn.includes(tiger.title) && day.drawn.includes("✓  Read"));
  assert.ok(day.drawn.some((t) => t.startsWith("Day 10")));
});
test("a saved ID that disagrees with the day's own label never opens", () => {
  const p = base({ "2026-10-20": { picks: { poem: label(find("william-blake-innocence-introduction")) }, ids: { poem: tiger.id }, poem: true } });
  const [poem] = resolveDay(p, "2026-10-20", SOURCE_CATALOGUE);
  assert.equal(poem.work.id, "william-blake-innocence-introduction", "the label's own work, not the stray ID");
});
test("a Drive merge keeps labels and IDs as a pair", () => {
  const older = { ...base({ "2026-10-20": { picks: { poem: label(tiger) }, ids: { poem: tiger.id } } }), savedAt: "2026-10-20T08:00:00Z" };
  const swapped = { ...base({ "2026-10-20": { picks: { poem: label(find("william-blake-innocence-introduction")) } } }), savedAt: "2026-10-20T09:00:00Z" };
  assert.equal(mergeProgress(older, swapped).days["2026-10-20"].ids, undefined, "no stray ID from a different pick");
  const same = { ...base({ "2026-10-20": { picks: { poem: label(tiger) } } }), savedAt: "2026-10-20T09:00:00Z" };
  assert.deepEqual(mergeProgress(older, same).days["2026-10-20"].ids, { poem: tiger.id });
  const bare = { ...base({ "2026-10-20": { poem: true } }), savedAt: "2026-10-20T09:00:00Z" };
  const merged = mergeProgress(bare, older).days["2026-10-20"];
  assert.deepEqual([merged.picks, merged.ids], [{ poem: label(tiger) }, { poem: tiger.id }]);
});
test("a day with empty picks is not a shelf row, and the shelf shows the Drive note", () => {
  assert.deepEqual(shelfDays(base({ "2026-10-20": { picks: {} }, "2026-10-21": { ids: {} } }), "2026-10-28"), []);
  // The app's real notices are longer than one line; every word must show.
  for (const note of ["Saved selections need source-backed replacements. Sync with Drive, then ask Claude for today's three.",
    "Claude's latest selections failed the source checks. Ask Claude for today's three again; the reasons are now in Drive."]) {
    const ctx = fakeCtx();
    paintShelf(ctx, { days: [], page: 0, entriesFor: () => [], hover: null, note, c: colours });
    const i = ctx.drawn.findIndex((t) => note.startsWith(t) && t.length > 10);
    assert.equal(ctx.drawn.slice(i, i + 2).join(" "), note);
  }
});
