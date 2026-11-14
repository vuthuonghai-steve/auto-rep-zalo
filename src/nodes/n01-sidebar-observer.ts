import type {
  DiscoveredGroupItem,
  GroupDetectedEvent,
  WhitelistGroupItem,
  WhitelistMatchingRule,
} from '@/contracts/schemas';
import { SELECTORS, resolveElement } from '@/contracts/selectors';
import { type ZaloAutomationDatabase, db as defaultDb } from '@/db/database';
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

export type QueueProcessingStatus = 'IDLE' | 'PROCESSING' | 'DRAINED';

export interface QueueItemSnapshot {
  id?: number | undefined;
  groupId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  enqueuedAt: number;
  retryCount: number;
}

export interface N01TelemetrySnapshot {
  queueStatus: QueueProcessingStatus;
  isObserving: boolean;
  isAttached: boolean;
  totalProcessed: number;
  totalIgnoredNonWhitelist: number;
  lastActiveTimestamp: number;
  pendingQueueItems?: QueueItemSnapshot[] | undefined;
  processingQueueItem?: QueueItemSnapshot | null | undefined;
}

export interface DebounceStats {
  pendingMutationsCount: number;
  isDebouncing: boolean;
  totalDebouncedRuns: number;
  totalEnqueued: number;
  totalDedupSkipped: number;
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
  reconnectCooldownMs?: number; // Thời gian hạ nhiệt tái kết nối Self-Healing (mặc định 500ms)
  emitEventPayload?: boolean; // Tùy chọn ép buộc truyền toàn bộ GroupDetectedEvent vào callback 1 tham số
  debounceMs?: number; // Cửa sổ khử rung gom cụm đột biến DOM (mặc định 300ms)
  maxDebounceBufferMs?: number; // Thời gian tối đa giữ đệm trước khi ép buộc xả tránh starvation (mặc định 1500ms)
  dbInstance?: ZaloAutomationDatabase; // Database instance (mặc định import db từ @/db/database)
  telemetryChannelName?: string; // Tên kênh BroadcastChannel (mặc định 'n01_telemetry_channel')
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
  private debounceMs: number;
  private maxDebounceBufferMs: number;
  private db: ZaloAutomationDatabase;

  // Debounce buffer internals
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private firstDebounceMutationTime: number | null = null;
  private pendingMutationQueue: Set<HTMLElement> = new Set();
  private rafId: number | ReturnType<typeof setTimeout> | null = null;

  // Telemetry metrics
  private totalProcessed = 0;
  private totalIgnoredNonWhitelist = 0;
  private totalDebouncedRuns = 0;
  private totalEnqueued = 0;
  private totalDedupSkipped = 0;

  // Resilience & Telemetry internals (US4)
  private container: HTMLElement | null = null;
  private reconnectCooldownMs: number;
  private telemetryChannelName: string;
  private telemetryChannel: BroadcastChannel | null = null;
  private bodyObserver: MutationObserver | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private drainedTimer: ReturnType<typeof setTimeout> | null = null;
  private queueStatus: QueueProcessingStatus = 'IDLE';
  private isReconnecting = false;
  private lastDisconnectTime = 0;
  private lastActiveTimestamp = Date.now();

  constructor(options: SidebarObserverOptions) {
    this.onNewMessage = options.onNewMessage;
    this.doc =
      options.rootDocument ||
      (typeof document !== 'undefined' ? document : (null as unknown as Document));
    this.autoAttachTimeoutMs = options.autoAttachTimeoutMs ?? 30000;
    this.reconnectCooldownMs = options.reconnectCooldownMs ?? 500;
    this.emitEventPayload = options.emitEventPayload ?? false;
    this.debounceMs = options.debounceMs ?? 300;
    this.maxDebounceBufferMs = options.maxDebounceBufferMs ?? 1500;
    this.db = options.dbInstance ?? defaultDb;
    this.telemetryChannelName = options.telemetryChannelName ?? 'n01_telemetry_channel';

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

    this.initBroadcastChannel();
    this.startBodyObserver();

    const sidebarContainer = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
    if (sidebarContainer) {
      this.attachObserver(sidebarContainer);
      this.isRunning = true;
      this.startHealthCheck();
      this.broadcastTelemetry();
      logger.info('SIDEBAR_OBSERVER', 'N01', 'Bắt đầu theo dõi danh sách hội thoại Sidebar');
      return true;
    }

    // Nếu chưa có sẵn (React đang tải)
    this.isRunning = true;
    this.broadcastTelemetry();
    logger.info(
      'SIDEBAR_OBSERVER',
      'N01',
      '[N01] SIDEBAR_CONVERSATIONS chưa xuất hiện trên DOM. Đang kích hoạt chế độ chờ tự động gắn kết (Auto-Attach)...',
    );

    this.startWaitingForSidebar();
    this.startHealthCheck();
    return true;
  }

