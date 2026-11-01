// First-connection compatibility merge. Later saves use sequenced local edits.
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (!plain(a) || !plain(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]));
};
const copy = value => value === undefined ? undefined : structuredClone(value);
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);

// An absent field is never an instruction to discard history. Explicit
// false/null values are changes; feedback deletions have their own timestamped
// tombstone merge below. Compare to THIS device's last received payload, not
// the server's last merged snapshot or another headset's reading place.
export function changedFields(local, remote, baseline) {
  if (local === undefined || equal(local, baseline)) return copy(remote);
  if (plain(local)) {
    const result = {};
    for (const key of new Set([...Object.keys(plain(remote) ? remote : {}), ...Object.keys(local)])) {
      if (forbidden.has(key)) continue;
      const value = changedFields(local[key], plain(remote) ? remote[key] : undefined, plain(baseline) ? baseline[key] : undefined);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  return copy(local);
}

// The existing catalogue, reward, feedback and draft rules remain authoritative.
// The caller supplies the SAME shared mergeProgress on client and server.
export function mergeManagedState(local, remote, baseline, mergeProgress) {
  if (!remote) return copy(local);
  const { headset: localHeadset, ...localProgress } = local;
  const { headset: remoteHeadset, ...remoteProgress } = remote;
  const { headset: baseHeadset, ...baseProgress } = baseline || {};
  const protectedKeys = new Set(['start', 'trackingSince', 'savedAt', 'feedback', 'unapprovedThoughtDrafts', 'rewards', 'completedWorks']);
  const merged = mergeProgress(localProgress, remoteProgress);
  if (!baseline) {
    // On a first connection there is no evidence that an overlapping headset
    // value is a new edit. Keep the server's existing restoration copy, while
    // retaining local-only places and the established progress merge rules.
    const headset = changedFields(remoteHeadset, localHeadset, undefined);
    return headset === undefined ? merged : { ...merged, headset };
  }
  const fields = changedFields(localProgress, remoteProgress, baseProgress);
  for (const [key, value] of Object.entries(fields || {})) if (!protectedKeys.has(key)) merged[key] = value;
  // Recheck edition-specific notes after independent per-day changes.
  const checked = mergeProgress(merged, merged);
  const headset = changedFields(localHeadset, remoteHeadset, baseHeadset);
  return headset === undefined ? checked : { ...checked, headset };
}
