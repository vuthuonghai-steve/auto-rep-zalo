import fs from 'node:fs';
import path from 'node:path';
import type { EntityBundle } from '@/contracts/schemas';
import { ZaloAutomationDatabase } from '@/db/database';
import { QueueRepository } from '@/db/queue-repo';
import { ChatSwitcher } from '@/nodes/n03-chat-switcher';
import { ForwardAutomator } from '@/nodes/n08-forward-automator';
import { TextInjector } from '@/nodes/n09-text-injector';
import { CommitterDrain } from '@/nodes/n10-committer-drain';
import { beforeEach, describe, expect, it } from 'vitest';

describe('User Story 4: Two-Phase Forwarding & Drain (Nodes 8, 9, 10) (tests/unit/us4-forward-drain.test.ts)', () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

  let testDb: ZaloAutomationDatabase;
  let queueRepo: QueueRepository;
  let switcher: ChatSwitcher;
  let forwardAutomator: ForwardAutomator;
  let textInjector: TextInjector;
  let committerDrain: CommitterDrain;

  beforeEach(async () => {
    document.body.innerHTML = fixtureHtml;
    testDb = new ZaloAutomationDatabase(`us4_test_${Date.now()}_${Math.random()}`);
    await testDb.open();
    queueRepo = new QueueRepository(testDb);
    switcher = new ChatSwitcher(document);
    forwardAutomator = new ForwardAutomator(document);
    textInjector = new TextInjector(switcher, document);
    committerDrain = new CommitterDrain(testDb, queueRepo);
  });

  const sampleBundle: EntityBundle = {
    bundleId: 'bundle_us4_test',
    sourceGroupId: 'conv-group-source-1',
    senderId: 'user-author-99',
    senderName: 'Trần Văn Cảnh',
    messages: [
      {
        msgId: 'msg-001',
        type: 'TEXT',
        text: 'Em gửi thông tin căn hộ Trung Kính sáng nay nhé!',
        timestamp: Date.now() - 2000,
      },
      {
        msgId: 'msg-002',
        type: 'ALBUM',
        text: 'Bán gấp nhà Cầu Giấy ngõ thông 35m2 x 5 tầng, giá chốt 3.8 tỷ có thương lượng. Liên hệ: O9O.123.4567',
        mediaUrls: ['img-01', 'img-02'],
        timestamp: Date.now(),
      },
    ],
    rawCombinedText:
      'Em gửi thông tin căn hộ Trung Kính sáng nay nhé!\nBán gấp nhà Cầu Giấy ngõ thông 35m2 x 5 tầng, giá chốt 3.8 tỷ có thương lượng. Liên hệ: O9O.123.4567',
    extractedPhone: '0901234567',
    detectedPrice: 3.8,
    targetGroupIds: ['conv-target-2b-5b'],
    createdAt: Date.now(),
  };

  describe('Node 8: ForwardAutomator (Pha 1 - Native Modal & Toast)', () => {
    it('should open modal, check targets, confirm forward, and trigger toast success', async () => {
      const targets = ['conv-target-2b-5b'];
      const success = await forwardAutomator.forwardPhase1(sampleBundle, targets);

      expect(success).toBe(true);

      // Verify target checkbox was checked
      const checkbox = document.querySelector<HTMLInputElement>(
        'input[name="target_group"][value="conv-target-2b-5b"]',
      );
      expect(checkbox?.checked).toBe(true);

      // Verify toast success display
      const toast = document.querySelector<HTMLElement>('.toast-success');
      expect(toast?.style.display).toBe('block');
    });

    it('should return false if targets list is empty', async () => {
      const success = await forwardAutomator.forwardPhase1(sampleBundle, []);
      expect(success).toBe(false);
    });
  });

  describe('Node 9: TextInjector (Pha 2 - Destination Injection & Return to Source)', () => {
    it('should navigate to target group, inject text via React DOM bridge, send, and return to source', async () => {
      const targets = ['conv-target-2b-5b'];
      const editedText = 'Bán nhà Cầu Giấy 3.8 tỷ. Liên hệ chính chủ: 0999888777';

      const success = await textInjector.injectTextPhase2(
        sampleBundle.sourceGroupId,
        targets,
        editedText,
        false,
      );

      expect(success).toBe(true);

      // Verify the active conversation is back to source group (conv-group-source-1)
      const activeItem = document.querySelector('.conv-item.active');
      expect(activeItem?.getAttribute('data-id')).toBe('conv-group-source-1');
    });
  });

  describe('Node 10: CommitterDrain (Quiescence, Checkpoint & Mutex Release)', () => {
    it('should save Checkpoint to Dexie and complete queue task after quiescence buffer', async () => {
      // Setup queue item with PROCESSING status
      const queueId = (await queueRepo.enqueue('conv-group-source-1')) as number;
      await queueRepo.acquireLock(queueId);

      const success = await committerDrain.commitAndDrain(
        sampleBundle.sourceGroupId,
        sampleBundle,
        10, // 10ms for fast test
        Date.now() - 500,
      );

      expect(success).toBe(true);

      // Verify Checkpoint updated in Dexie
      const checkpoint = await testDb.group_checkpoints.get('conv-group-source-1');
      expect(checkpoint).toBeDefined();
      expect(checkpoint?.lastMessageId).toBe('msg-002');
      expect(checkpoint?.lastSenderId).toBe('user-author-99');

      // Verify queue item marked COMPLETED
      const queueItem = await testDb.group_dispatch_queue.get(queueId);
      expect(queueItem?.status).toBe('COMPLETED');
    });
  });

  describe('Chuỗi hoàn chỉnh Pha 1 & Pha 2 (N8 -> N9 -> N10)', () => {
    it('should execute full 2-phase forwarding pipeline and successfully drain', async () => {
      const targets = ['conv-target-2b-5b'];
      const editedText = 'Bán nhà Cầu Giấy 3.8 tỷ. Liên hệ: 0999888777';

      // 1. Pha 1: Forward media qua Modal
      const p1Success = await forwardAutomator.forwardPhase1(sampleBundle, targets);
      expect(p1Success).toBe(true);

      // 2. Pha 2: Tiêm văn bản và quay lại nhóm nguồn
      const p2Success = await textInjector.injectTextPhase2(
        sampleBundle.sourceGroupId,
        targets,
        editedText,
      );
      expect(p2Success).toBe(true);

      // 3. Pha 3: Committer Drain ghi Checkpoint
      const drainSuccess = await committerDrain.commitAndDrain(
        sampleBundle.sourceGroupId,
        sampleBundle,
        10,
      );
      expect(drainSuccess).toBe(true);

      // Khẳng định trạng thái kết thúc hoàn mỹ
      const activeConv = document.querySelector('.conv-item.active');
      expect(activeConv?.getAttribute('data-id')).toBe(sampleBundle.sourceGroupId);

      const finalCheckpoint = await testDb.group_checkpoints.get(sampleBundle.sourceGroupId);
      expect(finalCheckpoint?.lastMessageId).toBe('msg-002');
    });
  });
});