  /**
   * Dừng theo dõi và giải phóng observer và debounce timers.
   */
  stop(): void {
    this.cleanupWaiting();
    this.stopHealthCheck();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function' && typeof this.rafId === 'number') {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId as ReturnType<typeof setTimeout>);
      }
      this.rafId = null;
    }
    this.pendingMutationQueue.clear();
    this.firstDebounceMutationTime = null;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.container = null;
    this.isRunning = false;
    this.queueStatus = 'IDLE';
    this.broadcastTelemetry();
    if (this.telemetryChannel) {
      this.telemetryChannel.close();
      this.telemetryChannel = null;
    }
    logger.info('SIDEBAR_OBSERVER', 'N01', 'Đã dừng theo dõi Sidebar');
  }

  isObserving(): boolean {
    return this.isRunning;
  }

  /**
   * Kiểm tra xem observer đã thực sự được gắn vào phần tử Sidebar hay chưa.
   */
  isAttached(): boolean {
    return (
      this.observer !== null &&
      this.container !== null &&
      (this.doc ? this.doc.contains(this.container) : true)
    );
  }

  /**
   * Truy xuất thống kê viễn trắc vận hành của SidebarObserver.
   */
  getTelemetry(): SidebarObserverTelemetry {
    return {
      totalProcessed: this.totalProcessed,
      totalIgnoredNonWhitelist: this.totalIgnoredNonWhitelist,
      isObserving: this.isRunning,
      isAttached: this.isAttached(),
    };
  }

  /**
   * Alias tương thích getStats() theo yêu cầu T009.
   */
  getStats(): SidebarObserverTelemetry {
    return this.getTelemetry();
  }

  /**
   * Truy xuất thống kê cơ chế gom cụm Debounce và hàng đợi Dexie (T011 & T012).
   */
  getDebounceStats(): DebounceStats {
    return {
      pendingMutationsCount: this.pendingMutationQueue.size,
      isDebouncing: this.debounceTimer !== null,
      totalDebouncedRuns: this.totalDebouncedRuns,
      totalEnqueued: this.totalEnqueued,
      totalDedupSkipped: this.totalDedupSkipped,
    };
  }

  /**
   * Đặt lại bộ đếm viễn trắc.
   */
  resetTelemetry(): void {
    this.totalProcessed = 0;
    this.totalIgnoredNonWhitelist = 0;
    this.totalDebouncedRuns = 0;
    this.totalEnqueued = 0;
    this.totalDedupSkipped = 0;
  }

  /**
   * Khởi tạo kết nối BroadcastChannel để phát sóng viễn trắc.
   */
  private initBroadcastChannel(): void {
    if (this.telemetryChannel) return;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.telemetryChannel = new BroadcastChannel(this.telemetryChannelName);
      }
    } catch {
      this.telemetryChannel = null;
    }
  }

  /**
   * Phát sóng snapshot viễn trắc qua BroadcastChannel và chrome.storage.local.
   */
  broadcastTelemetry(customSnapshot?: N01TelemetrySnapshot): void {
    this.lastActiveTimestamp = Date.now();
    const snapshot: N01TelemetrySnapshot = customSnapshot || {
      queueStatus: this.queueStatus,
      isObserving: this.isRunning,
      isAttached: this.isAttached(),
      totalProcessed: this.totalProcessed,
      totalIgnoredNonWhitelist: this.totalIgnoredNonWhitelist,
      lastActiveTimestamp: this.lastActiveTimestamp,
    };

    if (this.telemetryChannel) {
      try {
        this.telemetryChannel.postMessage(snapshot);
      } catch {
        // Fallback an toàn nếu channel gặp sự cố
      }
    }

    // Đồng bộ telemetry lên chrome.storage.local để trang Options đọc xuyên Origin
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ n01_telemetry: snapshot }).catch(() => {
          // Bỏ qua lỗi context invalidated trong extension lifecycle
        });
      }
    } catch {
      // Môi trường không có chrome.storage
    }
  }

  /**
   * Truy xuất snapshot viễn trắc N01TelemetrySnapshot.
   */
  getTelemetrySnapshot(): N01TelemetrySnapshot {
    return {
      queueStatus: this.queueStatus,
      isObserving: this.isRunning,
      isAttached: this.isAttached(),
      totalProcessed: this.totalProcessed,
      totalIgnoredNonWhitelist: this.totalIgnoredNonWhitelist,
      lastActiveTimestamp: this.lastActiveTimestamp,
    };
  }

  /**
   * Thiết lập thủ công trạng thái hàng đợi viễn trắc.
   */
  setQueueStatus(status: QueueProcessingStatus): void {
    this.queueStatus = status;
    this.broadcastTelemetry();
  }

  getQueueStatus(): QueueProcessingStatus {
    return this.queueStatus;
  }

  /**
   * Đồng bộ viễn trắc hàng đợi với Dexie group_dispatch_queue (GATE-N01-05).
   * Phân tích số lượng PENDING, PROCESSING và tự động chuyển đổi IDLE / PROCESSING / DRAINED.
   */
  async syncQueueTelemetry(): Promise<N01TelemetrySnapshot> {
    if (!this.db) {
      return this.getTelemetrySnapshot();
    }
    try {
      const pendingItems = await this.db.group_dispatch_queue
        .where('status')
        .equals('PENDING')
        .toArray();
      const processingItems = await this.db.group_dispatch_queue
        .where('status')
        .equals('PROCESSING')
        .toArray();

      const pendingSnapshots: QueueItemSnapshot[] = pendingItems.map((item) => ({
        id: item.id,
        groupId: item.groupId,
        status: item.status,
        enqueuedAt: item.enqueuedAt,
        retryCount: item.retryCount,
      }));

      const processingSnapshot: QueueItemSnapshot | null = processingItems[0]
        ? {
            id: processingItems[0].id,
            groupId: processingItems[0].groupId,
            status: processingItems[0].status,
            enqueuedAt: processingItems[0].enqueuedAt,
            retryCount: processingItems[0].retryCount,
          }
        : null;

      const isBusy =
        pendingItems.length > 0 || processingItems.length > 0 || this.pendingMutationQueue.size > 0;

      if (isBusy) {
        if (this.drainedTimer) {
          clearTimeout(this.drainedTimer);
          this.drainedTimer = null;
        }
        this.queueStatus = 'PROCESSING';
      } else if (this.queueStatus === 'PROCESSING') {
        this.queueStatus = 'DRAINED';
        if (this.drainedTimer) clearTimeout(this.drainedTimer);
        this.drainedTimer = setTimeout(() => {
          this.queueStatus = 'IDLE';
          this.broadcastTelemetry();
        }, 5000);
      } else if (this.queueStatus !== 'DRAINED') {
        this.queueStatus = 'IDLE';
      }

      const snapshot: N01TelemetrySnapshot = {
        queueStatus: this.queueStatus,
        isObserving: this.isRunning,
        isAttached: this.isAttached(),
        totalProcessed: this.totalProcessed,
        totalIgnoredNonWhitelist: this.totalIgnoredNonWhitelist,
        lastActiveTimestamp: this.lastActiveTimestamp,
        pendingQueueItems: pendingSnapshots,
        processingQueueItem: processingSnapshot,
      };

      this.broadcastTelemetry(snapshot);
      return snapshot;
    } catch (error) {
      logger.error('SIDEBAR_OBSERVER', 'N01', 'Lỗi khi syncQueueTelemetry', error);
      return this.getTelemetrySnapshot();
    }
  }

  /**
   * Ghi log cấu trúc Wide-Event Telemetry vào Dexie system_logs (T021).
   */
  async logWideEvent(params: {
    operation: 'DETECT_MUTATION' | 'ENQUEUE_DISPATCH' | 'SELF_HEALING_RECONNECT';
    nodeId?: string;
    level?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    status?: 'SUCCESS' | 'FAILURE' | 'DEGRADED';
    durationMs?: number;
    groupId?: string;
    senderIdMasked?: string;
    phoneMasked?: string;
    message: string;
    errorPayload?: { code: string; message: string; stack?: string };
    correlationId?: string;
  }): Promise<void> {
    if (!this.db) {
      return;
    }
    try {
      const now = Date.now();
      await this.db.system_logs.add({
        correlationId: params.correlationId || CorrelationContext.generate(),
        operation: params.operation,
        nodeId: 'N01_SIDEBAR_OBSERVER',
        level: params.level || 'INFO',
        status: params.status || 'SUCCESS',
        durationMs: params.durationMs ?? 0,
        groupId: params.groupId || 'GLOBAL',
        senderIdMasked: params.senderIdMasked || '***',
        phoneMasked: params.phoneMasked,
        message: params.message,
        errorPayload: params.errorPayload,
        timestamp: now,
      });
    } catch (err) {
      logger.error('SIDEBAR_OBSERVER', 'N01', 'Lỗi khi ghi wide-event vào system_logs', err);
    }
  }

  /**
   * Kiểm tra tính toàn vẹn của container và kích hoạt Self-Healing nếu cần (T019).
   */
  checkContainerHealth(): void {
    if (!this.isRunning || !this.doc) return;

    // Trường hợp 1: Container cũ bị gỡ khỏi DOM (React unmount khi chuyển tab)
    if (this.container && (!this.doc.contains(this.container) || !this.container.isConnected)) {
      this.handleContainerDisconnected();
      return;
    }

    // Trường hợp 2: Đang chờ container mới xuất hiện để tái gắn kết
    if (!this.container && (this.isReconnecting || this.waitingObserver !== null)) {
      const found = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
      if (found) {
        if (this.isReconnecting) {
          this.handleContainerReconnected(found);
        } else {
          this.cleanupWaiting();
          this.attachObserver(found);
          this.scanExisting();
          this.broadcastTelemetry();
        }
      }
    }
  }

  /**
   * Xử lý sự kiện container Sidebar bị mất khỏi DOM (SPA tab switch / re-mount).
   */
  handleContainerDisconnected(): void {
    if (!this.isRunning) return;
    this.lastDisconnectTime = Date.now();
    this.isReconnecting = true;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.container = null;

    logger.warn(
      'SIDEBAR_OBSERVER',
      'N01',
      '[N01] Phát hiện container Sidebar bị gỡ khỏi DOM (SPA tab switch / re-mount). Đang kích hoạt Self-Healing Reconnect...',
    );

    void this.logWideEvent({
      operation: 'SELF_HEALING_RECONNECT',
      level: 'WARN',
      status: 'DEGRADED',
      groupId: 'SYSTEM',
      senderIdMasked: 'SYSTEM',
      message: 'Sidebar container bị gỡ khỏi DOM. Kích hoạt Self-Healing Reconnect...',
    });

    this.broadcastTelemetry();
    this.scheduleSelfHealingReconnect();
  }

  /**
   * Xử lý tái gắn kết thành công khi container mới xuất hiện trên DOM trong <= 500ms.
   */
  handleContainerReconnected(newContainer: HTMLElement): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const duration = this.lastDisconnectTime > 0 ? Date.now() - this.lastDisconnectTime : 0;
    this.isReconnecting = false;
    this.attachObserver(newContainer);
    this.scanExisting();

    logger.info(
      'SIDEBAR_OBSERVER',
      'N01',
      `[N01] Self-Healing: Tái gắn kết thành công với Sidebar container mới trong ${duration}ms.`,
    );

    void this.logWideEvent({
      operation: 'SELF_HEALING_RECONNECT',
      level: 'INFO',
      status: 'SUCCESS',
      durationMs: duration,
      groupId: 'SYSTEM',
      senderIdMasked: 'SYSTEM',
      message: `Tái gắn kết Self-Healing thành công với Sidebar container mới trong ${duration}ms`,
    });

    this.broadcastTelemetry();
  }

  /**
   * Lập lịch vòng lặp tái gắn kết Self-Healing định kỳ <= 500ms.
   */
  private scheduleSelfHealingReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const tryReconnect = () => {
      if (!this.isRunning) return;
      const found = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
      if (found) {
        this.handleContainerReconnected(found);
      } else {
        this.reconnectTimer = setTimeout(tryReconnect, this.reconnectCooldownMs);
      }
    };

    // Kiểm tra ngay lập tức xem đã có container mới chưa
    const immediateFound = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, this.doc);
    if (immediateFound) {
      this.handleContainerReconnected(immediateFound);
    } else {
      this.reconnectTimer = setTimeout(tryReconnect, Math.min(100, this.reconnectCooldownMs));
    }
  }

  /**
   * Kích hoạt MutationObserver trên document.body để phát hiện thay đổi cấu trúc DOM.
   */
  private startBodyObserver(): void {
    const root = this.doc?.body || this.doc?.documentElement;
    if (!root || typeof MutationObserver === 'undefined') return;

    if (this.bodyObserver) {
      this.bodyObserver.disconnect();
    }

    this.bodyObserver = new MutationObserver(() => {
      this.checkContainerHealth();
    });

    this.bodyObserver.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Kích hoạt kiểm tra sức khỏe container định kỳ (Health Check polling).
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(
      () => this.checkContainerHealth(),
      Math.min(200, this.reconnectCooldownMs),
    );
  }

  /**
   * Dừng kiểm tra sức khỏe và dọn dẹp body observer.
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.bodyObserver) {
      this.bodyObserver.disconnect();
      this.bodyObserver = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.drainedTimer) {
      clearTimeout(this.drainedTimer);
      this.drainedTimer = null;
    }
    this.isReconnecting = false;
  }

  /**
   * Gắn MutationObserver chính thức lên phần tử Sidebar Container.
   */
  private attachObserver(container: HTMLElement): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.container = container;

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
          this.broadcastTelemetry();
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
        this.isRunning = false;
        this.broadcastTelemetry();
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
   * 1. Ưu tiên tuyệt đối thuộc tính anim-data-id khi có mặt (tránh fallback nhầm vào img[data-ava-uid] khi gặp avatar ghép zavatar-multi).
   * 2. Fallback data-id bắt đầu bằng 'conv-'.
   * 3. Fallback tìm thẻ ảnh avatar img[data-ava-uid^="g"] lấy data-ava-uid.
   * 4. Fallback data-id khác div_TabMsg_ThrdChItem.
   */
  extractGroupId(itemElement: HTMLElement): string | null {
    const animDataId = itemElement.getAttribute('anim-data-id');
    if (animDataId) {
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
   * Khử trùng lặp lũy đẳng (Idempotent Enqueueing - GATE-N01-03):
   * Ghi nhận nhóm vào bảng Dexie `group_dispatch_queue`.
   * Nếu nhóm đã có bản ghi ở trạng thái PENDING hoặc PROCESSING:
   *   -> Cập nhật timestamp enqueuedAt (Zero duplicate record).
   * Nếu chưa có (hoặc bản ghi cũ đã COMPLETED / FAILED):
   *   -> Thêm bản ghi mới với trạng thái PENDING.
   */
  async enqueueGroup(groupId: string, _event?: GroupDetectedEvent): Promise<number | undefined> {
    try {
      const existing = await this.db.group_dispatch_queue
        .where('groupId')
        .equals(groupId)
        .and((item) => item.status === 'PENDING' || item.status === 'PROCESSING')
        .first();

      const now = Date.now();

      if (existing && existing.id !== undefined) {
        this.totalDedupSkipped++;
        await this.db.group_dispatch_queue.update(existing.id, {
          enqueuedAt: now,
        });
        logger.info(
          'SIDEBAR_OBSERVER',
          'N01',
          `[N01] Idempotent deduplication: Cập nhật enqueuedAt cho nhóm ${groupId} (id=${existing.id}, status=${existing.status})`,
          { groupId },
        );
        void this.logWideEvent({
          correlationId: _event?.correlationId || CorrelationContext.generate(),
          operation: 'ENQUEUE_DISPATCH',
          nodeId: 'N01_SIDEBAR_OBSERVER',
          level: 'INFO',
          status: 'SUCCESS',
          durationMs: 0,
          groupId,
          senderIdMasked: _event?.senderName || '***',
          message: `Idempotent deduplication: Cập nhật enqueuedAt cho nhóm ${groupId} (id=${existing.id}, status=${existing.status})`,
        });
        void this.syncQueueTelemetry();
        return existing.id;
      }

      this.totalEnqueued++;
      const newId = await this.db.group_dispatch_queue.add({
        groupId,
        status: 'PENDING',
        retryCount: 0,
        enqueuedAt: now,
      });

      logger.info(
        'SIDEBAR_OBSERVER',
        'N01',
        `[N01] Đã thêm nhóm vào group_dispatch_queue: ${groupId} (id=${newId})`,
        { groupId },
      );

      void this.logWideEvent({
        correlationId: _event?.correlationId || CorrelationContext.generate(),
        operation: 'ENQUEUE_DISPATCH',
        nodeId: 'N01_SIDEBAR_OBSERVER',
        level: 'INFO',
        status: 'SUCCESS',
        durationMs: 0,
        groupId,
        senderIdMasked: _event?.senderName || '***',
        message: `Đã thêm nhóm vào group_dispatch_queue: ${groupId} (id=${newId})`,
      });
      void this.syncQueueTelemetry();

      return newId;
    } catch (error) {
      logger.error(
        'SIDEBAR_OBSERVER',
        'N01',
        `[N01] Lỗi khi enqueueGroup vào Dexie: ${error instanceof Error ? error.message : String(error)}`,
        error,
        { groupId },
      );
      return undefined;
    }
  }

  /**
   * Bóc tách và xử lý logic cho một thẻ hội thoại (thỏa mãn T007 & T008 & T009 & T012).
   */
  private async processItemElement(itemElement: HTMLElement): Promise<void> {
    const groupId = this.extractGroupId(itemElement);
    if (!groupId) {
      return;
    }

    // Bóc tách đa tín hiệu (Multi-Signal Fusion)
    const badgeResult = extractUnreadBadge(itemElement);
    const hasUnreadClass =
      itemElement.querySelector('.z-conv-message.--unread') !== null ||
      itemElement.querySelector('.unread-red-dot') !== null ||
      itemElement.querySelector('.unread-badge') !== null ||
      itemElement.querySelector('.preview-time.--b') !== null ||
      itemElement.querySelector('.important-unread-icon-mention') !== null;
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

    void this.logWideEvent({
      correlationId: event.correlationId,
      operation: 'DETECT_MUTATION',
      nodeId: 'N01_SIDEBAR_OBSERVER',
      level: 'INFO',
      status: 'SUCCESS',
      durationMs: 0,
      groupId: event.groupId,
      senderIdMasked: event.senderName || '***',
      message: `Phát hiện tin nhắn mới trong nhóm Whitelist: ${event.groupId} (${event.groupName}) [unread=${event.unreadCount}]`,
    });

    // Khởi chạy Idempotent Enqueueing trước khi phát sự kiện callback (GATE-N01-03)
    const enqueuePromise = this.enqueueGroup(groupId, event);
    this.emitNewMessage(event);
    await enqueuePromise;
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
   * Quét và gom cụm các đột biến DOM trong danh sách hội thoại qua Debounce Buffer (GATE-N01-01).
   */
  private handleMutations(mutations: MutationRecord[]): void {
    let hasNewItems = false;
    for (const mutation of mutations) {
      const target = mutation.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') continue;

      const convItem = this.findSidebarItem(target);
      if (convItem) {
        this.pendingMutationQueue.add(convItem);
        hasNewItems = true;
      }
    }

    if (!hasNewItems && this.pendingMutationQueue.size === 0) {
      return;
    }

    const now = Date.now();
    if (this.firstDebounceMutationTime === null) {
      this.firstDebounceMutationTime = now;
    }

    const elapsed = now - this.firstDebounceMutationTime;
    if (elapsed >= this.maxDebounceBufferMs) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      this.scheduleFlushChunk();
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const remainingMaxTime = this.maxDebounceBufferMs - elapsed;
    const delay = Math.max(0, Math.min(this.debounceMs, remainingMaxTime));

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.scheduleFlushChunk();
    }, delay);
  }

  /**
   * Lập lịch xử lý lô thẻ hội thoại đã gom cụm qua requestAnimationFrame hoặc setTimeout fallback.
   */
  private scheduleFlushChunk(): void {
    this.firstDebounceMutationTime = null;
    if (this.pendingMutationQueue.size === 0) {
      return;
    }

    const items = Array.from(this.pendingMutationQueue);
    this.pendingMutationQueue.clear();
    this.totalDebouncedRuns++;

    const runChunk = () => {
      this.rafId = null;
      for (const item of items) {
        void this.processItemElement(item);
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      this.rafId = requestAnimationFrame(runChunk);
    } else {
      this.rafId = setTimeout(runChunk, 0);
    }
  }

  /**
   * Ép buộc xả toàn bộ hàng đợi đột biến đang chờ xử lý (phục vụ kiểm thử & dọn dẹp).
   */
  async flushPendingMutations(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function' && typeof this.rafId === 'number') {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId as ReturnType<typeof setTimeout>);
      }
      this.rafId = null;
    }
    this.firstDebounceMutationTime = null;

    if (this.pendingMutationQueue.size === 0) {
      return;
    }

    const items = Array.from(this.pendingMutationQueue);
    this.pendingMutationQueue.clear();
    this.totalDebouncedRuns++;

    for (const item of items) {
      await this.processItemElement(item);
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

  /**
   * Trả về danh sách Whitelist thô hiện tại trong observer.
   */
  getWhitelist(): (string | WhitelistGroupItem)[] {
    return [...this.rawWhitelist];
  }

  /**
   * Quét và khám phá các nhóm trên Sidebar dựa theo document hiện tại.
   */
  discoverGroups(): DiscoveredGroupItem[] {
    return discoverSidebarGroups(this.doc, this.rawWhitelist);
  }
}

/**
 * Quét toàn diện danh mục nhóm trên DOM Sidebar Zalo Web.
 * (GATE-N01-06 / T015)
 *
 * @param doc Document cần quét (mặc định global document)
 * @param currentWhitelist Danh sách Whitelist hiện tại để kiểm tra isInWhitelist
 * @returns DiscoveredGroupItem[]
 */
export function discoverSidebarGroups(
  doc?: Document,
  currentWhitelist?: (WhitelistGroupItem | string)[] | Set<string>,
): DiscoveredGroupItem[] {
  const targetDoc =
    doc || (typeof document !== 'undefined' ? document : (null as unknown as Document));
  if (!targetDoc) return [];

  const container = resolveElement(SELECTORS.SIDEBAR_CONVERSATIONS, targetDoc);
  if (!container) return [];

  const candidateElements = container.querySelectorAll<HTMLElement>(
    'div.msg-item[data-id="div_TabMsg_ThrdChItem"], [anim-data-id^="g"], [anim-data-id], .conv-item, .msg-item',
  );

  const discovered: DiscoveredGroupItem[] = [];
  const seenIds = new Set<string>();

  // Chuẩn bị lookup set & rules cho whitelist
  const whitelistIds = new Set<string>();
  const whitelistNames = new Set<string>();
  const structuredRules: WhitelistGroupItem[] = [];

  if (currentWhitelist) {
    if (currentWhitelist instanceof Set) {
      for (const id of currentWhitelist) {
        whitelistIds.add(id);
      }
    } else if (Array.isArray(currentWhitelist)) {
      for (const item of currentWhitelist) {
        if (typeof item === 'string') {
          whitelistIds.add(item);
          const norm = normalizeZaloText(item).toLowerCase();
          if (norm) whitelistNames.add(norm);
        } else if (item && typeof item === 'object') {
          structuredRules.push(item);
          if (item.groupId) whitelistIds.add(item.groupId);
          if (item.groupName) {
            const norm = normalizeZaloText(item.groupName).toLowerCase();
            if (norm) whitelistNames.add(norm);
          }
        }
      }
    }
  }

  const checkInWhitelist = (groupId: string, groupName: string): boolean => {
    if (groupId && whitelistIds.has(groupId)) return true;
    const norm = normalizeZaloText(groupName).toLowerCase();
    if (norm && whitelistNames.has(norm)) return true;
    for (const rule of structuredRules) {
      if (rule.isEnabled === false) continue;
      if (rule.groupId && rule.groupId === groupId) return true;
      if (
        groupName &&
        rule.groupName &&
        isGroupNameMatching(groupName, rule.groupName, rule.matchingRule)
      ) {
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < candidateElements.length; i++) {
    const rawEl = candidateElements[i];
    if (!rawEl) continue;

    // Tìm phần tử bao bọc msg-item gần nhất
    const item = rawEl.classList.contains('msg-item')
      ? rawEl
      : (rawEl.closest('.msg-item') as HTMLElement) || rawEl;

    // 1. Trích xuất groupId: Ưu tiên tuyệt đối anim-data-id
    const animId = item.getAttribute('anim-data-id');
    const dataId = item.getAttribute('data-id');
    const imgEl = item.querySelector<HTMLImageElement>('img[data-ava-uid]');
    const avatarUid = imgEl?.getAttribute('data-ava-uid') || '';
    const groupId =
      animId ||
      (dataId?.startsWith('conv-') ? dataId : null) ||
      (avatarUid.startsWith('g') ? avatarUid : null) ||
      (dataId && dataId !== 'div_TabMsg_ThrdChItem' ? dataId : null) ||
      avatarUid ||
      '';

    if (!groupId || seenIds.has(groupId)) continue;
    seenIds.add(groupId);

    // 2. Trích xuất groupName
    const nameEl =
      item.querySelector('div-b16.conv-item-title__name .truncate') ||
      item.querySelector('.conv-item-title__name .truncate') ||
      item.querySelector('.conv-item-title__name > div') ||
      item.querySelector('.conv-item-title__name');
    const rawName = nameEl?.textContent || '';
    const groupName = normalizeZaloText(rawName) || `Nhóm ${groupId}`;

    // 3. Avatar & Community indicator
    const avatarUrl = imgEl?.src || undefined;
    const isCommunity =
      item.querySelector('i.community__conv-indicator, i[class*="Community"]') !== null;

    // 4. Unread count & badge
    const badgeEl = item.querySelector('.conv-action__unread-v2 .z-noti-badge, .z-noti-badge');
    const badgeInfo = extractUnreadBadge(badgeEl);
    const unreadCount = badgeInfo.unreadCount;

    // 5. Last snippet
    const snippetEl =
      item.querySelector(SELECTORS.PREVIEW_MESSAGE.tier1_semantic) ||
      item.querySelector(SELECTORS.PREVIEW_MESSAGE.tier2_hierarchy) ||
      item.querySelector(SELECTORS.PREVIEW_MESSAGE.tier3_class);
    const lastSnippet = snippetEl?.textContent
      ? normalizeZaloText(snippetEl.textContent)
      : undefined;

    // 6. isInWhitelist
    const isInWhitelist = checkInWhitelist(groupId, groupName);

    discovered.push({
      groupId,
      groupName,
      avatarUrl,
      isCommunity,
      unreadCount,
      lastSnippet,
      isInWhitelist,
    });
  }

  return discovered;
}

/**
 * Cơ chế Hot-Sync Whitelist (GATE-N01-04 / T017):
 * Lưu trữ danh sách whitelist vào bảng Dexie `app_settings` (key: 'n01_whitelist_groups').
 * Nếu có truyền đối tượng observer, cập nhật ngay lập tức bộ nhớ RAM qua observer.updateWhitelist().
 */
export async function syncWhitelistSettings(
  groups: WhitelistGroupItem[],
  dbInstance: ZaloAutomationDatabase = defaultDb,
  observer?: SidebarObserver,
): Promise<void> {
  const now = Date.now();
  await dbInstance.app_settings.put({
    key: 'n01_whitelist_groups',
    value: { groups },
    updatedAt: now,
  });

  if (observer) {
    observer.updateWhitelist(groups);
  }
}

/**
 * Tải danh sách Whitelist từ Dexie app_settings.
 */
export async function loadWhitelistSettings(
  dbInstance: ZaloAutomationDatabase = defaultDb,
): Promise<WhitelistGroupItem[]> {
  const record =
    (await dbInstance.app_settings.get('n01_whitelist_groups')) ||
    (await dbInstance.app_settings.get('whitelist_groups'));
  if (record?.value) {
    const val = record.value as { groups?: WhitelistGroupItem[] };
    if (Array.isArray(val.groups) && val.groups.length > 0) {
      return val.groups;
    }
    if (
      Array.isArray(record.value) &&
      (record.value as unknown as WhitelistGroupItem[]).length > 0
    ) {
      return record.value as unknown as WhitelistGroupItem[];
    }
  }

  // Tự động chuyển đổi dữ liệu kế thừa (Auto-Migration) từ key 'config' nếu có
  const configRecord = await dbInstance.app_settings.get('config');
  const legacyVal = configRecord?.value as {
    whitelist?: Array<{
      groupId?: string | number;
      name?: string;
      groupName?: string;
      matchingRule?: 'EXACT' | 'CONTAINS';
      addedAt?: number;
    }>;
  };

  if (Array.isArray(legacyVal?.whitelist) && legacyVal.whitelist.length > 0) {
    const now = Date.now();
    const migrated: WhitelistGroupItem[] = [];
    for (const item of legacyVal.whitelist) {
      if (item && typeof item === 'object' && item.groupId != null) {
        migrated.push({
          groupId: String(item.groupId),
          groupName: item.groupName || item.name || `Nhóm ${item.groupId}`,
          matchingRule: item.matchingRule || 'EXACT',
          priority: 1,
          isEnabled: true,
          addedAt: item.addedAt || now,
          lastUpdatedAt: now,
        });
      }
    }

    if (migrated.length > 0) {
      await dbInstance.app_settings.put({
        key: 'n01_whitelist_groups',
        value: { groups: migrated },
        updatedAt: now,
      });
      return migrated;
    }
  }

  return [];
}
