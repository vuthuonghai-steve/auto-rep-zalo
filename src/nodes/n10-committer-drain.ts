import type { EntityBundle } from '@/contracts/schemas';
import { type ZaloAutomationDatabase, db as defaultDb } from '@/db/database';
import { type QueueRepository, queueRepo as defaultQueueRepo } from '@/db/queue-repo';
import { logger } from '@/utils/logger';

export class CommitterDrain {
  constructor(
    private db: ZaloAutomationDatabase = defaultDb,
    private queue: QueueRepository = defaultQueueRepo,
  ) {}

  /**
   * Node 10: Chờ đệm tĩnh lặng (Inactivity Quiescence), ghi nhận Checkpoint vào Dexie,
   * hoàn tất tác vụ trong hàng chờ và phát ra Canonical Log Line tổng kết chu trình.
   */
  async commitAndDrain(
    sourceGroupId: string,
    bundle: EntityBundle,
    quiescenceBufferMs = 10000,
    startTime?: number,
  ): Promise<boolean> {
    // 1. Chờ đệm tĩnh lặng để lắng nghe tin bổ sung từ cùng sender
    if (quiescenceBufferMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, quiescenceBufferMs));
    }

    // 2. Chốt điểm nối Checkpoint mới nhất vào Dexie group_checkpoints
    const lastMsg = bundle.messages[bundle.messages.length - 1];
    const lastMessageId = lastMsg?.msgId || `msg_${Date.now()}`;

    await this.db.group_checkpoints.put({
      groupId: sourceGroupId,
      lastMessageId,
      lastSenderId: bundle.senderId,
      updatedAt: Date.now(),
    });

    // 3. Cập nhật trạng thái hoàn thành trong hàng chờ
    const activeItem = await this.db.group_dispatch_queue
      .where('groupId')
      .equals(sourceGroupId)
      .and((item) => item.status === 'PROCESSING')
      .first();

    if (activeItem?.id !== undefined) {
      await this.queue.markCompleted(activeItem.id);
    }

    // 4. Phát Canonical Log Line tổng kết toàn chu trình TWO_PHASE_FORWARD
    const durationMs = startTime ? Date.now() - startTime : 0;
    await logger.info(
      'TWO_PHASE_FORWARD',
      'N10',
      `Hoàn tất chu trình chuyển tiếp 2 pha: Checkpoint [${lastMessageId}]`,
      {
        groupId: sourceGroupId,
        phone: bundle.extractedPhone,
        durationMs,
      },
    );

    return true;
  }
}

export const committerDrain = new CommitterDrain();
