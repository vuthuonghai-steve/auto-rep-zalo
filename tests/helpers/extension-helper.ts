import type { BrowserContext, Page, Worker } from '@playwright/test';

export class ExtensionHelper {
  /**
   * Lấy extension ID từ background Service Worker trong context.
   */
  static async getExtensionId(context: BrowserContext, timeoutMs = 5000): Promise<string> {
    const existingSw = context.serviceWorkers()[0];
    if (existingSw) {
      return this.extractIdFromUrl(existingSw.url());
    }

    try {
      const sw = await context.waitForEvent('serviceworker', { timeout: timeoutMs });
      return this.extractIdFromUrl(sw.url());
    } catch {
      // Fallback: quét các pages nếu có page mở chrome-extension://
      for (const page of context.pages()) {
        const url = page.url();
        if (url.startsWith('chrome-extension://')) {
          return this.extractIdFromUrl(url);
        }
      }
      return '';
    }
  }

  /**
   * Trích xuất Extension ID từ URL dạng chrome-extension://<id>/...
   */
  static extractIdFromUrl(url: string): string {
    const match = url.match(/^chrome-extension:\/\/([a-z0-9]+)/i);
    return match ? match[1] || '' : '';
  }

  /**
   * Mở trang Side Panel của extension.
   */
  static async openSidepanel(context: BrowserContext, extensionId: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await page.waitForLoadState('domcontentloaded');
    return page;
  }

  /**
   * Mở trang Options của extension.
   */
  static async openOptions(context: BrowserContext, extensionId: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForLoadState('domcontentloaded');
    return page;
  }

  /**
   * Đọc dữ liệu từ chrome.storage.local của extension.
   */
  static async getStorageData<T = Record<string, unknown>>(page: Page): Promise<T> {
    return page.evaluate(async () => {
      return new Promise<T>((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get(null, (res) => resolve(res as T));
        } else {
          resolve({} as T);
        }
      });
    });
  }

  /**
   * Ghi dữ liệu vào chrome.storage.local của extension.
   */
  static async setStorageData(page: Page, data: Record<string, unknown>): Promise<void> {
    return page.evaluate(async (payload) => {
      return new Promise<void>((resolve, reject) => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set(payload, () => {
            if (chrome.runtime?.lastError) reject(chrome.runtime.lastError);
            else resolve();
          });
        } else {
          resolve();
        }
      });
    }, data);
  }
}

