import test from "node:test";
import assert from "node:assert/strict";
import { todayFacts, workStatus, todayButtons, todayHit, nextUnread, closingButtons, closingHit } from "../today-panel.js";
import { menuButtons } from "../gestures.js";
import { SOURCE_CATALOGUE } from "../source-catalogue.js";

const pick = (kind) => SOURCE_CATALOGUE.find((w) => w.kind === kind);
const works = ["poem", "story", "essay"].map(pick);
const base = (days = {}) => ({ version: 1, start: "2026-10-18", trackingSince: "2026-10-18", days, weeks: {} });

test("the dateline names the weekday, part of day and challenge day", () => {
  const f = todayFacts(new Date(2026, 9, 28, 20), base(), "2026-10-28");
  assert.equal(f.dateline, "Wednesday evening · Day 11");
  assert.equal(f.read, 0);
  assert.equal(f.closing, "");
  assert.match(todayFacts(new Date(2026, 9, 18, 8), base(), "2026-10-18").dateline, /^Sunday morning · Day 1$/);
});
test("finishing all three is noted quietly, with the streak only when it is real", () => {
  const all = { poem: true, story: true, essay: true };
  assert.equal(todayFacts(new Date(2026, 9, 28, 20), base({ "2026-10-28": all }), "2026-10-28").closing, "All three read today");
  const run = base({ "2026-10-26": all, "2026-10-27": all, "2026-10-28": all });
  const f = todayFacts(new Date(2026, 9, 28, 20), run, "2026-10-28");
  assert.equal(f.allRead, true);
  assert.equal(f.closing, "All three read · 3 days running");
});
test("each entry shows Read from today's ticks, else In progress from a saved place", () => {
  const p = base({ "2026-10-28": { poem: true } });
  assert.equal(workStatus(works[0], p, "2026-10-28", {}), "Read");
  assert.equal(workStatus(works[1], p, "2026-10-28", { [works[1].id]: { page: 3 } }), "In progress");
  assert.equal(workStatus(works[2], p, "2026-10-28", { [works[2].id]: { page: 0 } }), "");
  // A tick from yesterday is not today's reading.
  assert.equal(workStatus(works[0], base({ "2026-10-27": { poem: true } }), "2026-10-28", {}), "");
});
test("Today targets are large, separate, on the page and away from the menu's exit row", () => {
  const buttons = todayButtons(works);
  assert.deepEqual(buttons.map((b) => b.id), ["today-menu", ...works.map((w) => "today:" + w.id), "today-library"]);
  for (const [i, a] of buttons.entries()) {
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= 2048 && a.y + a.h <= 2560, a.id);
    for (const b of buttons.slice(i + 1))
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} overlaps ${b.id}`);
  }
  for (const b of buttons.slice(1, 4)) assert.ok(b.h >= 240, "entries are bigger than Library rows");
  // A repeated pinch on "Leave the cabin" must never land on Today's "Menu".
  const exit = menuButtons.find((b) => b.page === "main" && b.id === "exit");
  const menu = buttons[0];
  assert.ok(menu.y + menu.h <= exit.y || exit.y + exit.h <= menu.y || menu.x >= exit.x + exit.w || exit.x >= menu.x + menu.w);
  assert.equal(todayHit(buttons[2].x + 10, buttons[2].y + 10, works), "today:" + works[1].id);
  assert.equal(todayHit(5, 5, works), null);
  assert.deepEqual(todayButtons([]).map((b) => b.id), ["today-menu", "today-library"]);
});
test("the closing page offers Next only while another of today's works is unread", () => {
  const p = base({ "2026-10-28": { story: true } });
  assert.equal(nextUnread(works, works[0], p, "2026-10-28").id, works[2].id);
  const done = base({ "2026-10-28": { poem: true, story: true, essay: true } });
  assert.equal(nextUnread(works, works[0], done, "2026-10-28"), null);
  assert.deepEqual(closingButtons(works[2]).map((b) => b.id), ["end-back", "end-mark", "end-next", "end-today"]);
  assert.deepEqual(closingButtons(null).map((b) => b.id), ["end-back", "end-mark", "end-today"]);
  const mark = closingButtons(null)[1];
  assert.equal(closingHit(mark.x + 5, mark.y + 5, null), "end-mark");
});
// A canvas stand-in: records drawn text and fails on undefined geometry.
function fakeCtx() {
  const drawn = [];
  const check = (...n) => { for (const v of n) assert.ok(Number.isFinite(v), "finite geometry"); };
  return {
    drawn, font: "40px Arial", textAlign: "left", fillStyle: "", strokeStyle: "", lineWidth: 1,
    measureText(t) { return { width: String(t).length * (parseFloat(/(\d+)px/.exec(this.font)[1]) * 0.55) }; },
    fillText(t, x, y) { check(x, y); drawn.push({ t, font: this.font }); },
    fillRect(x, y, w, h) { check(x, y, w, h); }, strokeRect(x, y, w, h) { check(x, y, w, h); },
    beginPath() {}, rect(x, y, w, h) { check(x, y, w, h); }, roundRect(x, y, w, h) { check(x, y, w, h); }, fill() {},
  };
}
const colours = { bg: "#000", ink: "#111", muted: "#222", card: "#333", accent: "#444", gold: "#555", serif: "Literata", italic: "" };
test("Today paints safely with three, two or no works (e.g. just after midnight)", async () => {
  const { paintToday } = await import("../today-panel.js");
  const facts = todayFacts(new Date(2026, 9, 28, 20), base(), "2026-10-28");
  for (const list of [works, works.slice(0, 2), []]) {
    const ctx = fakeCtx();
    paintToday(ctx, { works: list, hover: null, facts, statuses: {}, note: "A note that is long enough to need a second line on the page because it keeps going and going for a while yet.", c: colours });
    assert.ok(ctx.drawn.some((d) => d.t === "The whole Library  ›"), "the Library button is always there");
  }
});
test("long titles shrink before they are cut, so Blake's book label survives", async () => {
  const { paintToday, paintClosing } = await import("../today-panel.js");
  const blake = SOURCE_CATALOGUE.find((w) => w.id === "william-blake-experience-the-chimney-sweeper");
  assert.match(blake.title, /\(Songs of Experience\)$/);
  const ctx = fakeCtx();
  paintToday(ctx, { works: [blake, works[1], works[2]], hover: null, facts: todayFacts(new Date(2026, 9, 28, 20), base(), "2026-10-28"), statuses: { [blake.id]: "Read" }, c: colours });
  assert.ok(ctx.drawn.some((d) => d.t === blake.title), "full title drawn");
  assert.ok(ctx.drawn.some((d) => d.t === "✓  Read"));
  const closing = fakeCtx();
  paintClosing(closing, { work: blake, next: works[1], read: false, hover: null, c: colours });
  assert.ok(closing.drawn.some((d) => d.t === blake.title), "closing header keeps the full title");
  assert.ok(closing.drawn.some((d) => d.t.startsWith("FINISHED · POEM")));
});
