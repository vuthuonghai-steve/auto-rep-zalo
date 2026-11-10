import { AppSettingSchema, PriceRouteRuleSchema } from '@/contracts/schemas';
import { ZaloAutomationDatabase } from '@/db/database';
import { LogRepository } from '@/db/log-repo';
import { circuitBreaker } from '@/utils/pacing-guard';
import { h, render } from 'preact';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FloatingPanel,
  queueCount,
  workerStatus,
} from '../../entrypoints/zalo.content/FloatingPanel';

describe('User Story 1: Options & Floating Panel Integration (tests/unit/us1-init-options.test.ts)', () => {
  let testDb: ZaloAutomationDatabase;
  let logRepo: LogRepository;

  beforeEach(async () => {
    testDb = new ZaloAutomationDatabase(`us1_test_${Date.now()}_${Math.random()}`);
    await testDb.open();
    logRepo = new LogRepository(testDb);

    // Reset signals & circuit breaker
    circuitBreaker.resume();
    workerStatus.value = 'IDLE';
    queueCount.value = 0;
    document.body.innerHTML = '';
  });

  describe('Cấu hình Whitelist & Ma Trận Khoảng Giá (Dexie app_settings)', () => {
    it('should validate and save valid configuration to Dexie app_settings', async () => {
      const configPayload = {
        whitelist: [
          { groupId: 'conv-group-source-1', name: 'Nguồn BĐS Cầu Giấy' },
          { groupId: 'conv-group-source-2', name: 'Nguồn BĐS Đống Đa' },
        ],
        priceRules: [
          {
            id: 'rule_1',
            label: 'Dưới 3 Tỷ',
            minPrice: 0,
            maxPrice: 3,
            targetGroupIds: ['conv-target-under-2b'],
          },
          {
            id: 'rule_2',
            label: '3 - 5 Tỷ',
            minPrice: 3,
            maxPrice: 5,
            targetGroupIds: ['conv-target-2b-5b'],
          },
        ],
        quiescenceDelaySec: 10,
      };

      // Xác thực cấu trúc PriceRouteRules qua Zod
      for (const rule of configPayload.priceRules) {
        expect(() => PriceRouteRuleSchema.parse(rule)).not.toThrow();
      }

      await testDb.app_settings.put({
        key: 'config',
        value: configPayload,
        updatedAt: Date.now(),
      });

      const saved = await testDb.app_settings.get('config');
      expect(saved).toBeDefined();
      expect(AppSettingSchema.safeParse(saved).success).toBe(true);

      const val = saved?.value as typeof configPayload;
      expect(val.whitelist.length).toBe(2);
      expect(val.priceRules[0]?.label).toBe('Dưới 3 Tỷ');
      expect(val.priceRules[0]?.targetGroupIds).toEqual(['conv-target-under-2b']);
    });
  });

  describe('Floating Panel Preact Signals & Emergency Stop', () => {
    it('should render Floating Panel with initial IDLE state and 0 queue', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      render(h(FloatingPanel, null), container);

      const statusEl = container.querySelector('#panel-worker-status');
      const queueEl = container.querySelector('#panel-queue-count');
      const stopBtn = container.querySelector('#btn-emergency-stop');

      expect(statusEl?.textContent).toBe('IDLE');
      expect(queueEl?.textContent).toContain('0 nhóm');
      expect(stopBtn).not.toBeNull();
    });

    it('should reactively update when queue count changes', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      render(h(FloatingPanel, null), container);

      queueCount.value = 5;
      await new Promise((r) => setTimeout(r, 10));

      const queueEl = container.querySelector('#panel-queue-count');
      expect(queueEl?.textContent).toContain('5 nhóm');
    });

    it('should trigger Emergency Stop, set STOPPED state and block CircuitBreaker', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      render(h(FloatingPanel, null), container);

      const stopBtn = container.querySelector('#btn-emergency-stop') as HTMLButtonElement;
      stopBtn.click();
      await new Promise((r) => setTimeout(r, 10));

      expect(workerStatus.value).toBe('STOPPED');
      expect(circuitBreaker.getState()).toBe('EMERGENCY_STOPPED');
      expect(circuitBreaker.isBlocked()).toBe(true);
      expect(() => circuitBreaker.assertNotBlocked()).toThrow(/Emergency Stop/);

      // Verify Resume button appears
      const resumeBtn = container.querySelector('#btn-panel-resume') as HTMLButtonElement;
      expect(resumeBtn).not.toBeNull();

      resumeBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(workerStatus.value).toBe('IDLE');
      expect(circuitBreaker.isBlocked()).toBe(false);
    });
  });

  describe('Xuất file chẩn đoán diagnostic_logs.json', () => {
    it('should generate valid JSON diagnostic export from log repository', async () => {
      await logRepo.addLog({
        correlationId: 'corr_us1_diag',
        operation: 'INITIALIZE',
        nodeId: 'N00',
        level: 'INFO',
        status: 'SUCCESS',
        durationMs: 15,
        groupId: 'g_main',
        senderIdMasked: 'u_admin',
        message: 'System initialized successfully',
        timestamp: Date.now(),
      });

      const jsonStr = await logRepo.exportLogsToJson(7, '1.0.0');
      const parsed = JSON.parse(jsonStr);

      expect(parsed.extensionVersion).toBe('1.0.0');
      expect(parsed.totalLogs).toBeGreaterThanOrEqual(1);
      expect(parsed.logs[0].operation).toBe('INITIALIZE');
    });
  });
});
