// Today's three from Claude, read from Bastian's Google Drive.
// Claude writes a small JSON file, "picks-YYYY-MM-DD.json", in the Drive
// folder "Bradbury Cabin" (a new file per request; the newest one wins).
// Texts are plain strings, so they are easy to write:
//   poems: one line per line, a blank line between stanzas, leading spaces
//          for indented lines;
//   prose: a blank line between paragraphs.
// {
//   "version": 1,
//   "date": "2026-10-28",
//   "picks": {
//     "poem":  { "title", "author", "year", "place", "source", "text" },
//     "story": { ... },
//     "essay": { ... }
//   }
// }
import { normalizeGuide } from "./study-guide.js?v=24";
export const KINDS = ["poem", "story", "essay"];
const MAX_TEXT = 150000; // characters per text: a long story, not a novel

export function textToBlocks(kind, text) {
  const clean = String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/[  ]+$/gm, "");
  const chunks = clean.split(/\n\s*\n/).map((c) => c.replace(/^\n+|\n+$/g, "")).filter((c) => c.trim());
  if (kind === "poem")
    return chunks.map((c) => {
      const lines = c.split("\n").filter((l) => l.trim());
      return {
        type: "stanza",
        lines: lines.map((l) => ({
          text: l.trim(),
          indent: Math.min(14, Math.round((l.length - l.trimStart().length) / 2)),
        })),
      };
    });
  return chunks.map((c) => ({ type: "para", text: c.replace(/\s*\n\s*/g, " ").trim() }));
}

function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return (h >>> 0).toString(36);
}
const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// Validates Claude's file and turns it into Library works. Returns
// { date, works: [...], problems: [...] }. Bad entries are skipped, never fatal.
export function parsePicks(json) {
  const problems = [];
  let data = json;
  if (typeof json === "string") {
    try {
      data = JSON.parse(json);
    } catch {
      return { date: null, works: [], problems: ["today.json is not valid JSON"] };
    }
  }
  if (!data || typeof data !== "object" || !data.picks || typeof data.picks !== "object")
    return { date: null, works: [], problems: ["today.json has no picks"] };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null;
  if (!date) problems.push("today.json has no valid date");
  const works = [];
  for (const kind of KINDS) {
    const p = data.picks[kind];
    if (!p) continue;
    const title = str(p.title, 200),
      author = str(p.author, 200),
      text = typeof p.text === "string" ? p.text.slice(0, MAX_TEXT) : "";
    if (!title || !author || !text.trim()) {
      problems.push(`${kind} is missing a title, author or text`);
      continue;
    }
    const blocks = textToBlocks(kind, text);
    if (!blocks.length) {
      problems.push(`${kind} has no readable text`);
      continue;
    }
    works.push({
      // The title is part of the id, so a swapped work never inherits the
      // previous work's saved place.
      id: `today-${date || "undated"}-${kind}-${hash(title)}`,
      kind,
      today: true,
      title,
      author,
      year: Number.isInteger(p.year) ? p.year : str(String(p.year ?? ""), 20),
      place: str(p.place, 80),
      source: str(p.source, 300) || "Chosen by Claude",
      blocks,
      guide: normalizeGuide(p.guide),
    });
  }
  return { date, works, problems };
}

// "Title — Author" labels for the calendar and the wrist card.
export function pickLabels(works) {
  const out = {};
  for (const w of works) out[w.kind] = `${w.title} — ${w.author}`;
  return out;
}
