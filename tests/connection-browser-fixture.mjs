// Local real service + fake Google. Nothing here is part of the public site.
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { makeOfflineEdition, manifestSource } from '../tools/generate-offline.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions, build } from '../tools/connection-runtime.mjs';
import { randomToken } from '../connection/connection-crypto.js';
import { CONNECTION_URL } from '../config.js';
import { seedProgress, berlinDateKey } from '../progress.js';
import { SOURCE_CATALOGUE } from '../source-catalogue.js';
import { LIBRARY } from '../library.js';
import { RESERVED_REWARD_IDS } from '../rewards.js';
const entry = fileURLToPath(new URL('../connection/worker.js', import.meta.url)).replaceAll('\\', '/');
const bundled = build({ stdin: { contents: `import worker,{CabinOwner} from ${JSON.stringify(entry)};
export class BrowserOwnerFixture extends CabinOwner {
  async fetch(request) { const path=new URL(request.url).pathname;if(path==='/__fixture/alarm'){await this.authority.authenticate(request.headers.get('Authorization'));await super.alarm();return Response.json({ran:true});}if(path==='/__fixture/expire'){await this.authority.authenticate(request.headers.get('Authorization'));this.authority.accessInfo=null;return Response.json({expired:true});}return super.fetch(request); }
}
export default worker;`, resolveDir: process.cwd(), sourcefile: 'browser-owner-fixture.js' }, bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022' });

export async function connectionFixture(returnURL, { initial = seedProgress(berlinDateKey()) } = {}) {
  const temporary = await mkdtemp(join(tmpdir(), 'cabin-browser-api-')), output = await bundled;
  const config = { SERVICE_URL: CONNECTION_URL, CABIN_URL: 'https://p0champ.github.io/bradbury-cabin/', SETUP_URL: new URL('/', returnURL).href, GOOGLE_CLIENT_ID: 'fixture-client', GOOGLE_CLIENT_SECRET: 'fixture-secret', MASTER_KEY: randomToken(), OWNER_EMAIL: 'reader@example.com' };
  const files = new Map([['P', { id: 'P', name: 'progress.json', raw: JSON.stringify(initial), revision: 1, createdTime: '2026-10-30T12:00:00Z' }]]), writes = [], requestPaths = [];
  let reserved = 0, directProfile = 'fixture-owner', directCalls = 0, googleMode = 'normal', apiMode = 'normal', pause = false, held = null, loseBackup = false, todaySequence = 0, renewals = 0;
  const excluded = new Set([...LIBRARY.map(work => work.id), ...RESERVED_REWARD_IDS]), available = SOURCE_CATALOGUE.filter(work => !excluded.has(work.id));
  const [poem, swapPoem] = available.filter(work => work.kind === 'poem'), story = available.find(work => work.kind === 'story'), essay = available.find(work => work.kind === 'essay');
  const googleFetch = async request => {
    const url = new URL(request.url);
    if (url.hostname === 'oauth2.googleapis.com') { if (new URLSearchParams(await request.text()).get('grant_type') === 'refresh_token') renewals++; return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'Bearer', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file' }); }
    if (url.hostname === 'openidconnect.googleapis.com') return Response.json({ email: config.OWNER_EMAIL, email_verified: true, sub: directProfile });
    if (url.hostname !== 'www.googleapis.com') throw Error('Unexpected external request in the local service fixture');
    if (googleMode !== 'normal') return new Response('<html>fixture Google limit</html>', { status: 429 });
    if (url.pathname.endsWith('/generateIds')) return Response.json({ ids: [`probe-${++reserved}`] });
    const query = url.searchParams.get('q');
    if (query) {
      if (query.includes('mimeType')) return Response.json({ files: [{ id: 'F', name: 'Bradbury Cabin' }] });
      if (query.includes("name = 'progress.json'")) return Response.json({ files: [{ id: 'P', name: 'progress.json' }] });
      if (query.includes("name contains 'cabin-recovery-'")) return Response.json({files:[...files.values()].filter(file=>file.name.startsWith('cabin-recovery-')).map(({raw,revision,...metadata})=>({...metadata,size:new TextEncoder().encode(raw).length}))});
      const day = /name contains 'picks-(\d{4}-\d{2}-\d{2})'/.exec(query)?.[1];
      return Response.json({ files: [...files.values()].filter(file => /^picks-/.test(file.name) && (!day || file.name.includes(day))).sort((a, b) => b.createdTime.localeCompare(a.createdTime)).map(({ raw, revision, ...metadata }) => ({ ...metadata, size: new TextEncoder().encode(raw).length, modifiedTime: metadata.createdTime })) });
    }
    if (request.method === 'POST') {
      const raw = await request.text(), parts = [...raw.matchAll(/\r\n\r\n({[^\r\n]+})\r\n--/g)].map(match => match[1]), metadata = JSON.parse(parts[0]);
      if (!/^(cabin-connection-check-|cabin-recovery-)/.test(metadata.name)) throw Error('Unexpected file creation in the local Google fixture');
      files.set(metadata.id, { ...metadata, raw: parts[1], revision: 1, createdTime: new Date(Date.now()+reserved).toISOString() }); return Response.json({ id: metadata.id });
    }
    const id = url.pathname.split('/').at(-1), file = files.get(id); if (!file) return new Response(null, { status: 404 });
    if (request.method === 'PATCH') {
      if (request.headers.get('If-Match') !== `"${file.revision}"`) return new Response(null, { status: 412 });
      file.raw = await request.text(); file.revision++; if (id === 'P') writes.push(JSON.parse(file.raw)); return Response.json({ id });
    }
    if (request.method === 'DELETE') { if (id === 'P') throw Error('The fixture must never delete progress'); files.delete(id); return new Response(null, { status: 204 }); }
    if (url.searchParams.get('alt') === 'media') return new Response(file.raw, { headers: { ETag: `"${file.revision}"` } });
    return Response.json({ id, name: file.name, appProperties: file.appProperties });
  };
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: output.outputFiles[0].text, compatibilityDate: '2026-10-30', bindings: config, durableObjects: { OWNER: { className: 'BrowserOwnerFixture', useSQLite: true } }, outboundService: googleFetch, resourcePersistencePath: temporary, telemetry: { enabled: false } }));
  const dispatch = (path, { token, body, headers = {} } = {}) => mf.dispatchFetch(new URL(path, CONNECTION_URL).href, { redirect: 'manual', method: body === undefined ? 'GET' : 'POST', headers: { Origin: new URL(returnURL).origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  async function authorise() {
    const device = randomToken(), begin = await dispatch('auth/begin?' + new URLSearchParams({ return: config.SETUP_URL }));
    if (begin.status !== 303) throw Error('Fixture sign-in did not start');
    const state = new URL(begin.headers.get('Location')).searchParams.get('state'), cookie = begin.headers.get('Set-Cookie').split(';')[0];
    const callback = await dispatch('auth/callback?' + new URLSearchParams({ code: 'fixture-code-long-enough', state }), { headers: { Cookie: cookie } });
    if (callback.status !== 303) throw Error('Fixture sign-in did not return');
    const code = new URLSearchParams(new URL(callback.headers.get('Location')).hash.slice(1)).get('cabin-pair'), paired = await dispatch('pair', { body: { code, device } });
    if (paired.status !== 200) throw Error('Fixture connection was not paired');
    const { token, ownerSubject } = await paired.json(), probe = await dispatch('connection-check', { token, body: {} });
    if (probe.status !== 200 || !(await probe.json()).safeConditional) throw Error('The disposable compatibility probe failed');
    return { token, device, ownerSubject };
  }
  async function routeContext(context) {
    // Build 058 publishes the direct reader. These retained Build 059 checks
    // explicitly serve a managed test edition, including its real, matching
    // offline hashes; no assertion or integrity check is skipped or relaxed.
    const original = await readFile(new URL('../config.js', import.meta.url), 'utf8');
    if (!original.includes('export const MANAGED_CONNECTION_ENABLED = false;')) throw Error('Expected the direct Build 058 release configuration');
    const managed = Buffer.from(original.replace('export const MANAGED_CONNECTION_ENABLED = false;', 'export const MANAGED_CONNECTION_ENABLED = true;'));
    const edition = await makeOfflineEdition(name => name === 'config.js' ? managed : readFile(new URL('../' + name, import.meta.url)));
    await context.route(new URL('config.js', returnURL).href + '*', route => route.fulfill({ contentType: 'text/javascript', body: managed }));
    await context.route(new URL('offline-manifest.js', returnURL).href + '*', route => route.fulfill({ contentType: 'text/javascript', body: manifestSource(edition) }));
    await context.route('https://**/*', route => route.abort());
    await context.route(CONNECTION_URL + '**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname; requestPaths.push(path);
      if (apiMode === 'offline') return route.abort();
      if (apiMode === 'html-limit') return route.fulfill({ status: 429, contentType: 'text/html', body: '<html>fixture free limit</html>' });
      if (apiMode === 'bad-json') return route.fulfill({ status: 200, contentType: 'application/json', body: '{bad' });
      if (path === '/backup' && pause) { pause = false; await new Promise(resolve => { held = resolve; }); held = null; }
      const headers = await request.allHeaders(), response = await mf.dispatchFetch(request.url(), { method: request.method(), headers, ...(request.method() === 'GET' || request.method() === 'HEAD' ? {} : { body: request.postData() }), redirect: 'manual' });
      // Playwright does not intercept a redirect's next hop. Start a new
      // navigation so fake Google stays local, while retaining the real
      // service's state cookie and exact destination. Native Worker tests
      // separately require its real HTTP 303 response and Location.
      // https://playwright.dev/docs/network#redirects
      if (path === '/auth/begin' && response.status === 303) {
        const destination = response.headers.get('Location');
        if (new URL(destination).origin !== 'https://accounts.google.com') throw Error('Unexpected sign-in destination');
        return route.fulfill({ status: 200, headers: { ...Object.fromEntries(response.headers), 'Content-Type': 'text/html' }, body: `<script>location.replace(${JSON.stringify(destination)})</script>` });
      }
      if (path === '/backup' && loseBackup) { loseBackup = false; return route.abort(); }
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
    });
    for (const origin of ['https://www.googleapis.com/**','https://openidconnect.googleapis.com/**']) await context.route(origin, async route => {
      const request=route.request(),headers=await request.allHeaders();
      if (headers.authorization !== 'Bearer fixture-direct-access') throw Error('A private Cabin credential must never reach Google');
      directCalls++;
      const response=await googleFetch(new Request(request.url(),{method:request.method(),headers,...(request.method()==='GET'?{}:{body:request.postData()})}));
      return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    });
    await context.route('https://accounts.google.com/**', async route => {
      if (new URL(route.request().url()).pathname === '/gsi/client') return route.fulfill({status:200,contentType:'text/javascript',body:`globalThis.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken(){globalThis.__fixtureDirectPrompts=(globalThis.__fixtureDirectPrompts||0)+1;options.callback({access_token:'fixture-direct-access',expires_in:3600,scope:options.scope});}})}}};`});
      const requested = new URL(route.request().url()), callback = new URL(requested.searchParams.get('redirect_uri'));
      callback.searchParams.set('state', requested.searchParams.get('state')); callback.searchParams.set('code', 'fixture-code-long-enough');
      const declined = new URL(callback); declined.searchParams.delete('code'); declined.searchParams.set('error', 'access_denied');
      await route.fulfill({ status: 200, contentType: 'text/html', headers: { 'Cross-Origin-Opener-Policy': 'same-origin' }, body: `<button id="allow">Allow fixture connection</button><button id="decline">Decline fixture connection</button><script>document.querySelector('#allow').onclick=()=>location.href=${JSON.stringify(callback.href)};document.querySelector('#decline').onclick=()=>location.href=${JSON.stringify(declined.href)};</script>` });
    });
  }
  return {
    authorise, routeContext, dispatch, writes, requestPaths, directCalls:()=>directCalls, setDirectProfile:value=>{directProfile=value;}, recoveryFiles:()=>[...files.values()].filter(file=>file.name.startsWith('cabin-recovery-')), main:()=>JSON.parse(files.get('P').raw), works: { poem, swapPoem, story, essay },
    setAPI: value => { apiMode = value; }, setGoogle: value => { googleMode = value; },
    holdNextBackup: () => { pause = true; }, held: () => !!held, release: () => { if (!held) throw Error('No fixture backup is held'); held(); }, loseNextBackup: () => { loseBackup = true; },
    addPicks: (selected = poem) => { const date = berlinDateKey(), id = `T${++todaySequence}`, raw = JSON.stringify({ version: 2, date, picks: { poem: { catalogueId: selected.id }, story: { catalogueId: story.id }, essay: { catalogueId: essay.id } } }); files.set(id, { id, name: `picks-${date}-${todaySequence}.json`, raw, revision: 1, createdTime: new Date(Date.now() + todaySequence * 1000).toISOString() }); },
    state: async token => { const response = await dispatch('state', { token }); if (response.status !== 200) throw Error('Fixture private state unavailable'); return response.json(); },
    mirror: async token => { const response = await dispatch('__fixture/alarm', { token }); if (response.status !== 200) throw Error('Fixture alarm failed'); },
    expireAccess: async token => { const response = await dispatch('__fixture/expire', { token }); if (response.status !== 200) throw Error('Fixture expiry failed'); }, renewals: () => renewals,
    dispose: async () => { await mf.dispose(); await rm(temporary, { recursive: true, force: true }); },
  };
}
