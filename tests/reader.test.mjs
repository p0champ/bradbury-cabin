import test from "node:test";
import assert from "node:assert/strict";
import { layoutWork, pageForAnchor, AREA, loadReading, saveReading } from "../reader.js";
import { LIBRARY } from "../library.js";
import { SOURCE_CATALOGUE } from "../source-catalogue.js";
const ADDED_AUTHORS = new Set(["W. B. Yeats", "Edgar Allan Poe", "Thomas De Quincey", "Rabindranath Tagore"]);
// Fake canvas: every character is 0.5 em wide at the current font size.
function fakeCtx() {
  let size = 54;
  return {
    set font(f) { size = Number(/(\d+)px/.exec(f)[1]); },
    get font() { return size + "px"; },
    measureText: (t) => ({ width: t.length * size * 0.5 }),
  };
}
const text = (page) => page.filter((x) => x.kind === "line").map((x) => x.text);
const work = (id) => LIBRARY.find((w) => w.id === id);
test("starter shelf: three kinds, real texts with sources", () => {
  const kinds = new Set(LIBRARY.map((w) => w.kind));
  assert.deepEqual([...kinds].sort(), ["essay", "poem", "story"]);
  for (const w of LIBRARY) {
    assert.ok(w.title && w.author && w.year && w.source, w.id);
    assert.ok(w.year < 1929, "public domain by date: " + w.id);
  }
  assert.match(work("ohenry-magi").blocks.at(-1).text, /They are the magi\.$/);
  assert.match(work("bacon-studies").blocks[0].text, /^STUDIES serve for delight/);
});
test("every word of every work appears exactly once, in order, at every size", () => {
  for (const w of LIBRARY)
    for (const size of [0, 1, 2]) {
      const pages = layoutWork(fakeCtx(), w, size);
      const laid = pages.flatMap(text).join(" ").split(/\s+/).filter(Boolean);
      const source = w.blocks
        .flatMap((b) => (b.type === "stanza" ? b.lines.map((l) => l.text) : [b.text]))
        .join(" ")
        .split(/\s+/)
        .filter(Boolean);
      assert.deepEqual(laid, source, `${w.id} size ${size}`);
    }
});
test("lines stay inside the page area", () => {
  for (const w of LIBRARY) {
    const ctx = fakeCtx();
    for (const p of layoutWork(ctx, w, 2))
      for (const x of p) {
        assert.ok(x.y <= AREA.bottom && x.y >= AREA.top, `${w.id} y ${x.y}`);
        if (x.kind === "line") {
          ctx.font = `${x.font}px`;
          assert.ok((x.x ?? AREA.left) + ctx.measureText(x.text).width <= AREA.right + 1, `${w.id}: ${x.text}`);
        }
      }
  }
});
test("poems keep their line breaks; wrapped lines get a hanging indent", () => {
  const pages = layoutWork(fakeCtx(), work("whitman-astronomer"), 2);
  const lines = pages.flat().filter((x) => x.kind === "line");
  const long = lines.filter((x) => x.cont);
  assert.ok(long.length >= 1, "the long line wraps at large size");
  for (const c of long) assert.ok(c.x > AREA.left, "continuation is indented");
  // Each source line starts a new typeset line.
  const starts = lines.filter((x) => !x.cont).map((x) => x.text.split(" ")[0]);
  assert.deepEqual(starts, work("whitman-astronomer").blocks[0].lines.map((l) => l.text.split(" ")[0]));
});
test("O Captain keeps its stepped indents", () => {
  const lines = layoutWork(fakeCtx(), work("whitman-captain"), 0).flat().filter((x) => x.kind === "line" && !x.cont);
  const fallen = lines.filter((x) => x.text.startsWith("Fallen cold"));
  const first = lines.find((x) => x.text.startsWith("O Captain!"));
  assert.ok(fallen.every((x) => x.x > first.x), "refrain is indented");
});
test("prose never leaves a lone first or last line of a paragraph", () => {
  for (const id of ["ohenry-magi", "chopin-desiree", "bacon-truth"])
    for (const size of [0, 1, 2]) {
      const pages = layoutWork(fakeCtx(), work(id), size);
      for (let i = 0; i < pages.length - 1; i++) {
        const lines = pages[i].filter((x) => x.kind === "line");
        const last = lines.at(-1),
          next = pages[i + 1].find((x) => x.kind === "line");
        if (last.para === next.para) {
          assert.ok(last.paraLine >= 1, `${id} orphan on page ${i + 1}`);
          assert.ok(next.paraLines - next.paraLine >= 2, `${id} widow on page ${i + 2}`);
        }
      }
    }
});
test("a saved place survives every text-size change, for every page", () => {
  // The first words of each page must appear on the page chosen at any other
  // size: no skipping ahead, no landing far behind.
  for (const w of LIBRARY)
    for (const from of [0, 1, 2])
      for (const to of [0, 1, 2]) {
        const a = layoutWork(fakeCtx(), w, from),
          b = layoutWork(fakeCtx(), w, to);
        a.forEach((page, i) => {
          const first = page.find((x) => x.kind === "line");
          const target = b[pageForAnchor(b, page.anchor)];
          const words = target.filter((x) => x.kind === "line").map((x) => x.text).join(" ");
          assert.ok(words.includes(first.text.split(" ")[0]), `${w.id} ${from}->${to} page ${i + 1}`);
          // And the target page starts at or before those words.
          const t = target.anchor;
          assert.ok(t.block < page.anchor.block || (t.block === page.anchor.block && t.word <= page.anchor.word));
        });
      }
  assert.equal(pageForAnchor([], null), 0);
});
test("pages without anchors (the sampler) and bad anchors never crash", () => {
  const pages = [[], []];
  assert.equal(pageForAnchor(pages, { block: 1, word: 2 }), 0);
  assert.equal(pageForAnchor(layoutWork(fakeCtx(), work("bacon-truth"), 1), { block: "x" }), 0);
});
test("a word wider than the column is broken, never overflowing", () => {
  const long = { id: "t", kind: "story", title: "T", author: "A", year: 1900, blocks: [{ type: "para", text: "a " + "x".repeat(400) + " b" }] };
  const ctx = fakeCtx();
  const lines = layoutWork(ctx, long, 2).flat().filter((x) => x.kind === "line");
  for (const l of lines) {
    ctx.font = `${l.font}px`;
    assert.ok((l.x ?? AREA.left) + ctx.measureText(l.text).width <= AREA.right + 1);
  }
  assert.equal(lines.map((l) => l.text).join("").replace(/\s/g, ""), "a" + "x".repeat(400) + "b");
});
test("reading places round-trip and tolerate bad storage", () => {
  const m = new Map();
  const s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  const r = loadReading(s);
  r.places.x = { anchor: { block: 3, word: 7 }, page: 2 };
  assert.ok(saveReading(s, r));
  assert.equal(loadReading(s).places.x.page, 2);
  m.set("cabin-reading", JSON.stringify({ last: 5, places: { a: { anchor: { block: "x" } }, b: { anchor: { block: 2, word: 3 }, page: 1 } } }));
  assert.deepEqual(loadReading(s), { last: null, places: { b: { anchor: { block: 2, word: 3 }, page: 1 } } });
  m.set("cabin-reading", "{bad");
  assert.deepEqual(loadReading(s), { last: null, places: {} });
});

