// Server preparation only. Google credentials never enter Cabin snapshots.
import { randomToken, challenge, seal, open, digest } from './connection-crypto.js';
export const READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PROFILE_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const COOKIE = '__Host-cabin-connection';
const MAX_RESPONSE = 64000;
const failure = message => Error(message);
const validToken = token => typeof token === 'string' && token.length >= 8 && token.length <= 16000 && !/[\r\n]/.test(token);

export function authConfig(env) {
  const base = new URL(env.SERVICE_URL);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw failure('Connection address needs setup');
  const cabin = new URL(env.CABIN_URL);
  if (cabin.protocol !== 'https:' || cabin.username || cabin.password || cabin.search || cabin.hash || !cabin.pathname.endsWith('/')) throw failure('Cabin address needs setup');
  const returns = [cabin.href];
  if (env.SETUP_URL) {
    const setup = new URL(env.SETUP_URL);
    if (setup.protocol !== 'http:' || setup.hostname !== '127.0.0.1' || setup.username || setup.password || setup.search || setup.hash || !setup.pathname.endsWith('/')) throw failure('Temporary setup address is invalid');
    returns.push(setup.href);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.OWNER_EMAIL || '') || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.MASTER_KEY) throw failure('Private connection setup is incomplete');
  return { base: base.href, callback: new URL('auth/callback', base).href, cabin: cabin.href, returns, origins: new Set(returns.map(value => new URL(value).origin)), owner: env.OWNER_EMAIL.trim().toLowerCase() };
}

async function jsonReply(response) {
  if (!response.ok) throw failure('Google is unavailable just now; your saved readings are kept');
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE) throw failure('Google gave an unreadable reply');
  const reader = response.body?.getReader();
  if (!reader) throw failure('Google gave an unreadable reply');
  const parts = []; let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_RESPONSE) { await reader.cancel(); throw failure('Google gave an unreadable reply'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw failure('Google gave an unreadable reply'); }
}

export class GoogleAuth {
  constructor(env, { fetchFn = (...args) => fetch(...args), now = () => Date.now() } = {}) {
    this.env = env; this.config = authConfig(env); this.fetch = fetchFn; this.now = now;
  }
  async request(url, init) {
    // Workers supports manual/follow. Refuse every redirect at the response
    // check instead of forwarding a Google credential to another address.
    try { return await this.fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(20000) }); }
    catch { throw failure('Google is unavailable just now; your saved readings are kept'); }
  }
  async begin(returnTo) {
    if (!this.config.returns.includes(returnTo)) throw failure('Return to the cabin to connect');
    const state = randomToken(), verifier = randomToken();
    const protectedState = await seal({ state, verifier, returnTo, until: this.now() + 600000 }, this.env.MASTER_KEY, 'google-state');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: this.env.GOOGLE_CLIENT_ID, redirect_uri: this.config.callback, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: `openid email ${READ_SCOPE} ${FILE_SCOPE}`, state, code_challenge: await challenge(verifier), code_challenge_method: 'S256' });
    return { url: url.href, stateDigest: await digest(state), until: this.now() + 600000, cookie: `${COOKIE}=${protectedState}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600` };
  }
  async readCallback(request) {
    const url = new URL(request.url), cookies = request.headers.get('Cookie') || '';
    const matches = cookies.split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE}=`));
    if (matches.length !== 1) throw failure('Google sign-in did not finish; your readings are kept');
    const state = await open(matches[0].slice(COOKIE.length + 1), this.env.MASTER_KEY, 'google-state');
    if (!state || !Number.isFinite(state.until) || state.until <= this.now() || state.until > this.now() + 600000 || !this.config.returns.includes(state.returnTo) || typeof state.state !== 'string' || state.state !== url.searchParams.get('state') || typeof state.verifier !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state.verifier)) throw failure('Google sign-in needs a fresh try');
    if (url.searchParams.has('error')) return { ...state, cancelled: true, stateDigest: await digest(state.state) };
    const code = url.searchParams.get('code');
    if (!validToken(code)) throw failure('Google sign-in needs a fresh try');
    return { ...state, code, stateDigest: await digest(state.state) };
  }
  async exchange(callback, pinnedSubject = null) {
    const response = await this.request(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: callback.code, code_verifier: callback.verifier, client_id: this.env.GOOGLE_CLIENT_ID, client_secret: this.env.GOOGLE_CLIENT_SECRET, redirect_uri: this.config.callback }) });
    const token = await jsonReply(response);
    if (!validToken(token.access_token) || token.token_type?.toLowerCase() !== 'bearer' || !validToken(token.refresh_token) || !Number.isFinite(token.expires_in) || token.expires_in < 60) throw failure('Google did not finish the lasting connection; try connecting again');
    const scopes = new Set(String(token.scope || '').split(' '));
    if (!scopes.has(READ_SCOPE) || !scopes.has(FILE_SCOPE)) throw failure('Google did not allow the Cabin files; connect again and allow both Drive permissions');
    // Google checks the access token. Never trust a decoded, unsigned ID token.
    const profile = await jsonReply(await this.request(PROFILE_URL, { headers: { Authorization: `Bearer ${token.access_token}` } }));
    if (profile.email_verified !== true || String(profile.email || '').toLowerCase() !== this.config.owner || typeof profile.sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(profile.sub) || (pinnedSubject && pinnedSubject !== profile.sub)) throw failure('Use the Cabin owner’s Google account');
    return { subject: profile.sub, protectedRefresh: await seal({ refresh: token.refresh_token, subject: profile.sub }, this.env.MASTER_KEY, 'google-refresh'), access: token.access_token, expires: this.now() + Math.min(token.expires_in, 3600) * 1000 };
  }
  async renew(protectedRefresh, subject) {
    const saved = await open(protectedRefresh, this.env.MASTER_KEY, 'google-refresh');
    if (saved?.subject !== subject || !validToken(saved.refresh)) throw failure('The Google connection needs reconnecting; your readings are kept');
    const response = await this.request(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: saved.refresh, client_id: this.env.GOOGLE_CLIENT_ID, client_secret: this.env.GOOGLE_CLIENT_SECRET }) });
    // Only Google's actual invalid_grant means a revoked/expired grant. A
    // proxy page, quota response or timeout must retain the protected grant.
    if (response.status === 400) {
      let data; try { data = await jsonReply(new Response(response.body, { status: 200, headers: response.headers })); } catch {}
      if (data?.error === 'invalid_grant') return { reconnect: true };
      throw failure('Google is unavailable just now; your saved readings are kept');
    }
    const token = await jsonReply(response);
    if (!validToken(token.access_token) || token.token_type?.toLowerCase() !== 'bearer' || !Number.isFinite(token.expires_in) || token.expires_in < 60) throw failure('Google gave an unreadable reply');
    if (token.scope !== undefined) {
      const scopes = new Set(String(token.scope).split(' '));
      if (!scopes.has(READ_SCOPE) || !scopes.has(FILE_SCOPE)) return { reconnect: true };
    }
    let replacement = protectedRefresh;
    if (token.refresh_token !== undefined) {
      if (!validToken(token.refresh_token)) throw failure('Google gave an unreadable reply');
      replacement = await seal({ refresh: token.refresh_token, subject }, this.env.MASTER_KEY, 'google-refresh');
    }
    return { access: token.access_token, expires: this.now() + Math.min(token.expires_in, 3600) * 1000, protectedRefresh: replacement };
  }
  clearCookie() { return `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`; }
}
