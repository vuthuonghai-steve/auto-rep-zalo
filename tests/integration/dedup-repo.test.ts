import { ZaloAutomationDatabase } from '@/db/database';
import { DedupRepository } from '@/db/dedup-repo';
import { beforeEach, describe, expect, it } from 'vitest';

describe('DedupRepository (Integration Tests)', () => {
  let testDb: ZaloAutomationDatabase;
  let repo: DedupRepository;

  beforeEach(async () => {
    testDb = new ZaloAutomationDatabase(`dedup_test_${Date.now()}_${Math.random()}`);
    await testDb.open();
    repo = new DedupRepository(testDb);
  });

  it('should return isDuplicate: false for completely new messages', async () => {
    const result = await repo.isDuplicate('0901112233', 'hash_new_unique_1');
    expect(result.isDuplicate).toBe(false);
  });

  it('should detect duplicate by Layer 1: entityKey (Phone Number) within 30 days', async () => {
    await repo.saveEntity({
      entityKey: '0901234567',
      contentHash: 'hash_original',
      rawText: 'Nhà bán Cầu Giấy',
      sourceGroupId: 'g_source',
      targetGroupIds: ['g_target'],
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
    });

    const check = await repo.isDuplicate('0901234567', 'hash_different_content');
    expect(check.isDuplicate).toBe(true);
    expect(check.matchedBy).toBe('ENTITY_KEY');
    expect(check.existingEntity?.entityKey).toBe('0901234567');
  });

  it('should detect duplicate by Layer 2: contentHash within 30 days', async () => {
    await repo.saveEntity({
      entityKey: '0988776655',
      contentHash: 'hash_identical_text',
      rawText: 'Đất nền Hòa Lạc 1.2 tỷ',
      sourceGroupId: 'g_source',
      targetGroupIds: ['g_target'],
      createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
    });

    const check = await repo.isDuplicate('0911223344', 'hash_identical_text');
    expect(check.isDuplicate).toBe(true);
    expect(check.matchedBy).toBe('CONTENT_HASH');
  });

  it('should ignore expired entities (> 30 days) and allow duplicate check to pass', async () => {
    const fortyDaysAgo = Date.now() - 40 * 24 * 60 * 60 * 1000;
    await repo.saveEntity({
      entityKey: '0909998888',
      contentHash: 'hash_old_expired',
      rawText: 'Tin cũ 40 ngày trước',
      sourceGroupId: 'g_source',
      targetGroupIds: ['g_target'],
      createdAt: fortyDaysAgo,
    });

    // Check with default 30 days TTL -> should not be treated as duplicate
    const check = await repo.isDuplicate('0909998888', 'hash_old_expired');
    expect(check.isDuplicate).toBe(false);
  });

  it('should clean expired entities properly', async () => {
    const fortyDaysAgo = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

    await repo.saveEntity({
      entityKey: '0901111111',
      contentHash: 'hash_1',
      rawText: 'Tin cũ',
      sourceGroupId: 'g_1',
      targetGroupIds: [],
      createdAt: fortyDaysAgo,
    });

    await repo.saveEntity({
      entityKey: '0902222222',
      contentHash: 'hash_2',
      rawText: 'Tin mới',
      sourceGroupId: 'g_1',
      targetGroupIds: [],
      createdAt: tenDaysAgo,
    });

    expect(await repo.count()).toBe(2);

    const deleted = await repo.cleanExpiredEntities(30);
    expect(deleted).toBe(1);
    expect(await repo.count()).toBe(1);
  });
});
