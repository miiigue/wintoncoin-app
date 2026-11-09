import { test, expect } from 'playwright/test';

const usernames = String(process.env.WINTON_QA_USERNAMES || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const password = process.env.WINTON_QA_PASSWORD;
const hasFourAccounts = usernames.length === 4 && Boolean(password);

async function dismissOverlays(page) {
  const campaign = page.locator('#venezuelaEmergencyModal:visible');
  if (await campaign.isVisible().catch(() => false)) {
    await campaign.getByRole('button', { name: 'Quizás más tarde', exact: true }).click();
  }

  const gate = page.locator('.notification-gate-overlay');
  if (!await gate.isVisible().catch(() => false)) return;
  await page.locator('#gate-action-btn:visible').click({ timeout: 3_000 }).catch(() => {});
  for (let step = 0; step < 5 && await gate.isVisible().catch(() => false); step += 1) {
    const next = page.locator('#wizard-next:visible');
    if (!await next.isVisible().catch(() => false)) break;
    if (!await next.click({ timeout: 3_000 }).then(() => true).catch(() => false)) break;
  }
  await expect(gate).toBeHidden({ timeout: 8_000 });
}

async function login(page, username) {
  await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
  const policyClose = page.locator('.policy-close-button').last();
  if (await policyClose.isVisible().catch(() => false)) await policyClose.click();
  await page.locator('#identifier').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL(/\/contract_interaction\.html(?:\?|$)/, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await dismissOverlays(page);
  await expect(page.locator('#usernameDisplay')).toHaveText(username);
}

test.describe('Bloque A multiusuario no económico', () => {
  test.skip(!hasFourAccounts, 'Define cuatro WINTON_QA_USERNAMES y WINTON_QA_PASSWORD fuera del repositorio.');
  test.setTimeout(300_000);

  test('cuatro cuentas mantienen sesiones y tokens aislados después de recargar', async ({ browser }) => {
    const sessions = [];
    try {
      for (const username of usernames) {
        const context = await browser.newContext({ permissions: ['notifications'], serviceWorkers: 'block' });
        const page = await context.newPage();
        await login(page, username);
        sessions.push({ context, page, username });
      }

      const tokens = [];
      for (const { page, username } of sessions) {
        tokens.push(await page.evaluate(() => localStorage.getItem('token')));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await dismissOverlays(page);
        await expect(page.locator('#usernameDisplay')).toHaveText(username);
      }

      expect(tokens.every(Boolean)).toBe(true);
      expect(new Set(tokens).size).toBe(usernames.length);
    } finally {
      await Promise.all(sessions.map(({ context }) => context.close()));
    }
  });

  test('una cuenta normal no obtiene acceso al panel administrativo', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['notifications'], serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      await login(page, usernames[1]);
      await page.goto('/admin/web3', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Acceso administrativo' })).toBeVisible();
      await expect(page.getByText('Inicia sesión con una cuenta administrativa autorizada.')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('cerrar sesión y volver atrás no restaura una sesión utilizable', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['notifications'], serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      await login(page, usernames[3]);
      await page.locator('.profile-trigger').click();
      await page.locator('#logoutLink').click();
      await page.waitForURL(/\/login\.html(?:\?|$)/, { waitUntil: 'domcontentloaded' });
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toBeNull();
      await expect(page).not.toHaveURL(/\/contract_interaction\.html(?:\?|$)/);
      await expect(page.locator('#usernameDisplay')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('el panel básico permanece utilizable en ancho móvil', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['notifications'],
      serviceWorkers: 'block',
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      await login(page, usernames[0]);
      await expect(page.locator('#usernameDisplay')).toBeVisible();
      await expect(page.getByText('PRE-LANZAMIENTO', { exact: false }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.locator('.profile-trigger').click();
      await expect(page.locator('#profileDropdown')).toHaveClass(/show/);
    } finally {
      await context.close();
    }
  });
});
