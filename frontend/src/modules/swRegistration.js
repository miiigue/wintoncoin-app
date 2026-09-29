// Bundled with a content hash: no dependency on a year-cached registerSW.js.
export function registerAppWorker(win = window, doc = document) {
  if (!('serviceWorker' in win.navigator)) return;
  const sw = win.navigator.serviceWorker;
  const isAdmin = () => /^\/(?:admin(?:[/.\-]|$)|governance-panel|momentum-admin)/.test(win.location.pathname);
  let dirty = false, reloaded = false, registration, checking = false, lastCheck = 0;
  doc.addEventListener('input', () => { dirty = true; }, true);
  doc.addEventListener('change', () => { dirty = true; }, true);
  const refreshAdmin = () => {
    if (!isAdmin() || reloaded) return;
    if (dirty) {
      if (doc.getElementById('admin-update-notice')) return;
      const notice = doc.createElement('div');
      notice.id = 'admin-update-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = 'Hay una nueva versión del panel. Guarda tus cambios y recarga la página para verla.';
      notice.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:10000;padding:16px;background:#172554;color:white;border:1px solid #38bdf8;border-radius:12px';
      doc.body.appendChild(notice);
      return;
    }
    reloaded = true;
    win.location.reload();
  };
  sw.addEventListener('controllerchange', refreshAdmin);
  win.addEventListener('pageshow', event => { if (event.persisted) refreshAdmin(); });
  const check = async () => {
    if (!registration || checking || doc.visibilityState === 'hidden' || Date.now() - lastCheck < 60000) return;
    checking = true; lastCheck = Date.now();
    try { await registration.update(); } catch { /* Retry when the app is visible again. */ }
    finally { checking = false; }
  };
  const start = async () => {
    try {
      registration = await sw.register('/sw-source.js', { scope: '/', updateViaCache: 'none' });
      await check();
    } catch { /* Network failures must not block the page. */ }
  };
  win.addEventListener('focus', check);
  doc.addEventListener('visibilitychange', check);
  if (doc.readyState === 'complete') void start();
  else win.addEventListener('load', start, { once: true });
}

if (typeof window !== 'undefined' && import.meta.env?.PROD) registerAppWorker();
