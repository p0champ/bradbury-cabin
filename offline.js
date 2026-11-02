// Installing a complete offline copy must never interrupt an open reading.
if ('serviceWorker' in navigator && globalThis.isSecureContext) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./service-worker.js', import.meta.url), { updateViaCache: 'none' }).catch(() => {});
  }, { once: true });
}
