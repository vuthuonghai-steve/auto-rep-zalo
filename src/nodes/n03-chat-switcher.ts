import { SELECTORS, resolveElement } from '@/contracts/selectors';
import { logger } from '@/utils/logger';

export class ChatSwitcher {
  constructor(
    private doc: Document = typeof document !== 'undefined'
      ? document
      : (null as unknown as Document),
  ) {}

  /**
   * Mở nhóm chat nguồn theo groupId trên giao diện Zalo Web và neo đáy khung chat.
   */
  async switchToGroup(groupId: string): Promise<boolean> {
    if (!this.doc) return false;

    // 1. Định vị phần tử nhóm hội thoại trong danh sách Sidebar
    const sidebar = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
    if (!sidebar) {
      logger.error('CHAT_SWITCHER', 'N03', 'Không tìm thấy khung Sidebar hội thoại', undefined, {
        groupId,
      });
      return false;
    }

    const convItem =
      sidebar.querySelector<HTMLElement>(`[data-id="${groupId}"]`) ||
      sidebar.querySelector<HTMLElement>(`.conv-item[data-id="${groupId}"]`);

    if (!convItem) {
      logger.error(
        'CHAT_SWITCHER',
        'N03',
        `Không tìm thấy nhóm hội thoại trên Sidebar: ${groupId}`,
        undefined,
        {
          groupId,
        },
      );
      return false;
    }

    // 2. Kích hoạt sự kiện click mở nhóm
    convItem.click();

    // Cập nhật trạng thái active thị giác
    const prevActive = sidebar.querySelectorAll('.conv-item.active');
    for (const prev of prevActive) {
      prev.classList.remove('active');
    }
    convItem.classList.add('active');

    // Dọn dẹp chấm đỏ chưa đọc của nhóm vừa mở
    const unreadDot = convItem.querySelector('.unread-red-dot, .unread-badge');
    unreadDot?.remove();

    // 3. Neo đáy khung chat (Strict Bottom Anchor) & Bỏ qua nút 99+ tin chưa đọc
    this.anchorToBottom();

    logger.info('CHAT_SWITCHER', 'N03', `Đã chuyển đổi thành công sang nhóm nguồn: ${groupId}`, {
      groupId,
    });
    return true;
  }

  /**
   * Neo chắc chắn ở đáy khung chat và bỏ qua nút cuộn 99+ tin chưa đọc.
   */
  anchorToBottom(): boolean {
    if (!this.doc) return false;

    const messageContainer = resolveElement(SELECTORS.CHAT_MESSAGE_CONTAINER, this.doc);
    if (messageContainer) {
      // Neo chắc chắn ở vị trí scroll đáy
      messageContainer.scrollTop = messageContainer.scrollHeight;
      return true;
    }
    return false;
  }
}

export const chatSwitcher = new ChatSwitcher();
