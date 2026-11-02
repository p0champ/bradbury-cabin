// Google Drive link for Bradbury Cabin. Runs entirely in the browser:
// Google sign-in (Google Identity Services) gives a short-lived access token;
// the cabin then reads the newest "Bradbury Cabin/picks-YYYY-MM-DD.json"
// (written by Claude; its Drive connector can create files but not overwrite
// them, so each request is a new dated file) and
// keeps "Bradbury Cabin/progress.json" in step with the headset.
//
// Scopes: drive.readonly to read the file Claude wrote, drive.file to create
// and update the progress file the cabin owns. Nothing else is touched.
// The OAuth client ID is a public identifier (not a secret).
import { mergeRewards } from "./rewards.js?v=58";
import { mergeFeedback, mergeSelections } from "./feedback.js?v=58";
import { mergeThoughtDrafts } from "./thought-drafts.js?v=58";
import { withPickerContract } from "./picker-contract.js?v=58";
import { rememberGuides, missingGuideKinds, mergeDayGuides } from "./guide-archive.js?v=58";
import { mergePersonal } from "./daily-lines.js?v=58";
import { validCompletion } from "./progress.js?v=58";
export const CLIENT_ID_KEY = "cabin-google-client";
export const FOLDER = "Bradbury Cabin";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_KEY = "cabin-google-token";
export const READ_SCOPE_MISSING =
  "Google didn't allow reading Claude's file. Tap Sync with Drive again and tick \"See and download all your Google Drive files\"";
const MAX_FILE = 1_500_000; // bytes; a day's three texts are far smaller

// Calm notes for the reader: what happened, that reading is safe, what to do.
const KEPT = "Your readings are all here; tap Sync with Drive to try again.";
export const DRIVE_NOTES = {
  signInUnreachable: "Couldn't reach Google sign-in. Check the internet connection. " + KEPT,
  signInClosed: "Google sign-in closed before it finished. " + KEPT,
  unreachable: "Couldn't reach Google Drive just now. " + KEPT,
  slow: "Google Drive is taking too long to answer. " + KEPT,
  refused: "Google Drive didn't accept the request just now. " + KEPT,
};
const REQUEST_MS = 20000;

// One load per page; a failed load is forgotten so the next tap retries.
const loading = new Map();
function loadScript(src) {
  if (!loading.has(src))
    loading.set(src, new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => {
        s.remove();
        loading.delete(src);
        reject(Error(DRIVE_NOTES.signInUnreachable));
      };
      document.head.append(s);
    }));
  return loading.get(src);
}

