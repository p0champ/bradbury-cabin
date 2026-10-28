// Bradbury Challenge progress: one poem, one story and one essay per day,
// plus one written story submitted each week (due Sunday).
// Pure functions over a plain JSON record, so the same data can live in the
// headset cache now and in durable bridge storage later (Phase 3).

export const PROGRESS_KEY = "cabin-progress";
export const KINDS = ["poem", "story", "essay"];
export const CHALLENGE_START = "2026-10-18";

// Only facts Bastian has stated. Every other past day is "not recorded"
// until he ticks it himself; nothing is invented.
export function seedProgress(today) {
  return {
    version: 1,
    start: CHALLENGE_START,
    // Days before this date with no record are "not recorded", not missed.
    trackingSince: today,
    days: {
      "2026-10-18": { poem: true, story: true, essay: true },
      "2026-10-21": {
        missed: true,
        picks: {
          poem: "The Guest House — Rumi",
          story: "The Story of an Hour — Kate Chopin",
          essay: "The Death of the Moth — Virginia Woolf",
        },
      },
    },
    weeks: {},
  };
}

const pad = (n) => String(n).padStart(2, "0");
export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
// The Sunday that closes the week containing `key` (weeks run Monday–Sunday).
export function weekSunday(key) {
  const day = parseKey(key).getDay(); // 0 = Sunday
  return addDays(key, day === 0 ? 0 : 7 - day);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// A real calendar date in a sensible range (not 2026-02-31, not year 0001).
const realDate = (k) =>
  typeof k === "string" &&
  DATE.test(k) &&
  k >= "2000-01-01" &&
  k <= "2100-12-31" &&
  dateKey(parseKey(k)) === k;
const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v);
// Checks every entry, so an imported file can never crash ticking later.
export function validProgress(p) {
  if (!plain(p) || p.version !== 1) return false;
  if (!realDate(p.start) || !realDate(p.trackingSince)) return false;
  if (!plain(p.days) || !plain(p.weeks)) return false;
  for (const [key, d] of Object.entries(p.days)) {
    if (!realDate(key) || !plain(d)) return false;
    for (const k of [...KINDS, "missed"])
      if (k in d && typeof d[k] !== "boolean") return false;
    if ("picks" in d) {
      if (!plain(d.picks)) return false;
      if (Object.values(d.picks).some((v) => typeof v !== "string")) return false;
    }
  }
  for (const [key, w] of Object.entries(p.weeks)) {
    if (!realDate(key) || !plain(w)) return false;
    if ("submitted" in w && typeof w.submitted !== "boolean") return false;
  }
  return true;
}

export function ticks(p, key) {
  const d = p.days[key] || {};
  return KINDS.filter((k) => d[k] === true).length;
}

// complete | partial | missed | open (today, nothing yet) | unrecorded |
// future | before (before the challenge began)
export function dayStatus(p, key, today) {
  if (key < p.start) return "before";
  if (key > today) return "future";
  const n = ticks(p, key);
  if (n === 3) return "complete";
  if (n > 0) return "partial";
  if (key === today) return "open";
  if (p.days[key]?.missed) return "missed";
  return key >= p.trackingSince ? "missed" : "unrecorded";
}

// Toggling is only allowed from the start date up to today.
export function toggleTick(p, key, kind, today) {
  if (!KINDS.includes(kind) || key < p.start || key > today) return false;
  const d = (p.days[key] ||= {});
  d[kind] = !d[kind];
  // An untick is kept as an explicit false (not deleted), so merging with an
  // older Drive copy can never bring the tick back.
  return true;
}
export function toggleWeekly(p, key, today) {
  const sunday = weekSunday(key);
  if (key < p.start || key > today) return false;
  const w = (p.weeks[sunday] ||= {});
  w.submitted = !w.submitted;
  if (!w.submitted && w.grade == null && !w.title) delete p.weeks[sunday];
  return true;
}

// Consecutive complete days ending today, or ending yesterday while today is
// still being worked on.
export function streak(p, today) {
  let key = ticks(p, today) === 3 ? today : addDays(today, -1);
  let n = 0;
  while (key >= p.start && ticks(p, key) === 3) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

export function overview(p, today) {
  const counts = { complete: 0, partial: 0, missed: 0, unrecorded: 0 };
  for (let key = p.start; key <= today; key = addDays(key, 1)) {
    const s = dayStatus(p, key, today);
    if (s in counts) counts[s]++;
  }
  const thisSunday = weekSunday(today);
  return {
    ...counts,
    streak: streak(p, today),
    weekSubmitted: !!p.weeks[thisSunday]?.submitted,
    daysToSunday: Math.round((parseKey(thisSunday) - parseKey(today)) / 864e5),
  };
}

// Calendar grid for one month: Monday-first rows of {key, day} or null.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d++)
    cells.push({ key: dateKey(new Date(year, month, d)), day: d });
  while (cells.length % 7) cells.push(null);
  return cells;
}

// raw: the stored text, if any. recovered: something was stored but it was
// unreadable, so the caller must keep a backup before ever saving over it.
export function readProgress(storage, today) {
  let raw = null;
  try {
    raw = storage.getItem(PROGRESS_KEY);
  } catch {}
  if (raw != null) {
    try {
      const p = JSON.parse(raw);
      if (validProgress(p)) return { progress: p, raw, recovered: false };
    } catch {}
    return { progress: seedProgress(today), raw, recovered: true };
  }
  return { progress: seedProgress(today), raw: null, recovered: false };
}
export function loadProgress(storage, today) {
  return readProgress(storage, today).progress;
}
export function saveProgress(storage, p) {
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
