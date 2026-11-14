import { expect, test } from './fixtures';
import { CdpDebugClient } from '../helpers/cdp-client';
import { PLAYWRIGHT_ENV } from '../configs/playwright.env';

test.describe('E2E: Live Chrome CDP Debugging Suite (Profile 1)', () => {
  const cdpClient = new CdpDebugClient();

  test('should connect to running Chrome and inspect tabs, profile and targets', async () => {
    console.log(`[Live CDP] Mục tiêu Profile: ${PLAYWRIGHT_ENV.CHROME_PROFILE_PATH}`);
    const health = await cdpClient.checkHealth();
    if (!health.isOnline) {
      console.warn(`[Live CDP] Trình duyệt chưa bật CDP tại ${cdpClient['cdpUrl']}. Bỏ qua test live.`);
      test.skip();
      return;
    }

    console.log('[Live CDP] Đã kết nối Chrome thành công. Version:', health.version?.Browser);
    expect(health.version?.Browser).toBeDefined();

    const targets = await cdpClient.getTargets();
    console.log(`[Live CDP] Tìm thấy ${targets.length} targets.`);
    expect(targets.length).toBeGreaterThan(0);

    const { context } = await cdpClient.connect();
    const zaloPage = await cdpClient.findZaloPage(context);

    if (zaloPage) {
      console.log('[Live CDP] Phát hiện tab Zalo:', zaloPage.url());
      const pageTitle = await zaloPage.title();
      console.log('[Live CDP] Tiêu đề tab Zalo:', pageTitle);

      const hasConvList = await zaloPage.evaluate(() => {
        return !!(
          document.querySelector('#conversationListId') ||
          document.querySelector('#conversationList') ||
          document.querySelector('[data-id="div_TabMsg_ThrdChList"]')
        );
      });
      console.log('[Live CDP] Zalo conversation list present:', hasConvList);
    } else {
      console.log('[Live CDP] Tab Zalo Web chưa mở trên profile này.');
    }
  });
});
