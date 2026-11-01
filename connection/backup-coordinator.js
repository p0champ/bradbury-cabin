// Connection: private snapshot protocol, shared by the eventual authenticated
// Worker controller and local tests. The controller supplies owner identity.
import { SnapshotStore } from './snapshot-store.js';
import { mergeWithIntents } from './managed-intents.js';
import { mergeManagedState } from './managed-state.js';
const fault = (message, code, status) => Object.assign(Error(message), { code, status });
export class BackupCoordinator {
  constructor(storage, { validate, mergeProgress, readInitial, now = () => new Date(), dayKey }) {
    this.storage = storage; this.snapshots = new SnapshotStore(storage, validate, { queueMirror: true });
    this.validate = validate; this.mergeProgress = mergeProgress; this.readInitial = readInitial; this.now = now; this.dayKey = dayKey;
  }
  async ensureInitial() {
    const current = await this.snapshots.read();
    if (current) return current;
    // No network error or damaged existing Drive file may mean "new account".
    const raw = await this.readInitial();
    if (raw === null) return null;
    let state; try { state = JSON.parse(raw); } catch {}
    if (!this.validate(state)) throw fault('The Drive backup needs recovery; your readings are kept', 'recovery', 409);
    const stamp = this.now().toISOString();
    await this.snapshots.commit({ revision: 0, baselineRevision: 0, device: '0'.repeat(64), requestId: 'initial-drive-copy', payload: raw, state: raw, stamp, day: this.dayKey(this.now()) });
    return this.snapshots.read();
  }
  async state(device) {
    const current = await this.ensureInitial(), record = await this.snapshots.deviceState(device);
    const [mirror, problem, grant] = await Promise.all(['mirrorVerified', 'mirrorProblem', 'googleGrant'].map(key => this.storage.get(key)));
    const currentProblem = problem?.code === 'google_reconnect' && !grant?.reconnect ? null : problem;
    const driveCurrent = !!current && mirror?.revision === current.root.revision;
    return { state: current?.value ?? null, revision: current?.root.revision ?? 0, baselineRevision: record.baseline?.root.revision ?? 0, sequence: record.sequence, driveCurrent, driveSyncedAt: driveCurrent && Number.isFinite(mirror.at) ? new Date(mirror.at).toISOString() : null, mirrorProblem: currentProblem ? { code: currentProblem.code, message: currentProblem.message } : null, googleReconnect: grant?.reconnect === true };
  }
  async save(device, request) {
    const { requestId, payload, revision, baselineRevision, sequence, operations } = request || {};
    if (!Number.isSafeInteger(revision) || revision < 0 || !Number.isSafeInteger(baselineRevision) || baselineRevision < 0 || !Number.isSafeInteger(sequence) || sequence < 0 || typeof payload !== 'string') throw fault('The connection could not read the changes', 'invalid', 400);
    let local; try { local = JSON.parse(payload); } catch {}
    if (!this.validate(local)) throw fault('The complete backup needs recovery; your readings are kept', 'recovery', 409);
    const current = await this.ensureInitial(), record = await this.snapshots.deviceState(device);
    const initial = !record.baseline ? mergeManagedState(local, current?.value ?? null, null, this.mergeProgress) : null;
    const merged = initial
      ? mergeWithIntents(initial, initial, operations, 0, this.mergeProgress).state
      : mergeWithIntents(local, current?.value ?? null, operations, record.sequence, this.mergeProgress).state;
    if (!this.validate(merged)) throw fault('The merged backup needs recovery; your readings are kept', 'recovery', 409);
    const stamp = this.now().toISOString();
    const result = await this.snapshots.commit({ revision, baselineRevision, device, requestId, payload, state: JSON.stringify(merged), stamp, day: this.dayKey(this.now()), sequence, operations });
    if (result.conflict || result.staleDevice) throw fault('Another save arrived; your changes will retry', 'conflict', 409);
    // Snapshot, edit sequence, retry signal and alarm committed together.
    const restored = await this.snapshots.read();
    if (!restored || restored.root.revision < result.receipt.revision) throw fault('The backup could not be checked; your changes are kept', 'recovery', 503);
    const status = await this.state(device);
    return { receipt: result.receipt, ...status, state: restored.value, revision: restored.root.revision };
  }
}
