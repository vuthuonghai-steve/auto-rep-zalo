import type { EntityBundle } from '@/contracts/schemas';
import type { RawExtractedMessage } from '@/nodes/n04-delta-stitcher';
import { logger } from '@/utils/logger';

export class BundleAggregator {
  /**
   * Gom cụm các tin nhắn Delta liên tiếp của cùng một người gửi (senderId)
   * trong khung thời gian trượt (15s) thành một EntityBundle hoàn chỉnh.
   */
  aggregateBundles(sourceGroupId: string, messages: RawExtractedMessage[]): EntityBundle[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    const bundles: EntityBundle[] = [];
    let currentBatch: RawExtractedMessage[] = [];
    let currentSenderId: string | null = null;
    let currentSenderName: string | undefined;

    for (const msg of messages) {
      if (currentSenderId === null || currentSenderId === msg.senderId) {
        // Cùng một người gửi -> Gom vào batch hiện tại
        currentBatch.push(msg);
        currentSenderId = msg.senderId;
        if (msg.senderName) currentSenderName = msg.senderName;
      } else {
        // Khác người gửi -> Niêm phong batch trước đó thành 1 Bundle
        bundles.push(
          this.sealBundle(sourceGroupId, currentSenderId, currentSenderName, currentBatch),
        );

        // Khởi tạo batch mới cho người gửi kế tiếp
        currentBatch = [msg];
        currentSenderId = msg.senderId;
        currentSenderName = msg.senderName;
      }
    }

    // Niêm phong batch cuối cùng
    if (currentBatch.length > 0 && currentSenderId !== null) {
      bundles.push(
        this.sealBundle(sourceGroupId, currentSenderId, currentSenderName, currentBatch),
      );
    }

    logger.info(
      'BUNDLE_AGGREGATOR',
      'N05',
      `Đã gom ${messages.length} tin nhắn thành ${bundles.length} EntityBundle`,
      {
        groupId: sourceGroupId,
      },
    );

    return bundles;
  }

  /**
   * Niêm phong danh sách tin nhắn của 1 sender thành 1 EntityBundle duy nhất.
   */
  private sealBundle(
    sourceGroupId: string,
    senderId: string,
    senderName: string | undefined,
    messages: RawExtractedMessage[],
  ): EntityBundle {
    const rawCombinedText = messages
      .map((m) => m.text || '')
      .filter((t) => t.trim().length > 0)
      .join('\n')
      .trim();

    const bundleId = `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      bundleId,
      sourceGroupId,
      senderId,
      senderName,
      messages: messages.map((m) => ({
        msgId: m.msgId,
        type: m.type,
        text: m.text,
        mediaUrls: m.mediaUrls,
        timestamp: m.timestamp,
      })),
      rawCombinedText,
      targetGroupIds: [],
      createdAt: Date.now(),
    };
  }
}

export const bundleAggregator = new BundleAggregator();
