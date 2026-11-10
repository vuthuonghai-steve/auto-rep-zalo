import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, type Page, test as base, chromium } from '@playwright/test';

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  mockPage: Page;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

export const test = base.extend<ExtensionFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright test fixture requirement
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chrome',
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let background = context.serviceWorkers()[0];
    if (!background) {
      try {
        background = await context.waitForEvent('serviceworker', { timeout: 3000 });
      } catch {
        // Service worker có thể chưa kích hoạt ngay trong headless
      }
    }

    const extensionId = background ? background.url().split('/')[2] || '' : '';
    await use(extensionId);
  },

  mockPage: async ({ context }, use) => {
    const page = await context.newPage();
    const mockFilePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
    await page.goto(`file://${mockFilePath}`);
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
