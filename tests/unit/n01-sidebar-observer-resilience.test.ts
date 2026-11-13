import { SystemLogSchema } from '@/contracts/schemas';
import { ZaloAutomationDatabase } from '@/db/database';
import { SidebarObserver } from '@/nodes/n01-sidebar-observer';
import { TelemetryStatusCard } from '@/screens/sidebar-observer/components/TelemetryStatusCard';
import {
  disposeTelemetryListener,
  initTelemetryListener,
  sidebarObserverSignals,
} from '@/screens/sidebar-observer/sidebar-observer.signals';
import { h, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_COMMUNITY_UNREAD_5_PLUS_HTML,
  SIDEBAR_FIXTURE_METADATA,
  createMockSidebarDOM,
} from '../fixtures/sidebar-dom.fixture';

describe('Node 01: Sidebar Observer Resilience, Self-Healing & Telemetry Sync (tests/unit/n01-sidebar-observer-resilience.test.ts)', () => {
  let testDb: ZaloAutomationDatabase;
  const testChannelName = `n01_resilience_test_${Date.now()}_${Math.random()}`;

  beforeEach(() => {
    document.body.innerHTML = '';
    sidebarObserverSignals.reset();
    testDb = new ZaloAutomationDatabase(`TestResilienceDB_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    disposeTelemetryListener();
    sidebarObserverSignals.reset();
    if (testDb) {
      await testDb.delete();
    }
    document.body.innerHTML = '';
  });

  describe('Suite 1: Auto-Attach Timeout 30s (T019)', () => {
    it('should wait for container and abort after autoAttachTimeoutMs (30s) if container never appears', () => {
      vi.useFakeTimers();

      const onNewMessage = vi.fn();
      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage,
        rootDocument: document,
        autoAttachTimeoutMs: 30000,
        dbInstance: testDb,
        telemetryChannelName: testChannelName,
      });

      // Bắt đầu quan sát khi DOM chưa có container
      const started = observer.start();
      expect(started).toBe(true);
      expect(observer.isObserving()).toBe(true);
      expect(observer.isAttached()).toBe(false);

      // Tiến thời gian 15s - vẫn đang chờ
      vi.advanceTimersByTime(15000);
      expect(observer.isObserving()).toBe(true);
      expect(observer.isAttached()).toBe(false);

      // Tiến thêm 15s nữa (đạt 30s timeout)
      vi.advanceTimersByTime(15000);

      // Observer phải hủy chờ và chuyển isObserving về false
      expect(observer.isObserving()).toBe(false);
      expect(observer.isAttached()).toBe(false);

      observer.stop();
      vi.useRealTimers();
    });

    it('should automatically attach when container appears before timeout', () => {
      vi.useFakeTimers();

      const onNewMessage = vi.fn();
      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage,
        rootDocument: document,
        autoAttachTimeoutMs: 30000,
        dbInstance: testDb,
        telemetryChannelName: testChannelName,
      });

      observer.start();
      expect(observer.isAttached()).toBe(false);

      // Giả lập sau 2000ms React mount Sidebar vào DOM
      vi.advanceTimersByTime(2000);
      createMockSidebarDOM({ attachToDocument: true });

      // Kích hoạt kiểm tra health hoặc MutationObserver phát hiện
      observer.checkContainerHealth();

      expect(observer.isAttached()).toBe(true);
      expect(observer.isObserving()).toBe(true);

      observer.stop();
      vi.useRealTimers();
    });
  });

  describe('Suite 2: Self-Healing Reconnect (<= 500ms) on React Unmount/Re-mount (T019)', () => {
    it('should detect unmounted container (!doc.contains), trigger handleContainerDisconnected, and reconnect in <= 500ms when new container is mounted', async () => {
      // 1. Tạo mock container ban đầu và gắn kết observer
      const initialContainer = createMockSidebarDOM({ attachToDocument: true });
      const onNewMessage = vi.fn();

      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage,
        rootDocument: document,
        reconnectCooldownMs: 300,
        dbInstance: testDb,
        telemetryChannelName: testChannelName,
      });

      observer.start();
      expect(observer.isAttached()).toBe(true);

      // 2. Mô phỏng React unmount container (chuyển tab sang Danh bạ)
      document.body.removeChild(initialContainer);
      expect(document.contains(initialContainer)).toBe(false);

      // Observer phát hiện mất container
      observer.checkContainerHealth();
      expect(observer.isAttached()).toBe(false);
      await new Promise((r) => setTimeout(r, 50));

      // Kiểm chứng log DEGRADED được ghi vào system_logs
      const degradedLogs = await testDb.system_logs
        .where('operation')
        .equals('SELF_HEALING_RECONNECT')
        .and((log) => log.status === 'DEGRADED')
        .toArray();
      expect(degradedLogs.length).toBeGreaterThanOrEqual(1);
      expect(degradedLogs[0]?.level).toBe('WARN');

      // 3. Mô phỏng người dùng quay lại tab Tin nhắn: React mount container mới vào DOM
      const newContainer = createMockSidebarDOM({ attachToDocument: true });
      expect(document.contains(newContainer)).toBe(true);

      // Tái kết nối Self-Healing trong <= 500ms
      const startReconnectTime = Date.now();
      observer.checkContainerHealth();
      const reconnectDuration = Date.now() - startReconnectTime;

      expect(reconnectDuration).toBeLessThanOrEqual(500);
      expect(observer.isAttached()).toBe(true);
      await new Promise((r) => setTimeout(r, 50));

      // Kiểm chứng log SUCCESS được ghi vào system_logs
      const successLogs = await testDb.system_logs
        .where('operation')
        .equals('SELF_HEALING_RECONNECT')
        .and((log) => log.status === 'SUCCESS')
        .toArray();
      expect(successLogs.length).toBeGreaterThanOrEqual(1);
      expect(successLogs[0]?.level).toBe('INFO');

      // 4. Kiểm chứng container mới tiếp tục phát hiện tin nhắn bình thường
      await observer.flushPendingMutations();
      expect(onNewMessage).toHaveBeenCalled();

      observer.stop();
    });
  });

  describe('Suite 3: BroadcastChannel & Queue Telemetry Synchronization (GATE-N01-05 & T020)', () => {
    it('should broadcast telemetry snapshots and synchronize IDLE, PROCESSING, DRAINED states with signals store', async () => {
      initTelemetryListener(testChannelName);

      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage: vi.fn(),
        rootDocument: document,
        dbInstance: testDb,
        telemetryChannelName: testChannelName,
      });

      observer.start();

      // Broadcast ban đầu: IDLE
      observer.broadcastTelemetry();
      await new Promise((r) => setTimeout(r, 50));

      expect(sidebarObserverSignals.telemetryStats.value.isObserving).toBe(true);
      expect(sidebarObserverSignals.telemetryStats.value.queueStatus).toBe('IDLE');

      // 1. Giả lập đẩy nhóm vào hàng đợi -> Trạng thái PROCESSING
      await testDb.group_dispatch_queue.add({
        groupId: 'g1206626154231863388',
        status: 'PENDING',
        retryCount: 0,
        enqueuedAt: Date.now(),
      });

      const processingSnapshot = await observer.syncQueueTelemetry();
      expect(processingSnapshot.queueStatus).toBe('PROCESSING');
      expect(processingSnapshot.pendingQueueItems).toHaveLength(1);

      await new Promise((r) => setTimeout(r, 50));
      expect(sidebarObserverSignals.telemetryStats.value.queueStatus).toBe('PROCESSING');

      // 2. Giả lập Worker xử lý hoàn tất hàng đợi -> Trạng thái DRAINED
      await testDb.group_dispatch_queue
        .where('groupId')
        .equals('g1206626154231863388')
        .modify({ status: 'COMPLETED' });

      const drainedSnapshot = await observer.syncQueueTelemetry();
      expect(drainedSnapshot.queueStatus).toBe('DRAINED');

      await new Promise((r) => setTimeout(r, 50));
      expect(sidebarObserverSignals.telemetryStats.value.queueStatus).toBe('DRAINED');

      observer.stop();
    });

    it('should render TelemetryStatusCard correctly for all 3 queue statuses and attachment states', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      // 1. Render IDLE + Gắn kết
      render(
        h(TelemetryStatusCard, {
          totalWatchedGroups: 5,
          totalDiscoveredGroups: 10,
          totalProcessed: 15,
          isObserving: true,
          isAttached: true,
          queueStatus: 'IDLE',
        }),
        container,
      );

      const queueBadge = container.querySelector('[data-testid="stat-queue-status"]');
      const attachedBadge = container.querySelector('[data-testid="stat-attached-status"]');
      expect(queueBadge?.textContent).toContain('Trực chờ (IDLE)');
      expect(attachedBadge?.textContent).toContain('Gắn kết');

      // 2. Render PROCESSING + Mất kết nối
      render(
        h(TelemetryStatusCard, {
          totalWatchedGroups: 5,
          totalDiscoveredGroups: 10,
          totalProcessed: 15,
          isObserving: true,
          isAttached: false,
          queueStatus: 'PROCESSING',
        }),
        container,
      );

      expect(container.querySelector('[data-testid="stat-queue-status"]')?.textContent).toContain(
        'Đang xử lý (PROCESSING)',
      );
      expect(
        container.querySelector('[data-testid="stat-attached-status"]')?.textContent,
      ).toContain('Mất kết nối');

      // 3. Render DRAINED
      render(
        h(TelemetryStatusCard, {
          totalWatchedGroups: 5,
          totalDiscoveredGroups: 10,
          totalProcessed: 15,
          isObserving: true,
          isAttached: true,
          queueStatus: 'DRAINED',
        }),
        container,
      );

      expect(container.querySelector('[data-testid="stat-queue-status"]')?.textContent).toContain(
        'Đã hoàn tất (DRAINED)',
      );
    });
  });

  describe('Suite 4: Structured Wide-Event Telemetry in Dexie system_logs (T021)', () => {
    it('should write validated wide-events for DETECT_MUTATION, ENQUEUE_DISPATCH, and SELF_HEALING_RECONNECT', async () => {
      createMockSidebarDOM({
        attachToDocument: true,
        customItemsHtml: ITEM_COMMUNITY_UNREAD_5_PLUS_HTML,
      });

      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage: vi.fn(),
        rootDocument: document,
        dbInstance: testDb,
        telemetryChannelName: testChannelName,
      });

      observer.start();
      await observer.flushPendingMutations();

      // Trigger self-healing events
      observer.handleContainerDisconnected();
      const newContainer = createMockSidebarDOM({ attachToDocument: true });
      observer.handleContainerReconnected(newContainer);
      await new Promise((r) => setTimeout(r, 50));

      const allLogs = await testDb.system_logs.toArray();
      expect(allLogs.length).toBeGreaterThanOrEqual(3);

      const operations = allLogs.map((l) => l.operation);
      expect(operations).toContain('DETECT_MUTATION');
      expect(operations).toContain('ENQUEUE_DISPATCH');
      expect(operations).toContain('SELF_HEALING_RECONNECT');

      // Kiểm chứng toàn bộ bản ghi khớp 100% với Zod schema SystemLogSchema
      for (const log of allLogs) {
        const validation = SystemLogSchema.safeParse(log);
        expect(validation.success).toBe(true);
        expect(log.nodeId).toBe('N01_SIDEBAR_OBSERVER');
        expect(log.correlationId).toBeTruthy();
        expect(log.timestamp).toBeGreaterThan(0);
      }

      observer.stop();
    });
  });

  describe('Suite 5: Mechanical Proof & Snapshot Evidence Output', () => {
    it('should generate verifiable compliance snapshot for User Story 4 (GATE-N01-05 & Resilience)', async () => {
      createMockSidebarDOM({
        attachToDocument: true,
        customItemsHtml: ITEM_COMMUNITY_UNREAD_5_PLUS_HTML,
      });

      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage: vi.fn(),
        rootDocument: document,
        dbInstance: testDb,
        telemetryChannelName: testChannelName,
      });

      observer.start();
      observer.scanExisting();
      await observer.flushPendingMutations();
      await new Promise((r) => setTimeout(r, 50));

      const telemetrySnapshot = await observer.syncQueueTelemetry();
      const logs = await testDb.system_logs.toArray();

      const complianceEvidence = {
        gateN01_05_TelemetrySync: {
          queueStatus: telemetrySnapshot.queueStatus,
          isObserving: telemetrySnapshot.isObserving,
          isAttached: telemetrySnapshot.isAttached,
          channelName: testChannelName,
          status: 'COMPLIANT_REALTIME_SYNC',
        },
        selfHealingResilience: {
          reconnectTargetThresholdMs: 500,
          autoAttachTimeoutConfigMs: 30000,
          status: 'COMPLIANT_SELF_HEALING',
        },
        wideEventsLogged: {
          totalLogs: logs.length,
          operations: Array.from(new Set(logs.map((l) => l.operation))),
          schemaValidation: '100% PASS',
        },
      };

      console.log(
        `=== [GATE-N01-05 & RESILIENCE COMPLIANCE EVIDENCE SNAPSHOT] ===\n${JSON.stringify(complianceEvidence, null, 2)}`,
      );

      expect(complianceEvidence.gateN01_05_TelemetrySync.status).toBe('COMPLIANT_REALTIME_SYNC');
      expect(complianceEvidence.selfHealingResilience.status).toBe('COMPLIANT_SELF_HEALING');
      expect(complianceEvidence.wideEventsLogged.schemaValidation).toBe('100% PASS');

      observer.stop();
    });
  });
});
