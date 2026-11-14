import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, type Page, test as base, chromium } from '@playwright/test';
import { PLAYWRIGHT_ENV } from '../configs/playwright.env';
import { CdpDebugClient } from '../helpers/cdp-client';
import { ExtensionHelper } from '../helpers/extension-helper';

export interface ExtendedExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  mockPage: Page;
  sidepanelPage: Page;
  cdpClient: CdpDebugClient;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = PLAYWRIGHT_ENV.EXTENSION_PATH;

export const test = base.extend<ExtendedExtensionFixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright test fixture requirement
  cdpClient: async ({}, use) => {
    const client = new CdpDebugClient();
    await use(client);
  },

  // biome-ignore lint/correctness/noEmptyPattern: Playwright test fixture requirement
  context: async ({}, use) => {
    // 1. Chế độ LIVE_CDP: Kết nối trực tiếp vào phiên Google Chrome đang mở với Profile 1
    if (process.env.USE_LIVE_CDP === '1' || process.env.USE_LIVE_CDP === 'true') {
      const client = new CdpDebugClient();
      const { context } = await client.connect();
      await use(context);
      return;
    }

    // 2. Chế độ E2E độc lập: Khởi động Google Chrome với extension đã nạp
    // Hỗ trợ chỉ định profile directory nếu cờ USE_REAL_PROFILE được kích hoạt
    const userDataDir =
      process.env.USE_REAL_PROFILE === '1'
        ? PLAYWRIGHT_ENV.CHROME_USER_DATA_DIR
        : '';

    const args = [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
      '--disable-gpu',
    ];

    if (process.env.USE_REAL_PROFILE === '1') {
      args.push(`--profile-directory=${PLAYWRIGHT_ENV.CHROME_PROFILE_DIR}`);
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: PLAYWRIGHT_ENV.BROWSER_CHANNEL,
      headless: false,
      args,
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    const id = await ExtensionHelper.getExtensionId(context, 4000);
    await use(id);
  },

  mockPage: async ({ context }, use) => {
    const page = await context.newPage();
    const mockFilePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
    await page.goto(`file://${mockFilePath}`);
    await page.waitForLoadState('domcontentloaded');
    await use(page);
    await page.close();
  },

  sidepanelPage: async ({ context, extensionId }, use) => {
    if (!extensionId) {
      // Fallback mở file tĩnh nếu không lấy được extensionId
      const page = await context.newPage();
      const sidepanelHtmlPath = path.resolve(pathToExtension, 'sidepanel.html');
      await page.goto(`file://${sidepanelHtmlPath}`);
      await use(page);
      await page.close();
      return;
    }

    const page = await ExtensionHelper.openSidepanel(context, extensionId);
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
