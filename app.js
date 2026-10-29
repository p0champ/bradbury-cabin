import { PAGE, SIZES, layout, placedPose } from "./core.js?v=37";
import {
  GestureEngine,
  menuButtons,
  menuHit,
  MENU_PAGES,
  nearFacePalm,
  HOLD_MS,
  MIN_PINCH_MS,
  inView,
  facingPanel,
  handAnchor,
} from "./gestures.js?v=37";
import { renderer, identity, multiply, checkGl } from "./gl.js?v=37";
import { HandBadges } from "./hand-badges.js?v=37";
import { WristWatch, watchSummary, WATCH_HAND } from "./watch.js?v=37";
import { LIBRARY } from "./library.js?v=37";
import { pageForAnchor, loadReading, saveReading } from "./reader.js?v=37";
import { layoutReading } from "./reading-flow.js?v=37";
import { paintLibrary, libraryHit } from "./library-panel.js?v=37";
import { todayFacts, workStatus, paintToday, todayHit, nextUnread, closingHit, paintClosing, REVEAL_STEPS, REVEAL_MS } from "./today-panel.js?v=37";
import { parsePicks, pickLabels } from "./picks.js?v=37";
import { SOURCE_CATALOGUE } from "./source-catalogue.js?v=37";
import { shelfDays, resolveDay, pastWork, paintShelf, shelfHit, paintShelfDay, dayHit, DAYS_PER_PAGE } from "./shelf-panel.js?v=37";
import { rememberGuides, dayGuide } from "./guide-archive.js?v=37";
import { rememberPersonal, personalFor, clearReplacedTicks } from "./daily-lines.js?v=37";
import { DriveLink, mergeProgress, CLIENT_ID_KEY, preloadGoogle } from "./drive.js?v=37";
import { GOOGLE_CLIENT_ID } from "./config.js?v=37";
import { Ambience, AMBIENCE_KINDS, AMBIENCE_LABEL, VOLUME_STEPS, ambienceVolume } from "./ambience.js?v=37";
import { GazeDwell, GazeRing, gazeZone } from "./gaze.js?v=37";
import { Pointer, rayOnPage, OneEuro, smoothRay } from "./pointer.js?v=37";
import { paintWelcome, welcomeHit, greeting, WELCOME_STEPS, WELCOME_MS } from "./welcome-panel.js?v=37";
import { MOODS, UI, accentFor, goldFor, lift, unlift, WINDOW_RADIUS, spaced, unspaced } from "./theme.js?v=37";
import { Arrival, ARRIVAL_MS, pageArrivalPose, smooth } from "./arrival.js?v=37";
import { EntrySound } from "./entry-sound.js?v=37";
import {
  readProgress,
  saveProgress,
  toggleTick,
  toggleWeekly,
  validProgress,
  dateKey,
  parseKey,
} from "./progress.js?v=37";
import {
  paintCalendar,
  calendarHit,
  shiftMonth,
  dayInputAllowed,
} from "./calendar.js?v=37";
// Headset cache for challenge progress. Export/Import on the browser page is
// the backup until durable bridge storage arrives with Claude (Phase 3).
let progressPersistent = true,
  storageWorks = true,
  progressNotice = "",
  unreadableBackup = null;
const store = (() => {
  try {
    const s = globalThis.localStorage;
    s.getItem("cabin-progress");
    return s;
  } catch {
    // No working storage: ticks last only until this page closes.
    progressPersistent = false;
    storageWorks = false;
    const memory = new Map();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => memory.set(k, v),
    };
  }
})();
const todayKey = () => dateKey(new Date());
let progress,
  progressVersion = 0;
{
  const loaded = readProgress(store, todayKey());
  progress = loaded.progress;
  if (loaded.recovered) {
    // Keep the unreadable record instead of overwriting it (once per text).
    unreadableBackup = loaded.raw;
    let kept = false;
    try {
      kept = Object.keys(localStorage).some(
        (k) => k.startsWith("cabin-progress.bak-") && localStorage.getItem(k) === loaded.raw,
      );
      if (!kept) {
        store.setItem(`cabin-progress.bak-${todayKey()}-${Date.now()}`, loaded.raw);
        kept = true;
      }
    } catch {}
    if (kept)
      progressNotice =
        "Saved progress was unreadable. A backup was kept; import a progress file.";
    else {
      // Without a backup, never save over the original until an import.
      progressPersistent = false;
      progressNotice =
        "Saved progress was unreadable and could not be backed up. Not saving.";
    }
  } else if (loaded.raw == null) saveProgress(store, progress);
  if (!progressPersistent)
    progressNotice = "Not saving on this headset · export before leaving.";
  try {
    navigator.storage?.persist?.();
  } catch {}
}
// Saves, and tells the truth when it could not.
function storeProgress() {
  progressVersion++;
  progress.savedAt = new Date().toISOString();
  scheduleDriveSave();
  const ok = progressPersistent && saveProgress(store, progress);
  if (!ok) {
    progressNotice = "Not saving on this headset · export before leaving.";
    feedback("Could not save on this headset · export from the browser page");
  } else if (progressNotice.startsWith("Saved progress was unreadable"))
    progressNotice = "";
  return ok;
}
// A pinch repeated right after opening a day must not tick that day.
let dayOpenedAt = -Infinity,
  paintedToday = null;
const calendarView = (() => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), selected: null };
})();
const CALENDAR_PAGES = ["calendar", "day"];
// The two-page sampler stays the default text; the starter shelf follows.
const SAMPLER = {
  id: "sampler",
  kind: "sampler",
  title: "A first leaf",
  author: "Blake & O. Henry excerpts",
};
// Today's three from Claude (via Google Drive), cached on the headset so they
// stay readable offline. They sit at the top of the Library.
const TODAY_KEY = "cabin-today";
let todayWorks = [];
let todayWorksFor = null;
let picksNotice = "";
function loadTodayCache() {
  todayWorksFor = dateKey(new Date());
  try {
    const r = parsePicks(localStorage.getItem(TODAY_KEY) || "", progress.days);
    if (r.date && r.date <= todayWorksFor && r.works.length === 3 && !r.problems.length) {
      const notesChanged = rememberGuides(progress, r.date, r.works, { onlyMissing: true });
      const linesChanged = rememberPersonal(progress, r.date, r, { onlyMissing: true });
      if (notesChanged || linesChanged) {
        progress.savedAt = new Date().toISOString();
        if (!saveProgress(store, progress)) progressNotice = "Reading notes could not be saved on this headset.";
      }
    }
    todayWorks = r.date === todayWorksFor && r.works.length === 3 && !r.problems.length ? r.works : [];
    for (const work of todayWorks) {
      const original = SOURCE_CATALOGUE.find(w => w.id === work.catalogueId);
      const saved = original && dayGuide(progress.days[r.date], work.kind, original);
      if (saved) work.guide = saved;
    }
    picksNotice = r.date === todayWorksFor && !todayWorks.length
      ? "Saved selections need source-backed replacements. Sync with Drive, then ask Claude for today's three."
      : "";
  } catch {
    todayWorks = [];
  }
}
loadTodayCache();
const WORKS = [];
// Works that stopped being "today" stay readable while open, so passing
// midnight never pulls the page away mid-read.
let carriedWorks = [];
// Earlier days' works opened from Your shelf (exact catalogue editions).
const shelfWorks = [];
let shelfTop;
function rebuildWorks(openId = null) {
  const open = [...WORKS, ...carriedWorks].find(
    (w) => w.id === openId && !todayWorks.includes(w) && (w.today || carriedWorks.includes(w)),
  );
  carriedWorks = open ? [{ ...open, today: false }] : [];
  WORKS.length = 0;
  WORKS.push(...todayWorks, SAMPLER, ...carriedWorks, ...shelfWorks.filter((w) => !todayWorks.some((t) => t.id === w.id)), ...LIBRARY);
}
// The Library lists the sampler, today's three and the starter shelf; earlier
// days live on Your shelf instead.
const libraryWorks = () => WORKS.filter((w) => !w.shelfDate && !carriedWorks.includes(w));
// Adds an earlier day's work, by the id it had that day, if the catalogue
// holds it. Returns the work or null.
function addShelfWork(id) {
  const m = /^today-(\d{4}-\d{2}-\d{2})-(poem|story|essay)-(.+)$/.exec(id);
  if (!m) return null;
  const known = WORKS.find((w) => w.id === id);
  if (known) return known;
  const work = SOURCE_CATALOGUE.find((w) => w.id === m[3] && w.kind === m[2]);
  if (!work) return null;
  shelfWorks.push(pastWork(m[1], m[2], work, progress.days[m[1]]));
  rebuildWorks(state?.workId);
  return WORKS.find((w) => w.id === id) || null;
}
// Notes arriving from Drive must not move an open source page into the
// newly inserted introduction. Keep its existing section/word anchor.
function refreshSavedGuides() {
  for (const work of WORKS) {
    const match = /^today-(\d{4}-\d{2}-\d{2})-(poem|story|essay)-(.+)$/.exec(work.id);
    if (!match) continue;
    const original = SOURCE_CATALOGUE.find(w => w.id === match[3] && w.kind === match[2]);
    if (!original) continue;
    const guide = dayGuide(progress.days[match[1]], match[2], original);
    if (JSON.stringify(work.guide || null) !== JSON.stringify(guide)) {
      if (work.id === state.workId) state.pendingAnchor = currentAnchor();
      work.guide = guide;
    }
  }
}
rebuildWorks();
const reading = loadReading(store);
const workById = (id) => WORKS.find((w) => w.id === id) || SAMPLER;
const currentAnchor = () => pages[state.page]?.anchor || null;
const $ = (id) => document.getElementById(id),
  canvas = $("page"),
  ctx = canvas.getContext("2d");
