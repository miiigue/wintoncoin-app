import { test, expect } from 'playwright/test';

const username = process.env.WINTON_QA_USERNAME;
const password = process.env.WINTON_QA_PASSWORD;
const hasCredentials = Boolean(username && password);

async function dismissNotificationGate(page) {
  const overlay = page.locator('.notification-gate-overlay');
  if (!await overlay.isVisible().catch(() => false)) return;

  const initialAction = page.locator('#gate-action-btn');
  if (await initialAction.isVisible().catch(() => false)) {
    await initialAction.click();
  }

  for (let step = 0; step < 5 && await overlay.isVisible().catch(() => false); step += 1) {
    const next = page.locator('#wizard-next');
    if (!await next.isVisible().catch(() => false)) break;
    await next.click();
  }

  await expect(overlay).toBeHidden({ timeout: 5_000 });
}

async function login(page) {
  await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
  const policyClose = page.locator('.policy-close-button').last();
  if (await policyClose.isVisible().catch(() => false)) await policyClose.click();
  await page.locator('#identifier').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL(/\/(?:contract_interaction\.html|dashboard)(?:\?|$)/, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });

  const emergencyModal = page.locator('#venezuelaEmergencyModal:visible');
  const campaignVisible = await emergencyModal
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (campaignVisible) {
    await emergencyModal.getByRole('button', { name: 'Quizás más tarde', exact: true }).click();
    await expect(emergencyModal).toBeHidden();
  }

  await dismissNotificationGate(page);
}

test.describe('Bloque A autenticado y no económico', () => {
  test.use({ permissions: ['notifications'] });
  test.skip(!hasCredentials, 'Define WINTON_QA_USERNAME y WINTON_QA_PASSWORD fuera del repositorio.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('el buscador actualiza y limpia el texto sin realizar operaciones económicas', async ({ page }) => {
    const search = page.locator('#publicationSearchInput');
    await expect(search).toBeVisible();
    await search.fill('qa-sin-coincidencias-987654');
    await expect(search).toHaveValue('qa-sin-coincidencias-987654');

    const clear = page.locator('#publicationSearchClear');
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(search).toHaveValue('');
  });

  test('Prelanzamiento se evalúa antes que KYC al intentar publicar', async ({ page }) => {
    const emptyFeedAction = page.getByRole('button', { name: /Crear la Primera Publicación/i });
    const entry = await emptyFeedAction.isVisible().catch(() => false)
      ? emptyFeedAction
      : page.locator('#openPublicationModalBtn');
    await entry.click();

    const kycDialog = page.getByRole('dialog', { name: 'Verificación para publicar' });
    const kycIntercepted = await kycDialog
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    expect(
      kycIntercepted,
      'KYC no debe adelantarse al bloqueo universal de Prelanzamiento.'
    ).toBe(false);

    const modal = page.locator('.prelaunch-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Prelanzamiento activo' })).toBeVisible();
    await expect(modal).toContainText('hasta que el lanzamiento sea aprobado');
    await expect(modal).not.toContainText(/muy pronto|espacio seguro/i);
  });
});
