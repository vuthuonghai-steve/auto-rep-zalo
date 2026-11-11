import fs from 'node:fs';
import path from 'node:path';
import { getDefaultFlagState } from '@/configs/features.config';
import { flagsSignal } from '@/configs/storage.config';
import { db } from '@/db/database';
import type { ChatSwitcher } from '@/nodes/n03-chat-switcher';
import { forwardAutomator } from '@/nodes/n08-forward-automator';
import { TextInjector, textInjector } from '@/nodes/n09-text-injector';
import { ZaloAutomationOrchestrator } from '@/orchestrator';
import { circuitBreaker } from '@/utils/pacing-guard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Phase 4: Dynamic Orchestrator, Node Bypass Engine & Safe Dry-Run (Unit Tests)', () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

  beforeEach(async () => {
    circuitBreaker.resume();
    vi.restoreAllMocks();
    // Reset flags to defaults: N01-N07=true, N08=false, N09=false, N10=true
    flagsSignal.value = getDefaultFlagState();

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

  describe('Task 4.1 & 4.2: Safe Dry-Run Mode (N08 & N09 disabled by default)', () => {
    it('should process N01-N07 normally but bypass N08 & N09 with dry-run logs', async () => {
      // Mặc định N08 và N09 là false (Safe Dry-Run)
      expect(flagsSignal.value['n08-forward-automator']).toBe(false);
      expect(flagsSignal.value['n09-text-injector']).toBe(false);

      const forwardSpy = vi.spyOn(forwardAutomator, 'forwardPhase1');
      const textInjectSpy = vi.spyOn(textInjector, 'injectTextPhase2');

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });
      await orch.processGroup('conv-group-source-1', 'dry_run_test_01');

      // 1. N04-N07 đã chạy thành công: Checkpoint và entity được lưu
      const cp = await db.group_checkpoints.get('conv-group-source-1');
      expect(cp).toBeDefined();
      expect(cp?.lastMessageId).toBe('msg-002');

      const savedEntities = await db.entities.toArray();
      expect(savedEntities.length).toBeGreaterThan(0);

      // 2. N08 & N09 tuyệt đối không gọi DOM operations chuyển tiếp
      expect(forwardSpy).not.toHaveBeenCalled();
      expect(textInjectSpy).not.toHaveBeenCalled();

      // 3. Log có cấu trúc ghi nhận chế độ DRY_RUN của N08 và N09
      const logs = await db.system_logs.toArray();
      const n08DryRunLog = logs.find(
        (l) =>
          l.nodeId === 'N08' && l.message.includes('[DRY_RUN] N08 Forward Automator is disabled'),
      );
      expect(n08DryRunLog).toBeDefined();

      const n09DryRunLog = logs.find(
        (l) => l.nodeId === 'N09' && l.message.includes('[DRY_RUN] N09 Text Injector is disabled'),
      );
      expect(n09DryRunLog).toBeDefined();

      // N10 vẫn chốt chu trình thành công
      const twoPhaseLog = logs.find((l) => l.operation === 'TWO_PHASE_FORWARD');
      expect(twoPhaseLog).toBeDefined();
    });

    it('should execute full N08 & N09 DOM operations when both are enabled', async () => {
      flagsSignal.value = {
        ...flagsSignal.value,
        'n08-forward-automator': true,
        'n09-text-injector': true,
      };

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });
      await orch.processGroup('conv-group-source-1', 'enabled_forward_01');

      const logs = await db.system_logs.toArray();
      // Không còn dry-run logs
      const dryRunLogs = logs.filter((l) => l.message.includes('[DRY_RUN]'));
      expect(dryRunLogs.length).toBe(0);

      // Có log FORWARD_PHASE1 và TEXT_INJECTION
      const forwardPhase1Log = logs.find((l) => l.operation === 'FORWARD_PHASE1');
      expect(forwardPhase1Log).toBeDefined();

      const textInjectLog = logs.find((l) => l.operation === 'TEXT_INJECTION');
      expect(textInjectLog).toBeDefined();
    });
  });

  describe('Task 4.1: N06 Dedup Gate Bypass', () => {
    it('should bypass deduplication filter (100% pass-through) when N06 is disabled', async () => {
      // Tắt N06 Dedup Gate
      flagsSignal.value = {
        ...flagsSignal.value,
        'n06-dedup-gate': false,
      };

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });

      // Lần 1: Chạy bình thường
      await orch.processGroup('conv-group-source-1', 'corr_dedup_01');

      // Clear checkpoint để giả lập tin nhắn đến lại với cùng nội dung
      await db.group_checkpoints.clear();

      // Lần 2: Chạy lại cùng dữ liệu. Khi N06 tắt, nó không bị reject mà cho qua 100%
      await orch.processGroup('conv-group-source-1', 'corr_dedup_02');

      const logs = await db.system_logs.toArray();
      const bypassLogs = logs.filter(
        (l) =>
          l.nodeId === 'N06' &&
          l.message.includes('N06 Dedup Gate is disabled. Bypassing deduplication check'),
      );
      expect(bypassLogs.length).toBeGreaterThan(0);

      // Không có log cảnh báo trùng lặp
      const duplicateWarnLogs = logs.filter(
        (l) => l.nodeId === 'N06' && l.message.includes('Bỏ qua bundle do trùng lặp'),
      );
      expect(duplicateWarnLogs.length).toBe(0);
    });
  });

  describe('Task 4.2: N09 Target Group Locked Detection', () => {
    it('should gracefully skip text injection when target group chat is locked without crashing', async () => {
      // Tạo container cho nhóm bị khóa có phần tử .lockSendMessageBox
      const lockedGroupHtml = `
        <div id="target-locked-group" class="conv-item" data-id="conv-locked-target">
          <span class="conv-item-title">Nhóm Đích Bị Khóa</span>
        </div>
        <div id="chatView">
          <div class="lockSendMessageBox">
            <span class="lockSendMessageBox--hightlight" data-translate-inner="STR_LOCK_SEND_MESSAGE">
              Chỉ trưởng/phó nhóm mới có thể gửi tin nhắn vào nhóm này.
            </span>
          </div>
        </div>
      `;
      document.body.innerHTML += lockedGroupHtml;

      const mockSwitcher = {
        switchToGroup: vi.fn().mockResolvedValue(true),
      };

      const injector = new TextInjector(mockSwitcher as unknown as ChatSwitcher, document);

      const result = await injector.injectTextPhase2(
        'conv-group-source-1',
        ['conv-locked-target'],
        'Nội dung bất động sản test',
        false,
      );

      // Kết quả an toàn (true), không crash, không tìm kiếm CHAT_INPUT_BOX
      expect(result).toBe(true);

      // Verify log cảnh báo khóa nhóm được ghi nhận
      const logs = await db.system_logs.toArray();
      const lockWarningLog = logs.find(
        (l) =>
          l.nodeId === 'N09' && l.message.includes('Target group is locked (only admin can post)'),
      );
      expect(lockWarningLog).toBeDefined();
    });
  });

  describe('Task 4.1: Other Node Bypass Engine Scenarios', () => {
    it('should skip starting observer when N01 is disabled', async () => {
      flagsSignal.value = {
        ...flagsSignal.value,
        'n01-sidebar-observer': false,
      };

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });
      await orch.start();

      expect(orch.isStarted()).toBe(true);

      const logs = await db.system_logs.toArray();
      const n01DisabledLog = logs.find(
        (l) => l.nodeId === 'N01' && l.message.includes('N01 Sidebar Observer is disabled'),
      );
      expect(n01DisabledLog).toBeDefined();

      orch.stop();
    });

    it('should skip processing group when N02 is disabled', async () => {
      flagsSignal.value = {
        ...flagsSignal.value,
        'n02-queue-manager': false,
      };

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });
      await orch.processGroup('conv-group-source-1', 'corr_n02_disabled');

      // Checkpoint không được tạo vì N02 bị skip ngay đầu hàm
      const cp = await db.group_checkpoints.get('conv-group-source-1');
      expect(cp).toBeUndefined();

      const logs = await db.system_logs.toArray();
      const n02DisabledLog = logs.find(
        (l) => l.nodeId === 'N02' && l.message.includes('N02 Queue Manager is disabled'),
      );
      expect(n02DisabledLog).toBeDefined();
    });

    it('should skip switching chat when N03 is disabled', async () => {
      flagsSignal.value = {
        ...flagsSignal.value,
        'n03-chat-switcher': false,
      };

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });
      await orch.processGroup('conv-group-source-1', 'corr_n03_disabled');

      const logs = await db.system_logs.toArray();
      const n03DisabledLog = logs.find(
        (l) => l.nodeId === 'N03' && l.message.includes('N03 Chat Switcher is disabled'),
      );
      expect(n03DisabledLog).toBeDefined();
    });

    it('should return empty delta and stop pipeline when N04 is disabled', async () => {
      flagsSignal.value = {
        ...flagsSignal.value,
        'n04-delta-stitcher': false,
      };

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });
      await orch.processGroup('conv-group-source-1', 'corr_n04_disabled');

      // Checkpoint không được ghi vì dừng ở N04
      const cp = await db.group_checkpoints.get('conv-group-source-1');
      expect(cp).toBeUndefined();

      const logs = await db.system_logs.toArray();
      const n04DisabledLog = logs.find(
        (l) => l.nodeId === 'N04' && l.message.includes('N04 Delta Stitcher is disabled'),
      );
      expect(n04DisabledLog).toBeDefined();
    });

    it('should process messages as instant individual bundles when N05 is disabled', async () => {
      flagsSignal.value = {
        ...flagsSignal.value,
        'n05-bundle-aggregator': false,
      };

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });
      await orch.processGroup('conv-group-source-1', 'corr_n05_disabled');

      const logs = await db.system_logs.toArray();
      const n05DisabledLog = logs.find(
        (l) => l.nodeId === 'N05' && l.message.includes('N05 Bundle Aggregator is disabled'),
      );
      expect(n05DisabledLog).toBeDefined();
    });

    it('should use default fallback target groups when N07 is disabled', async () => {
      flagsSignal.value = {
        ...flagsSignal.value,
        'n07-price-router': false,
      };

      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 0 });
      await orch.processGroup('conv-group-source-1', 'corr_n07_disabled');

      const logs = await db.system_logs.toArray();
      const n07DisabledLog = logs.find(
        (l) => l.nodeId === 'N07' && l.message.includes('N07 Price Router is disabled'),
      );
      expect(n07DisabledLog).toBeDefined();
    });

    it('should immediately drain without quiescence delay when N10 is disabled', async () => {
      flagsSignal.value = {
        ...flagsSignal.value,
        'n10-committer-drain': false,
      };

      // Đặt default delay 10000ms, nếu N10 bật sẽ chờ 10s (timeout). Nhưng N10 tắt nên phải chạy ngay lập tức.
      const orch = new ZaloAutomationOrchestrator({ quiescenceDelayMs: 10000 });
      const start = Date.now();
      await orch.processGroup('conv-group-source-1', 'corr_n10_disabled');
      const elapsed = Date.now() - start;

      // Elapsed time phải cực nhỏ (< 500ms), không hề chờ 10000ms
      expect(elapsed).toBeLessThan(500);

      const cp = await db.group_checkpoints.get('conv-group-source-1');
      expect(cp).toBeDefined();
    });
  });
});
