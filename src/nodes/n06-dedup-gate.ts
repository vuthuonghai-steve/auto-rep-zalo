import type { EntityBundle } from '@/contracts/schemas';
import { type DedupRepository, dedupRepo as defaultDedupRepo } from '@/db/dedup-repo';
import { extractPhoneNumber } from '@/nodes/n07-price-router';
import { normalizeTextForHash, sha256 } from '@/utils/crypto-hash';
import { logger } from '@/utils/logger';

export interface DedupCheckResult {
  allowed: boolean;
  reason?: 'DUPLICATE_ENTITY_KEY' | 'DUPLICATE_CONTENT_HASH' | 'EMPTY_CONTENT';
  entityKey: string;
  contentHash: string;
}

export class DedupGate {
  constructor(private repo: DedupRepository = defaultDedupRepo) {}

  /**
   * Thẩm định cấu trúc và kiểm tra trùng lặp 2 lớp trong thời hạn 30 ngày:
   * Lớp 1: Số điện thoại đã giải mã lách luật (entityKey).
   * Lớp 2: Mã băm SHA-256 nội dung sau chuẩn hóa (contentHash).
   */
  async checkAndRegister(bundle: EntityBundle, saveIfAllowed = true): Promise<DedupCheckResult> {
    const rawText = bundle.rawCombinedText?.trim() || '';
    if (!rawText && (!bundle.messages || bundle.messages.length === 0)) {
      return {
        allowed: false,
        reason: 'EMPTY_CONTENT',
        entityKey: '',
        contentHash: '',
      };
    }

    // 1. Trích xuất số điện thoại (Lớp 1: entityKey)
    const entityKey = extractPhoneNumber(rawText) || '';

    // 2. Tính mã băm nội dung chuẩn hóa (Lớp 2: contentHash)
    const normalized = normalizeTextForHash(rawText);
    const contentHash = await sha256(normalized);

    // 3. Kiểm tra trùng lặp trong IndexedDB trong 30 ngày
    const duplicateCheck = await this.repo.isDuplicate(entityKey, contentHash, 30);

    if (duplicateCheck.isDuplicate) {
      const reason =
        duplicateCheck.matchedBy === 'ENTITY_KEY'
          ? 'DUPLICATE_ENTITY_KEY'
          : 'DUPLICATE_CONTENT_HASH';

      logger.warn(
        'DEDUP_GATE',
        'N06',
        `Tin trùng lặp bị từ chối (${reason}): SĐT=${entityKey || 'N/A'}, Hash=${contentHash.substring(0, 8)}...`,
        {
          groupId: bundle.sourceGroupId,
          phone: entityKey || undefined,
        },
      );

      return {
        allowed: false,
        reason,
        entityKey,
        contentHash,
      };
    }

    // 4. Nếu hợp lệ, lưu vào cơ sở dữ liệu để bảo vệ chống trùng cho các tin sau
    if (saveIfAllowed) {
      await this.repo.saveEntity({
        entityKey,
        contentHash,
        rawText,
        sourceGroupId: bundle.sourceGroupId,
        targetGroupIds: bundle.targetGroupIds || [],
        createdAt: Date.now(),
      });
    }

    logger.info(
      'DEDUP_GATE',
      'N06',
      `Tin hợp lệ không trùng lặp: SĐT=${entityKey || 'N/A'}, Hash=${contentHash.substring(0, 8)}...`,
      {
        groupId: bundle.sourceGroupId,
        phone: entityKey || undefined,
      },
    );

    return {
      allowed: true,
      entityKey,
      contentHash,
    };
  }
}

export const dedupGate = new DedupGate();
