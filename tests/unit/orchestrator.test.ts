import fs from 'node:fs';
import path from 'node:path';
import { db } from '@/db/database';
import { queueManager } from '@/nodes/n02-queue-manager';
import { ZaloAutomationOrchestrator } from '@/orchestrator';
import { circuitBreaker } from '@/utils/pacing-guard';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Phase 7: Full Orchestrator & Cross-Cutting Polish (Unit Tests)', () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

  beforeEach(async () => {
    circuitBreaker.resume();
    await db.group_dispatch_queue.clear();
    await db.group_checkpoints.clear();
    await db.entities.clear();
    await db.system_logs.clear();

    await db.app_settings.put({
      key: 'config',
      value: {
        whitelist_groups: ['conv-group-source-1'],
        price_routes: [
          {
            id: 'rule-under-2b',
            minPrice: 0,
            maxPrice: 2,
            targetGroupIds: ['conv-target-under-2b'],
          },
          {
            id: 'rule-2b-5b',
            minPrice: 2,
            maxPrice: 5,
            targetGroupIds: ['conv-target-2b-5b'],
          },
        ],
      },
      updatedAt: Date.now(),
    });

    document.body.innerHTML = fixtureHtml;
  });

  it('should manage orchestrator lifecycle (start, isStarted, stop)', async () => {
    const orch = new ZaloAutomationOrchestrator();
    expect(orch.isStarted()).toBe(false);

    await orch.start();
    expect(orch.isStarted()).toBe(true);

    orch.stop();
    expect(orch.isStarted()).toBe(false);
  });

  it('should trip CircuitBreaker and pause queue when Captcha is detected', async () => {
    // 1. Kiểm tra trạng thái bình thường
    expect(circuitBreaker.getState()).toBe('NORMAL');

    // 2. Kích hoạt xử lý Captcha
    queueManager.handleCaptchaDetected('Mô phỏng phát hiện Captcha từ DOM');

    // 3. Xác minh CircuitBreaker chuyển sang PAUSED_BY_CAPTCHA
    expect(circuitBreaker.getState()).toBe('PAUSED_BY_CAPTCHA');
    expect(circuitBreaker.isBlocked()).toBe(true);

    // 4. Thử đưa nhóm vào hàng chờ, triggerNext phải dừng lại không xử lý
    let workerCalled = false;
    queueManager.setWorker(async () => {
      workerCalled = true;
    });

    await queueManager.enqueue('conv-group-source-1');
    await queueManager.triggerNext();

    expect(workerCalled).toBe(false);

    // 5. Khôi phục CircuitBreaker
    circuitBreaker.resume();
    expect(circuitBreaker.isBlocked()).toBe(false);
  });

  it('should process complete 10-node cycle for whitelisted group via Orchestrator', async () => {
    const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });

    // Thực thi xử lý nhóm conv-group-source-1
    await orch.processGroup('conv-group-source-1', 'test_corr_id_001');

    // Xác minh Checkpoint đã được ghi nhận vào Dexie
    const cp = await db.group_checkpoints.get('conv-group-source-1');
    expect(cp).toBeDefined();
    expect(cp?.lastMessageId).toBe('msg-002');

    // Xác minh tin nhắn đã được lưu vào entities (khử trùng lặp)
    const savedEntities = await db.entities.toArray();
    expect(savedEntities.length).toBeGreaterThan(0);

    // Xác minh log hoàn thành chu trình được ghi nhận
    const logs = await db.system_logs.toArray();
    const forwardLogs = logs.filter(
      (l) => l.operation === 'TWO_PHASE_FORWARD' || l.operation === 'FORWARD_PHASE1',
    );
    expect(forwardLogs.length).toBeGreaterThan(0);
  });
});
