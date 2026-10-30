// Today's three from Claude, read from Bastian's Google Drive.
// Claude writes a small JSON file, "picks-YYYY-MM-DD.json", in the Drive
// folder "Bradbury Cabin" (a new file per request; the newest one wins).
// Version 2 contains catalogue references and separate original guide notes.
// Literary text and edition metadata always come from the reviewed catalogue.
import { normalizeGuide } from "./study-guide.js?v=51";
import { SOURCE_CATALOGUE } from "./source-catalogue.js?v=51";
import { LIBRARY } from "./library.js?v=51";
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

// Comparison keys only: case, accents and punctuation never decide a repeat.
const titleKey = (s) => String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const plainQuote = (s) => String(s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
  .replace(/\u2014/g, "--").replace(/\s+/g, " ").trim();

function workText(work) {
  return plainQuote(work.blocks.map((b) => b.type === "stanza" ? b.lines.map((l) => l.text).join(" ") : b.text).join(" "));
}

// Claude's notes are its own words, but anything it puts in double quotation
// marks must be the edition's exact words. Allowed: an ellipsis or [insertion]
// splitting a quotation into parts (each found in order), " / " between verse
// lines, and a changed first capital to fit the sentence. The work's own title
// and quotations under three words are not checked. Returns the first misquote.
export function misquote(work, guide, minimumWords = 3) {
  if (!guide) return null;
  const text = workText(work);
  const strings = Object.values(guide).flat();
  for (const s of strings) {
    for (const m of plainQuote(s).matchAll(/"([^"]+)"/g)) {
      // The edition heading, without the "(Songs of ...)" book label.
      if (titleKey(m[1]) === titleKey(work.title.replace(/ \(Songs of \w+\)$/, ""))) continue;
      const parts = m[1].replace(/\s+\/\s+/g, " ").split(/\.\.\.|\.\s\.\s\.|\u2026|\[[^\]]*\]/)
        .map((p) => p.trim().replace(/^[\s,;:.!?'-]+|[\s,;:.!?'-]+$/g, "")).filter(Boolean);
      if (!parts.length && minimumWords === 1) return m[1];
      if (parts.join(" ").split(" ").length < minimumWords) continue;
      let from = 0;
      for (const part of parts) {
        const recased = (part[0] === part[0].toLowerCase() ? part[0].toUpperCase() : part[0].toLowerCase()) + part.slice(1);
        const word = minimumWords === 1 ? /[\p{L}\p{N}\p{M}_'-]/u : /[\p{L}\p{N}\p{M}_]/u;
        const findWhole = p => {
          let at = text.indexOf(p, from);
          while (at >= 0) {
            const before = Array.from(text.slice(Math.max(0, at - 2), at)).at(-1) || "";
            const after = Array.from(text.slice(at + p.length, at + p.length + 2))[0] || "";
            if (!(word.test(Array.from(p)[0]) && word.test(before)) &&
                !(word.test(Array.from(p).at(-1)) && word.test(after))) return at;
            at = text.indexOf(p, at + 1);
          }
          return -1;
        };
        const found = [part, recased].map(findWhole).filter((at) => at >= 0);
        if (!found.length) return m[1];
        from = Math.min(...found) + part.length;
      }
    }
  }
  return null;
}

const realDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// Optional editorial lines never invalidate the readings. Check each quoted
// fragment against one complete work, so quotations may not cross editions.
export function personalLine(value, max, works) {
  if (typeof value !== "string" || !Array.isArray(works) || works.length !== 3) return null;
  const line = value.trim();
  if (!line || Array.from(line).length > max || /[\u0000-\u001f\u007f\u2028\u2029]/.test(line)) return null;
  const quoted = plainQuote(line);
  if ((quoted.match(/"/g) || []).length % 2) return null;
  for (const quote of quoted.matchAll(/"[^"]*"/g)) {
    if (!quote[0].slice(1, -1).trim() || !works.some(work => !misquote(work, { context: [quote[0]] }, 1))) return null;
  }
  return line;
}

// Validates references. Model-supplied text, metadata and verification claims
// can never replace the catalogue source. Old cached files use the same check.
// days (progress.days) lets the app refuse a work given on an earlier day.
export function parsePicks(json, days = {}) {
  const problems = [];
  let data = json;
  if (typeof json === "string") {
    try { data = JSON.parse(json); }
    catch { return { date: null, works: [], problems: ["today.json is not valid JSON"] }; }
  }
  if (!data || typeof data !== "object" || !data.picks || typeof data.picks !== "object")
    return { date: null, works: [], problems: ["today.json has no picks"] };
  const date = realDate(data.date) ? data.date : null;
  if (!date) problems.push("today.json has no valid date");
  const version = data.version ?? 1;
  if (version !== 1 && version !== 2)
    return { date, works: [], problems: [...problems, "today.json has an unsupported version"] };
  const works = [];
  for (const kind of KINDS) {
    const p = data.picks[kind];
    if (!p) continue;
    let matches = [];
    if (typeof p !== "object" || Array.isArray(p)) {
      problems.push(`${kind} has no valid source reference`);
      continue;
    }
    if (version === 2) {
      matches = SOURCE_CATALOGUE.filter((w) => w.id === p.catalogueId);
    } else {
      // Reject the old unsafe cap rather than cutting a work without warning.
      if (typeof p.text === "string" && p.text.length > MAX_TEXT) {
        problems.push(`${kind} exceeds the old import limit; ask Claude for a catalogue reference`);
        continue;
      }
      matches = SOURCE_CATALOGUE.filter((w) => w.title === p.title && w.author === p.author);
    }
    const original = matches.length === 1 ? matches[0] : null;
    if (!original || original.kind !== kind ||
        (version === 2 && ((p.title !== undefined && p.title !== original.title) ||
                          (p.author !== undefined && p.author !== original.author)))) {
      problems.push(`${kind} has no matching verified edition; ask Claude for a source catalogue selection`);
      continue;
    }
    if (LIBRARY.some((w) => w.id === original.id)) {
      problems.push(`${kind} is already on the starter shelf; ask Claude for a different work`);
      continue;
    }
    const label = titleKey(`${original.title} ${original.author}`);
    const given = Object.keys(days && typeof days === "object" ? days : {}).find((d) => (!date || d < date) &&
      Object.values(days[d]?.picks || {}).some((l) => typeof l === "string" && titleKey(l.replace(" — ", " ")) === label));
    if (given) {
      problems.push(`${kind} was already given on ${given}; ask Claude for an unread work`);
      continue;
    }
    const guide = normalizeGuide(p.guide);
    const wrong = misquote(original, guide);
    if (wrong) {
      problems.push(`${kind} study notes misquote the text ("${wrong.slice(0, 60)}"); ask Claude to correct them`);
      continue;
    }
    // Clone the trusted source so consumers cannot alter future imported copies.
    const work = JSON.parse(JSON.stringify(original));
    works.push({
      ...work,
      catalogueId: original.id,
      // A verified edition starts fresh: an old model copy may have different words.
      id: `today-${date || "undated"}-${kind}-${original.id}`,
      today: true,
      guide,
    });
  }
  return { date, works, problems, personal: {
    dedication: personalLine(data.dedication, 70, works),
    thread: personalLine(data.thread, 160, works),
  } };
}

// "Title — Author" labels for the calendar and the wrist card.
export function pickLabels(works) {
  const out = {};
  for (const w of works) out[w.kind] = `${w.title} — ${w.author}`;
  return out;
}
