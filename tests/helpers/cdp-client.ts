import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PLAYWRIGHT_ENV } from '../configs/playwright.env';

export interface CdpVersionInfo {
  Browser: string;
  'Protocol-Version': string;
  'User-Agent': string;
  'V8-Version': string;
  'WebKit-Version': string;
  webSocketDebuggerUrl: string;
}

export interface CdpTargetInfo {
  id: string;
  title: string;
  type: string;
  url: string;
  devtoolsFrontendUrl?: string;
  webSocketDebuggerUrl?: string;
}

export class CdpDebugClient {
  private cdpUrl: string;

  constructor(cdpUrl = PLAYWRIGHT_ENV.DEFAULT_CDP_URL) {
    this.cdpUrl = cdpUrl;
  }

  /**
   * Kiểm tra xem cổng CDP có đang hoạt động và trả về thông tin trình duyệt.
   */
  async checkHealth(): Promise<{ isOnline: boolean; version?: CdpVersionInfo; error?: string }> {
    try {
      const res = await fetch(`${this.cdpUrl}/json/version`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        return { isOnline: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }
      const data = (await res.json()) as CdpVersionInfo;
      return { isOnline: true, version: data };
    } catch (err) {
      return { isOnline: false, error: (err as Error).message };
    }
  }

  /**
   * Lấy danh sách targets hiện tại qua CDP REST endpoint.
   */
  async getTargets(): Promise<CdpTargetInfo[]> {
    try {
      const res = await fetch(`${this.cdpUrl}/json/list`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      return (await res.json()) as CdpTargetInfo[];
    } catch {
      return [];
    }
  }

  /**
   * Kết nối phiên Playwright qua CDP vào trình duyệt Chrome đang mở.
   */
  async connect(): Promise<{ browser: Browser; context: BrowserContext }> {
    const health = await this.checkHealth();
    if (!health.isOnline) {
      throw new Error(
        `Không thể kết nối đến Chrome CDP tại ${this.cdpUrl}. Vui lòng đảm bảo Google Chrome đã được khởi động với cờ --remote-debugging-port=${PLAYWRIGHT_ENV.DEFAULT_CDP_PORT}. Lỗi: ${health.error}`,
      );
    }

    const browser = await chromium.connectOverCDP(this.cdpUrl);
    const contexts = browser.contexts();
    const context = contexts[0] || (await browser.newContext());
    return { browser, context };
  }

  /**
   * Tìm tab Zalo Web đang mở trong phiên CDP.
   */
  async findZaloPage(context: BrowserContext): Promise<Page | undefined> {
    const pages = context.pages();
    return pages.find((p) => p.url().includes('chat.zalo.me'));
  }

  /**
   * Tìm tab Sidepanel của extension đang mở trong phiên CDP.
   */
  async findSidepanelPage(context: BrowserContext, extensionId?: string): Promise<Page | undefined> {
    const pages = context.pages();
    return pages.find((p) => {
      const url = p.url();
      if (!url.includes('sidepanel.html')) return false;
      if (extensionId) return url.includes(extensionId);
      return true;
    });
  }
}

