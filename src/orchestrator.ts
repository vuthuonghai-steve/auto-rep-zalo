import { initFeatureFlags, isFeatureEnabled } from '@/configs/storage.config';
import type {
  EntityBundle,
  GroupDetectedEvent,
  PriceRouteRule,
  WhitelistGroupItem,
} from '@/contracts/schemas';
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

export interface OrchestratorOptions {
  quiescenceDelayMs?: number;
}

export class ZaloAutomationOrchestrator {
  private running = false;
  private observer: SidebarObserver | null = null;

  constructor(private options?: OrchestratorOptions) {}

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    logger.info('ORCHESTRATOR', 'GLOBAL', 'Khởi động hệ thống Zalo Automation 24/7');
    this.running = true;

    // 0. Đồng bộ cờ tính năng từ Storage nếu chạy trong extension runtime
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await initFeatureFlags();
    }

    // 1. Phục hồi các tác vụ Stale sau F5/Reload
    await queueManager.initialize();

    // 2. Thiết lập Worker xử lý cho QueueManager (N02)
    queueManager.setWorker(async (groupId: string, correlationId: string) => {
      if (!isFeatureEnabled('n02-queue-manager')) {
        logger.info(
          'ORCHESTRATOR',
          'N02',
          `N02 Queue Manager is disabled. Skipping dequeue task processing (Corr: ${correlationId}).`,
          { groupId },
        );
        return;
      }
      await this.processGroup(groupId, correlationId);
    });

    // 3. Đọc cấu hình whitelist: Ưu tiên đọc từ key 'n01_whitelist_groups' trong Dexie app_settings, nếu không có thì fallback sang record 'config' cũ
    let whitelist: (string | WhitelistGroupItem)[] = [];
    const n01Setting = await db.app_settings.get('n01_whitelist_groups');
    if (n01Setting?.value) {
      const val = n01Setting.value as { groups?: WhitelistGroupItem[] } | WhitelistGroupItem[];
      if (Array.isArray((val as { groups?: WhitelistGroupItem[] }).groups)) {
        whitelist = (val as { groups: WhitelistGroupItem[] }).groups;
      } else if (Array.isArray(val)) {
        whitelist = val;
      }
    }

    if (whitelist.length === 0) {
      const settingRecord = await db.app_settings.get('config');
      const configValue = settingRecord?.value as { whitelist_groups?: string[] } | undefined;
      whitelist = configValue?.whitelist_groups || [];
    }

    // 4. Khởi chạy Sidebar Observer (N01) để theo dõi tin nhắn mới
    if (isFeatureEnabled('n01-sidebar-observer')) {
      this.observer = new SidebarObserver({
        whitelist,
        onNewMessage: (groupId: string, event?: GroupDetectedEvent) => {
          logger.info(
            'ORCHESTRATOR',
            'N01',
            `Phát hiện tin mới tại nhóm: ${groupId} (Tên: ${event?.groupName ?? 'N/A'}, Unread: ${event?.unreadCount ?? 0}, Corr: ${event?.correlationId ?? 'N/A'})`,
            {
              groupId,
            },
          );
          queueManager.enqueue(groupId, event?.correlationId).catch(() => {});
        },
      });
      this.observer.start();
    } else {
      logger.info(
        'ORCHESTRATOR',
        'N01',
        'N01 Sidebar Observer is disabled. Skipping observer start.',
      );
    }
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
   * Đồng bộ động trạng thái các Node khi Feature Flags thay đổi thời gian thực
   */
  async syncFeatures(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (isFeatureEnabled('n01-sidebar-observer')) {
      if (!this.observer) {
        let whitelist: (string | WhitelistGroupItem)[] = [];
        const n01Setting = await db.app_settings.get('n01_whitelist_groups');
        if (n01Setting?.value) {
          const val = n01Setting.value as { groups?: WhitelistGroupItem[] } | WhitelistGroupItem[];
          if (Array.isArray((val as { groups?: WhitelistGroupItem[] }).groups)) {
            whitelist = (val as { groups: WhitelistGroupItem[] }).groups;
          } else if (Array.isArray(val)) {
            whitelist = val;
          }
        }

        if (whitelist.length === 0) {
          const settingRecord = await db.app_settings.get('config');
          const configValue = settingRecord?.value as { whitelist_groups?: string[] } | undefined;
          whitelist = configValue?.whitelist_groups || [];
        }

        this.observer = new SidebarObserver({
          whitelist,
          onNewMessage: (groupId: string, event?: GroupDetectedEvent) => {
            logger.info(
              'ORCHESTRATOR',
              'N01',
              `Phát hiện tin mới tại nhóm: ${groupId} (Tên: ${event?.groupName ?? 'N/A'}, Unread: ${event?.unreadCount ?? 0}, Corr: ${event?.correlationId ?? 'N/A'})`,
              {
                groupId,
              },
            );
            queueManager.enqueue(groupId, event?.correlationId).catch(() => {});
          },
        });
        this.observer.start();
        logger.info(
          'ORCHESTRATOR',
          'N01',
          'Đã kích hoạt N01 Sidebar Observer sau khi cờ tính năng được bật',
        );
      }
    } else {
      if (this.observer) {
        this.observer.stop();
        this.observer = null;
        logger.info(
          'ORCHESTRATOR',
          'N01',
          'Đã dừng N01 Sidebar Observer do cờ tính năng bị tắt',
        );
      }
    }
  }

  /**
   * Xử lý luồng tự động hóa khép kín từ N3 -> N10 cho một nhóm nguồn
   */
  async processGroup(groupId: string, correlationId: string): Promise<void> {
    const startTime = Date.now();
    circuitBreaker.assertNotBlocked();

    // Node 2: Kiểm tra cờ n02-queue-manager nếu gọi trực tiếp
    if (!isFeatureEnabled('n02-queue-manager')) {
      logger.info(
        'ORCHESTRATOR',
        'N02',
        `N02 Queue Manager is disabled. Skipping processGroup execution (Corr: ${correlationId}).`,
        { groupId },
      );
      return;
    }

    logger.info('ORCHESTRATOR', 'N02', `Tiếp nhận xử lý nhóm: ${groupId} (Corr: ${correlationId})`);

    // Node 3: Chuyển tab sang nhóm nguồn và neo đáy
    if (isFeatureEnabled('n03-chat-switcher')) {
      const switched = await chatSwitcher.switchToGroup(groupId);
      if (!switched) {
        logger.warn('ORCHESTRATOR', 'N03', `Không thể chuyển sang nhóm ${groupId}`, { groupId });
        return;
      }
    } else {
      logger.info(
        'ORCHESTRATOR',
        'N03',
        `N03 Chat Switcher is disabled. Skipping switch to group ${groupId}.`,
        { groupId },
      );
    }

    // Node 4: Quét tin nhắn mới theo Checkpoint
    if (!isFeatureEnabled('n04-delta-stitcher')) {
      logger.info(
        'ORCHESTRATOR',
        'N04',
        'N04 Delta Stitcher is disabled. Returning empty delta messages.',
        { groupId },
      );
      return;
    }

    const messages = await deltaStitcher.stitchDelta(groupId);
    if (messages.length === 0) {
      logger.info('ORCHESTRATOR', 'N04', `Không có tin nhắn mới tại nhóm ${groupId}`, { groupId });
      return;
    }

    // Node 5: Gom cụm Media + Text theo senderId (15s window, 2-3s debounce)
    let bundles: EntityBundle[];
    if (isFeatureEnabled('n05-bundle-aggregator')) {
      bundles = bundleAggregator.aggregateBundles(groupId, messages);
    } else {
      logger.info(
        'ORCHESTRATOR',
        'N05',
        'N05 Bundle Aggregator is disabled. Processing messages as instant individual bundles.',
        { groupId },
      );
      bundles = messages.map((m) => ({
        bundleId: `bundle_instant_${m.msgId}_${Date.now()}`,
        sourceGroupId: groupId,
        senderId: m.senderId,
        senderName: m.senderName,
        messages: [
          {
            msgId: m.msgId,
            type: m.type,
            text: m.text,
            mediaUrls: m.mediaUrls,
            timestamp: m.timestamp,
          },
        ],
        rawCombinedText: m.text || '',
        targetGroupIds: [],
        createdAt: Date.now(),
      }));
    }

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
      if (isFeatureEnabled('n06-dedup-gate')) {
        const dedupResult = await dedupGate.checkAndRegister(bundle);
        if (!dedupResult.allowed) {
          logger.warn('ORCHESTRATOR', 'N06', `Bỏ qua bundle do trùng lặp: ${dedupResult.reason}`, {
            groupId,
            senderId: bundle.senderId,
          });
          continue;
        }
      } else {
        logger.info(
          'ORCHESTRATOR',
          'N06',
          'N06 Dedup Gate is disabled. Bypassing deduplication check (100% pass-through).',
          {
            groupId,
            senderId: bundle.senderId,
          },
        );
      }

      // Node 7: Bóc tách giá tiếng Việt và định tuyến tối đa 2 nhóm con
      let routeResult: { targetGroupIds: string[]; editedText: string };
      if (isFeatureEnabled('n07-price-router')) {
        routeResult = priceRouter.routeBundle(bundle, priceRules);
      } else {
        const fallbackTargets = priceRules.flatMap((r) => r.targetGroupIds).slice(0, 2);
        const defaultTargets =
          fallbackTargets.length > 0
            ? fallbackTargets
            : DEFAULT_PRICE_RULES[0]?.targetGroupIds || [];
        logger.info(
          'ORCHESTRATOR',
          'N07',
          `N07 Price Router is disabled. Using fallback/default target group: [${defaultTargets.join(', ')}].`,
          {
            groupId,
          },
        );
        routeResult = {
          targetGroupIds: defaultTargets,
          editedText: bundle.rawCombinedText,
        };
      }

      if (routeResult.targetGroupIds.length === 0) {
        logger.info('ORCHESTRATOR', 'N07', 'Không tìm thấy nhóm đích phù hợp theo khoảng giá', {
          groupId,
        });
        continue;
      }

      // Node 8: Pha 1 - Chia sẻ media qua Native Forward Modal và chờ Toast (Safe Dry-Run)
      const hasMedia = bundle.messages.some(
        (m) => m.type === 'IMAGE' || m.type === 'ALBUM' || m.type === 'VIDEO',
      );
      if (hasMedia) {
        if (isFeatureEnabled('n08-forward-automator')) {
          const forwardOk = await forwardAutomator.forwardPhase1(
            bundle,
            routeResult.targetGroupIds,
          );
          if (!forwardOk) {
            logger.warn('ORCHESTRATOR', 'N08', 'Pha 1 chia sẻ media thất bại', { groupId });
          }
        } else {
          logger.info(
            'ORCHESTRATOR',
            'N08',
            `[DRY_RUN] N08 Forward Automator is disabled. Skipping native modal media forward to [${routeResult.targetGroupIds.join(', ')}].`,
            { groupId },
          );
        }
      }

      // Node 9: Pha 2 - Tiêm text đã biên tập vào các nhóm đích kèm micro-jitter (Safe Dry-Run)
      if (routeResult.editedText) {
        if (isFeatureEnabled('n09-text-injector')) {
          await textInjector.injectTextPhase2(
            groupId,
            routeResult.targetGroupIds,
            routeResult.editedText,
            false,
          );
        } else {
          logger.info(
            'ORCHESTRATOR',
            'N09',
            `[DRY_RUN] N09 Text Injector is disabled. Skipping text injection to [${routeResult.targetGroupIds.join(', ')}].`,
            { groupId },
          );
        }
      }

      // Node 10: Đệm tĩnh lặng, ghi Checkpoint và chốt chu trình
      const defaultDelay = this.options?.quiescenceDelayMs ?? 10000;
      const quiescenceDelay = isFeatureEnabled('n10-committer-drain') ? defaultDelay : 0;
      await committerDrain.commitAndDrain(groupId, bundle, quiescenceDelay, startTime);
    }
  }
}

export const orchestrator = new ZaloAutomationOrchestrator();
