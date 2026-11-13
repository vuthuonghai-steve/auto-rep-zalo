import type { GroupDetectedEvent, WhitelistGroupItem } from '@/contracts/schemas';
import { SELECTORS, resolveElement } from '@/contracts/selectors';
import { extractUnreadBadge } from '@/utils/badge-extractor';
import { CorrelationContext } from '@/utils/correlation';
import { logger } from '@/utils/logger';
import { isGroupNameMatching, normalizeZaloText } from '@/utils/text-normalizer';

export interface SidebarObserverTelemetry {
  totalProcessed: number;
  totalIgnoredNonWhitelist: number;
  isObserving: boolean;
  isAttached: boolean;
}

export type OnNewMessageCallback =
  | ((event: GroupDetectedEvent) => void)
  | ((groupId: string, event?: GroupDetectedEvent) => void)
  | ((groupId: string) => void);

export interface SidebarObserverOptions {
  whitelist: (string | WhitelistGroupItem)[]; // Danh sách groupId hoặc WhitelistGroupItem
  onNewMessage: OnNewMessageCallback;
  rootDocument?: Document;
  autoAttachTimeoutMs?: number; // Thời gian chờ tối đa tự động gắn kết (mặc định 30000ms)
  emitEventPayload?: boolean; // Tùy chọn ép buộc truyền toàn bộ GroupDetectedEvent vào callback 1 tham số
}

export class SidebarObserver {
  private observer: MutationObserver | null = null;
  private waitingObserver: MutationObserver | null = null;
  private waitingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private rawWhitelist: (string | WhitelistGroupItem)[] = [];
  private whitelistSet: Set<string> = new Set();
  private whitelistRules: WhitelistGroupItem[] = [];
  private onNewMessage: OnNewMessageCallback;
  private doc: Document;
  private autoAttachTimeoutMs: number;
  private emitEventPayload: boolean;

  // Telemetry metrics
  private totalProcessed = 0;
  private totalIgnoredNonWhitelist = 0;

  constructor(options: SidebarObserverOptions) {
    this.onNewMessage = options.onNewMessage;
    this.doc =
      options.rootDocument ||
      (typeof document !== 'undefined' ? document : (null as unknown as Document));
    this.autoAttachTimeoutMs = options.autoAttachTimeoutMs ?? 30000;
    this.emitEventPayload = options.emitEventPayload ?? false;

    this.updateWhitelist(options.whitelist);
  }

  /**
   * Cập nhật danh sách Whitelist thời gian thực mà không cần khởi động lại observer.
   * Hỗ trợ cả string[] và WhitelistGroupItem[].
   */
  updateWhitelist(whitelist: (string | WhitelistGroupItem)[]): void {
    this.rawWhitelist = [...whitelist];
    this.whitelistSet = new Set();
    this.whitelistRules = [];

    for (const item of whitelist) {
      if (typeof item === 'string') {
        this.whitelistSet.add(item);
        const norm = normalizeZaloText(item).toLowerCase();
        if (norm) {
          this.whitelistSet.add(norm);
        }
      } else if (item && typeof item === 'object') {
        this.whitelistRules.push(item);
        if (item.isEnabled !== false) {
          if (item.groupId) {
            this.whitelistSet.add(item.groupId);
          }
          if (item.groupName && item.matchingRule === 'EXACT') {
            const norm = normalizeZaloText(item.groupName).toLowerCase();
            if (norm) {
              this.whitelistSet.add(norm);
            }
          }
        }
      }
    }
  }

