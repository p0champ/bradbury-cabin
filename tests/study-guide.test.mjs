import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGuide, studyGuide } from "../study-guide.js";
import { parsePicks } from "../picks.js";
import { LIBRARY } from "../library.js";
import { AREA, layoutWork, pageForAnchor } from "../reader.js";
import { MENU_PAGES, menuButtons } from "../gestures.js";

function context() {
  let size = 54;
  return { set font(v) { size = Number(/(\d+)px/.exec(v)[1]); },
    measureText(t) { return { width: t.length * size * 0.55 }; } };
}
test("optional guides accept strings and arrays, cap lengths and ignore malformed values", () => {
  assert.equal(normalizeGuide(null), null);
  assert.equal(normalizeGuide("bad"), null);
  assert.equal(normalizeGuide([]), null);
  assert.equal(normalizeGuide({ notice: [false, {}, 2, " "] }), null);
  assert.deepEqual(normalizeGuide({ context: "  Context  ", notice: [false, "A"], themes: {}, questions: "Q" }),
    { context: ["Context"], notice: ["A"], themes: [], questions: ["Q"] });
  const g = normalizeGuide({ context: Array(50).fill("x".repeat(5000)) });
  assert.equal(g.context.length, 8);
  assert.ok(g.context.every(s => s.length === 1200));
});
test("a missing, partial or malformed guide never drops a pick", () => {
  for (const guide of [undefined, null, 42, [], { context: 8 }, { notice: ["Look"] }]) {
    const r = parsePicks({ date: "2026-10-28", picks: { story: { title: "T", author: "A", text: "Text", guide } } });
    assert.equal(r.works.length, 1);
    assert.deepEqual(r.problems, []);
    assert.equal(r.works[0].guide?.notice?.[0] || null, guide?.notice?.[0] || null);
  }
});
test("all seven shelf works have two guide sections; sampler has the fallback", () => {
  for (const w of LIBRARY) {
    const g = studyGuide(w);
    assert.equal(g.id, `guide:${w.id}`);
    assert.equal(g.kind, "guide");
    assert.ok(g.blocks.some(b => b.text === "Before reading"));
    assert.ok(g.blocks.some(b => b.text === "After reading — spoilers" && b.pageBreak));
  }
  assert.deepEqual(studyGuide({ id: "sampler", title: "Sampler" }).blocks,
    [{ type: "para", text: "No study guide for this text." }]);
});
test("an after-only partial guide still opens with a safe introduction", () => {
  const g = studyGuide({ id: "partial", title: "Partial", guide: { themes: "Revealed outcome." } });
  const pages = layoutWork(context(), g);
  assert.ok(pages[0].some(b => b.text === "No before-reading notes for this text."));
  assert.ok(!pages[0].some(b => b.text === "Revealed outcome."));
  assert.equal(pages[1][0].text, "After reading — spoilers");
});
test("guides preserve every word, stay flush left and put spoilers on a fresh page at every size and mood", () => {
  for (const w of [...LIBRARY, { id: "custom", title: "Custom", guide: { context: "Context ".repeat(200), notice: ["Watch " .repeat(40)], themes: "Meaning ".repeat(200), questions: ["Why?"] } }])
    for (const size of [0, 1, 2]) for (const serif of ["Georgia", "Arial"]) {
      const guide = studyGuide(w), ctx = context(), pages = layoutWork(ctx, guide, size, { serif });
      const source = guide.blocks.map(b => b.text).join(" ").split(/\s+/);
      const laid = pages.flat().filter(b => ["heading", "line"].includes(b.kind)).map(b => b.text).join(" ").split(/\s+/);
      assert.deepEqual(laid, source);
      for (const page of pages) {
        for (const item of page) {
          assert.ok(item.y >= AREA.top && item.y <= AREA.bottom, `${w.id}: ${item.text}`);
          assert.equal(item.x ?? AREA.left, AREA.left);
          ctx.font = `${item.font}px`;
          assert.ok(ctx.measureText(item.text).width <= AREA.right - AREA.left);
        }
        const spoiler = page.find(b => b.text.startsWith("After reading"));
        if (spoiler) assert.equal(page[0], spoiler);
        assert.notEqual(page.at(-1).kind, "heading", "headings stay with their content");
        assert.equal(pageForAnchor(pages, page.anchor), pages.indexOf(page));
      }
    }
});
test("guide row fits and More/Back retain identical targets", () => {
  assert.ok(MENU_PAGES.main.includes("guide"));
  const guide = menuButtons.find(b => b.id === "guide");
  assert.ok(guide.y + guide.h < 2320);
  assert.equal(menuButtons.find(b => b.id === "more").y, menuButtons.find(b => b.id === "back").y);
});
test("headings stay with the following paragraph including its spacing at page boundaries", () => {
  for (let count = 1; count < 400; count++) for (const size of [0, 1, 2]) {
    const guide = studyGuide({ id: "boundary", title: "Title", guide: {
      context: "context ".repeat(count), notice: ["notice ".repeat(20)],
      themes: "theme ".repeat(count), questions: ["question ".repeat(20)] } });
    for (const page of layoutWork(context(), guide, size))
      assert.notEqual(page.at(-1).kind, "heading", `size ${size}, length ${count}`);
  }
});
