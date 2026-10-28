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
    // Today's files first (most complete wins, newest breaks ties); then, for
    // the "old picks" message, only the newest older file is opened.
    let best = null,
      fallback = null;
    for (const f of files) {
      if (Number(f.size) > MAX_FILE) continue;
      const nameDate = f.name.slice(6, 16);
      if (nameDate < today && (best || fallback)) break;
      const raw = await (await this.call(`${API}/files/${f.id}?alt=media`)).text();
      const parsed = parse(raw);
      if (!parsed.works.length) continue;
      if (parsed.date === today) {
        if (!best || parsed.works.length > best.parsed.works.length) best = { raw, parsed };
        if (best.parsed.works.length === 3) break;
      } else if (!fallback) fallback = { raw, parsed };
    }
    return best || fallback;
  }
  // Creates the folder and/or progress.json when needed, otherwise updates it.
  writeProgress(text) {
    const run = this.queue.then(() => this.writeProgressNow(text));
    this.queue = run.catch(() => {});
    return run;
  }
  async writeProgressNow(text) {
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
  for (const [key, d] of Object.entries(older.days || {})) {
    const o = (out.days[key] ||= {});
    for (const k of ["poem", "story", "essay"]) if (d[k] && !(k in o)) o[k] = true;
    if (d.picks && !o.picks) o.picks = d.picks;
    if (d.missed && o.missed == null) o.missed = d.missed;
  }
  for (const [key, w] of Object.entries(older.weeks || {})) {
    const o = (out.weeks[key] ||= {});
    if (w.submitted && !("submitted" in o)) o.submitted = true;
    for (const f of ["grade", "title"]) if (w[f] != null && o[f] == null) o[f] = w[f];
  }
  return out;
}
