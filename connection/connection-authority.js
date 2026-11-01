// Connection: a single owner's authentication records, outside all snapshots.
import { randomToken, digest } from './connection-crypto.js';
const fail = (message, code, status = 401) => Object.assign(Error(message), { code, status });
const prune = (items, now) => Object.fromEntries(Object.entries(items || {}).filter(([, value]) => Number.isFinite(value.until) && value.until > now));
export class ConnectionAuthority {
  constructor(storage, google, { now = () => Date.now() } = {}) { this.storage = storage; this.google = google; this.now = now; this.accessInfo = null; this.renewing = null; }
  async begin(returnTo) {
    const begin = await this.google.begin(returnTo);
    await this.storage.transaction(async tx => {
      const states = prune(await tx.get('authStates'), this.now());
      if (Object.keys(states).length >= 16) throw fail('Google sign-in is busy; try again in a few minutes', 'busy', 429);
      states[begin.stateDigest] = { returnTo, until: begin.until };
      await tx.put('authStates', states);
    });
    return begin;
  }
  async callback(request) {
    const callback = await this.google.readCallback(request);
    await this.storage.transaction(async tx => {
      const states = prune(await tx.get('authStates'), this.now()), state = states[callback.stateDigest];
      if (!state || state.returnTo !== callback.returnTo) throw fail('Google sign-in needs a fresh try', 'signin');
      delete states[callback.stateDigest]; await tx.put('authStates', states);
    });
    if (callback.cancelled) {
      const destination = new URL(callback.returnTo); destination.hash = 'cabin-connection=cancelled';
      return { url: destination.href, cookie: this.google.clearCookie() };
    }
    const previous = await this.storage.get('googleGrant');
    const connected = await this.google.exchange(callback, previous?.subject);
    const code = randomToken(), codeDigest = await digest(code);
    await this.storage.transaction(async tx => {
      const pinned = await tx.get('googleGrant');
      if (pinned && pinned.subject !== connected.subject) throw fail('Use the Cabin owner’s Google account', 'owner');
      const codes = prune(await tx.get('pairCodes'), this.now());
      if (Object.keys(codes).length >= 16) throw fail('Connecting is busy; try again in a few minutes', 'busy', 429);
      codes[codeDigest] = { origin: new URL(callback.returnTo).origin, until: this.now() + 120000 };
      await tx.put({ googleGrant: { subject: connected.subject, protectedRefresh: connected.protectedRefresh, reconnect: false }, pairCodes: codes });
    });
    this.accessInfo = { access: connected.access, expires: connected.expires };
    const destination = new URL(callback.returnTo); destination.hash = new URLSearchParams({ 'cabin-pair': code }).toString();
    return { url: destination.href, cookie: this.google.clearCookie() };
  }
  async pair(code, deviceId, origin) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(code || '') || !/^[A-Za-z0-9_-]{43}$/.test(deviceId || '') || !this.google.config.origins.has(origin)) throw fail('Return to the cabin to connect', 'pair');
    const codeDigest = await digest(code), token = randomToken(), tokenDigest = await digest(token), device = await digest(deviceId);
    await this.storage.transaction(async tx => {
      const codes = prune(await tx.get('pairCodes'), this.now()), pending = codes[codeDigest];
      if (!pending || pending.origin !== origin) throw fail('This connection link has expired; tap Sync with Drive again', 'pair');
      const tokens = await tx.get('cabinTokens') || {};
      for (const [key, record] of Object.entries(tokens)) if (record.device === device) delete tokens[key];
      if (Object.keys(tokens).length >= 16) throw fail('The connection has reached its device limit; your readings are kept', 'devices', 409);
      delete codes[codeDigest]; tokens[tokenDigest] = { device, created: this.now() };
      await tx.put({ pairCodes: codes, cabinTokens: tokens });
    });
    const grant = await this.storage.get('googleGrant');
    return { token, device, ownerSubject: grant.subject };
  }
  async authenticate(header) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header || '');
    if (!match) throw fail('Connect the cabin again; your saved readings are kept', 'connection');
    const tokenDigest = await digest(match[1]), record = (await this.storage.get('cabinTokens'))?.[tokenDigest];
    if (!record || !/^[a-f0-9]{64}$/.test(record.device || '')) throw fail('Connect the cabin again; your saved readings are kept', 'connection');
    return { device: record.device, tokenDigest };
  }
  async disconnect(header) {
    const { tokenDigest } = await this.authenticate(header);
    await this.storage.transaction(async tx => { const tokens = await tx.get('cabinTokens') || {}; delete tokens[tokenDigest]; await tx.put('cabinTokens', tokens); });
  }
  async access() {
    if (this.accessInfo?.expires > this.now() + 60000) return this.accessInfo.access;
    if (this.renewing) return this.renewing;
    this.renewing = (async () => {
      const grant = await this.storage.get('googleGrant');
      if (!grant || grant.reconnect) throw fail('Google needs reconnecting; your saved readings are kept. Tap Sync with Drive', 'google_reconnect', 424);
      const renewed = await this.google.renew(grant.protectedRefresh, grant.subject);
      if (renewed.reconnect) {
        await this.storage.put('googleGrant', { ...grant, reconnect: true });
        throw fail('Google needs reconnecting; your saved readings are kept. Tap Sync with Drive', 'google_reconnect', 424);
      }
      if (renewed.protectedRefresh !== grant.protectedRefresh) await this.storage.put('googleGrant', { ...grant, protectedRefresh: renewed.protectedRefresh });
      this.accessInfo = { access: renewed.access, expires: renewed.expires };
      return renewed.access;
    })();
    try { return await this.renewing; } finally { this.renewing = null; }
  }
}
