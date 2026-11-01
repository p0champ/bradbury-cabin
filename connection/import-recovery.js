// Rejoin immutable Google copies through the normal sequenced private protocol.
import { checkedRecovery, orderedRecovery, advanceRecovery } from './recovery-protocol.js';
export async function importRecoveryCopies(storage, files, backups, { limit = 8, now = Date.now, force = false } = {}) {
  const last = await storage.get('recoveryLastScan');
  if (!force && Number.isFinite(last) && now() - last < 15000) return;
  // Initial Google progress may already represent older recovery copies.
  // Establish its checked cursor before selecting files to replay.
  await backups.ensureInitial();
  const cursor = await storage.get('recoveryCursor'), pending = orderedRecovery(await files.listRecovery(cursor),cursor);
  const tokens = await storage.get('cabinTokens') || {};
  let next = cursor;
  for (const file of pending.slice(0,limit)) {
    const {envelope} = checkedRecovery(await files.readRecovery(file),file);
    const known = Object.values(tokens).some(record => record.device === envelope.device) || await storage.get(`device:${envelope.device}`);
    if (!known) throw Error('An earlier Google backup needs checking; your saved readings are kept');
    const current = await backups.state(envelope.device);
    await backups.save(envelope.device, { requestId: envelope.requestId, payload: envelope.payload, sequence: envelope.sequence, operations: envelope.operations, bootstrap: envelope.bootstrap ?? true, revision: current.revision, baselineRevision: current.baselineRevision });
    next = advanceRecovery(next,file);
    // A crash before this write just replays the exact received identity.
    await storage.put('recoveryCursor',next);
  }
  if (pending.length > limit) await storage.put('recoveryProblem', { code: 'busy', message: 'Earlier Google backups are catching up; your saved readings are kept' });
  else await storage.delete('recoveryProblem');
  await storage.put('recoveryLastScan',pending.length > limit ? 0 : now());
}

