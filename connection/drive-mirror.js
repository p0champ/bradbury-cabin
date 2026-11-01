// Connection: private snapshots are authoritative after the first import.
// An unexpected independent Drive edit is held for recovery, never overwritten.
import { digest } from './connection-crypto.js';
const hold = message => Object.assign(Error(message), { code: 'drive_changed' });
export class DriveMirror {
  constructor(storage, snapshots, files, { publish, conditionalReady = false, now = () => Date.now() }) {
    this.storage = storage; this.snapshots = snapshots; this.files = files; this.publish = publish; this.conditionalReady = conditionalReady; this.now = now;
  }
  async rememberAttempt(candidate, version) {
    const attempts = await this.storage.get('mirrorAttempts') || [];
    if (!Array.isArray(attempts)) throw hold('The Drive backup needs checking; your private progress is kept');
    if (!attempts.some(item => item.digest === candidate && item.base === (version?.etag ?? null))) {
      if (attempts.length >= 32) throw hold('Google could not confirm its earlier saves; your private progress is kept');
      attempts.push({ digest: candidate, base: version?.etag ?? null, at: this.now() });
      await this.storage.put('mirrorAttempts', attempts);
    }
  }
  async acceptObserved(version, checksum) {
    const head = await this.storage.get('driveMirrorHead'), attempts = await this.storage.get('mirrorAttempts') || [];
    if (head?.id === version.id && head.digest === checksum) {
      if (head.etag !== version.etag) await this.storage.put('driveMirrorHead', { ...head, etag: version.etag });
      return;
    }
    const createdId = await this.storage.get('mirrorCreateId');
    if (Array.isArray(attempts) && attempts.some(item => item.digest === checksum) && (head?.id === version.id || (!head && createdId === version.id))) {
      await this.storage.transaction(async tx => { await tx.put('driveMirrorHead', { id: version.id, etag: version.etag, digest: checksum }); await tx.put('mirrorAttempts', []); });
      return;
    }
    throw hold('The Drive copy changed separately and needs checking; your private progress is kept');
  }
  async markVerified(root, version, checksum) {
    await this.storage.transaction(async tx => {
      const current = await tx.get('current');
      await tx.put({ driveMirrorHead: { id: version.id, etag: version.etag, digest: checksum }, mirrorVerified: { revision: root.revision, digest: checksum, at: this.now() }, mirrorAttempts: [] });
      await tx.delete('mirrorProblem');
      if (current?.revision === root.revision) { await tx.delete('mirrorPending'); await tx.deleteAlarm(); }
      else { await tx.put('mirrorPending', { revision: current?.revision }); await tx.setAlarm(this.now() + 1000); }
    });
  }
  async run() {
    // Arm the next attempt before touching the network. Temporary failures
    // retain the complete private copy and the durable retry signal.
    await this.storage.setAlarm(this.now() + 60000);
    try {
      const saved = await this.snapshots.read();
      if (!saved) { await this.storage.deleteAlarm(); return; }
      if (!this.conditionalReady) throw hold('The lasting Google connection still needs its final setup; your private progress is kept');
      const text = this.publish(saved.text), checksum = await digest(text);
      const version = await this.files.readProgressVersion();
      if (version) {
        let parsed; try { parsed = JSON.parse(version.raw); } catch {}
        if (!this.snapshots.validate(parsed)) throw hold('The Drive copy needs recovery; it has been left untouched and your private progress is kept');
        const observed = await digest(version.raw); await this.acceptObserved(version, observed);
        if (observed === checksum) { await this.markVerified(saved.root, version, checksum); return; }
        await this.rememberAttempt(checksum, version);
        await this.files.writeConditional(version, text);
      } else {
        if (await this.storage.get('driveMirrorHead')) throw hold('The earlier Drive copy is missing; your private progress is kept');
        let id = await this.storage.get('mirrorCreateId');
        if (!id) { id = await this.files.reserveId(); await this.storage.put('mirrorCreateId', id); }
        await this.rememberAttempt(checksum, null); await this.files.createProgress(id, text);
      }
      // Never say Drive is current merely because an upload returned OK.
      const checked = await this.files.readProgressVersion();
      if (!checked || await digest(checked.raw) !== checksum) throw Error('Google did not confirm the complete backup');
      await this.acceptObserved(checked, checksum); await this.markVerified(saved.root, checked, checksum);
    } catch (error) {
      await this.storage.put('mirrorProblem', { code: error?.code === 'drive_changed' ? 'drive_changed' : error?.code === 'google_reconnect' ? 'google_reconnect' : 'unavailable', message: error?.code === 'drive_changed' || error?.code === 'google_reconnect' ? error.message : 'Google Drive has not caught up yet; your progress is kept privately and will retry', at: this.now() });
      // The scheduled retry remains. No private snapshot or credential is erased.
    }
  }
}