let preferences = {};
try {
  preferences = JSON.parse(localStorage.getItem("cabin-controls") || "{}");
  if (
    !preferences ||
    typeof preferences !== "object" ||
    Array.isArray(preferences)
  )
    preferences = {};
} catch {}
const savePreferences = () => {
  try {
    localStorage.setItem("cabin-controls", JSON.stringify(preferences));
  } catch {}
};
if (preferences.handMapRevision !== 9) {
  preferences.swapped = !Boolean(preferences.swapped);
  preferences.handMapRevision = 9;
  savePreferences();
}
// Changing what the window shows fades the new content in over 160 ms.
let lastView = null, viewFadeAt = -1e9, viewFadeFrom = 0.5, quietView = false;
const VIEW_FADE_MS = 160;
// After a few visits the gestures are known: the instruction lines go quiet.
const learned = () => (preferences.visits || 0) > 3;
const state = {
  menuPage: "main",
  // Steps of Today's first showing still to come (null: fully shown).
  todayReveal: null,
  shelfPage: 0,
  shelfDay: null,
  workId: "sampler",
  pendingAnchor: null,
  centering: false,
  arriving: false,
  arrivalError: null,
  entrySound: preferences.entrySound !== false,
  handEntryStarted: null,
  entryAudioLast: null,
  attentionPaused: false,
  menuOpen: false,
  practice: false,
  swapped: !!preferences.swapped,
  headPointer: !!preferences.headPointer,
  handFeedbackError: null,
  watchError: null,
  wristCalendar: preferences.wristCalendar !== false,
  mood: preferences.mood === "modern" ? "modern" : "literary",
  gazeTurn: preferences.gazeTurn === true, // off by default
  ambienceVolume: ambienceVolume(preferences.ambienceVolume),
  ambience: AMBIENCE_KINDS.includes(preferences.ambience) ? preferences.ambience : "off",
  practiceMarks: { next: false, prev: false, menu: false },
  feedback: "",
  feedbackUntil: 0,
  // Text size and paper/night are remembered between visits.
  size: [0, 1, 2].includes(preferences.size) ? preferences.size : 1,
  night: preferences.night === true,
  page: 0,
  mode: "layer",
  session: null,
  hover: null,
  error: null,
  graphicsError: null,
  renderRoute: null,
  layerStatus: "not tested",
  actualPixels: null,
  blend: null,
  turns: 0,
};
// Resume the last work opened, at its saved place (an earlier day's work is
// rebuilt from the catalogue first).
if (reading.last && !WORKS.some((w) => w.id === reading.last)) addShelfWork(reading.last);
if (reading.last && WORKS.some((w) => w.id === reading.last)) {
  state.workId = reading.last;
  state.pendingAnchor = reading.places[reading.last]?.anchor || null;
}
let pages = [],
  gpu,
  ref,
  base,
  binding,
  quad,
  placement,
  wantRecenter = true,
  dirty = true,
  sessionGeneration = 0;
let projectionRoute = false,
  layerDirty = true;
const gestures = new GestureEngine();
let nativeQueue = [],
  lastFrameTime = 0;
let gazeRing = null;
let pointer = null;
// Per hand: a steadied ray, and the choice held from the moment a pinch closes.
const rayFilters = new Map(), heldTargets = new Map();
const gazeDwell = new GazeDwell(),
  ambience = new Ambience(state.ambienceVolume);
let handBadges = null,
  wristWatch = null,
  watchCache = { key: null, summary: null };
// Recomputed only when progress or the date changes, not every frame.
function currentWatchSummary() {
  const key = progressVersion + ":" + todayKey();
  if (watchCache.key !== key)
    watchCache = { key, summary: watchSummary(progress, todayKey()) };
  return watchCache.summary;
}
let entrySound = null;
let arrival = null,
  arrivalElapsed = 0,
  lastArrivalTick = 0,
  arrivalAnchor = null;
let menuPlacement = null,
  lastViewer = null,
  lastDisplay = null,
  pointerSource = null,
  ending = false;
