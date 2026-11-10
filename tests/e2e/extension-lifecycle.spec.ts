import { expect, test } from './fixtures';

test.describe('E2E: Extension Lifecycle & F5 Reload Resilience', () => {
  test('should survive page reload and maintain DOM fixture integrity', async ({ mockPage }) => {
    // 1. Kiểm tra trạng thái ban đầu của mock page
    const sidebar = mockPage.locator('#conversationList');
    await expect(sidebar).toBeVisible();

    const activeItem = mockPage.locator('[data-id="conv-group-source-1"]');
    await activeItem.click();
    await expect(activeItem).toHaveClass(/active/);

    // 2. Thực hiện reload trang (F5)
    await mockPage.reload();

    // 3. Kiểm tra trang đã tải lại hoàn tất và các selector vẫn hợp lệ
    const reloadedSidebar = mockPage.locator('#conversationList');
    await expect(reloadedSidebar).toBeVisible();

    const reloadedConv = mockPage.locator('[data-id="conv-group-source-1"]');
    await expect(reloadedConv).toBeVisible();

    // 4. Kiểm tra ô nhập chat sẵn sàng nhận lệnh sau reload
    const chatInput = mockPage.locator('#chat-input-text');
    await expect(chatInput).toBeVisible();
    await chatInput.click();
    await mockPage.keyboard.type('Tin nhắn thử nghiệm sau F5');
    await expect(chatInput).toHaveText('Tin nhắn thử nghiệm sau F5');
  });

  test('should detect options page availability via extension ID', async ({
    context,
    extensionId,
  }) => {
    // Mở trang options của extension
    const optionsPage = await context.newPage();
    if (extensionId) {
      await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(optionsPage).toHaveTitle(/Cấu Hình/);
      const heading = optionsPage.locator('h1');
      await expect(heading).toBeVisible();
    } else {
      // Fallback kiểm tra file options.html đã build trong .output/chrome-mv3
      const optionsHtmlPath = new URL('../../.output/chrome-mv3/options.html', import.meta.url)
        .pathname;
      await optionsPage.goto(`file://${optionsHtmlPath}`);
      await expect(optionsPage).toHaveTitle(/Cấu Hình/);
    }
    await optionsPage.close();
  });
});
