// Remove the one-use sign-in code before the reader's module graph loads.
(() => {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (!fragment.has('cabin-pair') && !fragment.has('cabin-connection')) return;
  const code = fragment.get('cabin-pair'), cancelled = fragment.get('cabin-connection') === 'cancelled';
  history.replaceState(history.state, '', location.pathname + location.search);
  globalThis.__cabinConnectionReturn = true;
  try { sessionStorage.setItem('cabin-connection-pair', JSON.stringify({ code, cancelled, until: Date.now() + 120000 })); } catch {}
})();
