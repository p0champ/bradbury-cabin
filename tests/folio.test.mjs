import test from "node:test";
import assert from "node:assert/strict";
import { layoutWork, pageForAnchor, AREA } from "../reader.js";
import { LIBRARY } from "../library.js";
import { typeset, turnFrame, shimmerAt, TURN_MS, TURN_SLIDE_PX, SHIMMER, FRAME, FOLIO_BAND } from "../folio.js";

function fakeCtx() {
  let size = 54;
  return {
    set font(f) { size = Number(/(\d+)px/.exec(f)[1]); },
    get font() { return size + "px"; },
    measureText: (t) => ({ width: t.length * size * 0.5 }),
  };
}
// Words as the reader sees them, with an opening letter put back on its line.
const lineText = (x) => x.dropCap ? x.dropCap.letter + (x.dropCap.separate ? " " : "") + x.text : x.text;
const words = (pages) => pages.flatMap((p) => p.filter((x) => x.kind === "line").map(lineText)).join(" ").split(/\s+/).filter(Boolean);
const sourceWords = (w) => w.blocks.flatMap((b) => (b.type === "stanza" ? b.lines.map((l) => l.text) : [b.text])).join(" ").split(/\s+/).filter(Boolean);

test("glass folio: an opening letter never adds, drops or reorders a word", () => {
  for (const w of LIBRARY)
    for (const size of [0, 1, 2]) {
      const pages = layoutWork(fakeCtx(), w, size, { dropCap: true });
      assert.deepEqual(words(pages), sourceWords(w), `${w.id} size ${size}`);
      const caps = pages.flat().filter((x) => x.dropCap);
      assert.equal(caps.length, ["story", "essay"].includes(w.kind) && /^\p{Lu}/u.test(w.blocks.find((b) => b.type === "para")?.text.trim() || "") ? 1 : 0, w.id);
    }
});

test("glass folio: lines beside the opening letter stay inside the page", () => {
  const ctx = fakeCtx();
  for (const w of LIBRARY.filter((x) => x.kind !== "poem")) {
    const pages = layoutWork(ctx, w, 1, { dropCap: true });
    for (const x of pages.flat().filter((i) => i.kind === "line")) {
      ctx.font = `${x.font}px serif`;
      assert.ok(x.x >= AREA.left && x.x + ctx.measureText(x.text).width <= AREA.right + 1, `${w.id}: ${x.text}`);
    }
  }
});

test("glass folio: saved places from the plain layout land on the right page", () => {
  for (const w of LIBRARY) {
    const plain = layoutWork(fakeCtx(), w, 1), capped = layoutWork(fakeCtx(), w, 1, { dropCap: true });
    plain.forEach((page) => {
      const target = capped[pageForAnchor(capped, page.anchor)];
      const t = target.anchor;
      assert.ok(t.block < page.anchor.block || (t.block === page.anchor.block && t.word <= page.anchor.word), w.id);
    });
  }
});

test("glass folio: typographic quotes, display only", () => {
  assert.equal(typeset('"Come in," he said.'), "“Come in,” he said.");
  assert.equal(typeset("it's Tobin's"), "it’s Tobin’s");
  assert.equal(typeset("'tis the season"), "’tis the season");
  assert.equal(typeset("'Pipe a song!'"), "‘Pipe a song!’");
  assert.equal(typeset("the boys' room"), "the boys’ room");
  assert.equal(typeset("no quotes here"), "no quotes here");
  assert.equal(typeset("‘already curly’"), "‘already curly’");
  assert.equal(typeset(null), null);
});

test("glass folio: page turn slides old words out and new ones in, then rests", () => {
  const start = turnFrame(0, 1), mid = turnFrame(TURN_MS / 2, 1), end = turnFrame(TURN_MS, 1);
  assert.deepEqual([start.old.alpha, start.next.alpha], [1, 0]);
  assert.ok(mid.old.dx < 0 && mid.next.dx > 0 && Math.abs(mid.old.dx) <= TURN_SLIDE_PX);
  assert.deepEqual([end.old.alpha, end.next.alpha, end.next.dx, end.done], [0, 1, 0, true]);
  assert.ok(turnFrame(TURN_MS / 2, -1).old.dx > 0, "previous page slides the other way");
  const still = turnFrame(TURN_MS / 2, 1, true);
  assert.ok(still.old.dx === 0 && still.next.dx === 0 && still.old.alpha < 1, "reduced motion crossfades in place");
});

test("glass folio: the rim highlight passes rarely, along the top glass only", () => {
  assert.equal(shimmerAt(1000, 2048), null);
  const a = shimmerAt(SHIMMER.everyMs + SHIMMER.passMs / 2, 2048);
  assert.ok(a && a.y === 0 && a.alpha > .9);
  assert.equal(shimmerAt(SHIMMER.everyMs + SHIMMER.passMs + 10, 2048), null);
  assert.ok(shimmerAt(2 * SHIMMER.everyMs + 100, 2048), "repeats about every 25 s");
  for (let t = SHIMMER.everyMs; t < SHIMMER.everyMs + SHIMMER.passMs; t += 50) {
    const s = shimmerAt(t, 2048);
    assert.ok(s.x >= 88 && s.x + SHIMMER.width <= 2048 - 88, "stays on the straight rim");
  }
  assert.ok(FRAME < AREA.top && FOLIO_BAND.y > FRAME, "the glass band never reaches the words");
});