test("pages contain only drawable text items (no blank spacers drawn)", () => {
  for (const w of LIBRARY)
    for (const p of layoutWork(fakeCtx(), w, 1))
      for (const x of p) assert.equal(typeof x.text, "string", `${w.id} ${x.kind}`);
});

test("every Library work has a row (no silent overflow until paging exists)", async () => {
  const { LIBRARY_ROWS } = await import("../library-panel.js");
  assert.ok(LIBRARY.length + 1 <= LIBRARY_ROWS, "sampler + shelf must fit");
});

test("new authors' complete texts survive pagination at every size without altered or missing words", () => {
  const added = SOURCE_CATALOGUE.filter(w => ADDED_AUTHORS.has(w.author));
  assert.deepEqual(new Set(added.map(w => w.author)), ADDED_AUTHORS);
  for (const w of added) {
    const original = w.blocks.flatMap(b => b.type === "stanza" ? b.lines.map(l => l.text) : [b.text]).join(" ").split(/\s+/).filter(Boolean);
    assert.ok(original.length <= 6000, w.id + " whole-work daily length limit");
    for (const size of [0, 1, 2]) {
      const pages = layoutWork(fakeCtx(), w, size);
      assert.deepEqual(pages.flatMap(text).join(" ").split(/\s+/).filter(Boolean), original, w.id + " size " + size);
    }
  }
});

test("new edition metadata stays explicit and differing or unsupported sources remain unpublished", () => {
  const yeats = SOURCE_CATALOGUE.find(w => w.id === "w-b-yeats-the-song-of-wandering-aengus");
  const deq = SOURCE_CATALOGUE.find(w => w.id === "thomas-de-quincey-on-the-knocking-at-the-gate-in-macbeth");
  const tagore = SOURCE_CATALOGUE.find(w => w.id === "rabindranath-tagore-realisation-in-love");
  assert.match(yeats.year, /1903 edition/);
  assert.match(tagore.year, /1916 edition/);
  assert.ok(deq.sourceEdition.headingStartLine < deq.sourceEdition.headingLine);
  for (const id of [
    "w-b-yeats-aedh-tells-of-the-rose-in-his-heart",
    "w-b-yeats-michael-robartes-asks-forgiveness-because-of-his-many-moods",
    "rabindranath-tagore-soul-consciousness",
    "edgar-allan-poe-the-pit-and-the-pendulum",
  ]) assert.ok(!SOURCE_CATALOGUE.some(w => w.id === id), id + " must not be silently corrected or shortened");
});