  /**
   * Thuật toán đối chiếu Whitelist:
   * 1. Tra cứu trực tiếp Set theo groupId.
   * 2. Tra cứu trực tiếp Set theo groupName đã chuẩn hóa.
   * 3. Duyệt cấu hình WhitelistGroupItem áp dụng quy tắc EXACT / CONTAINS qua isGroupNameMatching.
   */
  matchWhitelist(groupId: string, groupName: string): boolean {
    if (!groupId && !groupName) {
      return false;
    }

    // 1. Direct Set check theo groupId
    if (groupId && this.whitelistSet.has(groupId)) {
      return true;
    }

    // 2. Direct Set check theo normalized groupName
    const normName = normalizeZaloText(groupName).toLowerCase();
    if (normName && this.whitelistSet.has(normName)) {
      return true;
    }

    // 3. So khớp theo các luật có cấu trúc WhitelistGroupItem
    for (const rule of this.whitelistRules) {
      if (rule.isEnabled === false) {
        continue;
      }
      if (rule.groupId && rule.groupId === groupId) {
        return true;
      }
      if (
        groupName &&
        rule.groupName &&
        isGroupNameMatching(groupName, rule.groupName, rule.matchingRule)
      ) {
        return true;
      }
    }

    // 4. So khớp fallback danh sách string thô
    for (const item of this.rawWhitelist) {
      if (typeof item === 'string') {
        if (item === groupId || item === groupName) {
          return true;
        }
        if (groupName && isGroupNameMatching(groupName, item, 'EXACT')) {
          return true;
        }
      }
    }

    return false;
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
   * Truy xuất thống kê viễn trắc vận hành của SidebarObserver.
   */
  getTelemetry(): SidebarObserverTelemetry {
    return {
      totalProcessed: this.totalProcessed,
      totalIgnoredNonWhitelist: this.totalIgnoredNonWhitelist,
      isObserving: this.isRunning,
      isAttached: this.observer !== null,
    };
  }

  /**
   * Alias tương thích getStats() theo yêu cầu T009.
   */
  getStats(): SidebarObserverTelemetry {
    return this.getTelemetry();
  }

  /**
   * Đặt lại bộ đếm viễn trắc.
   */
  resetTelemetry(): void {
    this.totalProcessed = 0;
    this.totalIgnoredNonWhitelist = 0;
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
   * Tìm phần tử đại diện cho thẻ hội thoại dựa trên ma trận selector 3 tầng chuẩn hóa.
   */
  findSidebarItem(target: Element): HTMLElement | null {
    return (
      target.closest<HTMLElement>('div.msg-item[data-id="div_TabMsg_ThrdChItem"]') ||
      target.closest<HTMLElement>('[anim-data-id^="g"]') ||
      target.closest<HTMLElement>(SELECTORS.SIDEBAR_ITEM.tier3_class) ||
      null
    );
  }

  /**
   * Bóc tách groupId từ thẻ hội thoại:
   * 1. Ưu tiên thuộc tính anim-data-id (bắt đầu bằng 'g...').
   * 2. Fallback tìm thẻ ảnh avatar img[data-ava-uid^="g"] lấy data-ava-uid.
   * 3. Fallback lấy data-id (bỏ qua giá trị template div_TabMsg_ThrdChItem).
   */
  extractGroupId(itemElement: HTMLElement): string | null {
    const animDataId = itemElement.getAttribute('anim-data-id');
    if (animDataId?.startsWith('g')) {
      return animDataId;
    }

    const dataId = itemElement.getAttribute('data-id');
    if (dataId?.startsWith('conv-')) {
      return dataId;
    }

    const avatarImg =
      itemElement.querySelector<HTMLImageElement>(SELECTORS.SIDEBAR_ITEM_AVATAR.tier1_semantic) ||
      itemElement.querySelector<HTMLImageElement>('img[data-ava-uid]');
    const avaUid = avatarImg?.getAttribute('data-ava-uid');
    if (avaUid?.startsWith('g')) {
      return avaUid;
    }

    if (dataId && dataId !== 'div_TabMsg_ThrdChItem') {
      return dataId;
    }

    if (avaUid) {
      return avaUid;
    }

    if (animDataId) {
      return animDataId;
    }

    return null;
  }

  /**
   * Bóc tách groupName chuẩn hóa:
   * Sử dụng SELECTORS.SIDEBAR_ITEM_TITLE và chuẩn hóa qua normalizeZaloText.
   */
  extractGroupName(itemElement: HTMLElement): string {
    const titleEl =
      itemElement.querySelector(SELECTORS.SIDEBAR_ITEM_TITLE.tier1_semantic) ||
      itemElement.querySelector(SELECTORS.SIDEBAR_ITEM_TITLE.tier2_hierarchy) ||
      itemElement.querySelector(SELECTORS.SIDEBAR_ITEM_TITLE.tier3_class);
    return normalizeZaloText(titleEl?.textContent);
  }

  /**
   * Bóc tách và xử lý logic cho một thẻ hội thoại (thỏa mãn T007 & T008 & T009).
   */
  private processItemElement(itemElement: HTMLElement): void {
    const groupId = this.extractGroupId(itemElement);
    if (!groupId) {
      return;
    }

    // Bóc tách đa tín hiệu (Multi-Signal Fusion)
    const badgeResult = extractUnreadBadge(itemElement);
    const hasUnreadClass =
      itemElement.querySelector('.z-conv-message.--unread') !== null ||
      itemElement.querySelector('.unread-red-dot') !== null ||
      itemElement.querySelector('.unread-badge') !== null;
    const hasUnread = badgeResult.hasUnread || hasUnreadClass;

    if (!hasUnread) {
      return;
    }

    const groupName = this.extractGroupName(itemElement);

    // Tăng biến đếm tổng số hội thoại có tin mới được xử lý
    this.totalProcessed++;

    // Đối chiếu Whitelist (T009)
    if (!this.matchWhitelist(groupId, groupName)) {
      this.totalIgnoredNonWhitelist++;
      logger.info(
        'SIDEBAR_OBSERVER',
        'N01',
        `Bỏ qua tin nhắn mới do không nằm trong Whitelist: groupId=${groupId}, groupName=${groupName}`,
        { groupId },
      );
      return;
    }

    // Bóc tách preview sender & snippet message
    const senderEl =
      itemElement.querySelector(SELECTORS.PREVIEW_SENDER.tier1_semantic) ||
      itemElement.querySelector(SELECTORS.PREVIEW_SENDER.tier2_hierarchy) ||
      itemElement.querySelector(SELECTORS.PREVIEW_SENDER.tier3_class);
    const senderName = normalizeZaloText(senderEl?.textContent) || undefined;

    const snippetEl =
      itemElement.querySelector(SELECTORS.PREVIEW_MESSAGE.tier1_semantic) ||
      itemElement.querySelector(SELECTORS.PREVIEW_MESSAGE.tier2_hierarchy) ||
      itemElement.querySelector(SELECTORS.PREVIEW_MESSAGE.tier3_class);
    const lastSnippet = normalizeZaloText(snippetEl?.textContent) || undefined;

    // Phát hiện nhóm cộng đồng qua community icon
    const isCommunity =
      itemElement.querySelector(SELECTORS.SIDEBAR_COMMUNITY_ICON.tier1_semantic) !== null ||
      itemElement.querySelector(SELECTORS.SIDEBAR_COMMUNITY_ICON.tier2_hierarchy) !== null ||
      itemElement.querySelector(SELECTORS.SIDEBAR_COMMUNITY_ICON.tier3_class) !== null;

    const unreadCount = badgeResult.unreadCount > 0 ? badgeResult.unreadCount : hasUnread ? 1 : 0;

    const event: GroupDetectedEvent = {
      groupId,
      groupName,
      unreadCount,
      lastSnippet,
      senderName,
      detectedAt: Date.now(),
      correlationId: CorrelationContext.generate(),
      isCommunity,
    };

    logger.info(
      'SIDEBAR_OBSERVER',
      'N01',
      `Phát hiện tin nhắn mới trong nhóm Whitelist: ${groupId} (${groupName}) [unread=${unreadCount}]`,
      {
        groupId,
      },
    );

    this.emitNewMessage(event);
  }

  /**
   * Phát đi sự kiện tin nhắn mới đến callback onNewMessage, hỗ trợ tương thích ngược:
   * 1. onNewMessage(groupId, event) khi callback nhận 2 tham số.
   * 2. onNewMessage(event) khi callback nhận 1 tham số tên event/e/payload hoặc emitEventPayload = true.
   * 3. onNewMessage(groupId) khi callback nhận 1 tham số tên groupId hoặc legacy test.
   */
  private emitNewMessage(event: GroupDetectedEvent): void {
    if (typeof this.onNewMessage !== 'function') return;

    if (this.onNewMessage.length >= 2) {
      (this.onNewMessage as (groupId: string, event: GroupDetectedEvent) => void)(
        event.groupId,
        event,
      );
      return;
    }

    if (this.onNewMessage.length === 1) {
      const fnStr = this.onNewMessage.toString();
      const paramMatch = fnStr.match(/^(?:async\s*)?(?:function\s*\w*\s*)?\(\s*([a-zA-Z0-9_$]+)/);
      const paramName = paramMatch?.[1] ? paramMatch[1].toLowerCase() : '';
      if (paramName.startsWith('group') || paramName === 'id') {
        (this.onNewMessage as (groupId: string) => void)(event.groupId);
        return;
      }
      (this.onNewMessage as (event: GroupDetectedEvent) => void)(event);
      return;
    }

    // length === 0 (vi.fn() không khai báo tham số tường minh)
    if (this.emitEventPayload) {
      (this.onNewMessage as (event: GroupDetectedEvent) => void)(event);
    } else {
      (this.onNewMessage as (groupId: string) => void)(event.groupId);
    }
  }

  /**
   * Quét và xử lý các đột biến DOM trong danh sách hội thoại.
   */
  private handleMutations(mutations: MutationRecord[]): void {
    const seenItems = new Set<HTMLElement>();
    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') continue;

      const convItem = this.findSidebarItem(target);
      if (convItem && !seenItems.has(convItem)) {
        seenItems.add(convItem);
        this.processItemElement(convItem);
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

    const rawCandidates = sidebar.querySelectorAll<HTMLElement>(
      'div.msg-item[data-id="div_TabMsg_ThrdChItem"], [anim-data-id^="g"], [anim-data-id], .conv-item, .msg-item',
    );
    const seenItems = new Set<HTMLElement>();
    for (let i = 0; i < rawCandidates.length; i++) {
      const candidate = rawCandidates[i];
      if (!candidate) continue;
      const convItem = this.findSidebarItem(candidate) || candidate;
      if (!seenItems.has(convItem)) {
        seenItems.add(convItem);
        this.processItemElement(convItem);
      }
    }
  }
}
