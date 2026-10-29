import { PAGE, SIZES, layout, placedPose } from "./core.js?v=50";
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
} from "./gestures.js?v=50";
import { renderer, identity, multiply, checkGl } from "./gl.js?v=50";
import { HandBadges } from "./hand-badges.js?v=50";
import { WristWatch, watchSummary, watchPose, WATCH_HAND } from "./watch.js?v=50";
import { LIBRARY } from "./library.js?v=50";
import { pageForAnchor, loadReading, saveReading, validAnchor } from "./reader.js?v=50";
import { layoutReading } from "./reading-flow.js?v=50";
import { HOME_FRAME, HOME_DAYS_PER_PAGE, homeButtons, paintHome } from "./home-panel.js?v=50";
import { SETTINGS_PAGES, settingsBounds, settingsButtons, paintSettings } from "./settings-panel.js?v=50";
import { compactBounds, compactButtons, paintCompact, compactNotesPages, compactWrap } from "./compact-panels.js?v=50";
import { paintLibrary, libraryHit } from "./library-panel.js?v=50";
import { todayFacts, workStatus, paintToday, todayHit, nextUnread, closingHit, paintClosing } from "./today-panel.js?v=50";
import { parsePicks, pickLabels } from "./picks.js?v=50";
import { SOURCE_CATALOGUE } from "./source-catalogue.js?v=50";
import { shelfDays, resolveDay, pastWork, paintShelf, shelfHit, paintShelfDay, dayHit, DAYS_PER_PAGE } from "./shelf-panel.js?v=50";
import { rememberGuides, dayGuide } from "./guide-archive.js?v=50";
import { rememberPersonal, personalFor, clearReplacedTicks } from "./daily-lines.js?v=50";
import { DriveLink, mergeProgress, CLIENT_ID_KEY, preloadGoogle } from "./drive.js?v=50";
import { GOOGLE_CLIENT_ID } from "./config.js?v=50";
import { Ambience, AMBIENCE_KINDS, AMBIENCE_LABEL, VOLUME_STEPS, ambienceVolume } from "./ambience.js?v=50";
import { GazeDwell, GazeRing, gazeZone } from "./gaze.js?v=50";
import { Pointer, rayOnPage, PageAimFilter, chooseSnapshot, LOOK_BACK } from "./pointer.js?v=50";
import { paintWelcome, welcomeHit, greeting } from "./welcome-panel.js?v=50";
import { MOODS, NAV, UI, accentFor, goldFor, WINDOW_RADIUS, spaced, unspaced, navigationSurface } from "./theme.js?v=50";
import { Arrival, ARRIVAL_MS, pageArrivalPose, smooth } from "./arrival.js?v=50";
import { EntrySound } from "./entry-sound.js?v=50";
import {
  readProgress,
  saveProgress,
  toggleTick,
  toggleWeekly,
  validProgress,
  dateKey,
  parseKey,
  canonicalWorkId,
  markWorkRead,
  workRead,
} from "./progress.js?v=50";
import {
  paintCalendar,
  calendarHit,
  shiftMonth,
  dayInputAllowed,
} from "./calendar.js?v=50";
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
  for (const id of Object.keys(progress.completedWorks || {})) {
    const completed = SOURCE_CATALOGUE.find(w => w.id === id);
    if (completed && !WORKS.some(w => w.id === id)) WORKS.push(completed);
  }
}
// The Library lists the sampler, today's three and the starter shelf; earlier
// days live on Your shelf instead.
const libraryWorks = () => {
  const seen = new Set();
  return WORKS.filter(w => {
    const id = canonicalWorkId(w);
    if (w.shelfDate || carriedWorks.includes(w) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};
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
// Ordinary page/menu changes keep their material opaque and position fixed.
const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const reducedMotion = () => motionPreference?.matches === true;
const arrivalDuration = () => reducedMotion() ? 1 : ARRIVAL_MS;
// After a few visits the gestures are known: the instruction lines go quiet.
const learned = () => (preferences.visits || 0) > 3;
const state = {
  menuPage: "today",
  libraryPage: 0,
  notesPage: 0,
  homeTab: preferences.homeTab === "shelf" ? "shelf" : "today",
  // Panels are complete on their first paint; retained in diagnostics.
  welcomeReveal: null,
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
let completionContext = null, currentReadingOpened = false;
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
// Each hand owns a single displayed hit and a press snapshot (including misses).
const rayFilters = new Map(), heldTargets = new Map();
const exitAims = new Map(), exitPresses = new Map();
// Recent filtered aim per hand, for the press look-back (pointer.js).
const aimHistory = new Map(), livePoints = new Map();
const pressChoices = [];
let exitHover = false;
const PLACE_FRAME = {x: (2048-600*2048/720)/2, y:(2560-240*2048/720)/2, w:600*2048/720, h:240*2048/720};
// Exit is a quiet 96 px circle at the surface's top right: outside floating
// cards (an ornament), inside the reading page's rounded corner. A fixed,
// larger invisible zone around it absorbs pinch drift; any real button inside
// that zone still wins. Hover never changes the zone.
// Forgiving targets: 12 mm below a button (pinching drags the aim down),
// 7 mm to the sides and above.
const TARGET_SLACK = Object.freeze({ below: 34, other: 20 });
const EXIT = Object.freeze({ radius: 48, inset: 88, left: 140, right: 190, up: 200, down: 140,
  releaseSlack: 57, readingBottom: 260 });
function exitSurface() {
  return state.centering ? PLACE_FRAME : state.menuOpen || state.arriving ? navigationModel().bounds : null;
}
function exitDisc() {
  const b = exitSurface();
  return b ? { cx: b.x + b.w - EXIT.inset, cy: b.y - EXIT.inset, r: EXIT.radius, floating: true }
    : { cx: PAGE.width - EXIT.inset, cy: EXIT.inset, r: EXIT.radius, floating: false };
}
function exitRect() {
  const d = exitDisc(), b = exitSurface();
  const top = d.cy - EXIT.up, bottom = Math.min(d.cy + EXIT.down, b ? b.y : EXIT.readingBottom);
  return { id: "global-exit", x: d.cx - EXIT.left, y: top, w: EXIT.left + EXIT.right, h: bottom - top };
}
function inExitZone(x, y, slack = 0) {
  const e = exitRect();
  if (!(x >= e.x - slack && x <= e.x + e.w + slack && y >= e.y - slack && y <= e.y + e.h + slack)) return false;
  // Real buttons win over the invisible zone.
  if (state.menuOpen && navigationModel().buttons.some(b => !b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)) return false;
  return true;
}
function overExit(ray, slack = 0) {
  const p = pagePoint(ray);
  return !!p && inExitZone(p.x, p.y, slack);
}
function leaveExperience() {
  rememberPlace();
  ending=true;
  state.session?.end();
}
const headPresses = new Map();
const wristPresses = new Map();
let pointerRevision = 0, pointerScreen = null;
// Explicit opt-in only; bounded local traces travel with the existing export.
const pointerDiagnosticsEnabled = new URLSearchParams(location.search).get("pointerDiagnostics") === "1";
const pointerDiagnostics = [];
let lastNativeQuad = null;
$("session-details").hidden = !pointerDiagnosticsEnabled;
let nativeQuadUpload = null;
function nativeQuadGeometry() {
  if (!quad) return null;
  return { width: quad.width, height: quad.height,
    transform: quad.transform?.matrix ? Array.from(quad.transform.matrix) : null,
    upload: nativeQuadUpload };
}
function recordPointerAim(source, ray, filtered, viewer, index, thumb, time, shown = filtered, gates = null) {
  if (!pointerDiagnosticsEnabled) return;
  const display = presentPose();
  const raw = rayOnPage(ray, display, PAGE.metresWide, PAGE.metresHigh);
  let pinch = null;
  if (index && thumb && !index.emulatedPosition && !thumb.emulatedPosition) {
    const a = index.transform.position, b = thumb.transform.position, o = viewer.position;
    const matrix = new Float32Array(16);
    matrix[15] = 1;
    matrix[12] = o.x; matrix[13] = o.y; matrix[14] = o.z;
    matrix[8] = o.x - (a.x + b.x) / 2;
    matrix[9] = o.y - (a.y + b.y) / 2;
    matrix[10] = o.z - (a.z + b.z) / 2;
    pinch = rayOnPage({ matrix }, display, PAGE.metresWide, PAGE.metresHigh);
  }
  const mm = h => h ? [h.local.x * 1000, h.local.y * 1000] : null;
  let actualQuadPoint = null;
  if (shown && quad?.transform && quad.width > 0 && quad.height > 0) {
    const p = new DOMPoint(shown.point.x, shown.point.y, shown.point.z)
      .matrixTransform(new DOMMatrix(quad.transform.matrix).inverse());
    const requestedPx = [(shown.local.x / PAGE.metresWide + .5) * PAGE.width,
      (.5 - shown.local.y / PAGE.metresHigh) * PAGE.height];
    const actualPx = [(p.x / quad.width + .5) * PAGE.width,
      (.5 - p.y / quad.height) * PAGE.height];
    actualQuadPoint = { requestedPx, actualPx,
      deltaPx: actualPx.map((v, i) => v - requestedPx[i]), planeDepthMm: p.z * 1000 };
  }
  pointerDiagnostics.push({ time, hand: source.handedness, revision: pointerRevision,
    nativeMm: mm(raw), filteredMm: mm(filtered), shownMm: mm(shown),
    headThroughPinchMm: mm(pinch), actualQuadPoint, nativeQuad: nativeQuadGeometry(), gates });
  if (pointerDiagnostics.length > 600) pointerDiagnostics.shift();
}
function cancelPointerPresses(reason = "pointer-context-change") {
  exitAims.clear(); exitPresses.clear(); aimHistory.clear(); livePoints.clear();
  pointerRevision++;
  headPresses.clear();
  wristPresses.clear();
  for (const source of heldTargets.keys()) gestures.cancel(source, reason, lastFrameTime);
  heldTargets.clear();
  rayFilters.clear();
  if (pointer?.clearVisible() && state.session && !ending) applyLayers();
}
function pointerScreenKey() {
  return JSON.stringify([state.menuOpen, state.menuPage, state.practice, state.centering,
    state.arriving, state.headPointer, state.shelfPage, state.shelfDay, state.libraryPage, state.notesPage, state.workId,
    calendarView, todayKey(), todayWorks.map(w => [w.id, w.catalogueId]), libraryWorks().map(w => w.id),
    state.welcomeReveal, state.todayReveal, progressVersion,
    menuPlacement ? Array.from(menuPlacement.matrix) : null]);
}
function syncPointerScreen() {
  const key = pointerScreenKey();
  if (key !== pointerScreen) {
    pointerScreen = key;
    cancelPointerPresses();
  }
}
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
const HOME_ROUTES = ["today", "shelf", "shelfday", "library"];
function nextReadingWork(work = workById(state.workId)) {
  return todayWorks.find(w => canonicalWorkId(w) !== canonicalWorkId(work) && !workRead(progress, w)) || null;
}
function homeOptions(route = state.menuPage) {
  const today = todayKey(), facts = todayFacts(new Date(), progress, today);
  const personal = personalFor(progress.days[today], todayWorks);
  const resumable = Object.fromEntries(WORKS.map(w => [w.id, validAnchor(reading.places[w.id]?.anchor) || (w.id === state.workId && currentReadingOpened && validAnchor(pages[state.page]?.anchor))]));
  const statuses = Object.fromEntries(WORKS.map(w => [w.id, workRead(progress,w) ? "Read ✓" : resumable[w.id] ? "In progress" : ""]));
  const currentPage = pages[state.page];
  const currentPosition = currentPage ? `${currentPage.section === "before" ? "Before reading" : currentPage.section === "after" ? "After reading" : "Text"} · Page ${currentPage.sectionPage || state.page + 1}` : "";
  const options = { tab: route === "shelf" || route === "shelfday" || route === "library" ? "shelf" : "today",
    works: todayWorks, currentId: state.workId, statuses, resumable, currentPosition, hover: state.hover,
    resume: workById(state.workId), dateline: facts.dateline + (facts.read ? ` · ${facts.read} of 3 read` : ""),
    notes: !!(personal.dedication || personal.thread || picksNotice || driveNote()),
    c: { ...NAV, serif: MOODS[state.mood].body, ui: UI } };
  if (!learned()) options.dateline = state.headPointer ? "Look at a title, then pinch and release." : "Point at a title, then pinch and release.";
  if (route === "shelf") {
    const days = shelfDays(progress, today);
    state.shelfPage = Math.max(0, Math.min(state.shelfPage, Math.max(0, Math.ceil(days.length/HOME_DAYS_PER_PAGE)-1)));
    options.days = days.map(date => ({ date, subtitle: `${resolveDay(progress,date,SOURCE_CATALOGUE).filter(e=>e.read).length} of 3 read` }));
    options.page = state.shelfPage;
    if (days[0] !== shelfTop) { if(shelfTop !== undefined) state.hover=null; shelfTop=days[0]; }
  } else if (route === "shelfday") {
    options.entries = resolveDay(progress, state.shelfDay, SOURCE_CATALOGUE).map(e => ({ ...e, read: e.read || (e.work && workRead(progress,e.work)),
      work: e.work ? {...e.work,id:`today-${state.shelfDay}-${e.kind}-${e.work.id}`} : null }));
    options.dayLabel = new Date(`${state.shelfDay}T12:00:00`).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
  } else if (route === "library") {
    const works = libraryWorks();
    state.libraryPage = Math.max(0,Math.min(state.libraryPage,Math.max(0,Math.ceil(works.length/3)-1)));
    options.works = works.slice(state.libraryPage*3,state.libraryPage*3+3);
    options.library = true; options.page=state.libraryPage; options.total=works.length;
    options.resume = null; options.notes = false;
    if (completionContext) {
      const completed = works.find(w => canonicalWorkId(w) === completionContext.canonical);
      if (completed) options.completion = { id: completed.id, title: completed.title, saved: completionContext.saved, next: nextReadingWork(completed) };
    }
    options.dateline = `Library · ${state.libraryPage+1} of ${Math.max(1,Math.ceil(works.length/3))}`;
  }
  return options;
}
function navigationModel() {
  const page = state.arriving ? "today" : state.menuPage;
  if (HOME_ROUTES.includes(page) || state.arriving) {
    const options=homeOptions(page);return {kind:"home",options,bounds:HOME_FRAME,buttons:homeButtons(options)};
  }
  if(SETTINGS_PAGES.includes(page)) {
    const options={page,values:state,hover:state.hover};
    return {kind:"settings",options,bounds:settingsBounds(),buttons:settingsButtons(options)};
  }
  const work=workById(state.workId),today=todayKey(),personal=personalFor(progress.days[today],todayWorks);
  const options={page,view:calendarView,progress,today,hover:state.hover,notice:progressNotice,
    work,next:nextReadingWork(work),read:workRead(progress,work),
    allRead:todayFacts(new Date(),progress,today).allRead,thread:personal.thread,
    notes:[personal.dedication,personal.thread,picksNotice,driveNote()].filter(Boolean),notesPage:state.notesPage,
    title:"Today’s notes",backLabel:state.notesContext === "day" ? "Day" : state.homeTab === "shelf" ? "Shelf" : "Today"};
  if(page === "day") {
    ctx.save();ctx.font=`400 17px system-ui, -apple-system, "Segoe UI", sans-serif`;
    options.longPicks=Object.values(progress.days[calendarView.selected]?.picks||{}).some(label=>compactWrap(ctx,label,630).length>2);ctx.restore();
  }
  if(page === "notes" && state.notesContext === "day") {
    options.notes=Object.entries(progress.days[calendarView.selected]?.picks||{}).map(([kind,label])=>`${kind.toUpperCase()}\n${label}`);
    options.title="Reading titles";
  }
  options.notesCount=compactNotesPages(ctx,options.notes).length;
  return {kind:"compact",options,bounds:compactBounds(),buttons:compactButtons(options)};
}
function navigate(page) {
  completionContext = null;
  cancelPointerPresses("navigation-route");
  state.menuOpen=true; state.menuPage=page; state.hover=null;
  if(page === "today" || page === "shelf") {
    state.homeTab=page; preferences.homeTab=page; savePreferences();
    if(page === "today") markTodayShown();
  }
  dayOpenedAt=lastFrameTime; gestures.setContext("menu"); paint();
}
function navigationAction(id) {
  if(id === "day-notes") {if(state.centering||state.arriving||!dayInputAllowed(lastFrameTime,dayOpenedAt))return true;state.notesContext="day";state.notesPage=0;navigate("notes");return true;}
  if(typeof id !== "string" || !(id.startsWith("home-") || id.startsWith("settings-") || id.startsWith("notes-")))return false;
  if(state.centering || state.arriving || !dayInputAllowed(lastFrameTime,dayOpenedAt))return true;
  if(id === "home-resume") {toggleMenu(false);return true;}
  const routes={"home-today":"today","home-shelf":"shelf","home-settings":"settings","home-library":"library",
    "home-calendar":"calendar","home-back-shelf":"shelf","home-notes":"notes","notes-home":state.notesContext==="day"?"day":state.homeTab,
    "settings-done":state.homeTab,"settings-more":"more","settings-sound":"sound","settings-calendar":"calendar",
    "settings-wrist":"wrist","settings-controls":"controls","settings-volume":"volume"};
  if(id in routes) { if(id==="home-library")state.libraryPage=0; if(id==="home-notes"){state.notesPage=0;state.notesContext="today";} navigate(routes[id]); return true; }
  if(id==="settings-back") {navigate(state.menuPage==="more"?"settings":state.menuPage==="volume"?"sound":"more");return true;}
  if(id.startsWith("home-day:")){state.shelfDay=id.slice(9);navigate("shelfday");return true;}
  if(id.startsWith("home-work:")){
    const target=id.slice(10),work=WORKS.find(w=>w.id===target)||addShelfWork(target);
    if(work){openWork(work.id);toggleMenu(false);}return true;
  }
  if(id==="home-earlier"||id==="home-later"){
    const key=state.menuPage==="library"?"libraryPage":"shelfPage";state[key]+=id==="home-earlier"?1:-1;paint();return true;
  }
  if(id==="notes-next"||id==="notes-prev"){state.notesPage+=id==="notes-next"?1:-1;paint();return true;}
  if(id==="settings-exit"){action("exit");return true;}
  if(id==="settings-move"){action("recenter");return true;}
  if(id==="settings-practise"){action("practice");return true;}
  const [name,value]=id.slice(9).split(":");
  if(name==="appearance" && state.night !== (value==="night"))action("night");
  else if(name==="type" && state.mood!==value)action("mood");
  else if(name==="size" && [0,1,2].includes(Number(value))) {
    state.pendingAnchor=currentAnchor();state.size=Number(value);preferences.size=state.size;savePreferences();paint();
  } else if(name==="entry" && state.entrySound!==(value==="on"))action("sound");
  else if(name==="wrist" && state.wristCalendar!==(value==="on"))action("watch");
  else if(name==="pointer" && state.headPointer!==(value==="head"))action("pointer");
  else if(name==="next" && state.swapped!==(value==="left"))action("swap");
  else if(name==="look" && state.gazeTurn!==(value==="on"))action("gaze");
  else if(name==="volume")setAmbienceVolume(Number(value)/100);
  else if(name==="ambience" && AMBIENCE_KINDS.includes(value)) {
    state.ambience=value;preferences.ambience=value;savePreferences();
    entrySound?.context?.resume?.().catch?.(()=>{});ambience.set(entrySound?.context,state.session?value:"off");paint();
  }
  return true;
}
function paint() {
  updateVolumeControl();
  // After midnight, yesterday's picks stop being "today".
  if (todayWorksFor !== dateKey(new Date())) {
    loadTodayCache();
    rebuildWorks(state.workId);
  }
  // Completion belongs to the actual open edition, including an archived
  // work or yesterday's reading carried across midnight.
  syncPointerScreen();
  canvas.dataset.view = state.arriving
    ? "arrival"
    : state.centering
      ? "centering"
      : state.menuOpen
        ? "menu"
        : state.practice
          ? "practice"
          : "reading";
  canvas.dataset.arrivalMs = String(arrivalDuration());
  canvas.dataset.reducedMotion = String(reducedMotion());
  canvas.dataset.welcomeComplete = String(state.arriving || (state.menuOpen && state.menuPage === "welcome"));
  canvas.dataset.todayComplete = String(state.menuOpen && state.menuPage === "today");
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
    palette = state.menuOpen || state.centering || state.arriving || state.practice
      ? NAV : state.night ? mood.night : mood.paper;
  const bg = palette.bg,
    ink = palette.ink,
    muted = palette.muted;
  ctx.clearRect(0, 0, PAGE.width, PAGE.height);
  if (!state.menuOpen && !state.arriving && !state.centering) { ctx.fillStyle = bg; ctx.fillRect(0, 0, PAGE.width, PAGE.height); }
  // Navigation owns its heading; the book retains its quiet running head.
  if (!state.menuOpen && !state.centering && !state.arriving && !state.practice) {
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
    while (title.length > 8 && ctx.measureText(title).width > 740) title = title.slice(0, -2).trimEnd() + "…";
    if (!state.menuOpen && !state.centering && !state.arriving) ctx.fillText(title, 1690, 170);
    // Display only: which of today's three this is, and which are read.
    if (!state.menuOpen && !state.centering && !state.arriving && todayWorks.some((t) => t.id === w.id)) {
      let x = 1690 - ctx.measureText(title).width - 56;
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
  }
  const navigation = navigationModel();
  canvas.dataset.buttons = JSON.stringify(navigation.buttons);
  canvas.dataset.activeBounds = JSON.stringify(navigation.bounds);
  if (state.arriving || state.menuOpen) {
    if (navigation.kind === "home") paintHome(ctx, navigation.options);
    else if (navigation.kind === "settings") paintSettings(ctx, navigation.options);
    else paintCompact(ctx, navigation.options);
    if (state.attentionPaused) {
      const b = navigation.bounds;
      ctx.fillStyle = "rgba(20,23,22,.94)";
      ctx.fillRect(b.x+80,b.y+b.h/2-60,b.w-160,120);
      ctx.fillStyle = NAV.ink; ctx.font = `500 38px ${UI}`; ctx.textAlign = "center";
      ctx.fillText("Paused · look toward the page, then open your hand.",b.x+b.w/2,b.y+b.h/2+12);
      ctx.textAlign = "left";
    }
  } else if (state.centering) {
    const b=PLACE_FRAME;
    ctx.save(); ctx.translate(b.x,b.y); navigationSurface(ctx,b.w,b.h,70); ctx.restore();
    ctx.textAlign="center";
    ctx.fillStyle=muted; ctx.font=`500 32px ${UI}`; spaced(ctx,5);
    ctx.fillText("BRADBURY CABIN",1024,b.y+100); unspaced(ctx);
    ctx.fillStyle=ink; ctx.font=`500 88px ${UI}`;
    ctx.fillText("Settle in.",1024,b.y+260);
    ctx.fillStyle=muted; ctx.font=`48px ${UI}`;
    ctx.fillText("Look where you’d like to read.",1024,b.y+365);
    ctx.beginPath(); ctx.roundRect(584,b.y+448,880,124,62);
    ctx.fillStyle="#eceeec"; ctx.fill();
    ctx.fillStyle="#252a27"; ctx.font=`500 43px ${UI}`;
    ctx.fillText("Pinch to place your window",1024,b.y+525);
    ctx.textAlign="left";
  } else if (state.practice) {
    ctx.fillStyle = ink;
    ctx.font = `500 76px ${UI}`;
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
      ctx.fillStyle = NAV.card;
      ctx.fillRect(160, y - 110, 1720, 280);
      ctx.fillStyle = ink;
      ctx.font = `500 54px ${UI}`;
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
  if (!state.menuOpen && !state.arriving && !state.centering) {
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
  }
  const exit=exitRect();
  canvas.dataset.buttons=JSON.stringify([...navigation.buttons,exit]);
  canvas.dataset.exitRect=JSON.stringify(exit);
  const disc=exitDisc();
  canvas.dataset.exitDisc=JSON.stringify(disc);
  paintExit(ctx, disc, palette === NAV ? null : palette, exitHover);
  // A window, not a sheet: soft rounded corners, transparent beyond them.
  if (state.mode !== "texture") {
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0, 0, PAGE.width, PAGE.height, WINDOW_RADIUS);
    else ctx.rect(0, 0, PAGE.width, PAGE.height);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
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
  $("page-turn-help").textContent = `Turn the page. ${state.swapped ? "Left" : "Right"} goes forward, ${state.swapped ? "right" : "left"} goes back. Change this in Settings → More settings → Controls.`;
  // The browser invitation shows the real saved reading page. Keep its last
  // reading image while the tools show a menu, and do no extra work in XR.
  if (!state.session && !state.menuOpen && !state.practice && !state.centering) {
    const preview = $("intro-page"), pctx = preview.getContext("2d");
    pctx.clearRect(0,0,preview.width,preview.height);
    pctx.drawImage(canvas,0,0,preview.width,preview.height);
    preview.dataset.work = work.id;
    preview.closest('.intro-reading').dataset.ready = 'true';
  }
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
function surfaceWidth(){return state.mode==="layer" && quad?.width>0 ? quad.width : PAGE.metresWide;}
function surfaceHeight(){return state.mode==="layer" && quad?.height>0 ? quad.height : PAGE.metresHigh;}
function surfacePose(){return state.mode==="layer" && quad?.transform ? quad.transform : presentPose();}
// Restrained close control: a circle and an xmark; a static label on hover.
function paintExit(ctx, { cx, cy, r }, paper, hover) {
  ctx.save();
  if (paper) {
    const dark = paper === MOODS[state.mood].night;
    ctx.fillStyle = dark ? `rgba(235,230,218,${hover ? .16 : .09})` : `rgba(31,42,36,${hover ? .13 : .07})`;
  } else {
    ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.fillStyle = hover ? "#454c4d" : "rgba(48,54,55,.94)";
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "transparent";
  if (!paper) {
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.stroke();
  }
  const glyph = paper ? (hover ? paper.ink : paper.muted) : hover ? NAV.ink : NAV.muted;
  ctx.strokeStyle = glyph; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 16); ctx.lineTo(cx + 16, cy + 16);
  ctx.moveTo(cx + 16, cy - 16); ctx.lineTo(cx - 16, cy + 16);
  ctx.stroke();
  if (hover) {
    ctx.font = `500 30px ${UI}`;
    if (!paper) {
      // Over the room it sits on the same quiet material as the disc.
      const w = ctx.measureText("Leave cabin").width + 44, right = cx - r - 12;
      ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      ctx.fillStyle = "rgba(48,54,55,.94)";
      ctx.beginPath(); ctx.roundRect(right - w, cy - 30, w, 60, 30); ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(right - w + 1, cy - 29, w - 2, 58, 29); ctx.stroke();
    }
    ctx.fillStyle = paper ? paper.muted : NAV.ink; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("Leave cabin", paper ? cx - r - 16 : cx - r - 34, cy);
  }
  ctx.restore();
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
// Each entry shows the complete welcome at its chosen, stationary position.
function openWelcome(initialPlacement = null) {
  state.homeTab = "today";
  toggleMenu(true, initialPlacement);
  state.menuPage = state.homeTab;
  dayOpenedAt = lastFrameTime;
  paint();
}
// The Today page is complete as soon as it is opened.
function openToday() {
  toggleMenu(true);
  state.menuPage = "today";
  state.homeTab = "today";
  dayOpenedAt = lastFrameTime;
  markTodayShown();
  paint();
}
// A deliberate NEXT beyond any work opens confirmation, never completion.
function openClosing() {
  if (!canonicalWorkId(workById(state.workId)) || !["poem","story","essay"].includes(workById(state.workId).kind)) return false;
  toggleMenu(true);
  state.menuPage = "closing";
  dayOpenedAt = lastFrameTime;
  paint();
  return true;
}
function finishReading() {
  if (!state.menuOpen || state.menuPage !== "closing" || !dayInputAllowed(lastFrameTime, dayOpenedAt)) return false;
  const work = workById(state.workId), canonical = canonicalWorkId(work);
  const assignedDay = /^today-(\d{4}-\d{2}-\d{2})-/.exec(work.id)?.[1] || todayKey();
  markWorkRead(progress, work, assignedDay);
  const saved = storeProgress();
  completionContext = { canonical, saved };
  rememberPlace();
  rebuildWorks(state.workId);
  const works = libraryWorks(), index = works.findIndex(w => canonicalWorkId(w) === canonical);
  state.menuPage = "library";
  state.homeTab = "shelf";
  state.libraryPage = Math.max(0,Math.floor(index / 3));
  state.hover = null;
  dayOpenedAt = lastFrameTime;
  feedback(saved ? `${work.title} marked as read` : "Marked as read · could not save on this headset");
  paint();
  return true;
}
// Open a work at its saved place (or the start), and remember it as last.
function openWork(id) {
  completionContext = null;
  currentReadingOpened = true;
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
function toggleMenu(open = !state.menuOpen, initialPlacement = null) {
  const wasOpen = state.menuOpen;
  completionContext = null;
  if (!open && wasOpen) currentReadingOpened = true;
  gazeDwell.consume();
  cancelPointerPresses();
  state.todayReveal = null;
  state.menuOpen = open;
  state.menuPage = state.homeTab;
  if (open) state.feedback = "";
  state.practice = false;
  state.hover = null;
  pointerSource = null;
  // A new visit starts in view; browsing within that visit keeps its anchor.
  if (open && !wasOpen) menuPlacement = initialPlacement || inFront();
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
    placement = event.placement || lastDisplay || placement;
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
  if (state.menuOpen && state.menuPage === "closing" && event.type === "page") {
    const direction = event.direction || ((event.hand === "right") !== state.swapped ? "next" : "prev");
    if (direction === "next") return finishReading() ? "finished" : null;
    action("end-back");
    return "reading";
  }
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
  if(id==="global-exit"){leaveExperience();return;}
  if (navigationAction(id)) return;
  if (id === "welcome-begin" || id === "welcome-continue" || id === "welcome-menu") {
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    if (id === "welcome-begin") openToday();
    else if (id === "welcome-continue") toggleMenu(false);
    else {
      state.menuPage = state.homeTab;
      state.hover = null;
      dayOpenedAt = lastFrameTime;
      paint();
    }
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
    state.menuPage = id === "volume" ? "volume" : "sound";
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
    state.menuPage = id === "cal-menu" ? state.homeTab : "calendar";
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
    state.menuPage = id === "more" ? "more" : "settings";
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
    state.menuPage = state.homeTab;
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
    // Guarded like every choice: repeating the opening pinch must not move on.
    if (!dayInputAllowed(lastFrameTime, dayOpenedAt)) return;
    state.menuPage = id === "today-menu" ? "settings" : id === "today-library" ? "shelf" : id === "today-full-library" ? "library" : "today";
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
    } else state.menuPage = id === "shelf-menu" ? "settings" : id === "shelf-library" ? "library" : "shelf";
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
    finishReading();
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
$("session-export").onclick = () => $("export").click();
$("export").onclick = () => {
  const data = {
    build: "gestures-050",
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
    pointer: { error: state.pointerError || null,
      aim: "native-page-plane", diagnosticsEnabled: pointerDiagnosticsEnabled,
      samples: pointerDiagnostics, nativeQuad: nativeQuadGeometry() || lastNativeQuad,
      lookBack: { constants: LOOK_BACK, presses: pressChoices } },
    ambience: { setting: state.ambience, ...ambience.status() },
    mood: state.mood,
    wristCalendar: {
      enabled: state.wristCalendar,
      hand: WATCH_HAND,
      error: state.watchError,
      // Recent show/hide decisions with their measurements, for tuning the
      // pose limits from a real Quest trace.
      decisions: wristWatch?.log || [],
      measurement: wristWatch?.lastMeasure || null,
      intentMs: wristWatch?.intentMs || 0,
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
  a.download = "bradbury-test-details-build-050.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function applyLayers() {
  const session = state.session;
  if (projectionRoute) {
    const primary = quad && state.mode === "layer" ? quad : base;
    const groups = [
      [gazeRing, 'gazeError'], [pointer, 'pointerError'],
      [wristWatch, 'watchError'], [handBadges, 'handFeedbackError'], [arrival, 'arrivalError'],
    ];
    const layersFor = o => o && !o.failed ? [...(o.visible || []), ...(o.pendingPreloads?.() || [])] : [];
    const extras = [...new Set(groups.flatMap(([o]) => layersFor(o)))];
    try {
      session.updateRenderState({ layers: [primary, ...extras] });
    } catch (error) {
      const rejected = groups.find(([o]) => layersFor(o).length);
      if (!rejected) throw error;
      const [o, key] = rejected;
      o.failed = true;
      o.clearVisible();
      state[key] = error.message;
      return applyLayers();
    }
  } else session.updateRenderState({ baseLayer: base });
}
// Where a head/ray transform meets the displayed page, in canvas pixels.
function pagePoint(transform, display = surfacePose()) {
  if (!display || !transform) return null;
  const inv = display.inverse.matrix,
    m = transform.matrix;
  const origin = new DOMPoint(m[12], m[13], m[14]).matrixTransform(new DOMMatrix(inv));
  const direction = new DOMPoint(-m[8], -m[9], -m[10], 0).matrixTransform(new DOMMatrix(inv));
  if (direction.z >= -0.0001) return null;
  const t = -origin.z / direction.z;
  if (t < 0) return null;
  return {
    x: ((origin.x + direction.x * t) / surfaceWidth() + 0.5) * PAGE.width,
    y: (0.5 - (origin.y + direction.y * t) / surfaceHeight()) * PAGE.height,
  };
}
function hit(transform) {
  const display = surfacePose();
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
    ((origin.x + direction.x * t) / surfaceWidth() + 0.5) * PAGE.width,
    (0.5 - (origin.y + direction.y * t) / surfaceHeight()) * PAGE.height,
  );
}
// Hit-test the current menu panel: fixed menu pages or the live calendar.
function panelHit(x, y) {
  const button = navigationModel().buttons.find(b => !b.disabled && x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h)?.id;
  if (button) return button;
  if (inExitZone(x, y)) return "global-exit";
  // Forgiving targets on Home and Settings: a point in open space just beside
  // a button counts as it, but only when no other button is that close
  // (never at a seam between two options, never on calendar cells).
  const model = navigationModel();
  if (!["home", "settings"].includes(model.kind)) return null;
  const near = model.buttons.filter(b => !b.disabled).filter(b => {
    const dx = Math.max(b.x - x, 0, x - b.x - b.w), above = Math.max(b.y - y, 0), below = Math.max(y - b.y - b.h, 0);
    return dx <= TARGET_SLACK.other && above <= TARGET_SLACK.other && below <= (dx ? TARGET_SLACK.other : TARGET_SLACK.below);
  });
  return near.length === 1 ? near[0].id : null;
}
function insideNavigation(hit) {
  if (!hit) return false;
  const b = navigationModel().bounds;
  const x = (hit.local.x/surfaceWidth()+.5)*PAGE.width;
  const y = (.5-hit.local.y/surfaceHeight())*PAGE.height;
  const e=exitRect();
  return (x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h) || (x>=e.x&&x<=e.x+e.w&&y>=e.y&&y<=e.y+e.h);
}

function cleanSession() {
  lastNativeQuad = nativeQuadGeometry() || lastNativeQuad;
  $("session-details").hidden = false;
  $("session-details").scrollIntoView({ block: "nearest", behavior: "auto" });
  completionContext = null;
  currentReadingOpened = false;
  sessionGeneration++;
  state.todayReveal = null;
  state.session = null;
  cancelPointerPresses("session-ended");
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
  nativeQuadUpload = null;
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
  if (!state.error) report("Back from the cabin. You can save test details below.");
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
  lastNativeQuad = null;
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
    pointer = new Pointer(binding, ref, (error) => {
      state.pointerError = error.message;
    }, { layers: !!quad });
    if (pointer) pointer.onMarks = marks => { canvas.dataset.pointerMarks = JSON.stringify(marks.map(m => ({ hand: m.hand, look: m.look,
      x: (m.local.x / surfaceWidth() + .5) * PAGE.width, y: (.5 - m.local.y / surfaceHeight()) * PAGE.height }))); };
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
    handBadges?.prepare();
    wristWatch?.prepare(currentWatchSummary(), state.night);
    applyLayers();
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
        const eventAim = heldTargets.get(e.inputSource);
        const shown = eventAim?.press || eventAim;
        const shownPoint = shown?.hit?.local;
        gestures.trace.push({
          stage: "received",
          kind,
          eventSource: "native-select",
          hand: e.inputSource.handedness,
          time,
          visibility: session.visibilityState,
          context: gestures.context,
          profiles: Array.from(e.inputSource.profiles || []).slice(0, 4),
          ...(pointerDiagnosticsEnabled ? {
            hasHand: !!e.inputSource.hand, rayMode: e.inputSource.targetRayMode || null,
            eventAt: e.timeStamp, frameAt: lastFrameTime, revision: pointerRevision,
            menuOpen: state.menuOpen, menuPage: state.menuPage,
            pointerMode: state.headPointer ? "head" : "hand", uiHover: state.hover,
            shownTarget: shown?.target || null,
            shownPx: shownPoint ? [(shownPoint.x / surfaceWidth() + .5) * PAGE.width,
              (.5 - shownPoint.y / surfaceHeight()) * PAGE.height] : null,
            eventPx: pagePoint(ray),
            buttonPressed: e.inputSource.gamepad?.buttons?.[0]?.pressed ?? null,
            pinchGapMm: aimHistory.get(e.inputSource)?.at(-1)?.gapMm ?? null,
          } : {}),
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
        const aim = heldTargets.get(e.inputSource);
        // Hands: press what was aimed at before the fingers began closing.
        const choice = kind === "selectstart" && e.inputSource.hand && !state.headPointer
          ? chooseSnapshot(aimHistory.get(e.inputSource) || [], time, pointerRevision) : null;
        if (choice) {
          pressChoices.push({ time, hand: e.inputSource.handedness, reason: choice.reason, shiftedMs: choice.shiftedMs || 0,
            target: choice.sample?.target || null, liveTarget: aim?.target || null,
            chosen: choice.sample?.px ? [Math.round(choice.sample.px.x), Math.round(choice.sample.px.y)] : null,
            gaps: (aimHistory.get(e.inputSource) || []).slice(-24).map(h => [Math.round(time - h.t), h.gapMm == null ? null : Math.round(h.gapMm),
              h.px ? Math.round(h.px.x) : null, h.px ? Math.round(h.px.y) : null, h.target]) });
          if (pressChoices.length > 40) pressChoices.shift();
        }
        // What you see is what you get: the press takes what is highlighted
        // now. (The look-back above is recorded for diagnostics only.)
        const exitChosen = exitAims.get(e.inputSource);
        if(kind==="selectstart" && exitChosen)
          exitPresses.set(e.inputSource,{revision:pointerRevision,time,placement:lastDisplay});
        if (kind === "selectstart" && state.menuOpen && state.headPointer)
          headPresses.set(e.inputSource, { target: state.hover, revision: pointerRevision });
        if (kind === "selectstart" && (state.menuOpen || exitChosen) && !state.headPointer && aim) {
          aim.press ||= { hit: aim.hit, target: aim.target, revision: pointerRevision };
          aim.nativeHeld = true;
        }
        nativeQueue.push({
          kind,
          source: e.inputSource,
          time,
          ray,
          visible: session.visibilityState === "visible",
          revision: pointerRevision,
          press: aim?.press || null,
          headPress: headPresses.get(e.inputSource) || null,
          exitPress: exitPresses.get(e.inputSource) || null,
          placement: state.centering ? lastDisplay : null,
          wrist: !!wristWatch?.showingFor(e.inputSource.handedness),
        });
        if (nativeQueue.length > 60) {
          nativeQueue = [];
          cancelPointerPresses("event-queue-overflow");
          gestures.reset("event-queue-overflow");
        }
      });
    session.addEventListener("inputsourceschange", (e) => {
      for (const source of e.removed) {
        gestures.cancel(source, "source-removed");
        rayFilters.delete(source);
        heldTargets.delete(source);
        headPresses.delete(source);
        aimHistory.delete(source);
        wristPresses.delete(source);
        nativeQueue = nativeQueue.filter((e) => e.source !== source);
      }
    });
    ref.addEventListener?.("reset", () => {
      wantRecenter = true;
      nativeQueue = [];
      cancelPointerPresses("reference-reset");
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
      cancelPointerPresses("visibility-change");
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
      cancelPointerPresses("viewer-pose-lost");
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
        arrivalElapsed >= arrivalDuration()
      ) {
        state.arriving = false;
        nativeQueue = [];
        gestures.setContext("reading");
        state.handEntryStarted = time;
        placeAtArrival = readingPlace();
        // Keep the welcome at the chosen position, even if the head moved
        // during the fade. Its first usable frame must not dip again.
        openWelcome(placement);
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
      if(quad && lastDisplay!==presentPose()) {
        quad.transform=presentPose();
        lastDisplay=presentPose();
        canvas.dataset.panelPose=JSON.stringify(Array.from(lastDisplay.matrix));
      }
      syncPointerScreen();
      const framePointerRevision = pointerRevision;
      const activeSources = new Set(session.inputSources);
      for (const source of gestures.hands.keys())
        if (!activeSources.has(source)) {
          gestures.cancel(source, "source-removed");
          gestures.hands.delete(source);
          heldTargets.delete(source);
          headPresses.delete(source);
          rayFilters.delete(source);
        }
      const targets = new Map(),
        samples = [];
      exitAims.clear();
      let watchSample = null, watchSafe = false, watchSuppressed = false;
      const pointerRays = [];
      for (const source of session.inputSources) {
        if (!source.hand) {
          const ray=state.headPointer?pose.transform:xrFrame.getPose(source.targetRaySpace,ref)?.transform;
          exitAims.set(source,sessionVisible&&!pose.emulatedPosition&&!source.skipRendering&&overExit(ray));
          continue;
        }
        const joint = (name) => {
          const space = source.hand.get(name);
          return space ? xrFrame.getJointPose(space, ref) : null;
        };
        const a = joint("index-finger-tip"),
          b = joint("thumb-tip");
        const rawRay = state.headPointer ? pose.transform : xrFrame.getPose(source.targetRaySpace, ref)?.transform;
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
        if (source.handedness === WATCH_HAND && source.skipRendering) watchSuppressed = true;
        if (source.handedness === WATCH_HAND && !source.skipRendering && !pose.emulatedPosition) {
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
          // The legacy near-face heuristic uses the opposite anatomical
          // normal and also flags a valid back-of-wrist glance. For this
          // shortcut require its positively verified watch posture; explicit
          // browser ownership still always blocks it. Reading gates stay as-is.
          watchSafe = sessionVisible && !pose.emulatedPosition && !source.skipRendering &&
            watchPose({ ...watchSample, viewer: pose.transform.position,
              forward: { x: -pose.transform.matrix[8], y: -pose.transform.matrix[9], z: -pose.transform.matrix[10] },
              right: { x: pose.transform.matrix[0], y: pose.transform.matrix[1], z: pose.transform.matrix[2] } });
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
        // The reading cone is not the headset's hand-tracking boundary. A
        // tracked wrist can cross it while its native ray still points into
        // a visible menu. Accept that on-window menu aim without changing
        // reading gates, system ownership, physical tracking or attention.
        const menuHandInRange = tracked && inView(anchor.position, pose.transform, 90, 90);
        const rawMenuHit = state.menuOpen && !state.headPointer && menuHandInRange && rawRay
          ? rayOnPage(rawRay, surfacePose(), surfaceWidth(), surfaceHeight()) : null;
        const menuRayInView = !!rawMenuHit && insideNavigation(rawMenuHit);
        const interactionInView = handInView || menuRayInView;
        const button = source.gamepad?.buttons?.[0];
        const open = button ? !button.pressed : distance > 0.028;
        samples[samples.length - 1].systemGesture ||= !attentive || (tracked && !interactionInView);
        const physicallySafe = attentive && interactionInView && !systemGesture && !glancing;
        const eligible = state.centering ? sessionVisible && handInView && !systemGesture : physicallySafe;
        // One filtered page point per hand drives the dot, hover, Exit and press.
        let freshHit = null, freshTarget = null, shownHit = null;
        if (eligible && rawRay && !state.headPointer) {
          if (!rayFilters.has(source)) rayFilters.set(source, new PageAimFilter());
          const px = h => ({ x: (h.local.x / surfaceWidth() + 0.5) * PAGE.width, y: (0.5 - h.local.y / surfaceHeight()) * PAGE.height });
          const region = h => !!h && (state.menuOpen ? insideNavigation(h) : inExitZone(px(h).x, px(h).y));
          const rawHit = rayOnPage(rawRay, surfacePose(), surfaceWidth(), surfaceHeight());
          // Menus filter inside their card; elsewhere every on-page point is
          // filtered and remembered, so a pinch that drifts off Exit can still
          // be traced back to it. Only points inside the zone are shown.
          const filtered = (state.menuOpen ? region(rawHit) : !!rawHit)
            ? rayFilters.get(source).update(rawRay, surfacePose(), surfaceWidth(), surfaceHeight(), time)
            : (rayFilters.get(source).reset(), null);
          freshHit = region(filtered) ? filtered : null;
          if (freshHit) {
            const p = px(freshHit);
            freshTarget = state.menuOpen ? panelHit(p.x, p.y) : inExitZone(p.x, p.y) ? "global-exit" : null;
          }
          livePoints.set(source, filtered ? px(filtered) : null);
          const history = aimHistory.get(source) || [];
          history.push({ t: time, hit: filtered, target: freshTarget, px: filtered ? px(filtered) : null,
            gapMm: tipsTracked && distance != null ? distance * 1000 : null, revision: pointerRevision });
          while (history.length && time - history[0].t > LOOK_BACK.bufferMs) history.shift();
          aimHistory.set(source, history);
          exitAims.set(source, freshTarget === "global-exit");
        } else {
          aimHistory.delete(source); livePoints.delete(source);
          exitAims.set(source, eligible && state.headPointer && overExit(rawRay));
        }
        // A held Exit press keeps its dot, even if the hand drifts off the zone.
        const exitHeld = exitPresses.get(source)?.revision === pointerRevision;
        const handMenuAim = (state.menuOpen || exitAims.get(source) || exitHeld) && !state.headPointer;
        let target = null;
        if (!physicallySafe || (handMenuAim && !rawRay)) {
          heldTargets.delete(source);
          rayFilters.delete(source);
          // Ray loss invalidates a menu aim only. Reading gestures depend on
          // the physical hand gates established by GestureEngine.update.
          if (handMenuAim) gestures.cancel(source, "pointer-tracking-or-attention-lost", time);
        } else if (handMenuAim) {
          let aim = heldTargets.get(source);
          if (!aim) { aim = { hit: freshHit, target: freshTarget, press: null, nativeHeld: false }; heldTargets.set(source, aim); }
          // Finger spacing is not a press: Quest calibrates its own pinch.
          // Keep aiming live until the native event captures the displayed point.
          aim.liveHit = freshHit; aim.liveTarget = freshTarget;
          if (!aim.nativeHeld) aim.press = null;
          if (!aim.press) { aim.hit = freshHit; aim.target = freshTarget; }
          const shown = aim.press || aim;
          shownHit = shown.hit;
          target = shown.target;
          pointerRays.push({ source, hand: source.handedness, hit: shown.hit,
            look: target ? (aim.press ? "press" : "ring") : "dot" });
        } else if (state.menuOpen) target = hit(rawRay);
        recordPointerAim(source, rawRay, freshHit, pose.transform, a, b, time, shownHit,
          { tracked, handWithinReadingCone: handInView, menuHandInRange, menuRayOnWindow: menuRayInView,
            interactionInView, attentive, systemGesture: !!systemGesture,
            watchShowing: glancing, rayAvailable: !!rawRay });
        targets.set(source, target);
        gestures.update(source, {
          tracked: tracked && !wristWatch?.showingFor(source.handedness),
          anchorKind: anchor.kind,
          tipsTracked,
          inView: interactionInView,
          attentive,
          open,
          time,
          hand: source.handedness,
          target,
          systemGesture,
        });
      }
      for (const source of wristPresses.keys())
        if (!activeSources.has(source) || !watchSafe || source.skipRendering) wristPresses.delete(source);
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
          heldTargets.delete(input.source);
          rayFilters.delete(input.source);
          targets.delete(input.source);
          wristPresses.delete(input.source);
          headPresses.delete(input.source);
          exitPresses.delete(input.source);
          // This frame's pointer was prepared before event validation.
          if (pointer?.clearVisible()) applyLayers();
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
        if(input.exitPress) {
          gestures.cancel(input.source,"exit-control",time);
          const valid=input.revision===pointerRevision && input.exitPress.revision===pointerRevision &&
            input.visible && sessionVisible && !pose.emulatedPosition && !input.source.skipRendering &&
            (state.headPointer ? overExit(pose.transform)
              : !input.source.hand ? overExit(input.ray, EXIT.releaseSlack)
              : !!livePoints.get(input.source) && inExitZone(livePoints.get(input.source).x, livePoints.get(input.source).y, EXIT.releaseSlack));
          if(input.kind==="select" && valid && input.time-input.exitPress.time<HOLD_MS)leaveExperience();
          if(input.kind==="select"||input.kind==="selectend") {
            exitPresses.delete(input.source);
            const held = heldTargets.get(input.source);
            if (held) { held.press = null; held.nativeHeld = false; }
          }
          continue;
        }
        if (input.wrist || wristPresses.has(input.source)) {
          const valid = input.revision === pointerRevision && watchSafe && !input.source.skipRendering && input.source.handedness === WATCH_HAND && input.visible && sessionVisible &&
            !pose.emulatedPosition && !state.centering && !state.arriving &&
            wristWatch?.showingFor(WATCH_HAND) && watchSample?.wrist &&
            watchPose({ ...watchSample, viewer: pose.transform.position,
              forward: { x: -pose.transform.matrix[8], y: -pose.transform.matrix[9], z: -pose.transform.matrix[10] },
              right: { x: pose.transform.matrix[0], y: pose.transform.matrix[1], z: pose.transform.matrix[2] } });
          gestures.note({ result: 'wrist-check', reason: valid ? 'valid-wrist' : 'invalid-wrist',
            kind: input.kind, time: input.time, hand: input.source.handedness,
            revision: input.revision, currentRevision: pointerRevision, hasPress: wristPresses.has(input.source) });
          if (input.kind === 'selectstart' && valid && !wristPresses.has(input.source))
            wristPresses.set(input.source, { time: input.time, revision: pointerRevision });
          if (input.kind === 'select') {
            const press = wristPresses.get(input.source);
            wristPresses.delete(input.source);
            if (valid && press?.revision === pointerRevision && input.time - press.time < HOLD_MS) {
              toggleMenu(true);
              state.menuPage = 'shelf';
              state.shelfPage = 0;
              dayOpenedAt = time;
              paint();
            }
          }
          if (!valid || input.kind === 'selectend') wristPresses.delete(input.source);
          gestures.cancel(input.source, 'wrist-glance', time);
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
              entry.outcome = gestureEvent({ type: "center", placement:input.placement });
            } else gestures.note(entry);
          }
          continue;
        }
        // What you see is what you pick: hands use the steadied, held target
        // the dot shows; head input holds the last displayed highlight too.
        const finishing=state.menuOpen && state.menuPage==="closing";
        if (input.revision !== pointerRevision || (state.menuOpen && !finishing && input.source.hand && !state.headPointer &&
            (!heldTargets.has(input.source) || !input.press || input.press.revision !== pointerRevision))) {
          gestures.cancel(input.source, "pointer-press-invalidated", time);
          continue;
        }
        const closingPointed=input.press?.target || input.headPress?.target;
        const target = finishing
          ? (["end-mark","end-back"].includes(closingPointed) ? closingPointed :
            ((input.source.handedness==="right")!==state.swapped ? "end-mark" : "end-back"))
          : !state.menuOpen
          ? null
          : state.headPointer
            ? input.headPress?.revision === pointerRevision ? input.headPress.target : null
            : targets.has(input.source)
              ? input.press.target
              : hit(input.ray);
        pointerSource = input.source;
        const event = gestures.handle(input.kind, input.source, input.time, target);
        if (pointerDiagnosticsEnabled && (input.kind === "selectstart" || input.kind === "select")) {
          gestures.trace.push({ stage: "pointer-selection", kind: input.kind,
            time: input.time, hand: input.source.handedness, revision: pointerRevision,
            menuPage: state.menuPage, target, event: event?.type || null,
            selectedTarget: event?.target || null, uiHover: state.hover });
          if (gestures.trace.length > 120) gestures.trace.shift();
        }
        deliver(event);
        const rejectedStart = input.kind === "selectstart" &&
          (gestures.owner !== input.source || !gestures.hands.get(input.source)?.closed);
        if (rejectedStart || input.kind === "select" || input.kind === "selectend") {
          headPresses.delete(input.source);
          const aim = heldTargets.get(input.source);
          if (aim) {
            aim.nativeHeld = false; aim.press = null;
            aim.hit = aim.liveHit; aim.target = aim.liveTarget;
            targets.set(input.source, aim.target);
            const visual = pointerRays.find(r => r.source === input.source);
            if (visual) { visual.hit = aim.hit; visual.look = aim.target ? "ring" : "dot"; }
          }
        }
      }
      if (!ending && !state.arriving) deliver(gestures.tick(time));
      // Render only still-valid sources after event validation. A cancellation
      // must not resurrect a pre-validation dot in this same frame.
      const validatedRays = [];
      for (const { source, hand } of pointerRays) {
        const aim = heldTargets.get(source);
        if (!aim) continue;
        if (aim.press && !exitPresses.has(source) && (gestures.owner !== source || !gestures.hands.get(source)?.closed)) {
          aim.press = null; aim.nativeHeld = false;
          aim.hit = aim.liveHit; aim.target = aim.liveTarget;
        }
        const shown = aim.press || aim;
        targets.set(source, shown.target);
        validatedRays.push({hand, hit: shown.hit, look: shown.target ? (aim.press ? "press" : "ring") : "dot"});
      }
      if (pointer?.update(validatedRays, { transform: surfacePose(), width: surfaceWidth(), height: surfaceHeight() }, time)) applyLayers();
      // A selection can replace the panel in this same frame. Hide every old
      // dot/highlight immediately rather than leaving it over a new row.
      if (framePointerRevision !== pointerRevision) {
        targets.clear();
        if (pointer?.clearVisible()) applyLayers();
      }
      if (ending || state.session !== session || !gpu) return;
      const nextExitHover=[...exitAims.values()].some(Boolean) ||
        [...exitPresses.values()].some(press => press.revision === pointerRevision);
      if(nextExitHover!==exitHover){exitHover=nextExitHover;paint();}
      let hover = null;
      if (state.menuOpen && attentive) {
        if (state.headPointer) hover = gestures.owner && headPresses.has(gestures.owner)
          ? headPresses.get(gestures.owner).target : hit(pose.transform);
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
            nearPage: state.menuOpen,
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
            !watchSuppressed &&
            !pose.emulatedPosition &&
            sessionVisible &&
            !state.centering &&
            !state.arriving,
        })
      )
        applyLayers();
      const progress = state.arriving
        ? Math.min(1, arrivalElapsed / arrivalDuration())
        : null;
      // The old cover leaves are retired: the window simply fades in.
      if (arrival?.clearVisible()) applyLayers();
      const display = state.arriving
        ? placement
        : presentPose();
      if (quad)
        quad.opacity = reducedMotion()
          ? 1
          : state.arriving
          ? smooth(progress)
          : 1;
      if (display !== lastDisplay) {
        if (quad) quad.transform = display;
        canvas.dataset.panelPose = JSON.stringify(Array.from(display.matrix));
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
            pointer?.drawProjection(gpu, multiply(view.projectionMatrix, view.transform.inverse.matrix), display.matrix);
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
        nativeQuadUpload = { viewport: { x: sub.viewport.x, y: sub.viewport.y,
          width: sub.viewport.width, height: sub.viewport.height },
          textureWidth: sub.textureWidth, textureHeight: sub.textureHeight,
          imageIndex: sub.imageIndex ?? null, sourceWidth: canvas.width, sourceHeight: canvas.height };
        checkGl(gl, "quad subimage acquisition");
        gpu.copyPage(sub, canvas, { premultiplied: true });
        layerDirty = false;
        if (state.layerStatus !== "drawn") {
          state.layerStatus = "drawn";
          if (state.handFeedbackError) report('Hand feedback unavailable: ' + state.handFeedbackError);
          else report(
            `Compositor layer drawn at ${state.actualPixels.join(" × ")} pixels. Build 006: practise Next, Back and Menu.`,
          );
        }
      }
      const hadPreloads = !!(handBadges?.pendingPreloads().length || wristWatch?.pendingPreloads().length);
      if (handBadges?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (wristWatch?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (gazeRing?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (pointer?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (arrival?.draw(xrFrame, gpu, activeLayers)) applyLayers();
      if (hadPreloads && !handBadges?.pendingPreloads().length && !wristWatch?.pendingPreloads().length) applyLayers();
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
        if (state.menuOpen && state.menuPage === "welcome") {
          // The choices change under the pointer: repaint and guard first.
          dayOpenedAt = lastFrameTime;
          state.hover = null;
          cancelPointerPresses();
          paint();
        }
        if (state.session && !state.centering && !state.arriving && !state.menuOpen && !state.practice &&
            readingPlace() === placeAtArrival && preferences.todayShown !== today)
          openToday();
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
          ? "Get comfortable, then enter. Allow hand tracking when asked."
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
