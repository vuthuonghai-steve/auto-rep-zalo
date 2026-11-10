import { ZaloAutomationDatabase } from '@/db/database';
import { LogRepository } from '@/db/log-repo';
import { beforeEach, describe, expect, it } from 'vitest';

describe('LogRepository (Integration Tests)', () => {
  let testDb: ZaloAutomationDatabase;
  let repo: LogRepository;

  beforeEach(async () => {
    testDb = new ZaloAutomationDatabase(`log_test_${Date.now()}_${Math.random()}`);
    await testDb.open();
    repo = new LogRepository(testDb);
  });

  it('should add log and retrieve recent logs in descending order', async () => {
    const id1 = await repo.addLog({
      correlationId: 'corr_1',
      operation: 'QUEUE_DISPATCH',
      nodeId: 'N01',
      level: 'INFO',
      status: 'SUCCESS',
      durationMs: 50,
      groupId: 'g_1',
      senderIdMasked: 'u_1',
      message: 'First log',
      timestamp: Date.now() - 1000,
    });

    const id2 = await repo.addLog({
      correlationId: 'corr_2',
      operation: 'TWO_PHASE_FORWARD',
      nodeId: 'N08',
      level: 'INFO',
      status: 'SUCCESS',
      durationMs: 1500,
      groupId: 'g_2',
      senderIdMasked: 'u_2',
      message: 'Second log',
      timestamp: Date.now(),
    });

    expect(id1).toBeGreaterThan(0);
    expect(id2).toBeGreaterThan(id1);

    const recent = await repo.getRecentLogs(2);
    expect(recent.length).toBe(2);
    expect(recent[0]?.correlationId).toBe('corr_2');
    expect(recent[1]?.correlationId).toBe('corr_1');
  });

  it('should clean logs older than retention period (7 days)', async () => {
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;

    await testDb.system_logs.add({
      correlationId: 'corr_old',
      operation: 'OLD_OP',
      nodeId: 'N01',
      level: 'WARN',
      status: 'DEGRADED',
      durationMs: 10,
      groupId: 'g_old',
      senderIdMasked: 'u_old',
      message: 'Old log 10 days ago',
      timestamp: tenDaysAgo,
    });

    await testDb.system_logs.add({
      correlationId: 'corr_new',
      operation: 'NEW_OP',
      nodeId: 'N02',
      level: 'INFO',
      status: 'SUCCESS',
      durationMs: 20,
      groupId: 'g_new',
      senderIdMasked: 'u_new',
      message: 'New log 2 days ago',
      timestamp: twoDaysAgo,
    });

    expect(await repo.count()).toBe(2);

    const deleted = await repo.cleanLogsOlderThan(7);
    expect(deleted).toBe(1);
    expect(await repo.count()).toBe(1);

    const remaining = await repo.getRecentLogs();
    expect(remaining[0]?.correlationId).toBe('corr_new');
  });

  it('should export logs of the last 7 days to structured JSON', async () => {
    await repo.addLog({
      correlationId: 'corr_export_test',
      operation: 'TWO_PHASE_FORWARD',
      nodeId: 'N10',
      level: 'INFO',
      status: 'SUCCESS',
      durationMs: 2200,
      groupId: 'g_export',
      senderIdMasked: 'u_exp',
      phoneMasked: '090****567',
      message: 'Forward completed',
      timestamp: Date.now(),
    });

    const jsonStr = await repo.exportLogsToJson(7, '1.2.3');
    expect(typeof jsonStr).toBe('string');

    const parsed = JSON.parse(jsonStr);
    expect(parsed.extensionVersion).toBe('1.2.3');
    expect(parsed.totalLogs).toBe(1);
    expect(parsed.logs[0].correlationId).toBe('corr_export_test');
    expect(parsed.logs[0].phoneMasked).toBe('090****567');
  });
});
