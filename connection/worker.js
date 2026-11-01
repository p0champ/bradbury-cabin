// Owner-only connection service entry point.
import { DriveLink, mergeProgress } from '../drive.js';
import { validProgress, berlinDateKey } from '../progress.js';
import { withPickerContract } from '../picker-contract.js';
import { GoogleAuth } from './google-auth.js';
import { ConnectionAuthority } from './connection-authority.js';
import { BackupCoordinator } from './backup-coordinator.js';
import { ConnectionService } from './connection-service.js';
import { createOwnerDrive } from './owner-drive.js';
import { DriveMirror } from './drive-mirror.js';
import { digest } from './connection-crypto.js';
export class CabinOwner {
  constructor(ctx, env) {
    this.storage = ctx.storage; this.env = env; this.queue = Promise.resolve();
    this.authority = new ConnectionAuthority(ctx.storage, new GoogleAuth(env));
  }
  exclusive(run) { const pending = this.queue.then(run); this.queue = pending.catch(() => {}); return pending; }
  files() { return createOwnerDrive(DriveLink, this.authority); }
  backups(files) {
    return new BackupCoordinator(this.storage, {
      validate: validProgress, mergeProgress, dayKey: berlinDateKey,
      readInitial: async () => {
        const version = await files.readProgressVersion(); if (!version) return null;
        let value; try { value = JSON.parse(version.raw); } catch {}
        if (!validProgress(value)) throw Object.assign(Error('The Drive backup needs recovery; it has been left untouched'), { code: 'recovery', status: 409 });
        // No private snapshot exists yet. This records the exact external
        // starting copy; normal later reads never replace private progress.
        await this.storage.put('driveMirrorHead', { id: version.id, etag: version.etag, digest: await digest(version.raw) });
        return version.raw;
      }
    });
  }
  fetch(request) {
    return this.exclusive(async () => {
      const files = this.files(), backups = this.backups(files);
      const verifyConnection = async () => {
        // Exercise the encrypted renewal grant, rather than a cached access
        // token, before the owner enables the connection.
        this.authority.accessInfo = null;
        await this.authority.access();
        const result = await files.probeConditional();
        if (result.safeConditional && result.cleanup) {
          const grant = await this.storage.get('googleGrant');
          await this.storage.put('conditionalVerified', { client: this.env.GOOGLE_CLIENT_ID, subject: grant.subject, at: Date.now() });
        }
        return { ...result, renewed: true };
      };
      return new ConnectionService({ authority: this.authority, backups, files, verifyConnection }).fetch(request);
    });
  }
  alarm() {
    return this.exclusive(async () => {
      const files = this.files(), backups = this.backups(files), [verified, grant] = await Promise.all(['conditionalVerified', 'googleGrant'].map(key => this.storage.get(key)));
      const conditionalReady = verified?.client === this.env.GOOGLE_CLIENT_ID && verified?.subject === grant?.subject;
      await new DriveMirror(this.storage, backups.snapshots, files, { conditionalReady, publish: text => withPickerContract(text, JSON.parse(text).cabinPickerInstructions?.lastCheck ?? null) }).run();
    });
  }
}
const privacy = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Bradbury Cabin · Privacy</title><body><main><h1>Bradbury Cabin privacy</h1><p>This is a personal reading cabin for its owner. The owner chooses readings manually through Claude; this connection does not choose or generate them.</p><p>With permission, the connection reads the Bradbury Cabin folder in Google Drive and keeps the Cabin progress file up to date. Progress includes reading history, saved places, settings, stars, saved thoughts and clearly unapproved thought drafts.</p><p>Personal backups stay in the owner’s private Cloudflare storage and Google Drive. The Google renewal credential is encrypted separately from the backups and never sent to the reader or put in the public source. Reader devices receive a restricted Cabin connection credential.</p><p>The private store keeps the current copy, up to twenty earlier changes, and the latest copy from seven successful backup days. Earlier copies can be downloaded for recovery. Disconnecting a device does not delete backups or revoke other devices.</p><p>The app does not sell personal data or use it for advertising. Cloudflare and Google process the connection requests needed to provide storage and Drive access. Google data is used only for these Cabin functions, in accordance with the Google API Services User Data Policy, including its Limited Use requirements.</p><p>The owner controls the Cloudflare account and Google permissions. Removing Google access stops Drive access; removing stored personal data also requires removing the private Cloudflare storage and any Drive backup copies the owner wants to delete.</p><p>If the connection is unavailable, already installed readings remain readable and unsent changes stay on the device for retry. A complete outside backup is confirmed only after it is stored and checked.</p></main></body></html>`;
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/privacy' && request.method === 'GET') return new Response(privacy, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
    try {
      if (new URL(request.url).origin !== new URL(env.SERVICE_URL).origin) return new Response('Return to the cabin to connect', { status: 403 });
      return await env.OWNER.get(env.OWNER.idFromName('owner')).fetch(request);
    } catch {
      return Response.json({ code: 'unavailable', message: "The connection couldn't finish just now. Your changes are kept on this headset; you can keep reading." }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
    }
  }
};