export function preloadGoogle() {
  return loadScript("https://accounts.google.com/gsi/client").catch(() => {});
}
export class DriveLink {
  constructor({ clientId, fetchFn = (...a) => fetch(...a), storage = sessionStorage, identity = false } = {}) {
    this.clientId = clientId;
    this.identity = identity;
    this.fetch = fetchFn;
    this.storage = storage;
    this.token = null;
    this.expires = 0;
    this.folderId = null;
    this.progressId = null;
    this.needsReadScope = false;
    // Writes run one at a time, so two saves can never both create the
    // folder or progress.json.
    this.queue = Promise.resolve();
    try {
      const t = JSON.parse(storage.getItem(TOKEN_KEY) || "null");
      // Older saved tokens carry no scope list: drop them so the next tap
      // checks the permissions properly.
      if (t && t.expires > Date.now() + 60000 && t.read === true && (!identity || t.identity === true))
        Object.assign(this, { token: t.token, expires: t.expires });
    } catch {}
  }
  get connected() {
    return !!this.token && this.expires > Date.now() + 30000;
  }
  // Must be called from a user tap (Google opens a small sign-in window).
  async signIn() {
    if (!this.clientId) throw Error("Google setup is not finished yet");
    if (!globalThis.google?.accounts?.oauth2) await loadScript("https://accounts.google.com/gsi/client");
    // A blocked or partial script load leaves no usable sign-in.
    const oauth2 = globalThis.google?.accounts?.oauth2;
    if (!oauth2?.initTokenClient) throw Error(DRIVE_NOTES.signInUnreachable);
    const response = await new Promise((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: this.clientId,
        scope: SCOPES + (this.identity ? ' openid email' : ''),
        callback: (r) => (r.error ? reject(Error(DRIVE_NOTES.signInClosed)) : resolve(r)),
        error_callback: () => reject(Error(DRIVE_NOTES.signInClosed)),
      });
      // After a partial grant, ask with the full consent screen again.
      client.requestAccessToken({ prompt: this.needsReadScope ? "consent" : "" });
    });
    // Google lets people untick permissions. Without drive.readonly the
    // cabin only sees its own files, never the picks Claude wrote.
    const granted = String(response.scope || SCOPES).split(" ");
    this.needsReadScope = !granted.includes("https://www.googleapis.com/auth/drive.readonly");
    if (this.needsReadScope) throw Error(READ_SCOPE_MISSING);
    if (this.identity && !granted.includes('https://www.googleapis.com/auth/drive.file')) throw Error('Google did not allow the backup files. Your readings are kept; tap Sync with Drive and allow both Drive permissions');
    this.token = response.access_token;
    this.expires = Date.now() + (Number(response.expires_in) || 3600) * 1000;
    try {
      this.storage.setItem(TOKEN_KEY, JSON.stringify({ token: this.token, expires: this.expires, read: true, ...(this.identity ? { identity: true } : {}) }));
    } catch {}
  }
  signOut() {
    this.token = null;
    this.expires = 0;
    try {
      this.storage.removeItem(TOKEN_KEY);
    } catch {}
  }
  async call(url, init = {}) {
    if (!this.connected) throw Error("Not signed in to Google Drive");
    // Every request has a deadline, so a poor connection cannot hang a sync.
    let r;
    try {
      r = await this.fetch(url, {
        ...init,
        signal: init.signal || AbortSignal.timeout?.(REQUEST_MS),
        headers: { ...(init.headers || {}), Authorization: `Bearer ${this.token}` },
      });
    } catch (e) {
      throw Error(e?.name === "TimeoutError" || e?.name === "AbortError" ? DRIVE_NOTES.slow : DRIVE_NOTES.unreachable);
    }
    if (r.status === 401) {
      this.signOut();
      throw Error("Google sign-in expired");
    }
    if (!r.ok) throw Object.assign(Error(DRIVE_NOTES.refused), { status: r.status });
    return r;
  }
  async listFiles(q, fields, order = 'createdTime desc', size = 100) {
    const files = [], seen = new Set();
    let token = '';
    do {
      const url = `${API}/files?q=${encodeURIComponent(q)}&fields=nextPageToken,incompleteSearch,files(${fields})&orderBy=${order}&pageSize=${size}&spaces=drive` +
        (token ? `&pageToken=${encodeURIComponent(token)}` : '');
      const page = await (await this.call(url)).json();
      if (!page || page.incompleteSearch || (page.files != null && !Array.isArray(page.files)))
        throw Error("Google Drive couldn't list all the files. Your readings are kept; tap Sync with Drive to try again.");
      const next = page.nextPageToken ?? '';
      if (typeof next !== 'string' || (next && seen.has(next)))
        throw Error("Google Drive couldn't finish listing the files. Your readings are kept; tap Sync with Drive to try again.");
      files.push(...(page.files || []));
      if (next) seen.add(next);
      token = next;
    } while (token);
    return files;
  }
  async find(q) {
    return this.listFiles(q, 'id,name,modifiedTime', 'modifiedTime desc', 5);
  }
  async folder() {
    if (this.folderId) return this.folderId;
    const found = await this.find(
      `name = '${FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    );
    this.folderId = found[0]?.id || null;
    return this.folderId;
  }
  // Text of a file in the folder, or null when it does not exist.
  async read(name) {
    const folder = await this.folder();
    if (!folder) return null;
    const files = await this.find(`name = '${name}' and '${folder}' in parents and trashed = false`);
    if (!files.length) return null;
    if (name === "progress.json") this.progressId = files[0].id;
    return (await this.call(`${API}/files/${files[0].id}?alt=media`)).text();
  }
  // One small listing: which of today's picks files is newest. A new daily
  // three or a swap changes it, so the open app knows when to sync.
  async newestPicksStamp(today) {
    const folder = await this.folder();
    if (!folder) return null;
    const query = `'${folder}' in parents and trashed = false and name contains 'picks-${today}'`;
    const file = (await this.listFiles(query, 'id,name,createdTime,modifiedTime')).find(f =>
      new RegExp(`^picks-${today}(-[0-9]+)?\\.json$`).test(f.name));
    return file ? `${file.id}:${file.createdTime || ""}:${file.modifiedTime || ""}` : null;
  }
  // Claude's picks for `today`. Lists the folder (newest created first),
  // keeps only files named picks-YYYY-MM-DD[-n].json, and returns the first
  // one that parses with today's date. If none is for today, returns the
  // newest valid file so the app can say how old it is.
  async readPicksFor(today, parse) {
    const folder = await this.folder();
    if (!folder) return null;
    const query = `'${folder}' in parents and trashed = false`;
    const files = (await this.listFiles(query, 'id,name,size,createdTime', 'createdTime desc', 20)).filter((f) =>
      /^picks-\d{4}-\d{2}-\d{2}(-\d+)?\.json$/.test(f.name),
    );
    // The newest current-day request is authoritative. A failed new swap
    // must never silently redisplay an older selection as the new request.
    for (const f of files) {
      const nameDate = f.name.slice(6, 16);
      if (nameDate > today) continue;
      if (Number(f.size) > MAX_FILE)
        return { raw: null, parsed: { date: nameDate, works: [], problems: ["Claude's file is too large; nothing was cut or imported"] } };
      const raw = await (await this.call(`${API}/files/${f.id}?alt=media`)).text();
      if (new TextEncoder().encode(raw).length > MAX_FILE)
        return { raw: null, parsed: { date: nameDate, works: [], problems: ["Claude's file is too large; nothing was cut or imported"] } };
      const parsed = parse(raw);
      if (parsed.date !== nameDate)
        return { raw: null, parsed: { date: nameDate, works: [], problems: [...parsed.problems, "Claude's file date does not match its name"] } };
      return { raw, parsed, createdTime: f.createdTime };
    }
    return null;
  }
  // Recover optional notes for recorded past days through the existing Sync.
  // Twelve downloads per sync bounds the work; unchanged empty/bad files are
  // remembered, so later syncs can continue further back instead of retrying.
  async recoverGuides(progress, today, parse) {
    const days = Object.keys(progress.days).filter(d => d < today && missingGuideKinds(progress.days[d]).length).sort().reverse();
    if (!days.length) return 0;
    const folder = await this.folder();
    if (!folder) return 0;
    const cursor = progress.guideRecoveryCursor;
    const next = typeof cursor === "string" ? days.findIndex(d => d < cursor) : -1;
    const ordered = next > 0 ? [...days.slice(next), ...days.slice(0, next)] : days;
    let downloads = 0, recovered = 0, listed = 0;
    for (const date of ordered) {
      if (downloads >= 12 || listed >= 24) break;
      progress.guideRecoveryCursor = date;
      listed++;
      const query = `'${folder}' in parents and trashed = false and name contains 'picks-${date}'`;
      const files = (await this.listFiles(query, 'id,name,size,createdTime,modifiedTime')).filter(f =>
        new RegExp(`^picks-${date}(-[0-9]+)?\\.json$`).test(f.name));
      const file = files[0];
      if (!file || Number(file.size) > MAX_FILE) continue;
      const day = progress.days[date], revision = `${file.id}:${file.modifiedTime || file.createdTime || ""}:${file.size || ""}`;
      if (day.guideRecovery === revision) continue;
      const raw = await (await this.call(`${API}/files/${file.id}?alt=media`)).text();
      downloads++;
      // Remember oversized successful downloads too, so they cannot consume
      // every later recovery pass. Network failures remain eligible to retry.
      day.guideRecovery = revision;
      if (new TextEncoder().encode(raw).length > MAX_FILE) continue;
      const parsed = parse(raw);
      const recorded = parsed.works.filter(w => day.ids?.[w.kind] || day.picks?.[w.kind]);
      if (parsed.date === date && parsed.works.length === 3 && !parsed.problems.length &&
          rememberGuides(progress, date, recorded, { savedAt: file.createdTime, onlyMissing: true })) recovered++;
    }
    return recovered;
  }
  // Creates the folder and/or progress.json when needed, otherwise updates it.
  writeProgress(text) {
    const run = this.queue.then(() => this.writeProgressNow(text));
    this.queue = run.catch(() => {});
    return run;
  }
  async writeProgressNow(text) {
    text = withPickerContract(text, this.lastCheck);
    let folder = await this.folder();
    if (!folder) {
      const r = await this.call(`${API}/files?fields=id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }),
      });
      folder = this.folderId = (await r.json()).id;
    }
    if (!this.progressId) {
      const existing = await this.find(`name = 'progress.json' and '${folder}' in parents and trashed = false`);
      this.progressId = existing[0]?.id || null;
    }
    if (this.progressId) {
      await this.call(`${UPLOAD}/files/${this.progressId}?uploadType=media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      return;
    }
    const boundary = "cabin" + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: "progress.json", parents: [folder], mimeType: "application/json" }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
    const r = await this.call(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    this.progressId = (await r.json()).id;
  }
}

// Merge headset and Drive progress: for every day and reading, a tick on
// either side counts (ticking is the common action, and nothing is lost when
// the headset was offline). Weeks merge the same way. The earlier tracking
// start and challenge start win. Unticks only travel with the newer copy.
export function mergeProgress(local, remote) {
  if (!remote) return local;
  const newer = (remote.savedAt || "") > (local.savedAt || "") ? remote : local;
  const out = structuredClone(newer);
  if(local.rewards || remote.rewards)out.rewards=mergeRewards(local.rewards,remote.rewards);
  if (local.feedback || remote.feedback) out.feedback = mergeFeedback(local.feedback, remote.feedback);
  if(local.unapprovedThoughtDrafts || remote.unapprovedThoughtDrafts)
    out.unapprovedThoughtDrafts=mergeThoughtDrafts(local.unapprovedThoughtDrafts,remote.unapprovedThoughtDrafts,out.feedback);
  out.start = [local.start, remote.start].filter(Boolean).sort()[0];
  out.trackingSince = [local.trackingSince, remote.trackingSince].filter(Boolean).sort()[0];
  const older = newer === remote ? local : remote;
  // An explicit completion survives either side being saved later offline.
  // Preserve the first completion time if the same edition was finished twice.
  if (local.completedWorks || remote.completedWorks) {
    out.completedWorks = {};
    for (const record of [local.completedWorks, remote.completedWorks]) {
      for (const [id, stamp] of Object.entries(record || {})) {
        if (!validCompletion(id, stamp)) continue;
        const previous = Object.hasOwn(out.completedWorks, id) ? out.completedWorks[id] : null;
        if (!previous || Date.parse(stamp) < Date.parse(previous))
          Object.defineProperty(out.completedWorks, id, { value: stamp, enumerable: true, writable: true, configurable: true });
      }
    }
  }
  for (const [key, d] of Object.entries(older.days || {})) {
    const o = (out.days[key] ||= {});
    for (const k of ["poem", "story", "essay"]) if (d[k] && !(k in o)) o[k] = true;
    // Labels and catalogue IDs describe the same picks: take them as a pair.
    if (d.picks && !o.picks) {
      o.picks = d.picks;
      if (d.ids) o.ids = d.ids;
    } else if (d.ids && !o.ids && JSON.stringify(d.picks) === JSON.stringify(o.picks)) o.ids = d.ids;
    if (d.missed && o.missed == null) o.missed = d.missed;
    mergeDayGuides(o, d);
    mergePersonal(o, d);
    mergeSelections(o, d);
  }
  // Also validate notes on days present only in the newer copy.
  for (const day of Object.values(out.days || {})) {
    mergeDayGuides(day, null);
    mergePersonal(day, null);
    mergeSelections(day, null);
  }
  for (const [key, w] of Object.entries(older.weeks || {})) {
    const o = (out.weeks[key] ||= {});
    if (w.submitted && !("submitted" in o)) o.submitted = true;
    for (const f of ["grade", "title"]) if (w[f] != null && o[f] == null) o[f] = w[f];
  }
  return out;
}
