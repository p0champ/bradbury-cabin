// Pagination for full works on the 2048 × 2560 page canvas.
// Poems keep their line breaks, stanza gaps and stepped indents; a long line
// wraps with a hanging indent and never loses words. Prose wraps by paragraph
// and flows across pages with at least two lines kept together at a split.
// Every page records an anchor (block, word) so a saved place survives a
// change of text size.
import { SIZES } from "./core.js?v=49";

export const AREA = { left: 194, right: 1854, top: 380, bottom: 2120 };
const WIDTH = AREA.right - AREA.left;

function wrapWords(ctx, text, width) {
  const out = [];
  let line = "";
  for (let word of text.split(/\s+/).filter(Boolean)) {
    // A single word wider than the column is broken by characters.
    while (ctx.measureText(word).width > width && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && ctx.measureText(word.slice(0, cut)).width > width) cut--;
      if (line) out.push(line);
      out.push(word.slice(0, cut));
      line = "";
      word = word.slice(cut);
    }
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}
const countWords = (t) => t.split(/\s+/).filter(Boolean).length;

// Turns a work into a flat list of typeset lines, then paginates them.
export function layoutWork(ctx, work, size = 1, { serif = "Literata, Georgia, serif", titleStyle = "italic" } = {}) {
  const font = SIZES[size],
    leading = Math.round(font * 1.43);
  const items = [];
  // Title block on the first page.
  ctx.font = `${titleStyle} 66px ${serif}`;
  for (const t of wrapWords(ctx, work.title, WIDTH))
    items.push({ kind: "title", text: t, h: 92, font: 66, anchor: { block: -1, word: 0 } });
  items.push({
    kind: "meta",
    text: [work.author, work.year, work.place].filter(Boolean).join(" · "),
    h: 116,
    font: 36,
    anchor: { block: -1, word: 0 },
  });
  ctx.font = `${font}px ${serif}`;
  work.blocks.forEach((b, bi) => {
    if (b.type === "heading") {
      ctx.font = `bold ${font}px ${serif}`;
      const lines = wrapWords(ctx, b.text, WIDTH);
      lines.forEach((text, i) => items.push({ kind: "heading", text, font,
        h: leading, anchor: { block: bi, word: 0 },
        pageBreak: b.pageBreak && i === 0, keepNext: true }));
      ctx.font = `${font}px ${serif}`;
    } else if (b.type === "stanza") {
      if (bi > 0) items.push({ kind: "gap", h: Math.round(leading * 0.8), anchor: { block: bi, word: 0 } });
      let wordsBefore = 0;
      b.lines.forEach((l, li) => {
        const indent = Math.min(l.indent, 14) * font * 0.32;
        const hang = font * 3.2;
        const parts = wrapWords(ctx, l.text, WIDTH - indent);
        // Continuations wrap within the remaining width after the hang.
        let rest = parts.slice(1).join(" ");
        items.push({ kind: "line", text: parts[0], x: AREA.left + indent, h: leading, font, anchor: { block: bi, word: wordsBefore }, keepNext: !!rest, stanza: bi });
        let w = wordsBefore + countWords(parts[0]);
        if (rest)
          for (const c of wrapWords(ctx, rest, WIDTH - indent - hang)) {
            // Turnovers are set flush right, the usual poetry convention, so
            // they can never be mistaken for an indented verse line.
            const x = AREA.right - ctx.measureText(c).width;
            items.push({ kind: "line", text: c, x, h: leading, font, anchor: { block: bi, word: w }, cont: true, stanza: bi });
            w += countWords(c);
          }
        wordsBefore += countWords(l.text);
      });
    } else {
      if (bi > 0) items.push({ kind: "gap", h: Math.round(leading * 0.45), anchor: { block: bi, word: 0 } });
      const first = bi === 0 || work.blocks[bi - 1]?.type !== "para";
      const indent = first || work.kind === "guide" ? 0 : font * 1.4;
      const ls = wrapWords(ctx, b.text, WIDTH - indent);
      // Re-wrap so only the first line is indented.
      const firstLine = ls[0];
      const others = ls.length > 1 ? wrapWords(ctx, ls.slice(1).join(" "), WIDTH) : [];
      let w = 0;
      [firstLine, ...others].forEach((t, li) => {
        items.push({ kind: "line", text: t, x: AREA.left + (li === 0 ? indent : 0), h: leading, font, anchor: { block: bi, word: w }, para: bi, paraLine: li, paraLines: others.length + 1 });
        w += countWords(t);
      });
    }
  });
  return paginate(items, work);
}

