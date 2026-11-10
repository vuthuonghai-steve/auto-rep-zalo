import { ZaloAutomationDatabase } from '@/db/database';
import { QueueRepository } from '@/db/queue-repo';
import { beforeEach, describe, expect, it } from 'vitest';

describe('QueueRepository (Integration Tests)', () => {
  let testDb: ZaloAutomationDatabase;
  let repo: QueueRepository;

  beforeEach(async () => {
    testDb = new ZaloAutomationDatabase(`queue_test_${Date.now()}_${Math.random()}`);
    await testDb.open();
    repo = new QueueRepository(testDb);
  });

  it('should enqueue items and maintain FIFO ordering', async () => {
    const id1 = await repo.enqueue('group_A');
    await new Promise((r) => setTimeout(r, 10));
    const id2 = await repo.enqueue('group_B');

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();

    const next = await repo.peekNext();
    expect(next?.groupId).toBe('group_A');
    expect(next?.id).toBe(id1);
  });

  it('should prevent duplicate enqueue for groups already PENDING or PROCESSING', async () => {
    const firstId = await repo.enqueue('group_duplicate');
    expect(firstId).not.toBeNull();

    const secondId = await repo.enqueue('group_duplicate');
    expect(secondId).toBeNull();

    const count = await repo.getPendingCount();
    expect(count).toBe(1);
  });

  it('should transition status from PENDING to PROCESSING with acquireLock', async () => {
    const id = (await repo.enqueue('group_lock')) as number;
    const locked = await repo.acquireLock(id);
    expect(locked).toBe(true);

    // Cannot lock again if already PROCESSING
    const lockedAgain = await repo.acquireLock(id);
    expect(lockedAgain).toBe(false);

    // peekNext will ignore PROCESSING items
    const next = await repo.peekNext();
    expect(next).toBeUndefined();
  });

  it('should handle failure retry mechanism', async () => {
    const id = (await repo.enqueue('group_retry')) as number;
    await repo.acquireLock(id);

    // Attempt 1 -> RETRYING
    const res1 = await repo.markFailed(id, 2);
    expect(res1).toBe('RETRYING');

    const item1 = await testDb.group_dispatch_queue.get(id);
    expect(item1?.status).toBe('PENDING');
    expect(item1?.retryCount).toBe(1);

    // Attempt 2 -> FAILED
    await repo.acquireLock(id);
    const res2 = await repo.markFailed(id, 2);
    expect(res2).toBe('FAILED');

    const item2 = await testDb.group_dispatch_queue.get(id);
    expect(item2?.status).toBe('FAILED');
    expect(item2?.retryCount).toBe(2);
  });

  it('should reset stale PROCESSING items back to PENDING after F5/crash', async () => {
    const id1 = (await repo.enqueue('group_stale_1')) as number;
    const id2 = (await repo.enqueue('group_stale_2')) as number;

    await repo.acquireLock(id1);
    await repo.acquireLock(id2);

    expect(await repo.getPendingCount()).toBe(0);

    const resetCount = await repo.resetStaleProcessing();
    expect(resetCount).toBe(2);

    expect(await repo.getPendingCount()).toBe(2);
    const peek = await repo.peekNext();
    expect(peek?.status).toBe('PENDING');
  });

  it('should mark items COMPLETED and allow clearing queue', async () => {
    const id = (await repo.enqueue('group_done')) as number;
    await repo.acquireLock(id);
    await repo.markCompleted(id);

    const item = await testDb.group_dispatch_queue.get(id);
    expect(item?.status).toBe('COMPLETED');

    await repo.clearQueue();
    const items = await repo.getAllItems();
    expect(items.length).toBe(0);
  });
});
