// Installing a complete offline copy must never interrupt an open reading.
// A finished new edition waits; the browser page offers "New readings ready ·
// Restart", and only the reader's tap switches to it. Sync also checks for one.
if ('serviceWorker' in navigator && globalThis.isSecureContext) {
  const button = document.getElementById('update-ready');
  let registration = null;
  const show = () => { if (button && registration?.waiting && navigator.serviceWorker.controller) button.hidden = false; };
  addEventListener('load', async () => {
    registration = await navigator.serviceWorker.register(new URL('./service-worker.js', import.meta.url), { updateViaCache: 'none' }).catch(() => null);
    if (!registration) return;
    show();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed') show(); });
    });
  }, { once: true });
  document.getElementById('drive-sync')?.addEventListener('click', () => { registration?.update().then(show, () => {}); });
  button?.addEventListener('click', () => {
    const waiting = registration?.waiting;
    if (!waiting) return;
    button.disabled = true; button.textContent = 'Restarting…';
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    waiting.postMessage('restart-into-new-edition');
  });
}
