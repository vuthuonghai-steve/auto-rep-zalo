import type { MessageEntity } from '@/contracts/schemas';
import { type ZaloAutomationDatabase, db as defaultDb } from './database';

const DEFAULT_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedBy?: 'ENTITY_KEY' | 'CONTENT_HASH';
  existingEntity?: MessageEntity;
}

export class DedupRepository {
  constructor(private db: ZaloAutomationDatabase = defaultDb) {}

  /**
   * Lưu thông tin gói tin đã xử lý vào bảng entities.
   */
  async saveEntity(entity: Omit<MessageEntity, 'id'>): Promise<number> {
    return await this.db.entities.add(entity);
  }

  /**
   * Kiểm tra trùng lặp 2 lớp trong thời hạn Rolling TTL (mặc định 30 ngày):
   * Lớp 1: Số điện thoại đã chuẩn hóa (entityKey).
   * Lớp 2: Mã băm SHA-256 nội dung tin (contentHash).
   */
  async isDuplicate(
    entityKey: string,
    contentHash: string,
    ttlDays = DEFAULT_TTL_DAYS,
  ): Promise<DuplicateCheckResult> {
    const threshold = Date.now() - ttlDays * MS_PER_DAY;

    // Lớp 1: Khớp theo entityKey trong 30 ngày
    if (entityKey && entityKey.trim() !== '') {
      const matchKey = await this.db.entities
        .where('entityKey')
        .equals(entityKey)
        .and((item) => item.createdAt >= threshold)
        .first();

      if (matchKey) {
        return {
          isDuplicate: true,
          matchedBy: 'ENTITY_KEY',
          existingEntity: matchKey,
        };
      }
    }

    // Lớp 2: Khớp theo contentHash trong 30 ngày
    if (contentHash && contentHash.trim() !== '') {
      const matchHash = await this.db.entities
        .where('contentHash')
        .equals(contentHash)
        .and((item) => item.createdAt >= threshold)
        .first();

      if (matchHash) {
        return {
          isDuplicate: true,
          matchedBy: 'CONTENT_HASH',
          existingEntity: matchHash,
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Xóa các bản ghi đã hết hạn TTL (vượt quá 30 ngày).
   */
  async cleanExpiredEntities(ttlDays = DEFAULT_TTL_DAYS): Promise<number> {
    const threshold = Date.now() - ttlDays * MS_PER_DAY;
    return await this.db.entities.where('createdAt').below(threshold).delete();
  }

  /**
   * Đếm tổng số lượng bản ghi trong bảng entities.
   */
  async count(): Promise<number> {
    return await this.db.entities.count();
  }
}

export const dedupRepo = new DedupRepository();
