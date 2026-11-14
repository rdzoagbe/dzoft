import { defineConfig } from '@playwright/test';

const localBase = 'http://127.0.0.1:4173/';
const externalBase = process.env.DZOFT_E2E_BASE_URL;
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: externalBase || localBase,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 8_000,
    navigationTimeout: 15_000
  },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1365, height: 900 }, locale: 'en-GB' } },
    { name: 'chromium-mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.5, locale: 'en-GB' } }
  ],
  webServer: externalBase ? undefined : {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: localBase,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  },
  outputDir: 'test-results',
  fullyParallel: true
});
