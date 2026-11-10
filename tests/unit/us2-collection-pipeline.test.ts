import fs from 'node:fs';
import path from 'node:path';
import { type EntityBundle, EntityBundleSchema } from '@/contracts/schemas';
import { ZaloAutomationDatabase } from '@/db/database';
import { QueueRepository } from '@/db/queue-repo';
import { SidebarObserver } from '@/nodes/n01-sidebar-observer';
import { QueueManager } from '@/nodes/n02-queue-manager';
import { ChatSwitcher } from '@/nodes/n03-chat-switcher';
import { DeltaStitcher } from '@/nodes/n04-delta-stitcher';
import { BundleAggregator } from '@/nodes/n05-bundle-aggregator';
import { CircuitBreaker } from '@/utils/pacing-guard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('User Story 2: Collection Pipeline (Nodes 1 to 5) (tests/unit/us2-collection-pipeline.test.ts)', () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

  let testDb: ZaloAutomationDatabase;
  let queueRepo: QueueRepository;
  let cb: CircuitBreaker;
  let qManager: QueueManager;

  beforeEach(async () => {
    document.body.innerHTML = fixtureHtml;
    testDb = new ZaloAutomationDatabase(`us2_test_${Date.now()}_${Math.random()}`);
    await testDb.open();
    queueRepo = new QueueRepository(testDb);
    cb = new CircuitBreaker();
    qManager = new QueueManager(queueRepo, cb);
  });

  describe('Node 1: SidebarObserver', () => {
    it('should observe and detect new unread messages in Whitelist groups', () => {
      const onNewMsg = vi.fn();
      const observer = new SidebarObserver({
        whitelist: ['conv-group-source-1'],
        onNewMessage: onNewMsg,
        rootDocument: document,
      });

      expect(observer.start()).toBe(true);

      // Giả lập thêm dot chưa đọc vào nhóm Whitelist
      const item = document.querySelector('[data-id="conv-group-source-1"]');
      const dot = document.createElement('span');
      dot.className = 'unread-red-dot';
      item?.appendChild(dot);

      // scanExisting verifies initial state or mutation
      observer.scanExisting();
      expect(onNewMsg).toHaveBeenCalledWith('conv-group-source-1');

      observer.stop();
      expect(observer.isObserving()).toBe(false);
    });

    it('should ignore unread messages in groups outside Whitelist', () => {
      const onNewMsg = vi.fn();
      const observer = new SidebarObserver({
        whitelist: ['conv-group-source-1'], // chỉ theo dõi source-1
        onNewMessage: onNewMsg,
        rootDocument: document,
      });

      observer.start();

      // Nhóm source-2 có tin mới nhưng KHÔNG nằm trong whitelist
      const item2 = document.querySelector('[data-id="conv-group-source-2"]');
      const dot = document.createElement('span');
      dot.className = 'unread-badge';
      item2?.appendChild(dot);

      observer.scanExisting();
      expect(onNewMsg).not.toHaveBeenCalledWith('conv-group-source-2');

      observer.stop();
    });
  });

  describe('Node 2: QueueManager', () => {
    it('should coordinate single mutex FIFO dispatching', async () => {
      const processed: string[] = [];
      qManager.setWorker(async (groupId) => {
        processed.push(groupId);
        await new Promise((r) => setTimeout(r, 10));
      });

      await qManager.enqueue('group_A');
      await qManager.enqueue('group_B');

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 150));

      expect(processed).toEqual(['group_A', 'group_B']);
      expect(qManager.isBusy()).toBe(false);
    });

    it('should recover stale PROCESSING items on initialize after F5', async () => {
      const id = (await queueRepo.enqueue('group_crash')) as number;
      await queueRepo.acquireLock(id);

      const recovered = await qManager.initialize();
      expect(recovered).toBe(1);

      const item = await testDb.group_dispatch_queue.get(id);
      expect(item?.status).toBe('PENDING');
    });
  });

  describe('Node 3: ChatSwitcher', () => {
    it('should switch active conversation and anchor strictly to bottom', async () => {
      const switcher = new ChatSwitcher(document);
      const switched = await switcher.switchToGroup('conv-group-source-1');

      expect(switched).toBe(true);

      const activeEl = document.querySelector('.conv-item.active');
      expect(activeEl?.getAttribute('data-id')).toBe('conv-group-source-1');

      const container = document.querySelector('.chat-message-list') as HTMLElement;
      expect(container.scrollTop).toBe(container.scrollHeight);
    });
  });

  describe('Node 4: DeltaStitcher', () => {
    it('should extract messages and stitch delta based on Checkpoint', async () => {
      const stitcher = new DeltaStitcher(testDb, document);

      // Chưa có checkpoint -> Quét fallback tin đáy
      const fallbackMessages = await stitcher.stitchDelta('conv-group-source-1');
      expect(fallbackMessages.length).toBe(2);
      expect(fallbackMessages[0]?.msgId).toBe('msg-001');
      expect(fallbackMessages[1]?.msgId).toBe('msg-002');
      expect(fallbackMessages[1]?.type).toBe('ALBUM');

      // Lưu Checkpoint tại msg-001
      await testDb.group_checkpoints.put({
        groupId: 'conv-group-source-1',
        lastMessageId: 'msg-001',
        lastSenderId: 'user-author-99',
        updatedAt: Date.now(),
      });

      // Quét lại -> Chỉ lấy các tin mới sau msg-001 (tức msg-002)
      const deltaMessages = await stitcher.stitchDelta('conv-group-source-1');
      expect(deltaMessages.length).toBe(1);
      expect(deltaMessages[0]?.msgId).toBe('msg-002');
      expect(deltaMessages[0]?.text).toContain('3.8 tỷ');
    });
  });

  describe('Node 5: BundleAggregator', () => {
    it('should aggregate consecutive messages of same sender into single EntityBundle', () => {
      const aggregator = new BundleAggregator();

      const messages = [
        {
          msgId: 'm1',
          senderId: 'user_1',
          senderName: 'Nguyen Van A',
          type: 'TEXT' as const,
          text: 'Bán nhà đẹp Cầu Giấy',
          timestamp: Date.now(),
        },
        {
          msgId: 'm2',
          senderId: 'user_1',
          senderName: 'Nguyen Van A',
          type: 'ALBUM' as const,
          text: 'Giá 4.5 tỷ chính chủ O9O.123.4567',
          mediaUrls: ['url_1', 'url_2'],
          timestamp: Date.now() + 1000,
        },
        {
          msgId: 'm3',
          senderId: 'user_2', // khác sender
          senderName: 'Le Thi B',
          type: 'TEXT' as const,
          text: 'Cần mua đất Đống Đa',
          timestamp: Date.now() + 2000,
        },
      ];

      const bundles = aggregator.aggregateBundles('group_source_1', messages);

      expect(bundles.length).toBe(2);

      // Bundle 1: Của user_1 (gộp m1 và m2)
      const b1 = bundles[0];
      expect(b1?.senderId).toBe('user_1');
      expect(b1?.messages.length).toBe(2);
      expect(b1?.rawCombinedText).toContain('Bán nhà đẹp Cầu Giấy\nGiá 4.5 tỷ');
      expect(EntityBundleSchema.safeParse(b1).success).toBe(true);

      // Bundle 2: Của user_2 (m3)
      const b2 = bundles[1];
      expect(b2?.senderId).toBe('user_2');
      expect(b2?.messages.length).toBe(1);
    });
  });

  describe('Toàn bộ chuỗi 5 Node (N1 -> N5 End-to-End Pipeline)', () => {
    it('should successfully capture, dispatch, switch, stitch, and seal bundle', async () => {
      const capturedBundles: EntityBundle[] = [];
      const stitcher = new DeltaStitcher(testDb, document);
      const switcher = new ChatSwitcher(document);
      const aggregator = new BundleAggregator();

      // Kết nối worker vào QueueManager
      qManager.setWorker(async (groupId) => {
        await switcher.switchToGroup(groupId);
        const deltaMsgs = await stitcher.stitchDelta(groupId);
        const bundles = aggregator.aggregateBundles(groupId, deltaMsgs);
        capturedBundles.push(...bundles);
      });

      // Node 1 phát hiện và enqueue
      await qManager.enqueue('conv-group-source-1');

      // Chờ hoàn thành chuỗi
      await new Promise((r) => setTimeout(r, 60));

      expect(capturedBundles.length).toBeGreaterThan(0);
      expect(capturedBundles[0]?.sourceGroupId).toBe('conv-group-source-1');
      expect(capturedBundles[0]?.messages.length).toBeGreaterThanOrEqual(1);
    });
  });
});
