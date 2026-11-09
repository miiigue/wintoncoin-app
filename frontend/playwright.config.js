import { defineConfig } from 'playwright/test';

const baseURL = process.env.WINTON_QA_BASE_URL || 'https://demo.wintoncoin.com';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // Render Free puede tardar más de 50 s al salir del reposo.
  timeout: 60_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results',
});
