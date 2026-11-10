import { SELECTORS, resolveElement } from '@/contracts/selectors';
import { type ChatSwitcher, chatSwitcher as defaultChatSwitcher } from '@/nodes/n03-chat-switcher';
import { logger } from '@/utils/logger';
import { microDelay } from '@/utils/pacing-guard';
import { setReactInputValue, simulateKeyStroke } from '@/utils/react-dom-bridge';

export class TextInjector {
  constructor(
    private switcher: ChatSwitcher = defaultChatSwitcher,
    private doc: Document = typeof document !== 'undefined'
      ? document
      : (null as unknown as Document),
  ) {}

  /**
   * Pha 2: Tiêm văn bản đã biên tập vào từng nhóm con đích, sau đó quay lại nhóm nguồn ban đầu:
   * 1. Mở từng nhóm con đích (tối đa 2 nhóm).
   * 2. Tiêm văn bản vào ô chat bằng setReactInputValue() kèm micro-jitter gõ phím con người.
   * 3. Bấm Gửi hoặc Enter.
   * 4. Chuyển ngược lại nhóm chat nguồn ban đầu.
   */
  async injectTextPhase2(
    sourceGroupId: string,
    targetGroupIds: string[],
    editedText: string,
    simulateTyping = false,
  ): Promise<boolean> {
    if (!this.doc || targetGroupIds.length === 0 || !editedText.trim()) {
      return false;
    }

    for (const targetId of targetGroupIds.slice(0, 2)) {
      // 1. Chuyển sang nhóm con đích
      await this.switcher.switchToGroup(targetId);

      // 2. Tìm phần tử ô nhập liệu
      const chatInput = resolveElement(SELECTORS.CHAT_INPUT_BOX, this.doc);
      if (!chatInput) {
        logger.error(
          'TEXT_INJECTION',
          'N09',
          `Không tìm thấy ô nhập chat tại nhóm đích: ${targetId}`,
          undefined,
          {
            groupId: targetId,
          },
        );
        continue;
      }

      // 3. Mô phỏng gõ phím (Micro-jitter con người) nếu được bật
      if (simulateTyping) {
        await microDelay(10, 30);
      }

      // 4. Tiêm văn bản tương thích React 18
      setReactInputValue(chatInput, editedText);

      // 5. Bấm nút gửi tin hoặc nhấn Enter
      const sendBtn =
        this.doc.querySelector<HTMLElement>('#btn-send-message') ||
        this.doc.querySelector<HTMLElement>('.btn-send');

      if (sendBtn) {
        sendBtn.click();
      } else {
        simulateKeyStroke(chatInput, 'Enter');
      }

      logger.info(
        'TEXT_INJECTION',
        'N09',
        `Đã tiêm văn bản và gửi tin tại nhóm đích: ${targetId}`,
        {
          groupId: targetId,
        },
      );
    }

    // 6. Quay ngược trở lại nhóm nguồn ban đầu
    await this.switcher.switchToGroup(sourceGroupId);

    logger.info(
      'TEXT_INJECTION',
      'N09',
      `Pha 2 hoàn tất: Đã quay trở về nhóm nguồn ban đầu: ${sourceGroupId}`,
      {
        groupId: sourceGroupId,
      },
    );

    return true;
  }
}

export const textInjector = new TextInjector();
