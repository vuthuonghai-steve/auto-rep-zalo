import type { MessageItem } from '@/contracts/schemas';
import { SELECTORS, resolveElement } from '@/contracts/selectors';
import { type ZaloAutomationDatabase, db as defaultDb } from '@/db/database';
import { logger } from '@/utils/logger';

export interface RawExtractedMessage {
  msgId: string;
  senderId: string;
  senderName?: string | undefined;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'ALBUM';
  text?: string | undefined;
  mediaUrls?: string[] | undefined;
  timestamp: number;
}

export class DeltaStitcher {
  constructor(
    private db: ZaloAutomationDatabase = defaultDb,
    private doc: Document = typeof document !== 'undefined'
      ? document
      : (null as unknown as Document),
  ) {}

  /**
   * Quét các tin nhắn đáy trên DOM khung chat và đối chiếu với Checkpoint để lấy danh sách tin Delta mới.
   */
  async stitchDelta(groupId: string): Promise<RawExtractedMessage[]> {
    if (!this.doc) return [];

    const container = resolveElement(SELECTORS.CHAT_MESSAGE_CONTAINER, this.doc);
    if (!container) {
      logger.error(
        'DELTA_STITCHER',
        'N04',
        'Không tìm thấy container tin nhắn trên DOM',
        undefined,
        { groupId },
      );
      return [];
    }

    // 1. Trích xuất toàn bộ các tin nhắn hiện có trên DOM
    const allMessages = this.extractMessagesFromDom(container);
    if (allMessages.length === 0) {
      logger.warn('DELTA_STITCHER', 'N04', 'Không có tin nhắn nào được tìm thấy trên DOM', {
        groupId,
      });
      return [];
    }

    // 2. Tra cứu Checkpoint gần nhất trong Dexie
    const checkpoint = await this.db.group_checkpoints.get(groupId);

    if (checkpoint?.lastMessageId) {
      const matchIndex = allMessages.findIndex((m) => m.msgId === checkpoint.lastMessageId);

      if (matchIndex >= 0) {
        // Lấy toàn bộ các tin nhắn nằm SAU Checkpoint
        const deltaMessages = allMessages.slice(matchIndex + 1);
        logger.info(
          'DELTA_STITCHER',
          'N04',
          `Khớp Checkpoint [${checkpoint.lastMessageId}]: Thu được ${deltaMessages.length} tin mới`,
          { groupId },
        );
        return deltaMessages;
      }

      logger.warn(
        'DELTA_STITCHER',
        'N04',
        `Mất dấu Checkpoint [${checkpoint.lastMessageId}]: Áp dụng Fallback quét 10 tin đáy`,
        { groupId },
      );
    }

    // 3. Fallback: Quét tối đa 5-10 tin đáy nếu chưa có checkpoint hoặc mất dấu
    const fallbackMessages = allMessages.slice(-10);
    logger.info(
      'DELTA_STITCHER',
      'N04',
      `Khởi tạo lần đầu: Quét ${fallbackMessages.length} tin nhắn đáy`,
      {
        groupId,
      },
    );
    return fallbackMessages;
  }

  /**
   * Trích xuất cấu trúc dữ liệu từ các phần tử DOM tin nhắn Zalo.
   */
  extractMessagesFromDom(container: HTMLElement): RawExtractedMessage[] {
    const messageElements = container.querySelectorAll<HTMLElement>('.msg-group, [data-msg-id]');
    const results: RawExtractedMessage[] = [];

    for (const el of messageElements) {
      const msgId = el.getAttribute('data-msg-id') || el.id || `msg_${Date.now()}_${Math.random()}`;
      const senderId = el.getAttribute('data-sender-id') || 'sender_unknown';

      // Trích xuất tên người gửi
      const senderEl = el.querySelector('.msg-sender');
      const senderName = senderEl?.textContent?.split('-')[0]?.trim() || undefined;

      // Kiểm tra Album ảnh hoặc ảnh đơn
      const albumContainer = el.querySelector('.album-container');
      const albumItems = el.querySelectorAll('.album-item, img');
      const hasMedia = albumContainer !== null || albumItems.length > 0;

      const mediaUrls: string[] = Array.from(albumItems)
        .map((item) => {
          return (
            item.getAttribute('src') ||
            item.getAttribute('data-src') ||
            item.getAttribute('data-img-id') ||
            (item instanceof HTMLImageElement ? item.src : '') ||
            (item instanceof HTMLVideoElement ? item.src : '')
          );
        })
        .filter((url): url is string => Boolean(url) && url.length > 0);

      // Trích xuất văn bản mô tả
      let text = '';
      const textEl = el.querySelector('.msg-text, .album-caption');
      if (textEl?.textContent) {
        text = textEl.textContent.trim();
      } else {
        const cardEl = el.querySelector('.msg-card');
        if (cardEl?.textContent) {
          text = cardEl.textContent.trim();
        }
      }

      const type = albumItems.length > 1 ? 'ALBUM' : hasMedia ? 'IMAGE' : 'TEXT';

      results.push({
        msgId,
        senderId,
        senderName,
        type,
        text,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        timestamp: Date.now(),
      });
    }

    return results;
  }
}

export const deltaStitcher = new DeltaStitcher();
