import type { DispatchQueueItem } from '@/contracts/schemas';
import { type ZaloAutomationDatabase, db as defaultDb } from './database';

export class QueueRepository {
  constructor(private db: ZaloAutomationDatabase = defaultDb) {}

  /**
   * Đưa một nhóm vào hàng chờ FIFO.
   * Nếu nhóm đang có trạng thái PENDING hoặc PROCESSING, bỏ qua để tránh trùng lặp.
   */
  async enqueue(groupId: string): Promise<number | null> {
    const existing = await this.db.group_dispatch_queue
      .where('groupId')
      .equals(groupId)
      .and((item) => item.status === 'PENDING' || item.status === 'PROCESSING')
      .first();

    if (existing) {
      return null;
    }

    const id = await this.db.group_dispatch_queue.add({
      groupId,
      status: 'PENDING',
      retryCount: 0,
      enqueuedAt: Date.now(),
    });

    return id;
  }

  /**
   * Lấy tác vụ PENDING cũ nhất (FIFO).
   */
  async peekNext(): Promise<DispatchQueueItem | undefined> {
    return await this.db.group_dispatch_queue
      .where('status')
      .equals('PENDING')
      .sortBy('enqueuedAt')
      .then((items) => items[0]);
  }

  /**
   * Chiếm quyền khóa đơn luồng (Single Mutex Lock), chuyển trạng thái sang PROCESSING.
   */
  async acquireLock(id: number): Promise<boolean> {
    const item = await this.db.group_dispatch_queue.get(id);
    if (!item || item.status !== 'PENDING') {
      return false;
    }

    await this.db.group_dispatch_queue.update(id, {
      status: 'PROCESSING',
    });
    return true;
  }

  /**
   * Đánh dấu tác vụ hoàn thành (COMPLETED).
   */
  async markCompleted(id: number): Promise<void> {
    await this.db.group_dispatch_queue.update(id, {
      status: 'COMPLETED',
    });
  }

  /**
   * Đánh dấu tác vụ thất bại (FAILED) hoặc chuyển về PENDING nếu chưa vượt quá số lần thử lại.
   */
  async markFailed(id: number, maxRetries = 3): Promise<'FAILED' | 'RETRYING'> {
    const item = await this.db.group_dispatch_queue.get(id);
    if (!item) {
      return 'FAILED';
    }

    const nextRetry = item.retryCount + 1;
    if (nextRetry >= maxRetries) {
      await this.db.group_dispatch_queue.update(id, {
        status: 'FAILED',
        retryCount: nextRetry,
      });
      return 'FAILED';
    }

    await this.db.group_dispatch_queue.update(id, {
      status: 'PENDING',
      retryCount: nextRetry,
    });
    return 'RETRYING';
  }

  /**
   * Phục hồi sau F5 hoặc tải lại extension:
   * Chuyển toàn bộ các tác vụ đang treo ở trạng thái PROCESSING về PENDING.
   */
  async resetStaleProcessing(): Promise<number> {
    const staleItems = await this.db.group_dispatch_queue
      .where('status')
      .equals('PROCESSING')
      .toArray();

    for (const item of staleItems) {
      if (item.id !== undefined) {
        await this.db.group_dispatch_queue.update(item.id, {
          status: 'PENDING',
        });
      }
    }

    return staleItems.length;
  }

  /**
   * Đếm số lượng tác vụ đang chờ xử lý.
   */
  async getPendingCount(): Promise<number> {
    return await this.db.group_dispatch_queue.where('status').equals('PENDING').count();
  }

  /**
   * Xóa toàn bộ hàng chờ.
   */
  async clearQueue(): Promise<void> {
    await this.db.group_dispatch_queue.clear();
  }

  /**
   * Lấy toàn bộ hàng chờ.
   */
  async getAllItems(): Promise<DispatchQueueItem[]> {
    return await this.db.group_dispatch_queue.toArray();
  }
}

export const queueRepo = new QueueRepository();
