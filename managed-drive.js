// Lasting owner connection. Google credentials stay on the private service.
import { withPickerContract } from './picker-contract.js?v=58';
import { validProgress } from './progress.js?v=58';
import { mergeProgress } from './drive.js?v=58';
import { mergeManagedState } from './connection/managed-state.js?v=58';
import { mergeWithIntents, acknowledgeIntents } from './connection/managed-intents.js?v=58';
import { missingGuideKinds, rememberGuides } from './guide-archive.js?v=58';

export const CONNECTION_KEY = 'cabin-connection';
export const CONNECTION_DEVICE_KEY = 'cabin-connection-device';
export const CONNECTION_OWNER_KEY = 'cabin-connection-owner';
export const CONNECTION_RESULT_KEY = 'cabin-connection-result';
export const CONNECTION_PAIR_KEY = 'cabin-connection-pair';
export const DRIVE_MODE_KEY = 'cabin-drive-mode';
const pattern = /^[A-Za-z0-9_-]{43}$/;
const kept = 'Your readings are kept on this headset; you can keep reading.';
const unavailable = "The connection couldn't finish just now. " + kept;
const error = (message = unavailable, code = 'unavailable', status = 503) => Object.assign(Error(message), { code, status });
const safeCodes = new Set(['connection', 'signin', 'pair', 'owner', 'busy', 'devices', 'google_reconnect', 'recovery', 'conflict', 'invalid']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sequence = value => Number.isSafeInteger(value) && value >= 0;
function endpoint(value) {
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/') return url.href; } catch {}
  throw error('The lasting connection still needs setup. ' + kept, 'setup');
}
function deviceIdentity(storage) {
  let value = storage.getItem(CONNECTION_DEVICE_KEY);
  if (pattern.test(value || '')) return value;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  value = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  storage.setItem(CONNECTION_DEVICE_KEY, value); return value;
}
async function readJSON(response) {
  if (!(response.headers.get('Content-Type') || '').toLowerCase().includes('application/json') || Number(response.headers.get('Content-Length')) > 10000000) throw error();
  const reader = response.body?.getReader(); if (!reader) throw error();
  const parts = []; let length = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > 10000000) { await reader.cancel(); throw error(); } parts.push(value); }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); if (!plain(value) && value !== null) throw error(); return value; } catch { throw error(); }
}
async function requestJSON(fetchFn, url, { body, connection, timeout = 20000 } = {}) {
  let response;
  try { response = await fetchFn(url, { method: body === undefined ? 'GET' : 'POST', redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(timeout), headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(connection ? { Authorization: `Bearer ${connection}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw error(); }
  let value;
  try { value = await readJSON(response); } catch { throw error(); }
  if (!response.ok) throw error(safeCodes.has(value?.code) && typeof value.message === 'string' ? value.message : unavailable, safeCodes.has(value?.code) ? value.code : 'unavailable', response.status);
  return value;
}

// Called before the reader is started in the returning sign-in tab. The early
// classic script has already removed the short-lived code from the address.
export async function finishConnectionReturn({ url, storage = localStorage, session = sessionStorage, fetchFn = (...args) => fetch(...args), returning = globalThis.__cabinConnectionReturn === true } = {}) {
  let raw; try { raw = session.getItem(CONNECTION_PAIR_KEY); } catch {}
  if (!returning && !raw) return { handled: false };
  const result = (success, message) => { try { storage.setItem(CONNECTION_RESULT_KEY, JSON.stringify({ success, message, at: Date.now(), id: crypto.randomUUID() })); } catch {} return { handled: true, connected: success, message }; };
  try {
    let pending; try { pending = JSON.parse(raw || 'null'); } catch {}
    if (pending?.cancelled) { session.removeItem(CONNECTION_PAIR_KEY); return result(false, 'Google sign-in closed before it finished. ' + kept); }
    if (!pattern.test(pending?.code || '') || !Number.isFinite(pending.until) || pending.until <= Date.now()) throw error('This connection link expired. Tap Sync with Drive again in the other cabin tab.');
    const paired = await requestJSON(fetchFn, new URL('pair', endpoint(url)).href, { body: { code: pending.code, device: deviceIdentity(storage) } });
    if (!pattern.test(paired?.token || '')) throw error();
    if (paired.ownerSubject !== undefined) {
      if (!/^[A-Za-z0-9_-]{1,255}$/.test(paired.ownerSubject)) throw error();
      storage.setItem(CONNECTION_OWNER_KEY, paired.ownerSubject);
    }
    storage.setItem(CONNECTION_KEY, paired.token); session.removeItem(CONNECTION_PAIR_KEY);
    return result(true, 'The cabin is connected. You can close this tab and return to your reading.');
  } catch (failure) { return result(false, safeCodes.has(failure?.code) ? failure.message : unavailable); }
}

export class ManagedLink {
  constructor({ url, journal, storage = localStorage, fetchFn = (...args) => fetch(...args), windowObject = globalThis.window } = {}) {
    this.isManaged = true; this.url = url; this.journal = journal; this.storage = storage; this.fetch = fetchFn; this.window = windowObject;
    this.token = null; this.status = null; this.lastCheck = null; this.needsReconnect = false; this.unavailable = false; this.ownerSubject = null;
    try { const owner = storage.getItem(CONNECTION_OWNER_KEY); if (/^[A-Za-z0-9_-]{1,255}$/.test(owner || '')) this.ownerSubject = owner; } catch {}
    try { this.refreshConnection(); } catch {}
  }
  refreshConnection() { const token = this.storage.getItem(CONNECTION_KEY); this.token = pattern.test(token || '') ? token : null; }
  get connected() { return !!this.token; }
  initialise(snapshot, ownership) {
    if (!this.journal) return;
    const existing = !!this.journal.record; this.journal.initialise(snapshot);
    if (!existing) this.journal.persist({ ...this.journal.record, ownership: { controls: !!ownership?.controls, reading: !!ownership?.reading, progress: ownership?.progress !== false }, initialClaimed: false, joined: false });
  }
  captureLocal(snapshot) {
    if (!this.journal?.record) throw error('The saved connection needs recovery. ' + kept, 'recovery');
    let record = this.journal.record;
    if (this.status?.sequence > record.sequence) record = this.journal.persist({ ...record, sequence: this.status.sequence });
    if (!record.initialClaimed && !record.joined && !this.status?.baselineRevision) {
      const observed = structuredClone(record.observed), owned = record.ownership || {};
      if (observed.headset) { if (owned.controls) delete observed.headset.controls; if (owned.reading) delete observed.headset.reading; }
      this.journal.persist({ ...record, observed }); this.journal.capture(snapshot);
      record = this.journal.persist({ ...this.journal.record, initialClaimed: true });
    }
    return this.journal.capture(snapshot);
  }
  prepareBackupText(text, check = this.lastCheck) { return withPickerContract(text, check); }
  async api(path, options = {}) {
    if (!this.connected) throw error('Connect the cabin again. ' + kept, 'connection', 401);
    try { const reply = await requestJSON(this.fetch, new URL(path, endpoint(this.url)).href, { ...options, connection: this.token }); this.unavailable = false; return reply; }
    catch (failure) {
      if (failure.code === 'google_reconnect') this.needsReconnect = true;
      if (failure.code === 'unavailable' || failure.code === 'busy') this.unavailable = true;
      if (failure.status === 401 && failure.code === 'connection') { this.token = null; try { this.storage.removeItem(CONNECTION_KEY); } catch {} }
      throw failure;
    }
  }
  async signIn() {
    if (!this.window?.open) throw error("Google sign-in couldn't open. " + kept, 'signin');
    deviceIdentity(this.storage);
    const previous = this.token, started = Date.now();
    const destination = new URL('auth/begin?' + new URLSearchParams({ return: this.window.location.origin + this.window.location.pathname }), endpoint(this.url)).href;
    const popup = this.window.open('about:blank', 'cabin-connection', 'popup,width=500,height=680');
    if (!popup) throw error("Google sign-in couldn't open. " + kept, 'signin');
    try {
      const ready = await requestJSON(this.fetch, new URL('health', endpoint(this.url)).href, { timeout: 8000 });
      if (ready?.ready !== true || popup.closed) throw error();
      popup.location.href = destination;
    } catch {
      this.unavailable = true; try { popup.close(); } catch {}
      throw error('The automatic connection is resting. Tap Sync with Drive to try the Google backup. ' + kept);
    }
    await new Promise((resolve, reject) => {
      let poll, timeout;
      const done = failure => { clearInterval(poll); clearTimeout(timeout); this.window.removeEventListener('storage', inspect); failure ? reject(failure) : resolve(); };
      const inspect = () => {
        try {
          this.refreshConnection();
          if (this.token && this.token !== previous) { this.needsReconnect = false; done(); return; }
          const result = JSON.parse(this.storage.getItem(CONNECTION_RESULT_KEY) || 'null');
          if (result?.at >= started && result.success === false) done(error(typeof result.message === 'string' ? result.message : unavailable, 'signin'));
        } catch {}
      };
      this.window.addEventListener('storage', inspect); poll = setInterval(inspect, 500); timeout = setTimeout(() => done(error('Google sign-in did not finish. Tap Sync with Drive to try again. ' + kept, 'signin')), 180000); inspect();
    });
  }
  acceptStatus(reply) {
    if (!plain(reply) || !(reply.state === null || validProgress(reply.state)) || !sequence(reply.revision) || !sequence(reply.baselineRevision) || reply.baselineRevision > reply.revision || !sequence(reply.sequence) || (reply.state === null && reply.revision !== 0) || typeof reply.driveCurrent !== 'boolean') throw error('The private backup needs recovery; your readings are kept.', 'recovery');
    if ('googleReconnect' in reply && typeof reply.googleReconnect !== 'boolean') throw error();
    if ('ownerSubject' in reply && reply.ownerSubject !== null) {
      if (!/^[A-Za-z0-9_-]{1,255}$/.test(reply.ownerSubject)) throw error();
      this.ownerSubject = reply.ownerSubject;
      try { if (this.storage.getItem(CONNECTION_OWNER_KEY) !== reply.ownerSubject) this.storage.setItem(CONNECTION_OWNER_KEY, reply.ownerSubject); } catch {}
    }
    this.status = reply; this.needsReconnect = reply.googleReconnect === true; return reply;
  }
  async read(name) { if (name !== 'progress.json') throw error(); const reply = this.acceptStatus(await this.api('state')); return reply.state === null ? null : JSON.stringify(reply.state); }
  async refreshStatus() { return this.acceptStatus(await this.api('state')); }
  mergeForLocal(local, remote) {
    const record = this.captureLocal(local);
    if (!record.joined && !this.status?.baselineRevision && record.ownership?.progress !== false) {
      const initial = mergeManagedState(local, remote, null, mergeProgress);
      return mergeWithIntents(initial, initial, record.pending, 0, mergeProgress).state;
    }
    return mergeWithIntents(local, remote, record.pending, this.status?.sequence ?? 0, mergeProgress).state;
  }
  mergeFallbackForLocal(local, remote) {
    const record = this.captureLocal(local);
    if (!record.joined && record.ownership?.progress === false) return mergeWithIntents(local, remote, record.pending, 0, mergeProgress).state;
    return mergeManagedState(local, remote, record.joined ? remote : null, mergeProgress);
  }
  freezeEnvelope(payload, requestId) {
    const snapshot = JSON.parse(payload); if (!validProgress(snapshot) || !requestId) throw error('The complete backup needs recovery. ' + kept, 'recovery');
    this.captureLocal(snapshot);
    let envelope = this.journal.record.envelope;
    if (envelope?.id !== requestId) envelope = this.journal.persist({ ...this.journal.record, envelope: { id: requestId, sequence: this.journal.record.sequence, operations: structuredClone(this.journal.record.pending), bootstrap: this.journal.record.ownership?.progress !== false } }).envelope;
    return { snapshot, envelope };
  }
  async prepareRecovery(queued) {
    const { envelope } = this.freezeEnvelope(queued.payload, queued.id);
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceIdentity(this.storage)));
    const device = [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
    return { version: 1, device, requestId: queued.id, payload: queued.payload, sequence: envelope.sequence, operations: structuredClone(envelope.operations), bootstrap: envelope.bootstrap ?? true };
  }
  async writeProgress(payload, { requestId } = {}) {
    const { snapshot, envelope } = this.freezeEnvelope(payload, requestId);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!this.status || attempt) this.acceptStatus(await this.api('state'));
      try {
        const reply = this.acceptStatus(await this.api('backup', { body: { requestId, state: snapshot, sequence: envelope.sequence, operations: envelope.operations, bootstrap: envelope.bootstrap ?? true, revision: this.status.revision, baselineRevision: this.status.baselineRevision } }));
        if (reply.receipt?.id !== requestId || reply.receipt.sequence !== envelope.sequence || !sequence(reply.receipt.revision) || reply.receipt.revision > reply.revision) throw error();
        return reply;
      } catch (failure) { if (failure.code !== 'conflict' || attempt === 2) throw failure; }
    }
  }
  acknowledge(reply) { this.journal.persist({ ...acknowledgeIntents(this.journal.record, reply.receipt.sequence), joined: true }); }
  async newestPicksStamp(day) { const reply = await this.api('stamp?' + new URLSearchParams({ day })); if (!(reply?.stamp === null || typeof reply?.stamp === 'string')) throw error(); return reply.stamp; }
  async readPicksFor(day, parse) {
    const found = await this.api('picks?' + new URLSearchParams({ day })); if (found === null) return null;
    if (!plain(found) || typeof found.date !== 'string' || !(typeof found.raw === 'string' || found.raw === null)) throw error();
    const parsed = found.raw === null ? { date: found.date, works: [], problems: Array.isArray(found.problems) && found.problems.every(p => typeof p === 'string') ? found.problems : ["Claude's newest file could not be checked"] } : parse(found.raw);
    if (parsed.date !== found.date) return { raw: null, parsed: { date: found.date, works: [], problems: ["Claude's file date does not match its name"] } };
    return { raw: found.raw, parsed, createdTime: found.createdTime };
  }
  async recoverGuides(progress, today, parse) {
    const days = Object.keys(progress.days).filter(day => day < today && missingGuideKinds(progress.days[day]).length).sort().reverse();
    const next = typeof progress.guideRecoveryCursor === 'string' ? days.findIndex(day => day < progress.guideRecoveryCursor) : -1, ordered = next > 0 ? [...days.slice(next), ...days.slice(0, next)] : days;
    let downloaded = 0, listed = 0, recovered = 0;
    for (const day of ordered) {
      if (listed >= 24 || downloaded >= 12) break; listed++; progress.guideRecoveryCursor = day;
      const record = progress.days[day], found = await this.api('guide?' + new URLSearchParams({ day, known: record.guideRecovery || '' }));
      if (!found || found.unchanged || found.oversized) continue;
      if (typeof found.raw !== 'string' || typeof found.revision !== 'string') throw error();
      downloaded++; record.guideRecovery = found.revision;
      if (new TextEncoder().encode(found.raw).length > 1500000) continue;
      const parsed = parse(found.raw), works = parsed.works.filter(work => record.ids?.[work.kind] || record.picks?.[work.kind]);
      if (parsed.date === day && parsed.works.length === 3 && !parsed.problems.length && rememberGuides(progress, day, works, { savedAt: found.createdTime, onlyMissing: true })) recovered++;
    }
    return recovered;
  }
}
