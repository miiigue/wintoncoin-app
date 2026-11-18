'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const frontendRoot = path.resolve(__dirname, '..');
  const distDemo = path.join(frontendRoot, 'dist-demo');
  assert(fs.existsSync(path.join(distDemo, 'sw-source.js')), 'Falta dist-demo/sw-source.js. Ejecuta npm run build:demo primero.');

  // 1. Pruebas unitarias de seguridad sobre referralContext.js
  const referralMod = await import(pathToFileURL(path.join(frontendRoot, 'src/modules/referralContext.js')).href);
  assert.equal(referralMod.sanitizeReferralCode('  juan-a1b2  '), 'JUAN-A1B2');
  assert.equal(referralMod.sanitizeReferralCode('<script>alert(1)</script>'), '');
  assert.equal(referralMod.sanitizeReferralCode('javascript:alert(1)'), '');
  assert.equal(referralMod.sanitizeReferralCode('https://evil.com/phish'), '');
  assert.equal(referralMod.sanitizeReferralCode("admin' OR 1=1--"), '');
  assert.equal(referralMod.extractReferralFromSearch('?ref=sosvenezuela'), 'SOSVENEZUELA');
  assert.equal(referralMod.extractReferralFromSearch('?referral=MARIA_88'), 'MARIA_88');
  assert.equal(referralMod.buildSafeRegisterUrl('sos-2026'), '/register?ref=SOS-2026');
  assert.equal(referralMod.buildSafeRegisterUrl('https://evil.com'), '/register');

  // 2. Verificación estática de reglas críticas en sw-source.js y .htaccess
  const swSource = fs.readFileSync(path.join(frontendRoot, 'src/sw-source.js'), 'utf8');
  assert(!swSource.includes("createHandlerBoundToURL('/index.html')"), 'sw-source.js no debe enrutar SPA hacia /index.html');
  assert(swSource.includes("createHandlerBoundToURL('/dashboard.html')"), 'sw-source.js debe enrutar SPA hacia /dashboard.html');

  const htaccess = fs.readFileSync(path.join(frontendRoot, 'public/.htaccess'), 'utf8');
  assert(/RewriteRule \^\([^)]*register[^)]*\)\/\?\$ dashboard\.html \[L,QSA\]/.test(htaccess), '.htaccess debe reescribir /register a dashboard.html con QSA');

  // 3. Prueba E2E real con Chromium + Service Worker activo sobre dist-demo
  const spaCleanRoutes = new Set([
    '/dashboard',
    '/wallet',
    '/exchange',
    '/register',
    '/login',
    '/forgot-password',
    '/recovery',
    '/flows',
    '/architecture',
    '/admin/flows',
    '/admin/web3',
    '/admin-web3'
  ]);

  const mimeMap = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
  };

  const baseUrl = 'https://demo.wintoncoin.com';
  const browser = await chromium.launch({ headless: true });
  let context;

  try {
    context = await browser.newContext({ serviceWorkers: 'allow' });
    await context.route('https://demo.wintoncoin.com/**', (route) => {
      const urlObj = new URL(route.request().url());
      const rawPathname = decodeURIComponent(urlObj.pathname);
      let targetPath = rawPathname === '/' ? '/index.html' : rawPathname;
      const normalized = targetPath.length > 1 && targetPath.endsWith('/') ? targetPath.slice(0, -1) : targetPath;
      if (spaCleanRoutes.has(normalized)) {
        targetPath = '/dashboard.html';
      }

      const filePath = path.resolve(distDemo, '.' + targetPath);
      if (!filePath.startsWith(distDemo + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return route.fulfill({ status: 404, body: 'Not found' });
      }
      const ext = path.extname(filePath).toLowerCase();
      return route.fulfill({
        status: 200,
        contentType: mimeMap[ext] || 'application/octet-stream',
        body: fs.readFileSync(filePath)
      });
    });

    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('[Browser pageerror]', err.message));

    // Silenciar llamadas externas de API para que no dependan de red remota en test local
    await page.route('https://wintoncoin-backend-demo.onrender.com/**', (route) => {
      const url = route.request().url();
      if (url.includes('/api/referral-settings')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ referral_reward_amount: 1000 }) });
      }
      if (url.includes('/api/public-settings')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      }
      if (url.includes('/api/legal/documents/active')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeDocuments: [] }) });
      }
      if (url.includes('/api/auth/status')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isAuthenticated: false }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    // Flujo 1: Landing -> Más información (sos-venezuela.html) -> Registrarme (con Service Worker activo)
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg && reg.active && reg.active.state === 'activated');
    }, { timeout: 15000 });

    await page.click('a[href="sos-venezuela.html"]');
    await page.waitForURL('**/sos-venezuela.html');
    await page.click('#sos-register-ref-link');
    await page.waitForSelector('h1:has-text("Crear Cuenta")', { timeout: 15000 });
    const sosBannerText = await page.textContent('[role="status"]');
    assert(sosBannerText && sosBannerText.includes('SOSVENEZUELA'), 'Debe mostrar el código SOSVENEZUELA aplicado al llegar desde sos-venezuela.html');

    // Flujo 2: Enlace directo /register?ref=JUAN-123 con Service Worker activo
    await page.goto(`${baseUrl}/register?ref=JUAN-123`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1:has-text("Crear Cuenta")', { timeout: 15000 });
    const juanBannerText = await page.textContent('[role="status"]');
    assert(juanBannerText && juanBannerText.includes('JUAN-123'), 'Debe abrir Registro con JUAN-123 precargado desde /register?ref=JUAN-123');

    // Flujo 3: Enlace a la landing con /?ref=PEDRO_77 -> debe redirigir al formulario de registro automáticamente
    await page.goto(`${baseUrl}/?ref=PEDRO_77`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/register?ref=PEDRO_77', { timeout: 15000 });
    await page.waitForSelector('h1:has-text("Crear Cuenta")', { timeout: 15000 });
    const pedroBannerText = await page.textContent('[role="status"]');
    assert(pedroBannerText && pedroBannerText.includes('PEDRO_77'), 'Debe redirigir de Landing a Registro con PEDRO_77 aplicado');

    // Flujo 4: Al abrir /register sin ?ref= en navegador normal (sin PWA instalada), debe restaurar PEDRO_77
    await page.goto(`${baseUrl}/register`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1:has-text("Crear Cuenta")', { timeout: 15000 });
    const restoredBannerText = await page.textContent('[role="status"]');
    assert(restoredBannerText && restoredBannerText.includes('PEDRO_77'), 'Debe restaurar PEDRO_77 desde localStorage en cualquier navegador');

    // Flujo 5: Payload XSS en ?ref= -> no debe almacenarse ni redirigir
    await page.evaluate(() => localStorage.removeItem('pending_referral_code'));
    await page.goto(`${baseUrl}/?ref=%3Cscript%3Ealert(1)%3C/script%3E`, { waitUntil: 'networkidle' });
    const storedAfterXss = await page.evaluate(() => localStorage.getItem('pending_referral_code'));
    assert.equal(storedAfterXss, null, 'Payload XSS en ?ref= nunca debe guardarse en localStorage');
    assert.equal(new URL(page.url()).pathname, '/', 'Payload XSS en ?ref= no debe redirigir');

    console.log('PASS check-referral-routing-security: sanitización XSS/OpenRedirect, Service Worker SPA y los 5 flujos E2E verificados.');
  } finally {
    if (context) await context.close();
    await browser.close();
  }
})().catch((err) => {
  console.error('FAIL check-referral-routing-security:', err);
  process.exitCode = 1;
});
