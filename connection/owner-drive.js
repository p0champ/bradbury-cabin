// Connection: the existing manual Claude folder, reached with server-only
// Google authorization. No reader token can make an arbitrary Google call.
import { MAX_RECOVERY_BYTES, recoveryQuery } from './recovery-protocol.js';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const MAX_BACKUP = 8000000, MAX_PICK = 1500000;
const fault = (message, status = 503) => Object.assign(Error(message), { status });
async function bounded(response, limit) {
  if (Number(response.headers.get('Content-Length')) > limit) { await response.body?.cancel(); throw fault('The complete file is too large; nothing was cut'); }
  const reader = response.body?.getReader(); if (!reader) return new Response(null, response);
  const parts = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength; if (length > limit) { await reader.cancel(); throw fault('The complete file is too large; nothing was cut'); } parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new Response(bytes, { status: response.status, headers: response.headers });
}
const strong = etag => typeof etag === 'string' && /^"[\x21\x23-\x7e]+"$/.test(etag);
const fileId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(id);
export function createOwnerDrive(DriveLink, authority, { fetchFn = (...args) => fetch(...args) } = {}) {
  return new class extends DriveLink {
    constructor() { super({ storage: { getItem: () => null } }); this.requests = 0; this.started = Date.now(); }
    get connected() { return true; }
    async call(url, init = {}, limit = MAX_BACKUP) {
      if (typeof url !== 'string' || !(url.startsWith(API + '/') || url.startsWith(UPLOAD + '/'))) throw fault('That file is outside the Cabin connection');
      const attempt = async () => {
        if (++this.requests > 45) throw fault('The connection is busy; your readings are kept and will retry');
        const token = await authority.access();
        const remaining = 18000 - (Date.now() - this.started);
        if (remaining <= 0) throw fault('Google is taking too long; your saved readings are kept');
        let response;
        try { response = await fetchFn(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(remaining), headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } }); }
        catch { throw fault('Google is unavailable just now; your saved readings are kept'); }
        return response;
      };
      let response = await attempt();
      if (response.status === 401) {
        await response.body?.cancel(); authority.accessInfo = null; response = await attempt();
      }
      if (!response.ok) { const status = response.status; await response.body?.cancel(); throw fault('Google did not finish this request; your readings are kept', status); }
      try { return await bounded(response, limit); }
      catch { throw fault('Google gave an incomplete or oversized file; your readings are kept'); }
    }
    listFiles(query, fields, order = 'createdTime desc') { return super.listFiles(query, fields, order, 1000); }
    async listRecovery(cursor) {
      const folder = await this.folder(); if (!folder) return [];
      return (await this.listFiles(`'${folder}' in parents and trashed = false and name contains 'cabin-recovery-'${recoveryQuery(cursor)}`, 'id,name,size,createdTime', 'createdTime asc'))
        .filter(file => /^cabin-recovery-[a-f0-9]{64}-[A-Za-z0-9-]{8,100}\.json$/.test(file.name));
    }
    async readRecovery(file) {
      if (!fileId(file?.id) || !/^cabin-recovery-[a-f0-9]{64}-[A-Za-z0-9-]{8,100}\.json$/.test(file.name) || Number(file.size) > MAX_RECOVERY_BYTES) throw fault('An earlier Google backup needs checking; your saved readings are kept');
      return (await this.call(`${API}/files/${file.id}?alt=media`, {}, MAX_RECOVERY_BYTES)).text();
    }
    async readPicks(day) {
      const found = await this.readPicksFor(day, raw => {
        let value; try { value = JSON.parse(raw); } catch {}
        return { date: value?.date ?? null, works: [], problems: value ? [] : ["Claude's file could not be read"] };
      });
      return found ? { raw: found.raw, date: found.parsed.date, problems: found.parsed.problems, createdTime: found.createdTime } : null;
    }
    async readGuide(day, known = '') {
      const folder = await this.folder(); if (!folder) return null;
      const files = (await this.listFiles(`'${folder}' in parents and trashed = false and name contains 'picks-${day}'`, 'id,name,size,createdTime,modifiedTime')).filter(file => new RegExp(`^picks-${day}(-[0-9]+)?\\.json$`).test(file.name));
      const file = files[0]; if (!file) return null;
      const revision = `${file.id}:${file.modifiedTime || file.createdTime || ''}:${file.size || ''}`;
      if (known === revision) return { raw: null, revision, unchanged: true, createdTime: file.createdTime };
      if (Number(file.size) > MAX_PICK) return { raw: null, revision, oversized: true, createdTime: file.createdTime };
      const raw = await (await this.call(`${API}/files/${file.id}?alt=media`)).text();
      const oversized = new TextEncoder().encode(raw).length > MAX_PICK;
      return { raw: oversized ? null : raw, revision, oversized, createdTime: file.createdTime };
    }
    async readProgressVersion() {
      const folder = await this.folder(); if (!folder) return null;
      const files = await this.find(`name = 'progress.json' and '${folder}' in parents and trashed = false`);
      if (!files.length) return null;
      if (!fileId(files[0].id)) throw fault('The Drive backup needs recovery');
      const response = await this.call(`${API}/files/${files[0].id}?alt=media`);
      return { id: files[0].id, etag: response.headers.get('ETag'), raw: await response.text() };
    }
    async writeConditional(version, text) {
      if (!fileId(version?.id) || !strong(version.etag)) throw fault('The Drive backup cannot be safely updated yet; the private backup is kept');
      await this.call(`${UPLOAD}/files/${version.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'If-Match': version.etag }, body: text });
    }
    async reserveId() {
      const value = await (await this.call(`${API}/files/generateIds?count=1&space=drive&type=files`)).json();
      if (!Array.isArray(value.ids) || value.ids.length !== 1 || !fileId(value.ids[0])) throw fault('Google did not reserve the backup file; your readings are kept');
      return value.ids[0];
    }
    async createProgress(id, text) {
      return this.createJson(id, 'progress.json', text);
    }
    async createJson(id, name, text, appProperties) {
      if (!fileId(id)) throw fault('The backup file needs setup');
      const folder = await this.folder(); if (!folder) throw fault("The Cabin folder is not on Drive yet; ask Claude for the daily three");
      const boundary = 'cabin' + crypto.randomUUID().replaceAll('-', '');
      const metadata = { id, name, parents: [folder], mimeType: 'application/json', ...(appProperties ? { appProperties } : {}) };
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
      await this.call(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    }
    async probeConditional() {
      const id = await this.reserveId(), name = `cabin-connection-check-${id}.json`, marker = crypto.randomUUID();
      const before = JSON.stringify({ connectionCheck: marker, stage: 'before' }), after = JSON.stringify({ connectionCheck: marker, stage: 'after' }), rejected = JSON.stringify({ connectionCheck: marker, stage: 'must-not-be-written' });
      let safeConditional = false, cleanup = false;
      const read = async () => { const response = await this.call(`${API}/files/${id}?alt=media`); return { raw: await response.text(), etag: response.headers.get('ETag') }; };
      const rejectedWrite = async etag => {
        try { await this.writeConditional({ id, etag }, rejected); return false; }
        catch (error) { if (error.status === 412) return true; throw error; }
      };
      try {
        await this.createJson(id, name, before, { cabinConnectionProbe: marker });
        const first = await read();
        if (first.raw === before && strong(first.etag) && await rejectedWrite(`"cabin-never-matches-${marker}"`)) {
          await this.writeConditional({ id, etag: first.etag }, after);
          const second = await read();
          if (second.raw === after && strong(second.etag) && second.etag !== first.etag && await rejectedWrite(first.etag)) safeConditional = (await read()).raw === after;
        }
      } finally {
        // Only this newly created, marked disposable file can be removed.
        // If it was changed independently, retain it rather than deleting data.
        try {
          const metadata = await (await this.call(`${API}/files/${id}?fields=id,name,appProperties`)).json(), current = await read();
          if (metadata.id === id && metadata.name === name && metadata.appProperties?.cabinConnectionProbe === marker && [before, after, rejected].includes(current.raw)) {
            await this.call(`${API}/files/${id}`, { method: 'DELETE' }); cleanup = true;
          }
        } catch {}
      }
      return { safeConditional, cleanup };
    }
  }();
}
