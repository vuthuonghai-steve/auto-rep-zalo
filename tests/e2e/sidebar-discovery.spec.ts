import { expect, test } from './fixtures';
import { ExtensionHelper } from '../helpers/extension-helper';

test.describe('E2E: Sidebar Observer & Discovery Workflow', () => {
  test('should load mock Zalo DOM and extract conversation groups correctly', async ({ mockPage }) => {
    // 1. Kiểm tra container sidebar
    const convList = mockPage.locator('#conversationList');
    await expect(convList).toBeVisible();

    // 2. Kiểm tra số lượng mục hội thoại trong mock DOM
    const items = mockPage.locator('#conversationList > li.conv-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // 3. Trích xuất thông tin nhóm đầu tiên
    const firstGroup = items.first();
    const groupNameEl = firstGroup.locator('.conv-name');
    await expect(groupNameEl).toContainText('Nguồn BĐS Cầu Giấy');

    const badgeEl = firstGroup.locator('.unread-badge');
    await expect(badgeEl).toHaveText('3');
  });

  test('should verify sidepanel UI rendering and initial telemetry card state', async ({ context, extensionId }) => {
    if (!extensionId) {
      // Trong môi trường headless không khởi tạo được Chrome Extension ID
      test.skip(!extensionId, 'Extension ID không khả dụng trong môi trường headless.');
      return;
    }

    const sidepanelPage = await ExtensionHelper.openSidepanel(context, extensionId);
    await expect(sidepanelPage).toHaveTitle(/Zalo/);

    // Kiểm tra root container của sidepanel
    const app = sidepanelPage.locator('#app');
    await expect(app).toBeAttached();

    // Kiểm tra header title hoặc banner
    const headerTitle = sidepanelPage.locator('h1');
    await expect(headerTitle).toBeVisible();

    await sidepanelPage.close();
  });
});
