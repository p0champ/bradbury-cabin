// Complete private snapshots, checked before acknowledgement or replacement.
// Uses the transactional storage API of a SQLite-backed Durable Object.
const MAX_BYTES = 8_000_000, CHUNK_BYTES = 500_000;
const encoder = new TextEncoder();
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
const rootKeys = root => Array.from({ length: root.parts }, (_, i) => `${root.id}/${i}`);
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const checkedRoot = root => {
  if (!plain(root) || root.schema !== 1 || typeof root.id !== 'string' || !/^(backup|client):[A-Za-z0-9:-]+$/.test(root.id) || !Number.isSafeInteger(root.revision) || root.revision < 1 || !Number.isInteger(root.parts) || root.parts < 1 || root.parts > 16 || !Number.isInteger(root.bytes) || root.bytes < 1 || root.bytes > MAX_BYTES || !/^[a-f0-9]{64}$/.test(root.digest)) throw Error('Private backup needs recovery');
  return root;
};
const prepare = async (id, revision, text, stamp) => {
  const bytes = encoder.encode(text);
  if (!bytes.length || bytes.length > MAX_BYTES) throw Error('Complete backup is too large; nothing was cut');
  const root = { schema: 1, id, revision, parts: Math.ceil(bytes.length / CHUNK_BYTES), bytes: bytes.length, digest: await hash(bytes), stamp };
  return { root, chunks: rootKeys(root).map((key, i) => [key, bytes.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES)]) };
};
export class SnapshotStore {
  constructor(storage, validate, { queueMirror = false } = {}) { this.storage = storage; this.validate = validate; this.queueMirror = queueMirror; }
  async scheduleMirror(txn, revision) {
    if (!this.queueMirror) return;
    const verified = await txn.get('mirrorVerified');
    if (verified?.revision === revision) return;
    await txn.put('mirrorPending', { revision });
    if (!await txn.getAlarm()) await txn.setAlarm(Date.now() + 1000);
  }
  async resumeMirror(root) {
    if (!this.queueMirror || !root) return;
    // Cloudflare can exhaust alarm retries during a prolonged outage. A
    // later checked read must resume the durable pending copy, even when
    // the reader has made no new edit. Keep any existing retry's backoff.
    await this.storage.transaction(async txn => {
      const current = await txn.get('current');
      if (current?.id !== root.id || (await txn.get('mirrorVerified'))?.revision === root.revision || await txn.getAlarm()) return;
      await this.scheduleMirror(txn, root.revision);
    });
  }
  async readSnapshot(root) {
    checkedRoot(root);
    const chunks = await this.storage.get(rootKeys(root)), bytes = new Uint8Array(root.bytes);
    let offset = 0;
    for (const key of rootKeys(root)) {
      const part = chunks.get(key);
      if (!(part instanceof Uint8Array) || offset + part.length > bytes.length) throw Error('Private backup needs recovery');
      bytes.set(part, offset); offset += part.length;
    }
    if (offset !== root.bytes || await hash(bytes) !== root.digest) throw Error('Private backup needs recovery');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes), value = JSON.parse(text);
    if (!this.validate(value)) throw Error('Private backup needs recovery');
    return { text, value, root };
  }
  async read() {
    const root = await this.storage.get('current');
    if (root != null) return this.readSnapshot(root);
    const [history, daily, initialized] = await Promise.all(['history', 'daily', 'initialized'].map(key => this.storage.get(key)));
    if (history != null || daily != null || initialized != null) throw Error('Private backup needs recovery');
    return null;
  }
  async deviceBaseline(device) {
    const record = await this.storage.get(`device:${device}`);
    return record?.baseline ? this.readSnapshot(record.baseline) : null;
  }
  async deviceState(device) {
    const record = await this.storage.get(`device:${device}`);
    if (record == null) return { sequence: 0, baseline: null };
    if (!Number.isSafeInteger(record.sequence ?? 0) || (record.sequence ?? 0) < 0 || !Array.isArray(record.receipts)) throw Error('Private device record needs recovery');
    return { sequence: record.sequence ?? 0, baseline: record.baseline ? await this.readSnapshot(record.baseline) : null };
  }
  async history() {
    const [current, previous = [], daily = {}] = await Promise.all(['current', 'history', 'daily'].map(key => this.storage.get(key)));
    if (current != null) checkedRoot(current);
    if (!Array.isArray(previous) || !plain(daily)) throw Error('Private backup history needs recovery');
    return { current, previous: previous.map(checkedRoot), daily: Object.fromEntries(Object.entries(daily).map(([day, root]) => [day, checkedRoot(root)])) };
  }
  async commit({ revision, baselineRevision, device, requestId, payload, state, stamp, day, sequence = 0, operations = [], bootstrap = true }) {
    if (!/^[a-f0-9]{64}$/.test(device) || !/^[A-Za-z0-9-]{8,100}$/.test(requestId) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(stamp))) throw Error('Invalid backup request');
    if (!this.validate(JSON.parse(payload)) || !this.validate(JSON.parse(state))) throw Error('Invalid complete backup');
    if (!Number.isSafeInteger(sequence) || sequence < 0 || !Array.isArray(operations) || operations.length > 20000 || operations.some(op => !Number.isSafeInteger(op?.sequence) || op.sequence < 1 || op.sequence > sequence)) throw Error('Invalid backup changes');
    // A damaged current copy is a recovery event. Validate its complete bytes
    // before even a duplicate acknowledgement or a replacement is possible.
    await this.read();
    const nextRevision = revision + 1;
    const [backup, baseline] = await Promise.all([prepare(`backup:${nextRevision}`, nextRevision, state, stamp), prepare(`client:${device}:${nextRevision}`, nextRevision, payload, stamp)]);
    const requestDigest = await hash(encoder.encode(JSON.stringify({ payload: baseline.root.digest, sequence, operations, ...(bootstrap === false ? { bootstrap: false } : {}) })));
    return this.storage.transaction(async txn => {
      const current = await txn.get('current');
      if (current != null) checkedRoot(current);
      const record = await txn.get(`device:${device}`) || { receipts: [] };
      if (!Array.isArray(record.receipts)) throw Error('Private device record needs recovery');
      const savedHistory = await txn.get('history'), savedDaily = await txn.get('daily');
      if (current == null && (savedHistory != null || savedDaily != null || record.baseline)) throw Error('Private backup needs recovery');
      const duplicate = record.receipts.find(r => r.id === requestId);
      if (duplicate) {
        if (duplicate.digest !== requestDigest) throw Error('Request identity was reused for different changes');
        await this.scheduleMirror(txn, current.revision);
        return { duplicate: true, receipt: duplicate, root: current };
      }
      if ((current?.revision || 0) !== revision) return { conflict: true, root: current };
      if ((record.baseline?.revision || 0) !== baselineRevision) return { staleDevice: true, root: current };
      const previous = savedHistory || [], daily = savedDaily || {};
      if (!Array.isArray(previous) || !plain(daily)) throw Error('Private backup history needs recovery');
      if (current == null && (previous.length || Object.keys(daily).length || record.baseline)) throw Error('Private backup needs recovery');
      previous.forEach(checkedRoot); Object.values(daily).forEach(checkedRoot);
      const oldRoots = [...previous, ...Object.values(daily), ...(current ? [current] : []), ...(record.baseline ? [checkedRoot(record.baseline)] : [])];
      const history = [...previous, ...(current ? [current] : [])].slice(-20);
      daily[day] = backup.root;
      for (const key of Object.keys(daily).sort().slice(0, -7)) delete daily[key];
      if (!Number.isSafeInteger(record.sequence ?? 0) || (record.sequence ?? 0) < 0) throw Error('Private device record needs recovery');
      const receipt = { id: requestId, digest: requestDigest, revision: nextRevision, stamp, sequence };
      for (const item of [backup, baseline]) await txn.put(Object.fromEntries(item.chunks));
      await txn.put({ initialized: true, current: backup.root, history, daily, [`device:${device}`]: { baseline: baseline.root, sequence: Math.max(record.sequence ?? 0, sequence), receipts: [...record.receipts, receipt].slice(-32) } });
      await this.scheduleMirror(txn, nextRevision);
      const retained = new Set([backup.root, baseline.root, ...history, ...Object.values(daily)].map(root => root.id));
      const discarded = [...new Map(oldRoots.filter(root => !retained.has(root.id)).map(root => [root.id, root])).values()];
      const keys = discarded.flatMap(rootKeys);
      for (let i = 0; i < keys.length; i += 128) await txn.delete(keys.slice(i, i + 128));
      return { receipt, root: backup.root };
    });
  }
}