const report = (message) => {
  $("status").textContent = message;
};
function readingPosition() {
  const page = pages[state.page];
  const label = page?.section === "before" ? "Before reading · "
    : page?.section === "after" ? "After reading · " : "";
  return `${label}Page ${page?.sectionPage || state.page + 1} of ${page?.sectionPages || pages.length}`;
}
const volumeLabel = () => state.ambienceVolume === 0 ? "Off" : `${Math.round(state.ambienceVolume * 100)}%`;
function updateVolumeControl() {
  $("ambience-volume").value = Math.round(state.ambienceVolume * 100);
  $("ambience-volume").setAttribute("aria-valuetext", volumeLabel());
  $("ambience-volume-value").textContent = volumeLabel();
}
function setAmbienceVolume(value) {
  state.ambienceVolume = ambienceVolume(value);
  preferences.ambienceVolume = state.ambienceVolume;
  savePreferences();
  ambience.setVolume(entrySound?.context, state.ambienceVolume);
  if (state.session) entrySound?.context?.resume?.().catch?.(() => {});
  updateVolumeControl();
  if (state.menuOpen) paint();
}
$("ambience-volume").oninput = e => setAmbienceVolume(Number(e.target.value) / 100);
function paint() {
  updateVolumeControl();
  // After midnight, yesterday's picks stop being "today".
  if (todayWorksFor !== dateKey(new Date())) {
    loadTodayCache();
    rebuildWorks(state.workId);
  }
  // At midnight yesterday's three stop being Today: fall back to Your shelf.
  if (state.menuOpen && ((state.menuPage === "today" && !hasToday()) ||
      (state.menuPage === "closing" && !todayWorks.some((w) => w.id === state.workId)))) {
    // Yesterday's three now belong on the shelf. A pinch already under way
    // must not choose a shelf row instead.
    state.menuPage = "shelf";
    state.shelfPage = 0;
    state.todayReveal = null;
    state.hover = null;
    dayOpenedAt = lastFrameTime;
  }
  canvas.dataset.view = state.arriving
    ? "arrival"
    : state.centering
      ? "centering"
      : state.menuOpen
        ? "menu"
        : state.practice
          ? "practice"
          : "reading";
  canvas.dataset.target = state.hover || "";
  canvas.dataset.menuPage = state.menuOpen ? state.menuPage : "";
  canvas.setAttribute(
    "aria-label",
    state.menuOpen
      ? "Cabin controls menu"
      : state.practice
        ? "Gesture practice: Next, Back and Menu"
        : "Public domain poem and short story excerpt",
  );
  const work = workById(state.workId);
  canvas.dataset.work = work.id;
  if (!state.menuOpen && !state.practice && !state.centering)
    canvas.setAttribute("aria-label", `Reading: ${work.title}`);
  pages =
    work === SAMPLER
      ? layout(ctx, state.size, MOODS[state.mood].body)
      : layoutReading(ctx, work, state.size, {
          serif: MOODS[state.mood].body,
          titleStyle: MOODS[state.mood].title,
        });
  if (state.pendingAnchor) {
    state.page = pageForAnchor(pages, state.pendingAnchor);
    state.pendingAnchor = null;
  }
  state.page = Math.max(0, Math.min(state.page, pages.length - 1));
  const section = pages[state.page]?.section || "text";
  canvas.dataset.section = section;
  const mood = MOODS[state.mood],
    palette = state.night ? mood.night : mood.paper;
  const bg = palette.bg,
    ink = palette.ink,
    muted = palette.muted;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PAGE.width, PAGE.height);
  // A quiet running head, like a book's: the cabin on the left, the work on
  // the right, a hairline below. No slogan competing with the page.
  ctx.fillStyle = muted;
  ctx.font = `500 26px ${UI}`;
  spaced(ctx, 6);
  ctx.fillText("BRADBURY CABIN", 180, 170);
  spaced(ctx, 4);
  ctx.textAlign = "right";
  {
    const w = workById(state.workId);
    let title = (w === SAMPLER ? "THE FIRST LEAF" : w.title).toUpperCase();
    while (title.length > 8 && ctx.measureText(title).width > 900) title = title.slice(0, -2).trimEnd() + "…";
    if (!state.menuOpen && !state.centering && !state.arriving) ctx.fillText(title, 1868, 170);
    // Display only: which of today's three this is, and which are read.
    if (!state.menuOpen && !state.centering && !state.arriving && todayWorks.some((t) => t.id === w.id)) {
      let x = 1868 - ctx.measureText(title).width - 56;
      for (const t of [...todayWorks].reverse()) {
        const current = t.id === w.id, read = progress.days[todayKey()]?.[t.kind] === true;
        ctx.font = `${current ? 44 : 34}px ${UI}`;
        ctx.fillStyle = current ? ink : muted;
        ctx.fillText(read ? "\u25c6" : "\u25c7", x, current ? 176 : 172);
        x -= 54;
      }
    }
  }
  unspaced(ctx);
  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(180, 222, 1688, 2);
  ctx.globalAlpha = 1;
  const welcomeColours = () => ({
    ink, muted, card: palette.card, hover: palette.hover, serif: mood.body,
    italic: state.mood === "literary" ? "italic " : "",
  });
  const welcomeInfo = () => {
    const w = workById(state.workId);
    return {
      hello: greeting(),
      line: hasToday()
        ? todayFacts(new Date(), progress, todayKey()).allRead ? "Today’s three are read." : "Three pieces are waiting."
        : "Today’s three haven’t arrived yet.",
      today: hasToday(),
      resume: { title: w === SAMPLER ? "the first leaf" : w.title, place: state.page > 0 ? `p. ${state.page + 1}` : "" },
    };
  };
  if (state.arriving) {
    // While the window fades in it shows only the greeting; the welcome
    // screen then builds from exactly this picture, so nothing jumps.
    paintWelcome(ctx, { ...welcomeInfo(), reveal: 0, c: welcomeColours() });
  } else if (state.centering) {
    ctx.fillStyle = ink;
    ctx.font = `82px ${mood.body}`;
    ctx.fillText("Get comfortable.", 180, 650);
    ctx.font = `45px ${UI}`;
    for (const [i, line] of [
      "Look where you want to read.",
      "Pinch once, then release to centre here.",
      "Or click your controller trigger once.",
      "Nothing else is active until you confirm.",
    ].entries())
      ctx.fillText(line, 180, 830 + i * 110);
    ctx.font = `32px ${UI}`;
    ctx.fillText("CENTRE HERE  ·  PINCH AND RELEASE", 180, 1500);
  } else if (state.menuOpen && state.menuPage === "welcome") {
    canvas.dataset.welcomePrimary = hasToday() ? "begin" : "continue";
    paintWelcome(ctx, { ...welcomeInfo(), reveal: state.welcomeReveal, hover: state.hover, c: welcomeColours() });
  } else if (state.menuOpen && (state.menuPage === "today" || state.menuPage === "closing")) {
    const today = todayKey();
    const c = {
      bg,
      ink,
      muted,
      card: palette.card,
      serif: mood.body,
      italic: state.mood === "literary" ? "italic " : "",
      hover: palette.hover,
      accent: accentFor(state.night),
      gold: goldFor(state.night),
    };
    if (state.menuPage === "today") {
      const statuses = {};
      for (const w of todayWorks) statuses[w.id] = workStatus(w, progress, today, reading.places);
      paintToday(ctx, {
        works: todayWorks,
        hover: state.hover,
        facts: todayFacts(new Date(), progress, today),
        statuses,
        personal: personalFor(progress.days[today], todayWorks),
        note: picksNotice,
        reveal: state.todayReveal ?? REVEAL_STEPS,
        c,
      });
    } else {
      const work = workById(state.workId);
      paintClosing(ctx, {
        work,
        next: nextUnread(todayWorks, work, progress, today),
        read: progress.days[today]?.[work.kind] === true,
        allRead: todayFacts(new Date(), progress, today).allRead,
        thread: personalFor(progress.days[today], todayWorks).thread,
        hover: state.hover,
        c,
      });
    }
  } else if (state.menuOpen && (state.menuPage === "shelf" || state.menuPage === "shelfday")) {
    const c = {
      bg,
      ink,
      muted,
      card: palette.card,
      serif: mood.body,
      italic: state.mood === "literary" ? "italic " : "",
      hover: palette.hover,
      accent: accentFor(state.night),
      gold: goldFor(state.night),
    };
    if (state.menuPage === "shelf") {
      const days = shelfDays(progress, todayKey());
      state.shelfPage = Math.max(0, Math.min(state.shelfPage, Math.ceil(days.length / DAYS_PER_PAGE) - 1));
      // A new day at midnight shifts every row: a pinch under way must not
      // land on the neighbouring day.
      if (days[0] !== shelfTop) {
        if (shelfTop !== undefined) {
          dayOpenedAt = lastFrameTime;
          state.hover = null;
        }
        shelfTop = days[0];
      }
      paintShelf(ctx, { days, page: state.shelfPage, entriesFor: (d) => resolveDay(progress, d, SOURCE_CATALOGUE), hover: state.hover, note: picksNotice || driveNote(), c });
    } else {
      const entries = resolveDay(progress, state.shelfDay, SOURCE_CATALOGUE);
      const statuses = {};
      for (const e of entries)
        if (e.work && reading.places[`today-${state.shelfDay}-${e.kind}-${e.work.id}`]?.page > 0) statuses[e.kind] = "In progress";
      paintShelfDay(ctx, { date: state.shelfDay, entries, statuses, hover: state.hover, c });
    }
  } else if (state.menuOpen && state.menuPage === "library") {
    const places = {};
    for (const w of libraryWorks())
      if (w !== SAMPLER && reading.places[w.id]?.page > 0) places[w.id] = "in progress";
    paintLibrary(ctx, {
      note: driveNote(),
      works: libraryWorks(),
      hover: state.hover,
      current: state.workId,
      places,
      c: {
        bg,
        ink,
        muted,
        card: palette.card,
        serif: mood.body,
        italic: state.mood === "literary" ? "italic " : "",
        hover: palette.hover,
        accent: accentFor(state.night),
      },
    });
  } else if (state.menuOpen && CALENDAR_PAGES.includes(state.menuPage)) {
    paintedToday = todayKey();
    paintCalendar(ctx, {
      notice: progressNotice,
      page: state.menuPage,
      view: calendarView,
      progress,
      today: todayKey(),
      hover: state.hover,
      c: {
        bg,
        ink,
        muted,
        card: palette.card,
        serif: mood.body,
        italic: state.mood === "literary" ? "italic " : "",
        accent: accentFor(state.night),
        done: state.night ? "#7f9a83" : "#6d8a74",
        faint: state.night ? "#4d5c52" : "#c4c2b0",
        warn: state.night ? "#d39a77" : "#a5603d",
        hover: state.night ? "#e2c77e" : "#c8973a",
      },
    });
  } else if (state.menuOpen) {
    const more = state.menuPage === "more";
    ctx.fillStyle = ink;
    ctx.font = `84px ${mood.body}`;
    ctx.fillText(state.menuPage === "volume" ? "Background volume" : more ? "More settings" : "Menu", 274, 470);
    ctx.fillStyle = muted;
    ctx.font = `36px ${UI}`;
    ctx.fillText(
      state.menuPage === "volume" ? `Current volume: ${volumeLabel()} · Choose a level.` : state.headPointer
        ? "Look at a choice, then pinch and release."
        : "Point at a choice, then pinch and release.",
      274,
      540,
    );
    const values = {
      night: state.night ? "Night" : "Paper",
      size: ["Small", "Medium", "Large"][state.size],
      more: "›",
      exit: "Exit VR",
      swap: state.swapped ? "Left hand" : "Right hand",
      pointer: state.headPointer ? "Head" : "Hand",
      sound: state.entrySound ? "On" : "Off",
      watch: state.wristCalendar ? "Right wrist" : "Off",
      mood: state.mood === "modern" ? "Clean modern" : "Literary",
      gaze: state.gazeTurn ? "On" : "Off",
      ambience: AMBIENCE_LABEL[state.ambience],
      volume: volumeLabel(),
    };
    if (hasToday()) {
      const read = todayFacts(new Date(), progress, todayKey()).read;
      values.library = preferences.todayShown === todayKey() ? `${read} of 3 read` : "New";
    }
    for (const step of VOLUME_STEPS)
      values[`volume-${step * 100}`] = Math.abs(state.ambienceVolume - step) < 0.001 ? "✓" : "";
    const card = palette.card;
    // An inset grouped list, as on Apple platforms: neighbouring rows share
    // one soft panel divided by hairlines; only the row you point at lifts.
    // Drawing only: every row keeps its own hit rectangle.
    const rows = menuButtons.filter((b) => b.page === state.menuPage);
    const groups = [];
    for (const b of rows) {
      const g = groups.at(-1), last = g?.at(-1);
      if (last && b.y - (last.y + last.h) < 40 && b.x === last.x && b.w === last.w) g.push(b);
      else groups.push([b]);
    }
    for (const g of groups) {
      const top = g[0], bottom = g.at(-1);
      ctx.fillStyle = card;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(top.x, top.y, top.w, bottom.y + bottom.h - top.y, 40);
      else ctx.rect(top.x, top.y, top.w, bottom.y + bottom.h - top.y);
      ctx.fill();
      ctx.fillStyle = muted;
      ctx.globalAlpha = 0.25;
      for (const b of g.slice(0, -1)) if (state.hover !== b.id && state.hover !== g[g.indexOf(b) + 1].id) ctx.fillRect(b.x + 70, b.y + b.h + (g[g.indexOf(b) + 1].y - b.y - b.h) / 2 - 1, b.w - 140, 2);
      ctx.globalAlpha = 1;
    }
    for (const b of rows) {
      const hot = state.hover === b.id;
      if (hot) {
        ctx.fillStyle = palette.hover;
        lift(ctx);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 40);
        else ctx.rect(b.x, b.y, b.w, b.h);
        ctx.fill();
        unlift(ctx);
      }
      ctx.fillStyle = ink;
      ctx.font = `${b.id === "resume" && state.mood === "literary" ? "italic " : ""}54px ${mood.body}`;
      ctx.textAlign = "left";
      ctx.fillText(
        (["back", "volume-back"].includes(b.id) ? "‹  " : "") + (b.id === "library" ? (hasToday() ? "Today" : "Your shelf") : b.label),
        b.x + 70,
        b.y + b.h / 2 + 20,
      );
      if (values[b.id]) {
        ctx.fillStyle = muted;
        ctx.font = `42px ${UI}`;
        ctx.textAlign = "right";
        ctx.fillText(values[b.id], b.x + b.w - 70, b.y + b.h / 2 + 15);
      }
    }
    ctx.textAlign = "left";
  } else if (state.practice) {
    ctx.fillStyle = ink;
    ctx.font = `76px ${mood.body}`;
    ctx.fillText("A moment to find your rhythm.", 160, 450);
    ctx.fillStyle = muted;
    ctx.font = `38px ${UI}`;
    ctx.fillText(
      "Rest your hands anywhere the headset can see them.",
      160,
      560,
    );
    const rows = [
      [
        "next",
        state.swapped
          ? "Left pinch, then release"
          : "Right pinch, then release",
        "Next page",
      ],
      [
        "prev",
        state.swapped
          ? "Right pinch, then release"
          : "Left pinch, then release",
        "Previous page",
      ],
      [
        "menu",
        "Hold either pinch for 1.4 seconds",
        "Open the menu (optional here)",
      ],
    ];
    rows.forEach(([id, title, detail], i) => {
      const y = 800 + i * 360;
      ctx.fillStyle = state.night ? "#29372f" : "#e8e6d7";
      ctx.fillRect(160, y - 110, 1720, 280);
      ctx.fillStyle = ink;
      ctx.font = `54px ${mood.body}`;
      ctx.fillText(
        (state.practiceMarks[id] ? "✓  " : "0" + (i + 1) + "  ") + title,
        220,
        y,
      );
      ctx.fillStyle = muted;
      ctx.font = `38px ${UI}`;
      ctx.fillText(detail, 320, y + 80);
    });
    ctx.fillStyle = muted;
    ctx.font = `36px ${UI}`;
    ctx.fillText(
      "Practice never changes your reading page. Next + Back finish it.",
      160,
      1880,
    );
    ctx.fillText(
      "Holding a pinch also lets you leave this practice.",
      160,
      1950,
    );
  } else {
    for (const b of pages[state.page]) {
      if (typeof b.text !== "string") continue; // spacing between blocks
      ctx.fillStyle = b.kind === "meta" ? muted : ink;
      const m = MOODS[state.mood];
      ctx.font = `${b.kind === "heading" ? "bold " : b.kind === "title" ? m.title + " " : ""}${b.font}px ${b.kind === "meta" ? UI : m.body}`;
      ctx.fillText(b.text, b.x ?? 194, b.y);
    }
  }
  ctx.fillStyle = muted;
  ctx.font = `32px ${UI}`;
  ctx.textAlign = "left";
  if (!state.menuOpen && !state.centering && !state.arriving)
    ctx.fillText(
      readingPosition().replace(/Page (\d+) of (\d+)/, "$1 / $2") +
        (state.mode === "layer" ? "" : "  ·  sharpness test B"),
      160,
      2175,
    );
  ctx.font = `36px ${UI}`;
  if (state.gazeTurn && !state.menuOpen) ctx.textAlign = "center";
  ctx.fillText(
    (state.arriving
      ? " "
      : state.centering
        ? "Only centring is active · pinch and release to place the page."
        : state.attentionPaused
          ? "Paused · look toward the page, then open your hand."
          : state.feedback) ||
      (learned() && !state.practice
        ? ""
        : state.menuOpen
        ? state.menuPage === "welcome"
          ? ""
          : state.menuPage === "today"
          ? "Hold a pinch to continue reading."
          : "Hold a pinch to close the menu."
        : (state.swapped
            ? "Left: next   ·   Right: back   ·   Hold: menu"
            : "Right: next   ·   Left: back   ·   Hold: menu") +
          (state.gazeTurn ? "   ·   Or look at a bottom corner" : "")),
    // With look-to-turn on, keep this text in the centre, away from the
    // two bottom corners that turn the page.
    state.gazeTurn && !state.menuOpen
      ? 1024
      : state.menuOpen
        ? state.menuPage === "calendar"
          ? 194
          : 274
        : 160,
    2320,
  );
  ctx.textAlign = "left";
  // A window, not a sheet: soft rounded corners, transparent beyond them.
  if (state.mode !== "texture") {
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0, 0, PAGE.width, PAGE.height, WINDOW_RADIUS);
    else ctx.rect(0, 0, PAGE.width, PAGE.height);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  {
    // A new view fades in from half; a page turn only breathes (from 0.85).
    const view = `${state.menuOpen}|${state.menuPage}|${state.workId}|${state.page}`;
    if (view !== lastView && !state.arriving && !quietView && lastView !== null) {
      viewFadeFrom = view.split("|").slice(0, 3).join() === lastView.split("|").slice(0, 3).join() ? 0.85 : 0.5;
      viewFadeAt = lastFrameTime;
    }
    lastView = view;
  }
  $("place").textContent = readingPosition();
  $("prev").disabled = state.page === 0;
  $("next").disabled = state.page === pages.length - 1;
  $("night").setAttribute("aria-pressed", String(state.night));
  document.body.classList.toggle("night", state.night);
  document
    .querySelectorAll("[data-size]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(+b.dataset.size === state.size)),
    );
  $("menu").textContent = state.menuOpen ? "Close menu" : "Open menu";
  $("pointer").textContent = state.headPointer
    ? "Menu pointer: head"
    : "Menu pointer: hand";
  $("compare").textContent =
    state.mode === "layer" ? "Compare: texture" : "Compare: layer";
  $("mode-label").textContent = state.session
    ? `${state.mode === "layer" ? "A · compositor layer" : "B · ordinary texture"} · ${state.blend}`
    : "PC preview · no headset quality claim";
  dirty = true;
  layerDirty = true;
}
function presentPose() {
  return state.menuOpen || state.practice
    ? menuPlacement || placement
    : placement;
}
function inFront() {
  return state.session && lastViewer
    ? new XRRigidTransform(
        placedPose(lastViewer.matrix).position,
        lastViewer.orientation,
      )
    : null;
}
// Where reading stood when the cabin settled: until he moves from there (a
// page either way, or another work), late picks may still open Today.
let placeAtArrival = null;
const readingPlace = () => `${state.workId}:${state.page}`;
// Today's three are checked and complete (see loadTodayCache / syncDrive).
const hasToday = () => todayWorks.length === 3;
function markTodayShown() {
  preferences.todayShown = todayKey();
  savePreferences();
}
// The welcome screen: every entry lands here and it builds in quiet steps.
let welcomeAt = 0;
function openWelcome() {
  toggleMenu(true);
  state.menuPage = "welcome";
  state.welcomeReveal = 0;
  welcomeAt = lastFrameTime;
  dayOpenedAt = lastFrameTime;
  paint();
}
// The Today page, as a menu panel in front of the reader.
let todayRevealAt = 0;
function openToday(build = false) {
  toggleMenu(true);
  state.menuPage = "today";
  dayOpenedAt = lastFrameTime;
  if (build) {
    state.todayReveal = 0;
    todayRevealAt = lastFrameTime;
  }
  markTodayShown();
  paint();
}
// After the last page of one of today's works: a quiet closing page.
function openClosing() {
  if (!todayWorks.some((w) => w.id === state.workId)) return false;
  toggleMenu(true);
  state.menuPage = "closing";
  dayOpenedAt = lastFrameTime;
  paint();
  return true;
}
// Open a work at its saved place (or the start), and remember it as last.
function openWork(id) {
  rememberPlace();
  state.workId = workById(id).id;
  const saved = reading.places[state.workId];
  state.page = 0;
  state.pendingAnchor = saved?.anchor || null;
  reading.last = state.workId;
  saveReading(store, reading);
}
// Saved place: the first line on the current page, so a text-size change or
// a later visit lands on the same words.
function rememberPlace() {
  const anchor = pages[state.page]?.anchor;
  if (!anchor) return;
  reading.places[state.workId] = { anchor, page: state.page };
  reading.last = state.workId;
  saveReading(store, reading);
}
function feedback(text) {
  state.feedback = text;
  state.feedbackUntil = performance.now() + 1800;
}
function toggleMenu(open = !state.menuOpen) {
  gazeDwell.consume();
  state.todayReveal = null;
  state.menuOpen = open;
  state.menuPage = "main";
  if (open) state.feedback = "";
  state.practice = false;
  state.hover = null;
  pointerSource = null;
  if (open) menuPlacement = inFront();
  gestures.setContext(open ? "menu" : "reading");
  paint();
}
// Practice is complete once Next and Back were both done, in any order. The
// menu hold is optional: it always leaves practice for the menu anyway.
function practiceDone() {
  const m = state.practiceMarks;
  if (!(m.next && m.prev)) return false;
  preferences.practised = true;
  savePreferences();
  return true;
}
// Returns what actually happened, so feedback never claims a turn that did
// not change the page: "turned", "first-page", "last-page", "practice",
// "menu" or "select".
function gestureEvent(event) {
  if (event.type === "center") {
    placement = new XRRigidTransform(
      placedPose(lastViewer.matrix).position,
      lastViewer.orientation,
    );
    state.centering = false;
    state.practice = false;
    state.menuOpen = false;
    menuPlacement = null;
    nativeQueue = [];
    state.arriving = true;
    preferences.visits = (preferences.visits || 0) + 1;
    savePreferences();
    // Chosen once, so a sync landing mid-fade cannot change the words.
    {
      const w = workById(state.workId);
      state.greeting = hasToday()
        ? "Today’s three are ready."
        : `Continuing ${w === SAMPLER ? "the first leaf" : w.title}`;
    }
    entrySound?.play(state.entrySound);
    arrivalElapsed = 0;
    lastArrivalTick = lastFrameTime;
    arrivalAnchor = lastViewer;
    gestures.setContext("arrival");
    paint();
    return "centered";
  }
  if (state.centering || state.arriving) return "blocked-before-reading";
  if (!event) return null;
  if (event.type === "menu") {
    if (state.practice) {
      state.practiceMarks.menu = true;
      practiceDone();
    }
    if (state.menuOpen) feedback("Reading");
    toggleMenu();
    return "menu";
  }
  if (event.type === "select") {
    const before = state.page;
    action(event.target);
    if (event.target === "next" || event.target === "prev") {
      const outcome =
        state.page !== before
          ? "turned"
          : event.target === "next"
            ? "last-page"
            : "first-page";
      if (outcome === "last-page" && openClosing()) return "closing";
      feedback(
        outcome === "turned"
          ? readingPosition()
          : outcome === "last-page"
            ? "Last page · use BACK on your hand"
            : "First page · use NEXT on your hand",
      );
      paint();
      return outcome;
    }
    return "select";
  }
  // Gaze turns name their direction; hand turns follow the hand mapping.
  const id =
    event.direction ||
    ((event.hand === "right") !== state.swapped ? "next" : "prev");
  if (state.practice) {
    state.practiceMarks[id] = true;
    if (practiceDone()) {
      state.practice = false;
      menuPlacement = null;
      feedback("Practice complete · now reading · hold for the menu");
    } else
      feedback(
        (id === "next" ? "Next ✓" : "Back ✓") + "  ·  practice: pages stay put",
      );
    paint();
    return "practice";
  }
  const before = state.page;
  action(id);
  if (state.page !== before) {
    feedback(readingPosition());
    paint();
    return "turned";
  }
  if (id === "next" && openClosing()) return "closing";
  feedback(
    id === "next"
      ? "Last page · nothing further"
      : "First page · nothing before",
  );
  paint();
  return id === "next" ? "last-page" : "first-page";
}
function action(id) {
  if (state.welcomeReveal != null && state.menuOpen && state.menuPage === "welcome") {
    state.welcomeReveal = null;
    paint();
    return;
  }
  if (id === "welcome-begin" || id === "welcome-continue" || id === "welcome-menu") {
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    if (id === "welcome-begin") openToday(preferences.todayShown !== todayKey());
    else if (id === "welcome-continue") toggleMenu(false);
    else {
      state.menuPage = "main";
      state.hover = null;
      dayOpenedAt = lastFrameTime;
      paint();
    }
    return;
  }
  if (state.todayReveal != null && state.menuOpen && state.menuPage === "today") {
    state.todayReveal = null;
    paint();
    return;
  }
  if (
    (state.centering || state.arriving) &&
    ["menu", "practice", "next", "prev", "recenter", "resume"].includes(id)
  )
    return;
  if (id === "menu") {
    toggleMenu();
    return;
  }
  if (id === "resume") {
    toggleMenu(false);
    return;
  }
  if (id === "volume" || id === "volume-back") {
    state.menuPage = id === "volume" ? "volume" : "main";
    dayOpenedAt = lastFrameTime;
    state.hover = null;
    paint();
    return;
  }
  if (/^volume-(0|25|50|75|100)$/.test(id)) {
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    setAmbienceVolume(Number(id.slice(7)) / 100);
    return;
  }
  if (id === "calendar") {
    const d = new Date();
    Object.assign(calendarView, { year: d.getFullYear(), month: d.getMonth() });
    state.menuPage = "calendar";
    state.hover = null;
    paint();
    return;
  }
  if (id === "cal-menu" || id === "cal-back") {
    state.menuPage = id === "cal-menu" ? "main" : "calendar";
    state.hover = null;
    dayOpenedAt = lastFrameTime;
    paint();
    return;
  }
  if (id === "cal-prev" || id === "cal-next") {
    Object.assign(calendarView, shiftMonth(calendarView, id === "cal-prev" ? -1 : 1));
    state.hover = null;
    paint();
    return;
  }
  if (typeof id === "string" && id.startsWith("day:")) {
    calendarView.selected = id.slice(4);
    state.menuPage = "day";
    dayOpenedAt = lastFrameTime;
    state.hover = null;
    paint();
    return;
  }
  if (typeof id === "string" && (id.startsWith("tick:") || id === "weekly")) {
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    const key = calendarView.selected,
      today = todayKey();
    const changed =
      id === "weekly"
        ? toggleWeekly(progress, key, today)
        : toggleTick(progress, key, id.slice(5), today);
    if (changed) storeProgress();
    paint();
    return;
  }
  if (id === "more" || id === "back") {
    state.menuPage = id === "more" ? "more" : "main";
    state.hover = null;
    dayOpenedAt = lastFrameTime;
    paint();
    return;
  }
  if (id === "practice") {
    state.practiceMarks = { next: false, prev: false, menu: false };
    state.practice = true;
    state.menuOpen = false;
    state.hover = null;
    menuPlacement = inFront();
    gestures.setContext("reading");
    paint();
    return;
  }
  if (id === "swap") {
    state.swapped = !state.swapped;
    preferences.swapped = state.swapped;
    savePreferences();
  }
  if (id === "mood") {
    state.mood = state.mood === "modern" ? "literary" : "modern";
    preferences.mood = state.mood;
    savePreferences();
    state.pendingAnchor = currentAnchor();
  }
  if (id === "gaze") {
    state.gazeTurn = !state.gazeTurn;
    preferences.gazeTurn = state.gazeTurn;
    savePreferences();
    gazeDwell.reset();
  }
  if (id === "ambience") {
    const i = AMBIENCE_KINDS.indexOf(state.ambience);
    state.ambience = AMBIENCE_KINDS[(i + 1) % AMBIENCE_KINDS.length];
    preferences.ambience = state.ambience;
    savePreferences();
    entrySound?.context?.resume?.().catch?.(() => {});
    ambience.set(entrySound?.context, state.session ? state.ambience : "off");
  }
  if (id === "watch") {
    state.wristCalendar = !state.wristCalendar;
    preferences.wristCalendar = state.wristCalendar;
    savePreferences();
  }
  if (id === "sound") {
    state.entrySound = !state.entrySound;
    preferences.entrySound = state.entrySound;
    savePreferences();
  }
  if (id === "pointer") {
    state.headPointer = !state.headPointer;
    preferences.headPointer = state.headPointer;
    savePreferences();
    gestures.setContext(state.menuOpen ? "menu" : "reading");
    state.hover = null;
  }
  if (id === "lib-menu") {
    state.menuPage = "main";
    state.hover = null;
    dayOpenedAt = lastFrameTime;
    paint();
    return;
  }
  if (typeof id === "string" && id.startsWith("work:")) {
    // A repeated pinch right after opening the Library must not pick a book.
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    openWork(id.slice(5));
    toggleMenu(false);
    feedback(workById(state.workId).title);
    paint();
    return;
  }
  if (id === "today-menu" || id === "today-library" || id === "today-full-library" || id === "end-today") {
    // Guarded like every choice: the pinch that completed Today's build-up,
    // or a repeat of the one that opened this page, must not move on.
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    state.menuPage = id === "today-menu" ? "main" : id === "today-library" ? "shelf" : id === "today-full-library" ? "library" : "today";
    state.shelfPage = 0;
    state.hover = null;
    dayOpenedAt = lastFrameTime;
    paint();
    return;
  }
  if (["shelf-menu", "shelf-library", "shelf-later", "shelf-earlier", "day-back"].includes(id)) {
    // "‹ Shelf" and "‹ Menu" share a place: a double pinch stops on the shelf.
    if (id !== "shelf-library" && !dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    if (id === "shelf-later" || id === "shelf-earlier") {
      state.shelfPage += id === "shelf-earlier" ? 1 : -1;
    } else state.menuPage = id === "shelf-menu" ? "main" : id === "shelf-library" ? "library" : "shelf";
    state.hover = null;
    dayOpenedAt = lastFrameTime;
    paint();
    return;
  }
  if (typeof id === "string" && id.startsWith("shelfday:")) {
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    state.shelfDay = id.slice(9);
    state.menuPage = "shelfday";
    state.hover = null;
    dayOpenedAt = lastFrameTime;
    paint();
    return;
  }
  if (typeof id === "string" && id.startsWith("pastwork:")) {
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    const entry = resolveDay(progress, state.shelfDay, SOURCE_CATALOGUE).find((e) => e.kind === id.slice(9));
    const work = entry?.work && addShelfWork(`today-${state.shelfDay}-${entry.kind}-${entry.work.id}`);
    if (!work) return;
    openWork(work.id);
    toggleMenu(false);
    feedback(work.title);
    paint();
    return;
  }
  if (typeof id === "string" && id.startsWith("today:")) {
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    openWork(id.slice(6));
    toggleMenu(false);
    feedback(workById(state.workId).title);
    paint();
    return;
  }
  if (id === "end-mark") {
    // Never automatic, and guarded: the pinch that turned the last page
    // must not also mark the work as read.
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    const today = todayKey();
    if (toggleTick(progress, today, workById(state.workId).kind, today)) storeProgress();
    dayOpenedAt = lastFrameTime;
    paint();
    return;
  }
  if (id === "end-next") {
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    const next = nextUnread(todayWorks, workById(state.workId), progress, todayKey());
    if (next) {
      openWork(next.id);
      toggleMenu(false);
      feedback(next.title);
    }
    paint();
    return;
  }
  if (id === "end-back") {
    toggleMenu(false);
    feedback(readingPosition());
    return;
  }
  if (id === "library") {
    state.menuPage = hasToday() ? "today" : "shelf";
    state.shelfPage = 0;
    if (hasToday()) markTodayShown();
    state.hover = null;
    dayOpenedAt = lastFrameTime;
    paint();
    return;
  }
  if (id === "prev") state.page = Math.max(0, state.page - 1);
  if (id === "next") {
    if (state.page < pages.length - 1) {
      state.page++;
      state.turns++;
    }
  }
  if (id === "prev" || id === "next") {
    paint();
    rememberPlace();
  }
  if (id === "night") {
    state.night = !state.night;
    preferences.night = state.night;
    savePreferences();
  }
  if (id === "size") {
    state.pendingAnchor = currentAnchor();
    state.size = (state.size + 1) % 3;
    preferences.size = state.size;
    savePreferences();
  }
  if (id === "recenter") {
    wantRecenter = true;
    toggleMenu(false);
  }
  if (id === "exit") {
    // A pinch repeated just after changing menu page must not leave the cabin.
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    ending = true;
    state.session?.end();
    return;
  }
  if (id === "compare") {
    if (state.session && !quad) {
      report("No compositor layer available. A/B comparison is blocked.");
      return;
    }
    state.mode = state.mode === "layer" ? "texture" : "layer";
    if (state.session) applyLayers();
  }
  paint();
}
for (const id of [
  "prev",
  "next",
  "night",
  "recenter",
  "compare",
  "menu",
  "practice",
  "pointer",
])
  $(id).onclick = () => action(id);
document.querySelectorAll("[data-size]").forEach(
  (b) =>
    (b.onclick = () => {
      state.pendingAnchor = currentAnchor();
      state.size = +b.dataset.size;
      preferences.size = state.size;
      savePreferences();
      paint();
    }),
);
$("calendar").onclick = () => {
  if (!state.menuOpen) toggleMenu(true);
  action("calendar");
};
$("progress-export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          unreadableBackup == null ? progress : { ...progress, unreadableBackup },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `bradbury-progress-${todayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  report("Progress exported. Keep the file somewhere safe.");
};
$("progress-import").onclick = () => $("progress-file").click();
$("progress-file").onchange = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!validProgress(data)) throw Error("not a Bradbury progress file");
    delete data.unreadableBackup;
    progress = data;
    unreadableBackup = null;
    // An import replaces the unreadable record, so saving may resume.
    progressPersistent = storageWorks;
    if (storageWorks) progressNotice = "";
    report(storeProgress() ? "Progress imported." : "Imported, but this browser cannot save it.");
    paint();
  } catch (error) {
    report("Could not import progress: " + error.message);
  }
};
$("export").onclick = () => {
  const data = {
    build: "gestures-037",
    phase: "1-gesture-trial",
    gestureTiming: { holdMs: HOLD_MS, minPinchMs: MIN_PINCH_MS },
    // Last 40 pinch attempts: what the recogniser decided, why, and what the
    // app then did. This is the evidence for "registered but did not turn".
    gestureLog: gestures.log.map((e) => ({ ...e, time: Math.round(e.time) })),
    ignoredPinches: gestures.ignored.map((e) => ({
      ...e,
      time: Math.round(e.time),
    })),
    nativeEvents: gestures.trace,
    inputState: [...gestures.hands.values()].map((h) => ({
      hand: h.hand,
      tracked: h.tracked,
      inView: h.inView,
      stable: h.stable,
      attentive: h.attentive,
      ready: h.armed,
      nativeDown: h.nativeDown,
      anchorKind: h.anchorKind,
      tipsTracked: h.tipsTracked,
    })),
    inputMode: "native-select-only",
    centering: state.centering,
    arriving: state.arriving,
    arrivalError: state.arrivalError,
    entryAudio: {
      enabled: state.entrySound,
      ...(entrySound?.status() || state.entryAudioLast),
    },
    attentionPaused: state.attentionPaused,
    handFeedbackError: state.handFeedbackError,
    reading: {
      // The work actually shown (falls back to the sampler if unknown).
      work: workById(state.workId).id,
      section: pages[state.page]?.section || "text",
      page: state.page + 1,
      pages: pages.length,
      anchor: pages[state.page]?.anchor || null,
    },
    gazeTurn: { enabled: state.gazeTurn, error: state.gazeError || null },
    pointer: { error: state.pointerError || null },
    ambience: { setting: state.ambience, ...ambience.status() },
    mood: state.mood,
    wristCalendar: {
      enabled: state.wristCalendar,
      hand: WATCH_HAND,
      error: state.watchError,
      // Recent show/hide decisions with their measurements, for tuning the
      // pose limits from a real Quest trace.
      decisions: wristWatch?.log || [],
    },
    controls: {
      swapped: state.swapped,
      pointer: state.headPointer ? "head" : "hand",
      practiceMarks: state.practiceMarks,
    },
    at: new Date().toISOString(),
    userAgent: navigator.userAgent,
    layerStatus: state.layerStatus,
    requestedPixels: [PAGE.width, PAGE.height],
    actualPixels: state.actualPixels,
    pageMetres: [PAGE.metresWide, PAGE.metresHigh],
    distance: PAGE.distance,
    textPixels: SIZES[state.size],
    mode: state.mode,
    blend: state.blend,
    page: state.page + 1,
    pageTurns: state.turns,
    error: state.error,
    graphicsError: state.graphicsError,
    renderRoute: state.renderRoute,
    questQuality:
      "Bastian confirmed Build 003 crispness; Build 010 controls need a Quest check",
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "bradbury-phase-0.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function applyLayers() {
  const session = state.session;
  if (projectionRoute) {
    const primary = quad && state.mode === "layer" ? quad : base;
    const optional = arrival?.visible.length ? arrival : handBadges;
    const extra =
      optional === arrival
        ? []
        : [...(gazeRing?.visible || []), ...(wristWatch?.visible || []), ...(pointer?.visible || [])];
    try {
      session.updateRenderState({
        layers: [primary, ...(optional?.visible || []), ...extra],
      });
    } catch (error) {
      // The gaze ring, then the wrist calendar, give up first.
      if (gazeRing?.visible.length) {
        gazeRing.failed = true;
        gazeRing.clearVisible();
        state.gazeError = error.message;
        return applyLayers();
      }
      if (extra.length) {
        wristWatch.failed = true;
        wristWatch.clearVisible();
        state.watchError = error.message;
        report("Wrist calendar unavailable: " + error.message);
        return applyLayers();
      }
      if (!optional?.visible.length) throw error;
      optional.failed = true;
      optional.clearVisible();
      if (optional === arrival) {
        state.arrivalError = error.message;
        report("Welcome decoration unavailable: " + error.message);
      } else {
        state.handFeedbackError = error.message;
        report("Hand feedback unavailable: " + error.message);
      }
      session.updateRenderState({ layers: [primary] });
    }
  } else session.updateRenderState({ baseLayer: base });
}
// Where a head/ray transform meets the displayed page, in canvas pixels.
function pagePoint(transform, display = presentPose()) {
  if (!display || !transform) return null;
  const inv = display.inverse.matrix,
    m = transform.matrix;
  const origin = new DOMPoint(m[12], m[13], m[14]).matrixTransform(new DOMMatrix(inv));
  const direction = new DOMPoint(-m[8], -m[9], -m[10], 0).matrixTransform(new DOMMatrix(inv));
  if (direction.z >= -0.0001) return null;
  const t = -origin.z / direction.z;
  if (t < 0) return null;
  return {
    x: ((origin.x + direction.x * t) / PAGE.metresWide + 0.5) * PAGE.width,
    y: (0.5 - (origin.y + direction.y * t) / PAGE.metresHigh) * PAGE.height,
  };
}
function hit(transform) {
  const display = presentPose();
  if (!state.menuOpen || !display || !transform) return null;
  const inv = display.inverse.matrix,
    m = transform.matrix;
  const origin = new DOMPoint(m[12], m[13], m[14]).matrixTransform(
    new DOMMatrix(inv),
  );
  const direction = new DOMPoint(-m[8], -m[9], -m[10], 0).matrixTransform(
    new DOMMatrix(inv),
  );
  if (direction.z >= -0.0001) return null;
  const t = -origin.z / direction.z;
  if (t < 0) return null;
  return panelHit(
    ((origin.x + direction.x * t) / PAGE.metresWide + 0.5) * PAGE.width,
    (0.5 - (origin.y + direction.y * t) / PAGE.metresHigh) * PAGE.height,
  );
}
// Hit-test the current menu panel: fixed menu pages or the live calendar.
function panelHit(x, y) {
  if (state.menuPage === "welcome") return state.welcomeReveal != null ? null : welcomeHit(x, y, hasToday());
  if (state.menuPage === "library") return libraryHit(x, y, libraryWorks());
  if (state.menuPage === "shelf") return shelfHit(x, y, shelfDays(progress, todayKey()), state.shelfPage);
  if (state.menuPage === "shelfday") return dayHit(x, y, resolveDay(progress, state.shelfDay, SOURCE_CATALOGUE));
  if (state.menuPage === "today") {
    // While it builds, only what is already drawn can be a target.
    const id = todayHit(x, y, todayWorks.slice(0, state.todayReveal ?? REVEAL_STEPS));
    return state.todayReveal != null && ["today-library", "today-full-library"].includes(id) ? null : id;
  }
  if (state.menuPage === "closing")
    return closingHit(x, y, nextUnread(todayWorks, workById(state.workId), progress, todayKey()));
  return CALENDAR_PAGES.includes(state.menuPage)
    ? calendarHit(x, y, state.menuPage, calendarView, progress, todayKey())
    : menuHit(x, y, state.menuPage);
}
function cleanSession() {
  sessionGeneration++;
  state.todayReveal = null;
  state.session = null;
  nativeQueue = [];
  state.centering = false;
  state.arriving = false;
  state.entryAudioLast = entrySound?.status() || state.entryAudioLast;
  ambience.stop(entrySound?.context);
  ambience.kind = "off";
  entrySound?.dispose();
  entrySound = null;
  arrivalAnchor = null;
  arrival?.dispose();
  arrival = null;
  state.attentionPaused = false;
  gestures.reset();
  handBadges?.dispose();
  handBadges = null;
  wristWatch?.dispose();
  wristWatch = null;
  gazeRing?.dispose();
  pointer?.dispose();
  pointer = null;
  gazeRing = null;
  gazeDwell.reset();
  quad?.destroy();
  quad = null;
  if (projectionRoute) base?.destroy();
  projectionRoute = false;
  gpu?.dispose();
  gpu = null;
  placement = null;
  binding = null;
  ref = null;
  base = null;
  state.hover = null;
  state.menuOpen = false;
  menuPlacement = null;
  lastViewer = null;
  lastDisplay = null;
  ending = false;
  $("enter").disabled = false;
  $("enter").textContent = "Enter the cabin ↗";
  paint();
}
async function enter() {
  if (state.session) return;
  // Unlock synchronously in the actual Enter click, before any awaits.
  state.entryAudioLast = null;
  entrySound = new EntrySound();
  entrySound.unlock();
  ambience.set(entrySound.context, state.ambience);
  $("enter").disabled = true;
  state.error = null;
  state.graphicsError = null;
  state.actualPixels = null;
  state.layerStatus = "not tested";
  let session;
  try {
    session = await navigator.xr.requestSession("immersive-ar", {
      optionalFeatures: ["local", "layers", "hand-tracking"],
    });
    state.session = session;
    session.addEventListener("end", cleanSession, { once: true });
    state.blend = session.environmentBlendMode;
    if (state.blend !== "alpha-blend")
      throw Error("This session does not provide passthrough alpha blending.");
    gpu = await renderer($("xr"));
    ref = await session.requestReferenceSpace("local");
    projectionRoute = false;
    if (
      globalThis.XRWebGLBinding &&
      session.enabledFeatures?.includes("layers") !== false
    ) {
      try {
        binding = new XRWebGLBinding(session, gpu.gl);
        base = binding.createProjectionLayer({
          textureType: "texture",
          colorFormat: gpu.gl.RGBA,
          depthFormat: gpu.gl.DEPTH_COMPONENT24,
        });
        session.updateRenderState({ layers: [base] });
        projectionRoute = true;
      } catch (e) {
        base?.destroy();
        base = null;
        binding = null;
        if (session.enabledFeatures?.includes("layers")) throw e;
      }
    }
    if (!projectionRoute)
      base = new XRWebGLLayer(session, gpu.gl, {
        alpha: true,
        antialias: true,
      });
    state.renderRoute = projectionRoute
      ? "native projection + quad"
      : "legacy texture only";
    if ("fixedFoveation" in base) base.fixedFoveation = 0;
    checkGl(gpu.gl, "XR layer setup");
    try {
      if (!projectionRoute)
        throw Error("Native Layers is unavailable in this session.");
      quad = binding.createQuadLayer({
        space: ref,
        viewPixelWidth: PAGE.width,
        viewPixelHeight: PAGE.height,
        width: PAGE.metresWide,
        height: PAGE.metresHigh,
        layout: "mono",
        isStatic: false,
        clearOnAccess: false,
      });
      quad.blendTextureSourceAlpha = true; // rounded window corners
      state.layerStatus = "created; awaiting first draw";
      state.mode = "layer";
      applyLayers();
      checkGl(gpu.gl, "quad setup");
    } catch (e) {
      quad?.destroy();
      quad = null;
      state.layerStatus = "unavailable: " + e.message;
      state.mode = "texture";
      applyLayers();
      report(
        "Layer unavailable. Texture fallback only: " +
          e.message +
          " This cannot pass the crispness gate.",
      );
    }
    ending = false;
    nativeQueue = [];
    state.centering = true;
    state.arriving = false;
    state.handEntryStarted = null;
    state.arrivalError = null;
    state.attentionPaused = false;
    state.menuOpen = false;
    state.practice = false;
    gestures.setContext("centering");
    state.handFeedbackError = null;
    if (quad)
      handBadges = new HandBadges(binding, ref, (error) => {
        state.handFeedbackError = error.message;
        report("Hand feedback unavailable: " + error.message);
      });
    state.watchError = null;
    if (quad)
      gazeRing = new GazeRing(binding, ref, (error) => {
        state.gazeError = error.message;
      });
    if (quad)
      pointer = new Pointer(binding, ref, (error) => {
        state.pointerError = error.message;
      });
    if (quad)
      wristWatch = new WristWatch(binding, ref, (error) => {
        state.watchError = error.message;
        report("Wrist calendar unavailable: " + error.message);
      });
    if (quad)
      arrival = new Arrival(binding, ref, (error) => {
        state.arrivalError = error.message;
        report("Welcome decoration unavailable: " + error.message);
      });
    wantRecenter = true;
    gestures.reset();
    paint();
    for (const kind of ["selectstart", "select", "selectend"])
      session.addEventListener(kind, (e) => {
        if (ending || state.session !== session) return;
        // Copy the event pose while the event frame is active. Viewer/joint
        // safety comes from the next animation frame, not this event frame.
        let ray = null;
        try {
          ray = e.frame.getPose(e.inputSource.targetRaySpace, ref)?.transform;
        } catch {}
        const time = Math.max(lastFrameTime, performance.now());
        gestures.trace.push({
          stage: "received",
          kind,
          eventSource: "native-select",
          hand: e.inputSource.handedness,
          time,
          visibility: session.visibilityState,
          context: gestures.context,
          profiles: Array.from(e.inputSource.profiles || []).slice(0, 4),
        });
        if (gestures.trace.length > 120) gestures.trace.shift();
        if (state.arriving) {
          gestures.note({
            result: "ignored",
            reason: "arrival-animation",
            kind,
            time,
            hand: e.inputSource.handedness,
          });
          return;
        }
        // Any pinch while Today is building completes it at once. Menu
        // selections need a target, so this happens at the press itself.
        if (kind === "selectstart" && state.welcomeReveal != null && state.menuOpen && state.menuPage === "welcome") {
          state.welcomeReveal = null;
          dayOpenedAt = lastFrameTime;
          paint();
        }
        if (kind === "selectstart" && state.todayReveal != null && state.menuOpen && state.menuPage === "today") {
          state.todayReveal = null;
          // This press only completes the page; its release cannot choose.
          dayOpenedAt = lastFrameTime;
          paint();
        }
        nativeQueue.push({
          kind,
          source: e.inputSource,
          time,
          ray,
          visible: session.visibilityState === "visible",
        });
        if (nativeQueue.length > 60) {
          nativeQueue = [];
          gestures.reset("event-queue-overflow");
        }
      });
    session.addEventListener("inputsourceschange", (e) => {
      for (const source of e.removed) {
        gestures.cancel(source, "source-removed");
        nativeQueue = nativeQueue.filter((e) => e.source !== source);
      }
    });
    ref.addEventListener?.("reset", () => {
      wantRecenter = true;
      nativeQueue = [];
      gestures.reset("reference-reset");
      if (state.arriving) {
        state.arriving = false;
        state.centering = true;
        arrivalAnchor = null;
        gestures.setContext("centering");
        paint();
      }
    });
    session.addEventListener("visibilitychange", () => {
      // Quest can suspend audio behind system UI; resume when we return.
      if (session.visibilityState === "visible")
        entrySound?.context?.resume?.().catch?.(() => {});
      gazeDwell.consume();
      if (gazeRing?.clearVisible() | pointer?.clearVisible()) applyLayers();
      nativeQueue = [];
      gestures.reset("visibility-change");
      if (handBadges?.clearVisible() | !!wristWatch?.clearVisible()) applyLayers();
      if (arrival?.clearVisible()) applyLayers();
    });
    const generation = ++sessionGeneration;
    session.requestAnimationFrame((t, f) => frame(t, f, generation));
  } catch (e) {
    state.error = e.message;
    state.graphicsError = e.graphics || null;
    report("Could not open the passthrough test: " + e.message);
    if (session) {
      await session.end();
    } else {
      state.entryAudioLast = entrySound?.status();
      ambience.stop(entrySound?.context);
      ambience.kind = "off";
      entrySound?.dispose();
      entrySound = null;
      state.session = null;
      $("enter").disabled = false;
      $("enter").textContent = "Try entering again ↗";
    }
  }
}
function frame(time, xrFrame, generation) {
  if (generation !== sessionGeneration || !state.session) return;
  const session = state.session;
  // Render-state layer changes take effect at the next XR frame boundary.
  // A pinch may request a new mode below; finish this frame using its old mode.
  const drawMode = state.mode;
  const activeLayers = session.renderState.layers || [];
  lastFrameTime = time;
  try {
    const pose = xrFrame.getViewerPose(ref);
    if (!pose) {
      gazeDwell.consume();
      if (gazeRing?.clearVisible() | pointer?.clearVisible()) applyLayers();
      lastArrivalTick = time;
      nativeQueue = [];
      gestures.reset("viewer-pose-lost");
      if (handBadges?.clearVisible() | !!wristWatch?.clearVisible()) applyLayers();
      if (arrival?.clearVisible()) applyLayers();
      if (state.hover) {
        state.hover = null;
        paint();
      }
    }
    if (pose) {
      if (wantRecenter || state.centering) {
        placement = new XRRigidTransform(
          placedPose(pose.transform.matrix).position,
          pose.transform.orientation,
        );
        wantRecenter = false;
      }
      lastViewer = pose.transform;
      if (state.arriving) {
        if (session.visibilityState === "visible" && !pose.emulatedPosition)
          arrivalElapsed += Math.max(0, Math.min(50, time - lastArrivalTick));
        lastArrivalTick = time;
      }
      if (
        state.arriving &&
        session.visibilityState === "visible" &&
        arrivalElapsed >= ARRIVAL_MS
      ) {
        state.arriving = false;
        nativeQueue = [];
        gestures.setContext("reading");
        state.handEntryStarted = time;
        placeAtArrival = readingPlace();
        // Every entry opens on Today when the three are ready; the gentle
        // build plays only on the first entry of the day.
        // The window has just faded in: opening Today must not dip again.
        quietView = true;
        openWelcome();
        quietView = false;
      }
      if (state.welcomeReveal != null && (!state.menuOpen || state.menuPage !== "welcome")) state.welcomeReveal = null;
      if (state.welcomeReveal != null && time - welcomeAt >= WELCOME_MS * (state.welcomeReveal + 1)) {
        state.welcomeReveal = state.welcomeReveal + 1 >= WELCOME_STEPS ? null : state.welcomeReveal + 1;
        paint();
      }
      if (state.todayReveal != null && (!state.menuOpen || state.menuPage !== "today")) state.todayReveal = null;
      if (state.todayReveal != null && time - todayRevealAt >= REVEAL_MS * (state.todayReveal + 1)) {
        state.todayReveal = state.todayReveal + 1 >= REVEAL_STEPS ? null : state.todayReveal + 1;
        paint();
      }
      const sessionVisible = session.visibilityState === "visible";
      const attentive =
        sessionVisible &&
        !pose.emulatedPosition &&
        !state.arriving &&
        (state.centering || facingPanel(pose.transform, presentPose()));
      if (state.attentionPaused === attentive) {
        state.attentionPaused = !attentive;
        paint();
      }
      if ((state.menuOpen || state.practice) && !menuPlacement)
        menuPlacement = inFront();
      const activeSources = new Set(session.inputSources);
      for (const source of gestures.hands.keys())
        if (!activeSources.has(source)) {
          gestures.cancel(source, "source-removed");
          gestures.hands.delete(source);
        }
      const targets = new Map(),
        samples = [];
      let watchSample = null;
      const pointerRays = [];
      for (const source of session.inputSources) {
        if (!source.hand) continue;
        const joint = (name) => {
          const space = source.hand.get(name);
          return space ? xrFrame.getJointPose(space, ref) : null;
        };
        const a = joint("index-finger-tip"),
          b = joint("thumb-tip");
        if (!rayFilters.has(source)) rayFilters.set(source, new OneEuro(1.0, 0.03));
        const point = state.headPointer
          ? pose.transform
          : smoothRay(rayFilters.get(source), xrFrame.getPose(source.targetRaySpace, ref)?.transform, time);
        const pinching = a && b && Math.hypot(
          a.transform.position.x - b.transform.position.x,
          a.transform.position.y - b.transform.position.y,
          a.transform.position.z - b.transform.position.z) < 0.03;
        // A hand drifts while it pinches: keep the choice it had as the pinch
        // closed until it opens again.
        let target = state.menuOpen ? hit(point) : null;
        if (pinching && heldTargets.has(source)) target = heldTargets.get(source);
        else if (!pinching) heldTargets.set(source, target);
        else heldTargets.set(source, target);
        targets.set(source, target);
        if (state.menuOpen && !state.headPointer)
          pointerRays.push({
            hand: source.handedness,
            hit: rayOnPage(point, presentPose(), PAGE.metresWide, PAGE.metresHigh),
            look: target ? (pinching ? "press" : "ring") : "dot",
          });
        const distance =
          a && b
            ? Math.hypot(
                a.transform.position.x - b.transform.position.x,
                a.transform.position.y - b.transform.position.y,
                a.transform.position.z - b.transform.position.z,
              )
            : null;
        const systemGesture =
          source.skipRendering ||
          nearFacePalm(
            joint("wrist")?.transform.position,
            joint("index-finger-metacarpal")?.transform.position,
            joint("pinky-finger-metacarpal")?.transform.position,
            pose.transform.position,
            source.handedness,
            {
              x: -pose.transform.matrix[8],
              y: -pose.transform.matrix[9],
              z: -pose.transform.matrix[10],
            },
          );
        const anchor = handAnchor({
          wrist: joint("wrist"),
          palm: joint("index-finger-metacarpal"),
          index: a,
          thumb: b,
          palmDeclared:
            !!source.hand.get("wrist") ||
            !!source.hand.get("index-finger-metacarpal"),
        });
        // Only the source Quest reports as the RIGHT hand may feed the wrist
        // calendar. No fallback to the other or the nearest hand.
        if (source.handedness === WATCH_HAND) {
          const p = (name) => {
            const j = joint(name);
            return j && !j.emulatedPosition ? j.transform.position : null;
          };
          watchSample = {
            // The real handedness, so watchPose's own check is a second lock.
            hand: source.handedness,
            wrist: p("wrist"),
            index: p("index-finger-metacarpal"),
            pinky: p("pinky-finger-metacarpal"),
            middle: p("middle-finger-metacarpal"),
          };
        }
        // While the right wrist is being read like a watch, that hand cannot
        // turn pages or select, and its hand icon steps aside.
        const glancing = !!wristWatch?.showingFor(source.handedness);
        samples.push({
          source,
          hand: source.handedness,
          position: anchor.position,
          systemGesture: systemGesture || glancing,
        });
        const tipsTracked =
          !!a && !!b && !a.emulatedPosition && !b.emulatedPosition;
        const tracked = !!anchor.position;
        const handInView = tracked && inView(anchor.position, pose.transform);
        const button = source.gamepad?.buttons?.[0];
        const open = button ? !button.pressed : distance > 0.028;
        samples[samples.length - 1].systemGesture ||= !attentive || !handInView;
        if (!attentive || !handInView || systemGesture)
          targets.set(source, null);
        gestures.update(source, {
          tracked: tracked && !wristWatch?.showingFor(source.handedness),
          anchorKind: anchor.kind,
          tipsTracked,
          inView: handInView,
          attentive,
          open,
          time,
          hand: source.handedness,
          target,
          systemGesture,
        });
      }
      if (pointer?.update(pointerRays, presentPose())) applyLayers();
      const deliver = (event) => {
        if (!event) return;
        // Any hand action ends the current look-to-turn attempt.
        gazeDwell.consume();
        pointerSource = gestures.owner || pointerSource;
        const entry = gestures.lastEntry;
        gestures.lastEntry = null;
        const outcome = gestureEvent(event);
        if (entry) {
          entry.outcome = outcome;
          entry.page = state.page + 1;
        }
        if (outcome !== "centered")
          handBadges?.pulse(event.hand, time, outcome);
      };
      const queued = state.arriving ? [] : nativeQueue;
      nativeQueue = [];
      for (const input of queued) {
        if (ending || state.arriving) break;
        const maxEventAge = state.centering ? 1000 : 120;
        if (
          !activeSources.has(input.source) ||
          time - input.time > maxEventAge
        ) {
          gestures.cancel(input.source, "stale-native-event", time);
          gestures.note({
            result: "ignored",
            reason: "stale-or-removed-event",
            hand: input.source.handedness,
            kind: input.kind,
            time: input.time,
            eventSource: "native-select",
          });
          continue;
        }
        // Startup has one explicit action. A completed browser-recognised
        // click confirms it, without the reading recogniser's joint/open-hand
        // prerequisites. This also works for controllers without XRHand.
        if (state.centering) {
          if (input.kind === "select") {
            const allowed =
              input.visible && sessionVisible && !pose.emulatedPosition;
            const entry = {
              ...gestures.snapshot(gestures.hands.get(input.source)),
              result: allowed ? "center" : "ignored",
              reason: allowed
                ? "startup-native-confirmation"
                : "attention-paused",
              eventSource: "native-select",
              hand: input.source.handedness,
              hasHand: !!input.source.hand,
              time: input.time,
              kind: input.kind,
            };
            if (allowed) {
              gestures.record(entry);
              entry.outcome = gestureEvent({ type: "center" });
            } else gestures.note(entry);
          }
          continue;
        }
        const target = state.menuOpen
          ? hit(state.headPointer ? pose.transform : input.ray)
          : null;
        pointerSource = input.source;
        deliver(gestures.handle(input.kind, input.source, input.time, target));
      }
      if (!ending && !state.arriving) deliver(gestures.tick(time));
      if (ending || state.session !== session || !gpu) return;
      let hover = null;
      if (state.menuOpen && attentive) {
        if (state.headPointer) hover = hit(pose.transform);
        else if (gestures.owner) hover = targets.get(gestures.owner) || null;
        else
          hover =
            targets.get(pointerSource) ||
            [...targets.values()].find(Boolean) ||
            null;
      }
      if (hover !== state.hover) {
        state.hover = hover;
        paint();
      }
      // Midnight while the calendar is open: today moves on, so redraw, and
      // follow into the new month if the view was showing the current one.
      if (
        state.menuOpen &&
        CALENDAR_PAGES.includes(state.menuPage) &&
        paintedToday &&
        paintedToday !== todayKey()
      ) {
        const was = parseKey(paintedToday);
        if (calendarView.year === was.getFullYear() && calendarView.month === was.getMonth()) {
          const now = new Date();
          calendarView.year = now.getFullYear();
          calendarView.month = now.getMonth();
        }
        paint();
      }
      if (state.feedback && performance.now() > state.feedbackUntil) {
        state.feedback = "";
        paint();
      }
      if (
        handBadges?.update(
          state.centering || state.arriving ? [] : samples,
          pose.transform,
          gestures,
          {
            swapped: state.swapped,
            menu: state.menuOpen,
            practice: state.practice,
            canForward: state.page < pages.length - 1,
            canBack: state.page > 0,
            time,
            entryTime: state.handEntryStarted,
          },
        )
      )
        applyLayers();
      {
        // Optional look-to-turn: only while reading, attentive and visible.
        const readingNow =
          state.gazeTurn &&
          attentive &&
          !state.menuOpen &&
          !state.practice &&
          !state.centering &&
          !state.arriving;
        const p = readingNow ? pagePoint(pose.transform) : null;
        const zone = p ? gazeZone(p.x, p.y) : null;
        const g = gazeDwell.update(zone, time, readingNow);
        if (gazeRing?.update(presentPose(), g.zone, g.progress, state.night)) applyLayers();
        if (g.fire) {
          const outcome = gestureEvent({ type: "page", direction: g.fire, hand: "gaze" });
          gestures.record({ result: "page", eventSource: "gaze", hand: "gaze", direction: g.fire, outcome, page: state.page + 1, time });
        }
      }
      if (
        wristWatch?.update(watchSample, pose.transform, {
          time,
          summary: currentWatchSummary(),
          night: state.night,
          enabled:
            state.wristCalendar &&
            sessionVisible &&
            !state.centering &&
            !state.arriving,
        })
      )
        applyLayers();
      const progress = state.arriving
        ? Math.min(1, arrivalElapsed / ARRIVAL_MS)
        : null;
      // The old cover leaves are retired: the window simply fades in.
      if (arrival?.clearVisible()) applyLayers();
      const display = state.arriving
        ? pageArrivalPose(arrivalAnchor, progress)
        : presentPose();
      if (quad)
        quad.opacity = state.arriving
          ? smooth(progress)
          : viewFadeFrom + (1 - viewFadeFrom) * smooth((time - viewFadeAt) / VIEW_FADE_MS);
      if (quad && display !== lastDisplay) {
        quad.transform = display;
        lastDisplay = display;
      }
      const { gl } = gpu;
      // The comparison texture is independent of the compositor upload. A
      // never needs its texImage2D/mipmap path; retain dirty until B uses it.
      if (drawMode === "texture" && dirty) {
        gpu.upload(canvas);
        checkGl(gl, "comparison source upload");
        dirty = false;
      }
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      if (drawMode === "texture") {
        const scale = new Float32Array(identity);
        scale[0] = PAGE.metresWide / 2;
        scale[5] = PAGE.metresHigh / 2;
        const model = multiply(display.matrix, scale);
        for (const view of pose.views) {
          let sub;
          if (projectionRoute) {
            sub = binding.getViewSubImage(base, view);
            gl.bindFramebuffer(gl.FRAMEBUFFER, gpu.fbo);
            gl.framebufferTexture2D(
              gl.FRAMEBUFFER,
              gl.COLOR_ATTACHMENT0,
              gl.TEXTURE_2D,
              sub.colorTexture,
              0,
            );
            if (sub.depthStencilTexture)
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.TEXTURE_2D,
                sub.depthStencilTexture,
                0,
              );
          } else gl.bindFramebuffer(gl.FRAMEBUFFER, base.framebuffer);
          try {
            checkGl(gl, "projection attachment");
            if (
              gl.checkFramebufferStatus(gl.FRAMEBUFFER) !==
              gl.FRAMEBUFFER_COMPLETE
            )
              throw Error("Comparison projection framebuffer is incomplete.");
            const v = sub?.viewport || base.getViewport(view);
            gl.viewport(v.x, v.y, v.width, v.height);
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(v.x, v.y, v.width, v.height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gpu.draw(
              multiply(
                view.projectionMatrix,
                multiply(view.transform.inverse.matrix, model),
              ),
            );
            checkGl(gl, "comparison projection draw");
          } finally {
            gl.disable(gl.SCISSOR_TEST);
            if (projectionRoute) {
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                null,
                0,
              );
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.TEXTURE_2D,
                null,
                0,
              );
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          }
          checkGl(gl, "projection cleanup");
        }
      }
      if (drawMode === "layer" && quad && (layerDirty || quad.needsRedraw)) {
        const sub = binding.getSubImage(quad, xrFrame);
        state.actualPixels = [sub.viewport.width, sub.viewport.height];
        checkGl(gl, "quad subimage acquisition");
        gpu.copyPage(sub, canvas, { premultiplied: true });
        layerDirty = false;
        if (state.layerStatus !== "drawn") {
          state.layerStatus = "drawn";
          report(
            `Compositor layer drawn at ${state.actualPixels.join(" × ")} pixels. Build 006: practise Next, Back and Menu.`,
          );
        }
      }
      if (handBadges?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (wristWatch?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (gazeRing?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (pointer?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (arrival?.draw(xrFrame, gpu, activeLayers)) applyLayers();
    }
  } catch (e) {
    state.error = e.message;
    state.graphicsError = e.graphics || null;
    state.layerStatus = "failed: " + e.message;
    report(
      "The layer test stopped: " +
        e.message +
        " Return to the browser to read the test details.",
    );
    session.end();
    return;
  }
  session.requestAnimationFrame((t, f) => frame(t, f, generation));
}
// ---------- Google Drive: today's three and progress backup ----------
const clientId = (() => {
  try {
    return localStorage.getItem(CLIENT_ID_KEY) || GOOGLE_CLIENT_ID;
  } catch {
    return GOOGLE_CLIENT_ID;
  }
})();
const drive = new DriveLink({ clientId });
// The app's verdict on Claude's newest picks file travels in every
// progress.json write, so it must survive a reload until the next sync.
const LAST_CHECK_KEY = "cabin-last-check";
try {
  drive.lastCheck = JSON.parse(localStorage.getItem(LAST_CHECK_KEY) || "null");
} catch {
  drive.lastCheck = null;
}
const driveState = { last: null, error: null, syncing: false, pending: 0, everSynced: false };
function driveNote() {
  if (driveState.error)
    return (
      "Drive: " +
      driveState.error.slice(0, 90) +
      (driveState.pending ? ` (${driveState.pending} change${driveState.pending === 1 ? "" : "s"} not yet on Drive)` : "")
    );
  if (picksNotice) return picksNotice;
  if (driveState.last) return "Synced with Google Drive at " + driveState.last;
  return clientId ? "Not synced yet · use Sync with Drive on the browser page" : "";
}
function paintDriveButton() {
  const b = $("drive-sync");
  if (!b) return;
  b.disabled = driveState.syncing || !clientId;
  b.textContent = !clientId
    ? "Drive: setup needed"
    : driveState.syncing
      ? "Syncing…"
      : drive.connected
        ? "Sync with Drive ✓"
        : "Sync with Drive";
}
let driveTimer = null;
function scheduleDriveSave() {
  if (!clientId || !driveState.everSynced) return;
  driveState.pending++;
  if (!drive.connected) {
    // Google's sign-in lasts about an hour. Ticks stay safe on the headset
    // and go up with the next Sync; say so instead of failing silently.
    driveState.error = "sign-in expired · ticks are kept on the headset; tap Sync with Drive again";
    return;
  }
  clearTimeout(driveTimer);
  driveTimer = setTimeout(() => {
    drive.writeProgress(JSON.stringify(progress)).then(
      () => {
        driveState.error = null;
        driveState.pending = 0;
        driveState.last = new Date().toTimeString().slice(0, 5);
      },
      (e) => (driveState.error = e.message),
    );
  }, 1500);
}
// Pull today's three and merge progress; push the merged progress back.
async function syncDrive() {
  driveState.syncing = true;
  paintDriveButton();
  try {
    if (!drive.connected) await drive.signIn();
    const today = todayKey();
    // History first: picks are checked against every earlier day's reading.
    const remote = await drive.read("progress.json");
    if (remote) {
      try {
        const parsed = JSON.parse(remote);
        if (validProgress(parsed)) progress = mergeProgress(progress, parsed);
      } catch {}
    }
    const found = await drive.readPicksFor(today, (raw) => parsePicks(raw, progress.days));
    let message = "No picks from Claude yet. Ask Claude for today's three.";
    drive.lastCheck = { checked: today, accepted: false, problems: ["no picks file for today yet"] };
    if (found) {
      const { raw, parsed: r } = found;
      const problems = [...r.problems];
      if (r.date && r.date !== today) problems.push(`the newest picks file is for ${r.date}, not ${today}`);
      else if (r.works.length !== 3 && !problems.length) problems.push("the file does not contain all three picks");
      drive.lastCheck = { checked: today, date: r.date, accepted: !problems.length, problems };
      if (r.date === today && r.works.length === 3 && !r.problems.length) {
        try {
          localStorage.setItem(TODAY_KEY, raw);
        } catch {}
        todayWorks = r.works;
        picksNotice = "";
        if (todayWorks.some(w => w.id === state.workId)) state.pendingAnchor = currentAnchor();
        const day = (progress.days[today] ||= {});
        clearReplacedTicks(day, r.works);
        day.picks = { ...(day.picks || {}), ...pickLabels(r.works) };
        day.ids = { ...(day.ids || {}), ...Object.fromEntries(r.works.map((w) => [w.kind, w.catalogueId])) };
        rememberGuides(progress, today, r.works, { savedAt: found.createdTime || new Date().toISOString() });
        rememberPersonal(progress, today, r, { savedAt: found.createdTime || new Date().toISOString() });
        rebuildWorks(state.workId);
        message = `Today's three are ready: ${r.works.map((w) => w.title).join(", ")}.`;
        if (state.session && !state.centering && !state.arriving && !state.menuOpen && !state.practice &&
            readingPlace() === placeAtArrival && preferences.todayShown !== today)
          openToday(true);
      } else if (r.date === today) {
        picksNotice = "Claude's latest selections failed the source checks. Ask Claude for today's three again; the reasons are now in Drive.";
        message = picksNotice + (todayWorks.length ? " Your previous checked selections are still available." : "");
      } else if (r.date && r.date !== today) message = `Claude's last picks are from ${r.date}. Ask for today's three.`;
      if (r.problems.length) message += " (" + r.problems.join("; ") + ")";
    }
    try {
      localStorage.setItem(LAST_CHECK_KEY, JSON.stringify(drive.lastCheck));
    } catch {}
    try {
      await drive.recoverGuides(progress, today, raw => parsePicks(raw));
    } catch {
      message += " Earlier study notes could not be recovered this time; existing readings are kept.";
    }
    refreshSavedGuides();
    driveState.everSynced = true;
    storeProgress();
    // This direct write replaces any queued save (no duplicate creation).
    clearTimeout(driveTimer);
    await drive.writeProgress(JSON.stringify(progress));
    driveState.pending = 0;
    driveState.error = null;
    driveState.last = new Date().toTimeString().slice(0, 5);
    report(message);
  } catch (e) {
    driveState.error = e.message;
    report("Drive sync failed: " + e.message);
  } finally {
    driveState.syncing = false;
    paintDriveButton();
    paint();
  }
}
$("drive-sync").onclick = () => syncDrive();
paintDriveButton();
// After a reload within the hour, Google's sign-in is still valid: sync
// straight away (no popup), so ticks keep going to Drive.
if (clientId && drive.connected) syncDrive();
// Load Google sign-in early, so the popup opens directly from the tap.
if (clientId) preloadGoogle();
await document.fonts.load("54px Literata");
$("enter").onclick = enter;
paint();
if (!isSecureContext) {
  report(
    "Use HTTPS on Quest. A file or an ordinary local-network HTTP page cannot start WebXR.",
  );
  $("enter").textContent = "HTTPS needed on Quest";
} else if (navigator.xr) {
  navigator.xr
    .isSessionSupported("immersive-ar")
    .then((ok) => {
      $("enter").disabled = !ok;
      $("enter").textContent = ok
        ? "Enter the cabin ↗"
        : "Headset needed for passthrough";
      report(
        ok
          ? "Lie down, then enter. Allow hand tracking when asked."
          : "This browser can show the page preview. Run the actual test in Quest Browser.",
      );
    })
    .catch((e) => {
      report(e.message);
    });
} else {
  $("enter").textContent = "Open in Quest Browser";
  report(
    "PC preview is ready. The compositor comparison happens in your headset.",
  );
}
