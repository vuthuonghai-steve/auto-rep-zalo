import { ZaloAutomationDatabase } from '@/db/database';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ZaloAutomationDatabase (Unit Tests with fake-indexeddb)', () => {
  let testDb: ZaloAutomationDatabase;

  beforeEach(async () => {
    testDb = new ZaloAutomationDatabase(`test_db_${Date.now()}_${Math.random()}`);
    await testDb.open();
  });

  it('should initialize all 5 tables successfully', () => {
    expect(testDb.app_settings).toBeDefined();
    expect(testDb.group_checkpoints).toBeDefined();
    expect(testDb.group_dispatch_queue).toBeDefined();
    expect(testDb.entities).toBeDefined();
    expect(testDb.system_logs).toBeDefined();
  });

  it('should insert and retrieve app_settings', async () => {
    await testDb.app_settings.put({
      key: 'whitelist',
      value: { groupIds: ['g1', 'g2'] },
      updatedAt: Date.now(),
    });

    const setting = await testDb.app_settings.get('whitelist');
    expect(setting).toBeDefined();
    expect(setting?.value).toEqual({ groupIds: ['g1', 'g2'] });
  });

  it('should insert and update group_checkpoints', async () => {
    await testDb.group_checkpoints.put({
      groupId: 'g_123',
      lastMessageId: 'msg_001',
      lastSenderId: 'user_456',
      updatedAt: Date.now(),
    });

    const checkpoint = await testDb.group_checkpoints.get('g_123');
    expect(checkpoint?.lastMessageId).toBe('msg_001');

    await testDb.group_checkpoints.update('g_123', {
      lastMessageId: 'msg_002',
      updatedAt: Date.now(),
    });

    const updated = await testDb.group_checkpoints.get('g_123');
    expect(updated?.lastMessageId).toBe('msg_002');
  });

  it('should manage group_dispatch_queue records with auto-increment ID', async () => {
    const id1 = await testDb.group_dispatch_queue.add({
      groupId: 'g_source_1',
      status: 'PENDING',
      retryCount: 0,
      enqueuedAt: Date.now(),
    });

    expect(id1).toBeGreaterThan(0);

    const item = await testDb.group_dispatch_queue.get(id1);
    expect(item?.status).toBe('PENDING');
    expect(item?.groupId).toBe('g_source_1');
  });

  it('should store and query message entities', async () => {
    const id = await testDb.entities.add({
      entityKey: '0901234567',
      contentHash: 'hash_abc123',
      rawText: 'Bán nhà Cầu Giấy 3.5 tỷ',
      sourceGroupId: 'g_source_1',
      targetGroupIds: ['g_target_1'],
      createdAt: Date.now(),
    });

    const entity = await testDb.entities.get(id);
    expect(entity?.entityKey).toBe('0901234567');
    expect(entity?.contentHash).toBe('hash_abc123');
  });

  it('should insert system_logs conforming to Canonical Log format', async () => {
    const logId = await testDb.system_logs.add({
      correlationId: 'corr_test_1',
      operation: 'QUEUE_DISPATCH',
      nodeId: 'N02',
      level: 'INFO',
      status: 'SUCCESS',
      durationMs: 120,
      groupId: 'g_source_1',
      senderIdMasked: 'u_***89',
      phoneMasked: '090****567',
      message: 'Dispatch completed successfully',
      timestamp: Date.now(),
    });

    const log = await testDb.system_logs.get(logId);
    expect(log?.operation).toBe('QUEUE_DISPATCH');
    expect(log?.phoneMasked).toBe('090****567');
  });
});
