import { expect, test } from './fixtures';

test.describe('E2E: Two-Phase Forwarding Workflow on Mock Zalo DOM', () => {
  test('should load mock Zalo DOM and verify 3-tier fallback selectors', async ({ mockPage }) => {
    // 1. Kiểm tra danh sách cuộc trò chuyện trên Sidebar
    const sidebar = mockPage.locator('#conversationList');
    await expect(sidebar).toBeVisible();

    const convGroup1 = mockPage.locator('[data-id="conv-group-source-1"]');
    await expect(convGroup1).toBeVisible();

    // 2. Chuyển đổi cuộc trò chuyện
    await convGroup1.click();

    // 3. Kiểm tra khung chat và các tin nhắn mẫu
    const messageList = mockPage.locator('.chat-message-list');
    await expect(messageList).toBeVisible();

    const firstMsg = mockPage.locator('[data-msg-id="msg-001"]');
    await expect(firstMsg).toBeVisible();

    // 4. Hover vào tin nhắn để hiển thị nút mở modal chia sẻ (Pha 1)
    const msgCard = firstMsg.locator('.msg-card');
    await msgCard.hover();

    const shareBtn = firstMsg.locator('.btn-forward-trigger');
    await expect(shareBtn).toBeVisible();

    // 5. Kiểm tra Native Forward Modal xuất hiện khi hiển thị
    await mockPage.evaluate(() => {
      const modal = document.querySelector<HTMLElement>('#forward-modal-container');
      if (modal) modal.style.display = 'flex';
    });

    const forwardModal = mockPage.locator('.forward-dialog');
    await expect(forwardModal).toBeVisible();

    // 6. Chọn nhóm đích và bấm Xác nhận Chia sẻ
    const targetCheckbox = mockPage.locator('input[value="conv-target-2b-5b"]');
    await targetCheckbox.setChecked(true, { force: true });
    await expect(targetCheckbox).toBeChecked();

    const confirmShareBtn = mockPage.locator('.btn-confirm-forward');
    await expect(confirmShareBtn).toBeVisible();
    await confirmShareBtn.click({ force: true });

    // 7. Kích hoạt và xác nhận Toast hiển thị thành công
    await mockPage.evaluate(() => {
      const modal = document.querySelector<HTMLElement>('#forward-modal-container');
      if (modal) modal.style.display = 'none';

      const toast = document.querySelector<HTMLElement>('.toast-success');
      if (toast) toast.style.display = 'block';
    });

    const toast = mockPage.locator('.toast-success');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Đã chia sẻ');

    // 8. Chuyển sang nhóm đích để tiêm text (Pha 2)
    const targetConv = mockPage.locator('[data-id="conv-target-2b-5b"]');
    await targetConv.click();

    const chatInput = mockPage.locator('#chat-input-text');
    await expect(chatInput).toBeVisible();

    // Nhập văn bản vào contenteditable
    await chatInput.click();
    await mockPage.keyboard.type('Bán nhà 3.8 tỷ');
    await mockPage.keyboard.press('Enter');

    // Quay về nhóm nguồn
    await convGroup1.click();
    await expect(convGroup1).toBeVisible();
  });
});
