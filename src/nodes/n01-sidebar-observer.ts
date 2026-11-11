import { SELECTORS, resolveElement } from '@/contracts/selectors';
import { logger } from '@/utils/logger';

export interface SidebarObserverOptions {
  whitelist: string[]; // Danh sách groupId được phép theo dõi
  onNewMessage: (groupId: string) => void;
  rootDocument?: Document;
  autoAttachTimeoutMs?: number; // Thời gian chờ tối đa tự động gắn kết (mặc định 30000ms)
}

export class SidebarObserver {
  private observer: MutationObserver | null = null;
  private waitingObserver: MutationObserver | null = null;
  private waitingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private whitelist: Set<string>;
  private onNewMessage: (groupId: string) => void;
  private doc: Document;
  private autoAttachTimeoutMs: number;

  constructor(options: SidebarObserverOptions) {
    this.whitelist = new Set(options.whitelist);
    this.onNewMessage = options.onNewMessage;
    this.doc =
      options.rootDocument ||
      (typeof document !== 'undefined' ? document : (null as unknown as Document));
    this.autoAttachTimeoutMs = options.autoAttachTimeoutMs ?? 30000;
  }

  /**
   * Cập nhật danh sách Whitelist thời gian thực mà không cần khởi động lại observer.
   */
  updateWhitelist(whitelist: string[]): void {
    this.whitelist = new Set(whitelist);
  }

  /**
   * Khởi động MutationObserver theo dõi danh sách hội thoại Zalo Sidebar.
   * Hỗ trợ Auto-Attach / Wait For Element nếu React chưa render Sidebar.
   */
  start(): boolean {
    if (this.isRunning || !this.doc) return false;

    const sidebarContainer = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
    if (sidebarContainer) {
      this.attachObserver(sidebarContainer);
      this.isRunning = true;
      logger.info('SIDEBAR_OBSERVER', 'N01', 'Bắt đầu theo dõi danh sách hội thoại Sidebar');
      return true;
    }

    // Nếu chưa có sẵn (React đang tải)
    this.isRunning = true;
    logger.info(
      'SIDEBAR_OBSERVER',
      'N01',
      '[N01] SIDEBAR_CONVERSATIONS chưa xuất hiện trên DOM. Đang kích hoạt chế độ chờ tự động gắn kết (Auto-Attach)...',
    );

    this.startWaitingForSidebar();
    return true;
  }

  /**
   * Dừng theo dõi và giải phóng observer.
   */
  stop(): void {
    this.cleanupWaiting();
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
   * Kiểm tra xem observer đã thực sự được gắn vào phần tử Sidebar hay chưa.
   */
  isAttached(): boolean {
    return this.observer !== null;
  }

  /**
   * Gắn MutationObserver chính thức lên phần tử Sidebar Container.
   */
  private attachObserver(container: HTMLElement): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-id'],
    });
  }

  /**
   * Kích hoạt chế độ chờ phần tử Sidebar xuất hiện trên DOM.
   */
  private startWaitingForSidebar(): void {
    const rootTarget = this.doc.body || this.doc.documentElement;

    if (rootTarget && typeof MutationObserver !== 'undefined') {
      this.waitingObserver = new MutationObserver(() => {
        const found = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
        if (found) {
          this.cleanupWaiting();
          this.attachObserver(found);
          this.scanExisting();
          logger.info(
            'SIDEBAR_OBSERVER',
            'N01',
            '[N01] Đã phát hiện SIDEBAR_CONVERSATIONS trên DOM, hoàn tất gắn kết MutationObserver.',
          );
        }
      });

      this.waitingObserver.observe(rootTarget, {
        childList: true,
        subtree: true,
      });
    }

    // Thiết lập timeout an toàn nếu sau thời gian này vẫn không thấy thì cảnh báo và hủy chờ
    this.waitingTimeoutTimer = setTimeout(() => {
      if (this.waitingObserver) {
        logger.warn(
          'SIDEBAR_OBSERVER',
          'N01',
          `[N01] Hết thời gian chờ (${this.autoAttachTimeoutMs}ms). Không tìm thấy phần tử SIDEBAR_CONVERSATIONS trên DOM. Hủy chế độ Auto-Attach.`,
        );
        this.cleanupWaiting();
      }
    }, this.autoAttachTimeoutMs);
  }

  /**
   * Dọn dẹp waiting observer và timer.
   */
  private cleanupWaiting(): void {
    if (this.waitingObserver) {
      this.waitingObserver.disconnect();
      this.waitingObserver = null;
    }
    if (this.waitingTimeoutTimer) {
      clearTimeout(this.waitingTimeoutTimer);
      this.waitingTimeoutTimer = null;
    }
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
          item.querySelector('.unread-badge') !== null ||
          item.querySelector('[data-translate-inner*="unread"]') !== null;
        if (hasUnread) {
          this.onNewMessage(groupId);
        }
      }
    }
  }
}