function paginate(items, work) {
  const pages = [];
  let page = [],
    y = AREA.top;
  const capacity = AREA.bottom - AREA.top;
  const push = () => {
    if (page.length) pages.push(page);
    page = [];
    y = AREA.top;
  };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.pageBreak) push();
    if (it.kind === "gap" && !page.length) continue;
    let need = it.h;
    if (work.kind === "poem" && it.kind === "gap") {
      // Keep a whole stanza together when it fits on a fresh page.
      let j = i + 1,
        stanzaH = 0;
      while (j < items.length && items[j].kind === "line" && items[j].stanza === items[i + 1].stanza) stanzaH += items[j++].h;
      if (y + it.h + stanzaH > AREA.bottom && stanzaH <= capacity) {
        push();
        continue;
      }
    }
    if (it.kind === "line" && it.para != null) {
      // Prose: never leave a single first line at the bottom (orphan) or a
      // single last line at the top (widow).
      const left = it.paraLines - it.paraLine;
      if (it.paraLine === 0 && left > 1) need = it.h * 2;
      if (left === 2 && it.paraLine > 0) need = it.h * 2;
    }
    if (it.kind === "heading") {
      // Keep the complete heading with at least two body lines when present.
      let j = i + 1;
      while (items[j]?.kind === "heading") need += items[j++].h;
      if (items[j]?.kind === "gap") need += items[j++].h;
      if (items[j]?.kind === "line") {
        need += items[j].h;
        if (items[j + 1]?.kind === "line") need += items[j + 1].h;
        // A three-line paragraph cannot split under widow/orphan control.
        if (items[j].paraLines === 3) need += items[j + 2].h;
      }
    } else if (it.keepNext) need += it.h;
    if (y + need > AREA.bottom && page.some((p) => p.kind === "line" || p.kind === "heading")) {
      // If the break would strand a paragraph's first line, carry it over.
      let carry = null;
      if (
        it.para != null &&
        it.paraLine === 1 &&
        page.at(-1)?.para === it.para &&
        page.filter((p) => p.kind === "line").length > 1
      )
        carry = page.pop();
      push();
      if (carry) {
        page.push({ ...carry, y: y + carry.font });
        y += carry.h;
      }
    }
    if (it.kind === "gap") {
      if (page.length) y += it.h;
      continue;
    }
    page.push({ ...it, y: y + (["line", "heading"].includes(it.kind) ? it.font : it.kind === "title" ? 66 : 36) });
    y += it.h;
  }
  push();
  return pages.map((p) => {
    const first = p.find((x) => x.kind === "line" || x.kind === "heading") || p[0];
    p.anchor = first.anchor;
    return p;
  });
}

// Index of the page holding a saved anchor (falls back to the first page).
// Anchors are (block, word offset within the block), so they do not depend
// on how lines happened to wrap at a particular text size.
const before = (a, b) => a.block < b.block || (a.block === b.block && (a.word ?? 0) <= (b.word ?? 0));
export function validAnchor(a) {
  return (
    !!a &&
    typeof a === "object" &&
    Number.isInteger(a.block) &&
    (a.word === undefined || (Number.isInteger(a.word) && a.word >= 0))
  );
}
export function pageForAnchor(pages, anchor) {
  if (!validAnchor(anchor)) return 0;
  // Old places refer to the original text. Section-scoped anchors prevent a
  // guide's block 0 from colliding with the source text's block 0 on reflow.
  if (pages.some(p => p.section)) {
    const section = anchor.section || "text";
    let matching = pages.map((page, index) => ({ page, index })).filter(p => p.page.section === section);
    // Notes may disappear when an optional guide is removed on the next sync.
    if (!matching.length) return Math.max(0, pages.findIndex(p => p.section === "text"));
    if (!matching.length) return 0;
    let best = matching[0].index;
    for (const { page, index } of matching)
      if (validAnchor(page.anchor) && before(page.anchor, anchor)) best = index;
    return best;
  }
  let best = 0;
  pages.forEach((p, i) => {
    if (validAnchor(p.anchor) && before(p.anchor, anchor)) best = i;
  });
  return best;
}

// Per-work saved place, plus the last work opened. Browser storage cache.
export const READING_KEY = "cabin-reading";
export function loadReading(storage) {
  try {
    const r = JSON.parse(storage.getItem(READING_KEY) || "null");
    if (r && typeof r === "object" && r.places && typeof r.places === "object" && !Array.isArray(r.places)) {
      // Keep only well-formed places; drop anything else silently.
      const places = {};
      for (const [id, p] of Object.entries(r.places))
        if (p && typeof p === "object" && validAnchor(p.anchor))
          places[id] = { anchor: { block: p.anchor.block, word: p.anchor.word ?? 0,
            ...(["before", "text", "after"].includes(p.anchor.section) ? { section: p.anchor.section } : {}) },
            page: Number.isInteger(p.page) ? p.page : 0 };
      return { last: typeof r.last === "string" ? r.last : null, places };
    }
  } catch {}
  return { last: null, places: {} };
}
export function saveReading(storage, reading) {
  try {
    storage.setItem(READING_KEY, JSON.stringify(reading));
    return true;
  } catch {
    return false;
  }
}
