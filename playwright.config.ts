import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test Configuration for Harmony ERP (VetOS)
 * Target live Vercel deployment by default, or localhost if specified.
 */
const baseURL = process.env.BASE_URL || 'https://harmony-erp-suite-g28j.vercel.app';
const isLocal = baseURL.includes('localhost') || baseURL.includes('127.0.0.1');

export default defineConfig({
  testDir: './e2e',
  /* Maximum time one test can run for (60s accommodates cloud serverless latencies) */
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Only spin up a local server if testing on localhost */
  ...(isLocal
    ? {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:8080',
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
      }
    : {}),
});
