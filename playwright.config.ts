import { defineConfig, devices } from '@playwright/test';
import { PLAYWRIGHT_ENV } from './tests/configs/playwright.env';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: PLAYWRIGHT_ENV.NAVIGATION_TIMEOUT_MS,
  expect: {
    timeout: PLAYWRIGHT_ENV.EXPECT_TIMEOUT_MS,
  },
  retries: 0,
  workers: 1, // Chạy tuần tự 1 worker để tránh xung đột tài nguyên Chrome Extension & port CDP
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    trace: 'on-first-retry',
    headless: false,
    ...devices['Desktop Chrome'],
    channel: PLAYWRIGHT_ENV.BROWSER_CHANNEL,
    actionTimeout: PLAYWRIGHT_ENV.ACTION_TIMEOUT_MS,
    navigationTimeout: PLAYWRIGHT_ENV.NAVIGATION_TIMEOUT_MS,
    launchOptions: {
      args: [
        '--headless=new',
        `--disable-extensions-except=${PLAYWRIGHT_ENV.EXTENSION_PATH}`,
        `--load-extension=${PLAYWRIGHT_ENV.EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-gpu',
      ],
    },
  },
  projects: [
    {
      name: 'chrome-e2e',
      testMatch: /.*(lifecycle|forward|discovery)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: PLAYWRIGHT_ENV.BROWSER_CHANNEL,
      },
    },
    {
      name: 'live-chrome-debug',
      testMatch: /.*live-chrome-debug\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: PLAYWRIGHT_ENV.BROWSER_CHANNEL,
      },
    },
  ],
});
