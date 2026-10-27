import test from "node:test";
import assert from "node:assert/strict";
import {
  seedProgress, dayStatus, toggleTick, toggleWeekly, streak, overview,
  monthGrid, weekSunday, loadProgress, saveProgress, PROGRESS_KEY,
  readProgress, validProgress,
} from "../progress.js";
const TODAY = "2026-10-28";
test("seed holds only the stated facts", () => {
  const p = seedProgress(TODAY);
  assert.equal(dayStatus(p, "2026-10-18", TODAY), "complete");
  assert.equal(dayStatus(p, "2026-10-21", TODAY), "missed");
  for (const k of ["2026-10-19", "2026-10-20", "2026-10-22", "2026-10-27"])
    assert.equal(dayStatus(p, k, TODAY), "unrecorded", k);
  assert.equal(dayStatus(p, TODAY, TODAY), "open");
  assert.equal(dayStatus(p, "2026-10-29", TODAY), "future");
  assert.equal(dayStatus(p, "2026-10-17", TODAY), "before");
  assert.match(p.days["2026-10-21"].picks.poem, /Guest House/);
});
test("a day is complete only with all three ticks", () => {
  const p = seedProgress(TODAY);
  toggleTick(p, TODAY, "poem", TODAY);
  assert.equal(dayStatus(p, TODAY, TODAY), "partial");
  toggleTick(p, TODAY, "story", TODAY);
  assert.equal(dayStatus(p, TODAY, TODAY), "partial");
  toggleTick(p, TODAY, "essay", TODAY);
  assert.equal(dayStatus(p, TODAY, TODAY), "complete");
  toggleTick(p, TODAY, "essay", TODAY);
  assert.equal(dayStatus(p, TODAY, TODAY), "partial");
});
test("future and pre-challenge days cannot be ticked", () => {
  const p = seedProgress(TODAY);
  assert.equal(toggleTick(p, "2026-10-29", "poem", TODAY), false);
  assert.equal(toggleTick(p, "2026-10-17", "poem", TODAY), false);
  assert.equal(toggleTick(p, TODAY, "novel", TODAY), false);
  assert.equal(p.days["2026-10-29"], undefined);
});
test("after tracking starts, an empty past day becomes missed", () => {
  const p = seedProgress(TODAY);
  assert.equal(dayStatus(p, TODAY, "2026-10-29"), "missed");
  assert.equal(dayStatus(p, "2026-10-27", "2026-10-29"), "unrecorded");
});
test("unticking a recorded missed day keeps it missed and keeps its picks", () => {
  const p = seedProgress(TODAY);
  toggleTick(p, "2026-10-21", "poem", TODAY);
  assert.equal(dayStatus(p, "2026-10-21", TODAY), "partial");
  toggleTick(p, "2026-10-21", "poem", TODAY);
  assert.equal(dayStatus(p, "2026-10-21", TODAY), "missed");
  assert.ok(p.days["2026-10-21"].picks);
});
test("streak counts back from today, or from yesterday while today is open", () => {
  const p = seedProgress(TODAY);
  assert.equal(streak(p, TODAY), 0);
  for (const d of ["2026-10-26", "2026-10-27"])
    for (const k of ["poem", "story", "essay"]) toggleTick(p, d, k, TODAY);
  assert.equal(streak(p, TODAY), 2);
  for (const k of ["poem", "story", "essay"]) toggleTick(p, TODAY, k, TODAY);
  assert.equal(streak(p, TODAY), 3);
  assert.equal(streak(p, "2026-10-18"), 1);
});
test("weekly story belongs to the week's Sunday", () => {
  assert.equal(weekSunday("2026-10-28"), "2026-11-01");
  assert.equal(weekSunday("2026-11-01"), "2026-11-01");
  assert.equal(weekSunday("2026-10-26"), "2026-11-01");
  const p = seedProgress(TODAY);
  toggleWeekly(p, TODAY, TODAY);
  assert.equal(p.weeks["2026-11-01"].submitted, true);
  const o = overview(p, TODAY);
  assert.equal(o.weekSubmitted, true);
  assert.equal(o.daysToSunday, 4);
  assert.deepEqual([o.complete, o.missed, o.unrecorded], [1, 1, 8]);
});
test("month grid is Monday-first and covers every day", () => {
  const g = monthGrid(2026, 9);
  assert.equal(g.length % 7, 0);
  assert.equal(g.filter(Boolean).length, 31);
  assert.equal(g.findIndex(Boolean), 3, "1 Oct 2026 is a Thursday");
});
test("storage round-trips and rejects corrupt data", () => {
  const store = new Map();
  const s = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const p = loadProgress(s, TODAY);
  toggleTick(p, TODAY, "poem", TODAY);
  assert.ok(saveProgress(s, p));
  assert.equal(loadProgress(s, "2026-10-30").days[TODAY].poem, true);
  assert.equal(loadProgress(s, "2026-10-30").trackingSince, TODAY, "tracking start is kept");
  store.set(PROGRESS_KEY, "{oops");
  assert.equal(dayStatus(loadProgress(s, TODAY), "2026-10-18", TODAY), "complete");
  const broken = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  assert.equal(saveProgress(broken, p), false);
  assert.ok(loadProgress(broken, TODAY));
});

test("validation rejects malformed entries that could crash ticking", () => {
  const ok = seedProgress(TODAY);
  assert.equal(validProgress(ok), true);
  const bad = (f) => { const p = structuredClone(ok); f(p); return validProgress(p); };
  assert.equal(bad((p) => (p.days["2026-10-20"] = "yes")), false);
  assert.equal(bad((p) => (p.days["oct 20"] = {})), false);
  assert.equal(bad((p) => (p.days["2026-10-20"] = { poem: "yes" })), false);
  assert.equal(bad((p) => (p.days["2026-10-21"].picks = ["x"])), false);
  assert.equal(bad((p) => (p.weeks["2026-11-01"] = 1)), false);
  assert.equal(bad((p) => (p.start = "soon")), false);
  assert.equal(bad((p) => (p.days = [])), false);
});
test("an unreadable record is flagged as recovered, never silently replaced", () => {
  const store = new Map([[PROGRESS_KEY, "{oops"]]);
  const s = { getItem: (k) => store.get(k) ?? null };
  const r = readProgress(s, TODAY);
  assert.equal(r.recovered, true);
  assert.equal(r.raw, "{oops");
  const empty = readProgress({ getItem: () => null }, TODAY);
  assert.equal(empty.recovered, false);
  assert.equal(empty.raw, null);
});

test("day ticks are ignored for 600 ms after a day opens", async () => {
  globalThis.document ??= undefined;
  const { dayInputAllowed, DAY_GUARD_MS } = await import("../calendar.js");
  assert.equal(DAY_GUARD_MS, 600);
  assert.equal(dayInputAllowed(1000 + 599, 1000), false);
  assert.equal(dayInputAllowed(1000 + 600, 1000), true);
  assert.equal(dayInputAllowed(5, -Infinity), true);
});

test("dates must be real and in range", () => {
  const ok = seedProgress(TODAY);
  for (const k of ["0001-01-01", "2026-02-31", "2026-13-01"]) {
    const p = structuredClone(ok);
    p.days[k] = { poem: true };
    assert.equal(validProgress(p), false, k);
  }
});
