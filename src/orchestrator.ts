import type { PriceRouteRule } from '@/contracts/schemas';
import { db } from '@/db/database';
import { SidebarObserver } from '@/nodes/n01-sidebar-observer';
import { queueManager } from '@/nodes/n02-queue-manager';
import { chatSwitcher } from '@/nodes/n03-chat-switcher';
import { deltaStitcher } from '@/nodes/n04-delta-stitcher';
import { bundleAggregator } from '@/nodes/n05-bundle-aggregator';
import { dedupGate } from '@/nodes/n06-dedup-gate';
import { DEFAULT_PRICE_RULES, priceRouter } from '@/nodes/n07-price-router';
import { forwardAutomator } from '@/nodes/n08-forward-automator';
import { textInjector } from '@/nodes/n09-text-injector';
import { committerDrain } from '@/nodes/n10-committer-drain';
import { logger } from '@/utils/logger';
import { circuitBreaker } from '@/utils/pacing-guard';

export class ZaloAutomationOrchestrator {
  private running = false;
  private observer: SidebarObserver | null = null;

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    logger.info('ORCHESTRATOR', 'GLOBAL', 'Khởi động hệ thống Zalo Automation 24/7');
    this.running = true;

    // 1. Phục hồi các tác vụ Stale sau F5/Reload
    await queueManager.initialize();

    // 2. Thiết lập Worker xử lý cho QueueManager
    queueManager.setWorker(async (groupId: string, correlationId: string) => {
      await this.processGroup(groupId, correlationId);
    });

    // 3. Đọc cấu hình whitelist_groups từ IndexedDB app_settings
    const settingRecord = await db.app_settings.get('config');
    const configValue = settingRecord?.value as { whitelist_groups?: string[] } | undefined;
    const whitelist = configValue?.whitelist_groups || [];

    // 4. Khởi chạy Sidebar Observer để theo dõi tin nhắn mới
    this.observer = new SidebarObserver({
      whitelist,
      onNewMessage: (groupId: string) => {
        queueManager.enqueue(groupId).catch(() => {});
      },
    });

    this.observer.start();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    if (this.observer) {
      this.observer.stop();
      this.observer = null;
    }

    this.running = false;
    logger.info('ORCHESTRATOR', 'GLOBAL', 'Đã dừng hệ thống Zalo Automation 24/7');
  }

  isStarted(): boolean {
    return this.running;
  }

  /**
   * Xử lý luồng tự động hóa khép kín từ N3 -> N10 cho một nhóm nguồn
   */
  async processGroup(groupId: string, correlationId: string): Promise<void> {
    const startTime = Date.now();
    circuitBreaker.assertNotBlocked();
    logger.info('ORCHESTRATOR', 'N02', `Tiếp nhận xử lý nhóm: ${groupId} (Corr: ${correlationId})`);

    // Node 3: Chuyển tab sang nhóm nguồn và neo đáy
    const switched = await chatSwitcher.switchToGroup(groupId);
    if (!switched) {
      logger.warn('ORCHESTRATOR', 'N03', `Không thể chuyển sang nhóm ${groupId}`, { groupId });
      return;
    }

    // Node 4: Quét tin nhắn mới theo Checkpoint
    const messages = await deltaStitcher.stitchDelta(groupId);
    if (messages.length === 0) {
      logger.info('ORCHESTRATOR', 'N04', `Không có tin nhắn mới tại nhóm ${groupId}`, { groupId });
      return;
    }

    // Node 5: Gom cụm Media + Text theo senderId (15s window, 2-3s debounce)
    const bundles = bundleAggregator.aggregateBundles(groupId, messages);
    if (bundles.length === 0) {
      return;
    }

    // Lấy cấu hình price_routes từ app_settings
    const settingRecord = await db.app_settings.get('config');
    const configValue = settingRecord?.value as { price_routes?: PriceRouteRule[] } | undefined;
    const priceRules = configValue?.price_routes || DEFAULT_PRICE_RULES;

    for (const bundle of bundles) {
      circuitBreaker.assertNotBlocked();

      // Node 6: Cổng khử trùng lặp 2 lớp (30 ngày)
      const dedupResult = await dedupGate.checkAndRegister(bundle);
      if (!dedupResult.allowed) {
        logger.warn('ORCHESTRATOR', 'N06', `Bỏ qua bundle do trùng lặp: ${dedupResult.reason}`, {
          groupId,
          senderId: bundle.senderId,
        });
        continue;
      }

      // Node 7: Bóc tách giá tiếng Việt và định tuyến tối đa 2 nhóm con
      const routeResult = priceRouter.routeBundle(bundle, priceRules);
      if (routeResult.targetGroupIds.length === 0) {
        logger.info('ORCHESTRATOR', 'N07', 'Không tìm thấy nhóm đích phù hợp theo khoảng giá', {
          groupId,
        });
        continue;
      }

      // Node 8: Pha 1 - Chia sẻ media qua Native Forward Modal và chờ Toast
      const hasMedia = bundle.messages.some(
        (m) => m.type === 'IMAGE' || m.type === 'ALBUM' || m.type === 'VIDEO',
      );
      if (hasMedia) {
        const forwardOk = await forwardAutomator.forwardPhase1(bundle, routeResult.targetGroupIds);
        if (!forwardOk) {
          logger.warn('ORCHESTRATOR', 'N08', 'Pha 1 chia sẻ media thất bại', { groupId });
        }
      }

      // Node 9: Pha 2 - Tiêm text đã biên tập vào các nhóm đích kèm micro-jitter
      if (routeResult.editedText) {
        await textInjector.injectTextPhase2(
          groupId,
          routeResult.targetGroupIds,
          routeResult.editedText,
          false,
        );
      }

      // Node 10: Đệm tĩnh lặng, ghi Checkpoint và chốt chu trình
      await committerDrain.commitAndDrain(groupId, bundle, 0, startTime);
    }
  }
}

export const orchestrator = new ZaloAutomationOrchestrator();
