import { SELECTORS, resolveElement } from '@/contracts/selectors';
import { logger } from '@/utils/logger';

export interface SidebarObserverOptions {
  whitelist: string[]; // Danh sách groupId được phép theo dõi
  onNewMessage: (groupId: string) => void;
  rootDocument?: Document;
}

export class SidebarObserver {
  private observer: MutationObserver | null = null;
  private isRunning = false;
  private whitelist: Set<string>;
  private onNewMessage: (groupId: string) => void;
  private doc: Document;

  constructor(options: SidebarObserverOptions) {
    this.whitelist = new Set(options.whitelist);
    this.onNewMessage = options.onNewMessage;
    this.doc =
      options.rootDocument ||
      (typeof document !== 'undefined' ? document : (null as unknown as Document));
  }

  /**
   * Cập nhật danh sách Whitelist thời gian thực mà không cần khởi động lại observer.
   */
  updateWhitelist(whitelist: string[]): void {
    this.whitelist = new Set(whitelist);
  }

  /**
   * Khởi động MutationObserver theo dõi danh sách hội thoại Zalo Sidebar.
   */
  start(): boolean {
    if (this.isRunning || !this.doc) return false;

    const sidebarContainer = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
    if (!sidebarContainer) {
      logger.warn(
        'SIDEBAR_OBSERVER',
        'N01',
        'Không tìm thấy phần tử SIDEBAR_CONVERSATIONS trên DOM',
      );
      return false;
    }

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(sidebarContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-id'],
    });

    this.isRunning = true;
    logger.info('SIDEBAR_OBSERVER', 'N01', 'Bắt đầu theo dõi danh sách hội thoại Sidebar');
    return true;
  }

  /**
   * Dừng theo dõi và giải phóng observer.
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isRunning = false;
    logger.info('SIDEBAR_OBSERVER', 'N01', 'Đã dừng theo dõi Sidebar');
  }

  isObserving(): boolean {
    return this.isRunning;
  }

  /**
   * Quét và xử lý các đột biến DOM trong danh sách hội thoại.
   */
  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') continue;

      const convItem = target.closest('.conv-item') || target.closest('[data-id^="conv-"]');
      if (!convItem) continue;

      const groupId = convItem.getAttribute('data-id');
      if (!groupId || !this.whitelist.has(groupId)) {
        continue;
      }

      // Kiểm tra có chấm đỏ hoặc số lượng tin chưa đọc hay không
      const hasUnread =
        convItem.querySelector('.unread-red-dot') !== null ||
        convItem.querySelector('.unread-badge') !== null ||
        convItem.querySelector('[data-translate-inner*="unread"]') !== null;

      if (hasUnread) {
        logger.info(
          'SIDEBAR_OBSERVER',
          'N01',
          `Phát hiện tin nhắn mới trong nhóm Whitelist: ${groupId}`,
          {
            groupId,
          },
        );
        this.onNewMessage(groupId);
      }
    }
  }

  /**
   * Quét chủ động toàn bộ các mục hiện có trong Sidebar khi vừa tải trang.
   */
  scanExisting(): void {
    if (!this.doc) return;
    const sidebar = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
    if (!sidebar) return;

    const items = sidebar.querySelectorAll('.conv-item, [data-id^="conv-"]');
    for (const item of items) {
      const groupId = item.getAttribute('data-id');
      if (groupId && this.whitelist.has(groupId)) {
        const hasUnread =
          item.querySelector('.unread-red-dot') !== null ||
          item.querySelector('.unread-badge') !== null;
        if (hasUnread) {
          this.onNewMessage(groupId);
        }
      }
    }
  }
}
