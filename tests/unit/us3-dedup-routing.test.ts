import type { EntityBundle, PriceRouteRule } from '@/contracts/schemas';
import { ZaloAutomationDatabase } from '@/db/database';
import { DedupRepository } from '@/db/dedup-repo';
import { DedupGate } from '@/nodes/n06-dedup-gate';
import {
  PriceRouter,
  editMessageText,
  extractPhoneNumber,
  extractPriceInBillion,
} from '@/nodes/n07-price-router';
import { beforeEach, describe, expect, it } from 'vitest';

describe('User Story 3: Dedup Gate & Price Router (Nodes 6 & 7) (tests/unit/us3-dedup-routing.test.ts)', () => {
  let testDb: ZaloAutomationDatabase;
  let dedupRepo: DedupRepository;
  let dedupGate: DedupGate;
  let priceRouter: PriceRouter;

  beforeEach(async () => {
    testDb = new ZaloAutomationDatabase(`us3_test_${Date.now()}_${Math.random()}`);
    await testDb.open();
    dedupRepo = new DedupRepository(testDb);
    dedupGate = new DedupGate(dedupRepo);
    priceRouter = new PriceRouter();
  });

  describe('Bóc tách số điện thoại lách luật (extractPhoneNumber)', () => {
    it('should extract standard Vietnamese mobile phone numbers', () => {
      expect(extractPhoneNumber('Liên hệ: 0901234567 để xem nhà')).toBe('0901234567');
      expect(extractPhoneNumber('Hotline: 0987654321')).toBe('0987654321');
    });

    it('should extract phone numbers separated by dots, spaces or hyphens', () => {
      expect(extractPhoneNumber('SĐT: 090.123.4567')).toBe('0901234567');
      expect(extractPhoneNumber('Gọi ngay 091-234-5678')).toBe('0912345678');
      expect(extractPhoneNumber('Liên hệ 098 123 4567')).toBe('0981234567');
    });

    it('should decode bypass obfuscations: O/o -> 0, I/l -> 1', () => {
      expect(extractPhoneNumber('Chính chủ: O9O.123.4567')).toBe('0901234567');
      expect(extractPhoneNumber('Alo: o912.345.678')).toBe('0912345678');
      expect(extractPhoneNumber('Zalo: O98.l23.4567')).toBe('0981234567');
    });

    it('should return null when text has no valid mobile phone', () => {
      expect(extractPhoneNumber('Bán căn hộ 70m2 giá thương lượng')).toBeNull();
      expect(extractPhoneNumber('Mã căn 12345')).toBeNull();
    });
  });

  describe('Bóc tách khoảng giá tiếng Việt (extractPriceInBillion)', () => {
    it('should parse price in billions (tỷ / ty / b)', () => {
      expect(extractPriceInBillion('Bán nhà ngõ thông giá 3.8 tỷ')).toBe(3.8);
      expect(extractPriceInBillion('Chốt gấp 12 tỷ')).toBe(12);
      expect(extractPriceInBillion('Giá 4,5ty thương lượng')).toBe(4.5);
    });

    it('should parse format like "3 tỷ 5" -> 3.5', () => {
      expect(extractPriceInBillion('Nhà đẹp 3 tỷ 5 có thương lượng')).toBe(3.5);
      expect(extractPriceInBillion('Chính chủ cần bán 4 tỷ 2')).toBe(4.2);
    });

    it('should parse and convert price in millions (triệu / tr) to billions', () => {
      expect(extractPriceInBillion('Đất ngoại thành 850 triệu')).toBe(0.85);
      expect(extractPriceInBillion('Cho thuê 500tr')).toBe(0.5);
    });

    it('should return null when text contains no price info', () => {
      expect(extractPriceInBillion('Nhà mặt phố Cầu Giấy cực đẹp')).toBeNull();
    });
  });

  describe('Biên tập nội dung (editMessageText)', () => {
    it('should replace seller phone with operator phone', () => {
      const raw = 'Bán nhà 3.8 tỷ. Liên hệ: O9O.123.4567 chính chủ';
      const edited = editMessageText(raw, '0999888777');
      expect(edited).toContain('0999888777');
      expect(edited).not.toContain('O9O.123.4567');
    });
  });

  describe('Node 7: PriceRouter', () => {
    it('should route to correct target groups and cap at <= 2 destination groups', () => {
      const customRules: PriceRouteRule[] = [
        {
          id: 'r1',
          label: 'Dưới 2 Tỷ',
          minPrice: 0,
          maxPrice: 2,
          targetGroupIds: ['conv-target-under-2b'],
        },
        {
          id: 'r2',
          label: '2 - 5 Tỷ',
          minPrice: 2,
          maxPrice: 5,
          targetGroupIds: ['conv-target-2b-5b', 'conv-target-shared'],
        },
      ];

      const bundle: EntityBundle = {
        bundleId: 'b_test_price',
        sourceGroupId: 'g_source',
        senderId: 'user_1',
        messages: [
          { msgId: 'm1', type: 'TEXT', text: 'Nhà Cầu Giấy 3.8 tỷ', timestamp: Date.now() },
        ],
        rawCombinedText: 'Nhà Cầu Giấy 3.8 tỷ. Liên hệ: 0901234567',
        targetGroupIds: [],
        createdAt: Date.now(),
      };

      const result = priceRouter.routeBundle(bundle, customRules);
      expect(result.detectedPrice).toBe(3.8);
      expect(result.extractedPhone).toBe('0901234567');
      expect(result.targetGroupIds).toEqual(['conv-target-2b-5b', 'conv-target-shared']);
      expect(result.targetGroupIds.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Node 6: DedupGate (2-Layer Deduplication 30 Days)', () => {
    it('should allow first-time bundle and save to entities table', async () => {
      const bundle: EntityBundle = {
        bundleId: 'b_unique_1',
        sourceGroupId: 'g_source',
        senderId: 'user_1',
        messages: [
          { msgId: 'm1', type: 'TEXT', text: 'Nhà Cầu Giấy 3.8 tỷ', timestamp: Date.now() },
        ],
        rawCombinedText: 'Bán nhà Cầu Giấy 3.8 tỷ. Liên hệ: 0901234567',
        targetGroupIds: ['conv-target-2b-5b'],
        createdAt: Date.now(),
      };

      const result = await dedupGate.checkAndRegister(bundle);
      expect(result.allowed).toBe(true);
      expect(result.entityKey).toBe('0901234567');
      expect(result.contentHash.length).toBe(64);

      expect(await dedupRepo.count()).toBe(1);
    });

    it('should reject duplicate by Layer 1: entityKey (Phone Number) within 30 days', async () => {
      // Tin 1
      const bundle1: EntityBundle = {
        bundleId: 'b_phone_1',
        sourceGroupId: 'g_source',
        senderId: 'user_1',
        messages: [{ msgId: 'm1', type: 'TEXT', text: 'Nhà 1', timestamp: Date.now() }],
        rawCombinedText: 'Bán nhà ngõ 3.5 tỷ. LH: O9O.123.4567',
        targetGroupIds: [],
        createdAt: Date.now(),
      };
      await dedupGate.checkAndRegister(bundle1);

      // Tin 2: Văn bản khác hoàn toàn nhưng CÙNG số điện thoại
      const bundle2: EntityBundle = {
        bundleId: 'b_phone_2',
        sourceGroupId: 'g_source',
        senderId: 'user_2',
        messages: [{ msgId: 'm2', type: 'TEXT', text: 'Nhà 2', timestamp: Date.now() }],
        rawCombinedText: 'Cần bán gấp nhà mặt phố 4 tỷ chính chủ: 0901234567',
        targetGroupIds: [],
        createdAt: Date.now(),
      };

      const check = await dedupGate.checkAndRegister(bundle2);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('DUPLICATE_ENTITY_KEY');
    });

    it('should reject duplicate by Layer 2: contentHash within 30 days', async () => {
      // Tin 1: Không có SĐT
      const bundle1: EntityBundle = {
        bundleId: 'b_hash_1',
        sourceGroupId: 'g_source',
        senderId: 'user_1',
        messages: [{ msgId: 'm1', type: 'TEXT', text: 'Bán đất 2 tỷ', timestamp: Date.now() }],
        rawCombinedText: 'Đất nền Hòa Lạc giá 2 tỷ ngõ rộng 6m',
        targetGroupIds: [],
        createdAt: Date.now(),
      };
      await dedupGate.checkAndRegister(bundle1);

      // Tin 2: Nội dung tương tự với emoji và khoảng trắng thừa
      const bundle2: EntityBundle = {
        bundleId: 'b_hash_2',
        sourceGroupId: 'g_source',
        senderId: 'user_2',
        messages: [{ msgId: 'm2', type: 'TEXT', text: 'Bán đất 2 tỷ', timestamp: Date.now() }],
        rawCombinedText: '🔥 Đất nền Hòa Lạc giá 2 tỷ ngõ rộng 6m 🔥',
        targetGroupIds: [],
        createdAt: Date.now(),
      };

      const check = await dedupGate.checkAndRegister(bundle2);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('DUPLICATE_CONTENT_HASH');
    });
  });

  describe('Chuỗi tích hợp N6 -> N7 (Dedup Gate -> Price Router)', () => {
    it('should filter duplicates and route legitimate bundles to destination groups', async () => {
      const legitimateBundle: EntityBundle = {
        bundleId: 'b_legit_1',
        sourceGroupId: 'g_source_cau_giay',
        senderId: 'u_seller_88',
        messages: [{ msgId: 'm1', type: 'TEXT', text: 'Nhà đẹp', timestamp: Date.now() }],
        rawCombinedText: 'Bán nhà Trần Thái Tông 4.2 tỷ. LH: O91.234.5678',
        targetGroupIds: [],
        createdAt: Date.now(),
      };

      // Bước 1: Qua Node 6 (Dedup Gate)
      const dedupResult = await dedupGate.checkAndRegister(legitimateBundle);
      expect(dedupResult.allowed).toBe(true);

      // Bước 2: Qua Node 7 (Price Router)
      const routeResult = priceRouter.routeBundle(legitimateBundle);
      expect(routeResult.detectedPrice).toBe(4.2);
      expect(routeResult.targetGroupIds).toContain('conv-target-2b-5b');
      expect(routeResult.targetGroupIds.length).toBeLessThanOrEqual(2);
    });
  });
});
