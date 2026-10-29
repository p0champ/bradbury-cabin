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
import { withPickerContract } from "./picker-contract.js?v=49";
import { rememberGuides, missingGuideKinds, mergeDayGuides } from "./guide-archive.js?v=49";
import { mergePersonal } from "./daily-lines.js?v=49";
import { validCompletion } from "./progress.js?v=49";
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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(Error("Could not load Google sign-in"));
    document.head.append(s);
  });
}

export function preloadGoogle() {
  return loadScript("https://accounts.google.com/gsi/client").catch(() => {});
}
export class DriveLink {
  constructor({ clientId, fetchFn = (...a) => fetch(...a), storage = sessionStorage } = {}) {
    this.clientId = clientId;
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
      if (t && t.expires > Date.now() + 60000 && t.read === true)
        Object.assign(this, { token: t.token, expires: t.expires });
    } catch {}
  }
  get connected() {
    return !!this.token && this.expires > Date.now() + 30000;
  }
  // Must be called from a user tap (Google opens a small sign-in window).
  async signIn() {
    if (!this.clientId) throw Error("Google setup is not finished yet");
    await loadScript("https://accounts.google.com/gsi/client");
    const response = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: SCOPES,
        callback: (r) => (r.error ? reject(Error(r.error_description || r.error)) : resolve(r)),
        error_callback: (e) => reject(Error(e?.message || e?.type || "Sign-in was closed")),
      });
      // After a partial grant, ask with the full consent screen again.
      client.requestAccessToken({ prompt: this.needsReadScope ? "consent" : "" });
    });
    // Google lets people untick permissions. Without drive.readonly the
    // cabin only sees its own files, never the picks Claude wrote.
    const granted = String(response.scope || SCOPES).split(" ");
    this.needsReadScope = !granted.includes("https://www.googleapis.com/auth/drive.readonly");
    if (this.needsReadScope) throw Error(READ_SCOPE_MISSING);
    this.token = response.access_token;
    this.expires = Date.now() + (Number(response.expires_in) || 3600) * 1000;
    try {
      this.storage.setItem(TOKEN_KEY, JSON.stringify({ token: this.token, expires: this.expires, read: true }));
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
    const r = await this.fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${this.token}` },
    });
    if (r.status === 401) {
      this.signOut();
      throw Error("Google sign-in expired");
    }
    if (!r.ok) throw Error(`Google Drive error ${r.status}`);
    return r;
  }
  async find(q) {
    const url = `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=5&spaces=drive`;
    return (await (await this.call(url)).json()).files || [];
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
  // Claude's picks for `today`. Lists the folder (newest created first),
  // keeps only files named picks-YYYY-MM-DD[-n].json, and returns the first
  // one that parses with today's date. If none is for today, returns the
  // newest valid file so the app can say how old it is.
  async readPicksFor(today, parse) {
    const folder = await this.folder();
    if (!folder) return null;
    const url =
      `${API}/files?q=${encodeURIComponent(`'${folder}' in parents and trashed = false`)}` +
      `&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=20&spaces=drive`;
    const files = ((await (await this.call(url)).json()).files || []).filter((f) =>
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
      const url = `${API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime,modifiedTime)&orderBy=createdTime desc&pageSize=100&spaces=drive`;
      const files = ((await (await this.call(url)).json()).files || []).filter(f =>
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
  }
  // Also validate notes on days present only in the newer copy.
  for (const day of Object.values(out.days || {})) {
    mergeDayGuides(day, null);
    mergePersonal(day, null);
  }
  for (const [key, w] of Object.entries(older.weeks || {})) {
    const o = (out.weeks[key] ||= {});
    if (w.submitted && !("submitted" in o)) o.submitted = true;
    for (const f of ["grade", "title"]) if (w[f] != null && o[f] == null) o[f] = w[f];
  }
  return out;
}
