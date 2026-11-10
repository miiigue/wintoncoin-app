import { test, expect } from 'playwright/test';

const apiBaseURL = process.env.WINTON_QA_API_URL || 'https://wintoncoin-backend-demo.onrender.com';
const expectedChainId = process.env.WINTON_QA_CHAIN_ID || '11155420';
const expectedEpoch = process.env.WINTON_QA_DEPLOYMENT_EPOCH || 'V5_CODEX_163';
const expectedFingerprint = process.env.WINTON_QA_DEPLOYMENT_FINGERPRINT
  || '0xa4fbb3c5518e2f8d0a4c2257fcc3f802697ee5c3a3ad2de75f15f1ece98fddb1';

test.describe('Bloque A público y no económico', () => {
  test('la portada identifica inequívocamente el entorno Demo', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/\[DEMO\]/i);
    await expect(page.getByText('DEMO MODE', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /iniciar sesión/i }).first()).toBeVisible();
  });

  test('los documentos legales públicos responden sin errores', async ({ request }) => {
    for (const path of ['/terms.html', '/privacy.html']) {
      const response = await request.get(path);
      expect(response.ok(), `${path} debe responder correctamente`).toBeTruthy();
      expect(await response.text()).toContain('DEMO MODE');
    }
  });

  test('el login vacío se detiene en el navegador y no llama al backend', async ({ page }) => {
    let loginRequests = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && /\/login(?:\?|$)/.test(request.url())) loginRequests += 1;
    });

    await page.goto('/login.html', { waitUntil: 'domcontentloaded' });
    const policyClose = page.locator('.policy-close-button').last();
    if (await policyClose.isVisible().catch(() => false)) await policyClose.click();

    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();

    await expect(page.locator('#identifier')).toBeFocused();
    expect(await page.locator('#identifier').evaluate(element => element.checkValidity())).toBe(false);
    expect(loginRequests).toBe(0);
  });

  test('una ruta privada sin sesión no expone contenido privado', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/dashboard(?:\?|$)/);
    await expect(page).toHaveURL(/\/(?:login(?:\.html)?|index\.html)?(?:\?|$)/);
    const safeEntry = page.locator('#loginForm').or(
      page.getByRole('link', { name: /iniciar sesión/i }).first()
    );
    await expect(safeEntry.first()).toBeVisible();
  });

  test('Prelanzamiento mantiene las operaciones económicas del backend bloqueadas', async ({ request }) => {
    const settingsResponse = await request.get(`${apiBaseURL}/api/platform-settings`);
    expect(settingsResponse.ok()).toBeTruthy();
    const settings = await settingsResponse.json();
    expect(settings.pre_launch_mode_enabled).toBe(true);

    const deploymentResponse = await request.get(`${apiBaseURL}/api/web3/deployment`);
    expect(deploymentResponse.ok()).toBeTruthy();
    const deployment = await deploymentResponse.json();
    expect(deployment).toMatchObject({
      success: true,
      chainId: expectedChainId,
      epoch: expectedEpoch,
      fingerprint: expectedFingerprint,
    });
    expect(deployment.operations).toMatchObject({
      enabled: false,
      mode: 'prelaunch_read_only',
      epoch: expectedEpoch,
      fingerprint: expectedFingerprint,
      reason: 'PRELAUNCH_ACTIVE',
      preLaunchVerified: true,
      preLaunchActive: true,
    });
  });

  test('la suite Demo esperada mantiene pausados sus cuatro contratos económicos', async ({ request }) => {
    const [deploymentResponse, statusResponse] = await Promise.all([
      request.get(`${apiBaseURL}/api/web3/deployment`),
      request.get(`${apiBaseURL}/api/web3/status`),
    ]);
    expect(deploymentResponse.ok()).toBeTruthy();
    expect(statusResponse.ok()).toBeTruthy();

    const deployment = await deploymentResponse.json();
    const status = await statusResponse.json();
    expect(status).toMatchObject({
      success: true,
      chainId: expectedChainId,
      parameters: {
        contractPauses: {
          CoreProtocol: true,
          CollateralVault: true,
          FifoExchange: true,
          ProtocolTreasury: true,
        },
        allEconomicContractsPaused: true,
      },
    });

    for (const key of ['CoreProtocol', 'CollateralVault', 'FifoExchange', 'ProtocolTreasury']) {
      expect(status.contracts[key]).toBe(deployment.contracts[key]);
    }
  });
});
