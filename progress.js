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
export function berlinDateKey(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(v=>[v.type,v.value]));
  return `${p.year}-${p.month}-${p.day}`;
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
const WORK_ID = /^[a-z0-9-]{1,120}$/;
export function validCompletion(id, timestamp) {
  if (typeof id !== "string" || !WORK_ID.test(id) || typeof timestamp !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp) || !realDate(timestamp.slice(0, 10))) return false;
  const parsed = new Date(timestamp);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === timestamp.replace(/Z$/, timestamp.includes(".") ? "Z" : ".000Z");
}
// Today and archived editions use wrapper IDs; completion belongs to the
// catalogue edition, regardless of which shelf opened it.
export function canonicalWorkId(work) {
  const raw = work?.catalogueId || work?.id;
  if (typeof raw !== "string") return null;
  const id = /^today-\d{4}-\d{2}-\d{2}-(?:poem|story|essay)-(.+)$/.exec(raw)?.[1] || raw;
  return WORK_ID.test(id) ? id : null;
}
export function workRead(progress, work) {
  const id = canonicalWorkId(work);
  if (!id) return false;
  if (Object.hasOwn(progress.completedWorks || {}, id) && validCompletion(id, progress.completedWorks[id])) return true;
  // Earlier builds recorded only daily ticks. Only an exact saved edition
  // may inherit one; a tick for another poem says nothing about this poem.
  return KINDS.includes(work?.kind) && Object.values(progress.days || {}).some(day =>
    day?.[work.kind] === true && day.ids?.[work.kind] === id);
}
export function markWorkRead(progress, work, day, clock = new Date()) {
  const id = canonicalWorkId(work);
  const date = clock instanceof Date ? clock : new Date(clock);
  if (!id || !KINDS.includes(work?.kind) || !Number.isFinite(date.getTime())) return false;
  const timestamp = date.toISOString();
  if (!validCompletion(id, timestamp)) return false;
  const ledger = (progress.completedWorks ||= {});
  let changed = false;
  if (!Object.hasOwn(ledger, id) || !validCompletion(id, ledger[id])) {
    Object.defineProperty(ledger, id, { value: timestamp, enumerable: true, writable: true, configurable: true });
    changed = true;
  }
  const assigned = realDate(day) && day >= progress.start && day <= berlinDateKey(date) ? progress.days[day] : null;
  if (assigned?.ids?.[work.kind] === id && assigned[work.kind] !== true) {
    assigned[work.kind] = true;
    changed = true;
  }
  return changed;
}
// Checks every entry, so an imported file can never crash ticking later.
export function validProgress(p) {
  if (!plain(p) || p.version !== 1) return false;
  if (!realDate(p.start) || !realDate(p.trackingSince)) return false;
  if (!plain(p.days) || !plain(p.weeks)) return false;
  if ("completedWorks" in p && (!plain(p.completedWorks) || Object.entries(p.completedWorks).some(([id, stamp]) => !validCompletion(id, stamp)))) return false;
  for (const [key, d] of Object.entries(p.days)) {
    if (!realDate(key) || !plain(d)) return false;
    for (const k of [...KINDS, "missed"])
      if (k in d && typeof d[k] !== "boolean") return false;
    if ("picks" in d) {
      if (!plain(d.picks)) return false;
      if (Object.values(d.picks).some((v) => typeof v !== "string")) return false;
    }
    // Catalogue IDs of the day's picks (Build 028), so the shelf reopens
    // exactly the edition that was given.
    if ("ids" in d) {
      if (!plain(d.ids)) return false;
      if (Object.entries(d.ids).some(([k, v]) => !KINDS.includes(k) || typeof v !== "string" || !/^[a-z0-9-]{1,120}$/.test(v)))
        return false;
    }
    // Optional saved guides are validated against their edition when opened
    // and merged. Bad notes must never invalidate otherwise sound ticks.
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

// One missed/partial past day per Monday–Sunday week protects the chain,
// without adding a reading day. Unknown history breaks continuity and earns
// nothing. An unfinished today is still open, not a miss.
export function streakStats(p, today) {
  let current=0,best=0,completedDays=0,week=null,misses=0;
  const history=[];
  for(let key=p.start;key<=today;key=addDays(key,1)) {
    const wk=weekSunday(key);if(wk!==week){week=wk;misses=0;}
    const complete=ticks(p,key)===3,status=dayStatus(p,key,today);
    let protectedDay=false;
    if(complete){current++;completedDays++;best=Math.max(best,current);}
    else if(key===today){} // The day is not over yet.
    else if(status==='unrecorded'){current=0;}
    else {misses++;if(misses<=1)protectedDay=current>0;else current=0;}
    history.push({date:key,complete,streak:current,completedDays,protected:protectedDay});
  }
  return {current,best,completedDays,protectionAvailable:misses===0,history};
}
export function streak(p, today) { return streakStats(p,today).current; }

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
