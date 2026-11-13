import { SelectorHealthChecker } from '@/contracts/selectors';
import { type QueueRepository, queueRepo as defaultQueueRepo } from '@/db/queue-repo';
import { CorrelationContext } from '@/utils/correlation';
import { logger } from '@/utils/logger';
import { type CircuitBreaker, circuitBreaker as defaultCircuitBreaker } from '@/utils/pacing-guard';

export type GroupWorkerFunction = (groupId: string, correlationId: string) => Promise<void>;
export type QueueStateListener = (isProcessing: boolean, pendingCount: number) => void;

export class QueueManager {
  private isProcessing = false;
  private worker: GroupWorkerFunction | null = null;
  private stateListeners: Set<QueueStateListener> = new Set();

  constructor(
    private repo: QueueRepository = defaultQueueRepo,
    private cb: CircuitBreaker = defaultCircuitBreaker,
  ) {}

  onStateChange(listener: QueueStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Khởi tạo QueueManager: Phục hồi trạng thái Stale PROCESSING sau F5 và cập nhật số lượng hàng chờ.
   */
  async initialize(): Promise<number> {
    const recovered = await this.repo.resetStaleProcessing();
    await this.notifyListeners();

    if (recovered > 0) {
      logger.info(
        'QUEUE_DISPATCH',
        'N02',
        `Khôi phục ${recovered} tác vụ bị treo do F5/Reload sang PENDING`,
      );
    }

    // Tự động kích hoạt chu trình tiếp theo nếu có tác vụ tồn đọng
    this.triggerNext().catch(() => {});
    return recovered;
  }

  /**
   * Đăng ký worker handler để xử lý nhóm chat nguồn (chuỗi từ Node 3 đến Node 10).
   */
  setWorker(worker: GroupWorkerFunction): void {
    this.worker = worker;
  }

  /**
   * Đưa nhóm nguồn vào hàng chờ FIFO.
   */
  async enqueue(groupId: string, correlationId?: string): Promise<boolean> {
    const id = await this.repo.enqueue(groupId);
    await this.notifyListeners();

    if (id !== null) {
      logger.info(
        'QUEUE_DISPATCH',
        'N02',
        `Đã thêm nhóm vào hàng chờ FIFO: ${groupId}${correlationId ? ` (Corr: ${correlationId})` : ''}`,
        {
          groupId,
        },
      );
      this.triggerNext().catch(() => {});
      return true;
    }

    return false;
  }

  /**
   * Xử lý khi phát hiện Captcha: chuyển Circuit Breaker sang PAUSED_BY_CAPTCHA và phát cảnh báo
   */
  handleCaptchaDetected(reason = 'Zalo yêu cầu xác minh bảo mật / Captcha'): void {
    this.cb.tripCaptcha(reason);
    logger.warn('CIRCUIT_BREAKER', 'N02', `Tự động tạm dừng hàng chờ: ${reason}`);

    try {
      if (typeof chrome !== 'undefined' && chrome.notifications?.create) {
        chrome.notifications.create('zalo-captcha-alert', {
          type: 'basic',
          iconUrl: '/icon/128.png',
          title: 'Zalo Automation - Cần Can Thiệp Thủ Công',
          message:
            'Phát hiện yêu cầu xác minh Captcha. Vui lòng giải Captcha trên Zalo Web để tiếp tục.',
          priority: 2,
        });
      }
    } catch {
      // Bỏ qua lỗi notifications
    }
  }

  /**
   * Bộ điều phối Single Mutex Lock:
   * Đảm bảo chỉ DUY NHẤT 1 tác vụ được thực thi tại một thời điểm.
   */
  async triggerNext(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    // Kiểm tra nhanh sự xuất hiện của Captcha modal trên DOM (nếu có window/document)
    if (typeof document !== 'undefined' && SelectorHealthChecker.isCaptchaPresent(document)) {
      this.handleCaptchaDetected();
      return;
    }

    if (this.cb.isBlocked()) {
      logger.warn(
        'QUEUE_DISPATCH',
        'N02',
        `Hàng chờ tạm dừng do CircuitBreaker: ${this.cb.getState()}`,
      );
      return;
    }

    const nextItem = await this.repo.peekNext();
    if (!nextItem || nextItem.id === undefined) {
      await this.notifyListeners();
      return;
    }

    const locked = await this.repo.acquireLock(nextItem.id);
    if (!locked) {
      return;
    }

    this.isProcessing = true;
    await this.notifyListeners();
    const correlationId = CorrelationContext.generate();
    const startTime = Date.now();

    await CorrelationContext.runWith(correlationId, async () => {
      try {
        logger.info('QUEUE_DISPATCH', 'N02', `Bắt đầu xử lý nhóm: ${nextItem.groupId}`, {
          groupId: nextItem.groupId,
        });

        if (this.worker) {
          await this.worker(nextItem.groupId, correlationId);
        }

        if (nextItem.id !== undefined) {
          await this.repo.markCompleted(nextItem.id);
        }

        const durationMs = Date.now() - startTime;
        logger.info('QUEUE_DISPATCH', 'N02', `Hoàn thành xử lý nhóm: ${nextItem.groupId}`, {
          groupId: nextItem.groupId,
          durationMs,
          status: 'SUCCESS',
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;
        logger.error('QUEUE_DISPATCH', 'N02', `Xử lý nhóm thất bại: ${nextItem.groupId}`, error, {
          groupId: nextItem.groupId,
          durationMs,
        });

        if (nextItem.id !== undefined) {
          await this.repo.markFailed(nextItem.id);
        }
      } finally {
        this.isProcessing = false;
        await this.notifyListeners();

        // Kích hoạt tác vụ tiếp theo trong hàng chờ
        this.triggerNext().catch(() => {});
      }
    });
  }

  isBusy(): boolean {
    return this.isProcessing;
  }

  private async notifyListeners(): Promise<void> {
    try {
      const count = await this.repo.getPendingCount();
      for (const listener of this.stateListeners) {
        try {
          listener(this.isProcessing, count);
        } catch {
          // Bỏ qua lỗi trong listener
        }
      }
    } catch {
      // Bỏ qua lỗi truy vấn count
    }
  }
}

export const queueManager = new QueueManager();
