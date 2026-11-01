// One reading document owns this browser's synchronous personal store.
// Returning OAuth tabs finish their handoff before asking for this lease.
export async function readerLease({ locks = globalThis.navigator?.locks, events = globalThis.window, reload = () => location.reload() } = {}) {
  let active = true, release = () => {};
  if (locks?.request) {
    const ready = new Promise(resolve => {
      const held = new Promise(done => { release = done; });
      locks.request('bradbury-cabin-reader', { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) { active = false; resolve(false); return; }
        resolve(true); await held;
      }).catch(() => { active = false; resolve(false); });
    });
    if (!await ready) return { active: false };
  }
  // No stale fetch callback may write after this document leaves, including
  // browsers that keep a frozen document for Back/Forward restoration.
  events?.addEventListener('pagehide', () => { active = false; release(); });
  events?.addEventListener('pageshow', event => { if (event.persisted || !active) reload(); });
  return {
    get active() { return active; },
    wrap(storage) {
      return {
        getItem: key => storage.getItem(key),
        setItem(key, value) { if (!active) throw Error('Return to the open cabin tab. Your readings are kept'); storage.setItem(key, value); },
        removeItem(key) { if (!active) throw Error('Return to the open cabin tab. Your readings are kept'); storage.removeItem(key); },
      };
    },
  };
}
