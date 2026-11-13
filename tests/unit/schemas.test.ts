import { describe, expect, it } from 'vitest';
import {
  DiscoveredGroupItemSchema,
  GroupDetectedEventSchema,
  N01ConfigSchema,
  WhitelistGroupItemSchema,
  WhitelistMatchingRuleSchema,
} from '@/contracts/schemas';

describe('Node 01 Zod Schemas Contract (tests/unit/schemas.test.ts)', () => {
  describe('WhitelistMatchingRuleSchema', () => {
    it('should accept valid matching rules: EXACT and CONTAINS', () => {
      const exactRule = WhitelistMatchingRuleSchema.parse('EXACT');
      const containsRule = WhitelistMatchingRuleSchema.parse('CONTAINS');

      expect(exactRule).toBe('EXACT');
      expect(containsRule).toBe('CONTAINS');
      console.log('[SNAPSHOT - WhitelistMatchingRuleSchema valid]:', { exactRule, containsRule });
    });

    it('should reject invalid matching rules', () => {
      expect(() => WhitelistMatchingRuleSchema.parse('REGEX')).toThrow();
      expect(() => WhitelistMatchingRuleSchema.parse('')).toThrow();
      expect(() => WhitelistMatchingRuleSchema.parse(null)).toThrow();
    });
  });

  describe('WhitelistGroupItemSchema', () => {
    it('should validate and apply default values for nominal payload', () => {
      const raw = {
        groupId: 'g1206626154231863388',
        groupName: 'TL21House - NGUỒN <4tr',
        matchingRule: 'CONTAINS',
        addedAt: 1731456000000,
        lastUpdatedAt: 1731456000000,
      };

      const parsed = WhitelistGroupItemSchema.parse(raw);

      expect(parsed.groupId).toBe('g1206626154231863388');
      expect(parsed.groupName).toBe('TL21House - NGUỒN <4tr');
      expect(parsed.matchingRule).toBe('CONTAINS');
      expect(parsed.priority).toBe(1); // default
      expect(parsed.isEnabled).toBe(true); // default
      expect(parsed.addedAt).toBe(1731456000000);
      expect(parsed.lastUpdatedAt).toBe(1731456000000);

      console.log('[SNAPSHOT - WhitelistGroupItemSchema nominal]:', JSON.stringify(parsed, null, 2));
      expect(parsed).toMatchInlineSnapshot(`
        {
          "addedAt": 1731456000000,
          "groupId": "g1206626154231863388",
          "groupName": "TL21House - NGUỒN <4tr",
          "isEnabled": true,
          "lastUpdatedAt": 1731456000000,
          "matchingRule": "CONTAINS",
          "priority": 1,
        }
      `);
    });

    it('should accept custom priority and isEnabled status', () => {
      const custom = {
        groupId: 'g999888777',
        groupName: 'VIP Group Priority 5',
        matchingRule: 'EXACT',
        priority: 5,
        isEnabled: false,
        addedAt: 1731456000000,
        lastUpdatedAt: 1731456005000,
      };

      const parsed = WhitelistGroupItemSchema.parse(custom);
      expect(parsed.priority).toBe(5);
      expect(parsed.isEnabled).toBe(false);
    });

    it('should reject invalid payloads fail-fast', () => {
      // Empty groupId
      expect(() =>
        WhitelistGroupItemSchema.parse({
          groupId: '',
          groupName: 'Group',
          matchingRule: 'EXACT',
          addedAt: 1000,
          lastUpdatedAt: 1000,
        })
      ).toThrow();

      // Empty groupName
      expect(() =>
        WhitelistGroupItemSchema.parse({
          groupId: 'g123',
          groupName: '',
          matchingRule: 'EXACT',
          addedAt: 1000,
          lastUpdatedAt: 1000,
        })
      ).toThrow();

      // Priority out of bounds (> 5)
      expect(() =>
        WhitelistGroupItemSchema.parse({
          groupId: 'g123',
          groupName: 'Group',
          matchingRule: 'EXACT',
          priority: 6,
          addedAt: 1000,
          lastUpdatedAt: 1000,
        })
      ).toThrow();

      // Priority out of bounds (< 1)
      expect(() =>
        WhitelistGroupItemSchema.parse({
          groupId: 'g123',
          groupName: 'Group',
          matchingRule: 'EXACT',
          priority: 0,
          addedAt: 1000,
          lastUpdatedAt: 1000,
        })
      ).toThrow();

      // Non-positive timestamp
      expect(() =>
        WhitelistGroupItemSchema.parse({
          groupId: 'g123',
          groupName: 'Group',
          matchingRule: 'EXACT',
          addedAt: -500,
          lastUpdatedAt: 1000,
        })
      ).toThrow();
    });
  });

  describe('DiscoveredGroupItemSchema', () => {
    it('should validate nominal discovered group with defaults', () => {
      const raw = {
        groupId: 'g1206626154231863388',
        groupName: 'Căn Hộ Mini Sài Gòn',
      };

      const parsed = DiscoveredGroupItemSchema.parse(raw);

      expect(parsed.groupId).toBe('g1206626154231863388');
      expect(parsed.groupName).toBe('Căn Hộ Mini Sài Gòn');
      expect(parsed.avatarUrl).toBeUndefined();
      expect(parsed.isCommunity).toBe(false);
      expect(parsed.unreadCount).toBe(0);
      expect(parsed.lastSnippet).toBeUndefined();
      expect(parsed.isInWhitelist).toBe(false);

      console.log('[SNAPSHOT - DiscoveredGroupItemSchema nominal]:', JSON.stringify(parsed, null, 2));
      expect(parsed).toMatchInlineSnapshot(`
        {
          "groupId": "g1206626154231863388",
          "groupName": "Căn Hộ Mini Sài Gòn",
          "isCommunity": false,
          "isInWhitelist": false,
          "unreadCount": 0,
        }
      `);
    });

    it('should accept full populated discovered group item', () => {
      const raw = {
        groupId: 'g456789012',
        groupName: 'Cộng Đồng Nhà Đất',
        avatarUrl: 'https://zalo.me/avatar/g456789012.jpg',
        isCommunity: true,
        unreadCount: 15,
        lastSnippet: 'Có phòng mới giá 3.5tr',
        isInWhitelist: true,
      };

      const parsed = DiscoveredGroupItemSchema.parse(raw);
      expect(parsed.isCommunity).toBe(true);
      expect(parsed.unreadCount).toBe(15);
      expect(parsed.lastSnippet).toBe('Có phòng mới giá 3.5tr');
      expect(parsed.isInWhitelist).toBe(true);
      expect(parsed.avatarUrl).toBe('https://zalo.me/avatar/g456789012.jpg');
    });

    it('should reject invalid discovered group payload', () => {
      // Empty groupId
      expect(() =>
        DiscoveredGroupItemSchema.parse({
          groupId: '',
          groupName: 'Name',
        })
      ).toThrow();

      // Negative unreadCount
      expect(() =>
        DiscoveredGroupItemSchema.parse({
          groupId: 'g123',
          groupName: 'Name',
          unreadCount: -1,
        })
      ).toThrow();
    });
  });

  describe('GroupDetectedEventSchema', () => {
    it('should validate nominal group detected event', () => {
      const raw = {
        groupId: 'g1206626154231863388',
        groupName: 'TL21House - NGUỒN <4tr',
        unreadCount: 3,
        lastSnippet: 'Cho thuê căn 1PN full nội thất',
        senderName: 'Nguyễn Văn A',
        detectedAt: 1731456100000,
        correlationId: 'corr_1731456100000_abc123',
      };

      const parsed = GroupDetectedEventSchema.parse(raw);

      expect(parsed.groupId).toBe('g1206626154231863388');
      expect(parsed.groupName).toBe('TL21House - NGUỒN <4tr');
      expect(parsed.unreadCount).toBe(3);
      expect(parsed.lastSnippet).toBe('Cho thuê căn 1PN full nội thất');
      expect(parsed.senderName).toBe('Nguyễn Văn A');
      expect(parsed.detectedAt).toBe(1731456100000);
      expect(parsed.correlationId).toBe('corr_1731456100000_abc123');
      expect(parsed.isCommunity).toBe(false); // default

      console.log('[SNAPSHOT - GroupDetectedEventSchema nominal]:', JSON.stringify(parsed, null, 2));
      expect(parsed).toMatchInlineSnapshot(`
        {
          "correlationId": "corr_1731456100000_abc123",
          "detectedAt": 1731456100000,
          "groupId": "g1206626154231863388",
          "groupName": "TL21House - NGUỒN <4tr",
          "isCommunity": false,
          "lastSnippet": "Cho thuê căn 1PN full nội thất",
          "senderName": "Nguyễn Văn A",
          "unreadCount": 3,
        }
      `);
    });

    it('should reject invalid group detected event', () => {
      // Missing correlationId
      expect(() =>
        GroupDetectedEventSchema.parse({
          groupId: 'g123',
          groupName: 'Name',
          unreadCount: 1,
          detectedAt: 1731456000000,
        })
      ).toThrow();

      // Empty correlationId
      expect(() =>
        GroupDetectedEventSchema.parse({
          groupId: 'g123',
          groupName: 'Name',
          unreadCount: 1,
          detectedAt: 1731456000000,
          correlationId: '',
        })
      ).toThrow();

      // Non-positive detectedAt
      expect(() =>
        GroupDetectedEventSchema.parse({
          groupId: 'g123',
          groupName: 'Name',
          unreadCount: 1,
          detectedAt: 0,
          correlationId: 'corr_test',
        })
      ).toThrow();
    });
  });

  describe('N01ConfigSchema', () => {
    it('should supply default values when initialized empty', () => {
      const parsed = N01ConfigSchema.parse({});

      expect(parsed.debounceMs).toBe(300);
      expect(parsed.maxDebounceBufferMs).toBe(1500);
      expect(parsed.autoAttachTimeoutMs).toBe(30000);
      expect(parsed.reconnectCooldownMs).toBe(500);

      console.log('[SNAPSHOT - N01ConfigSchema defaults]:', JSON.stringify(parsed, null, 2));
      expect(parsed).toMatchInlineSnapshot(`
        {
          "autoAttachTimeoutMs": 30000,
          "debounceMs": 300,
          "maxDebounceBufferMs": 1500,
          "reconnectCooldownMs": 500,
        }
      `);
    });

    it('should accept custom configuration parameters', () => {
      const custom = {
        debounceMs: 500,
        maxDebounceBufferMs: 2000,
        autoAttachTimeoutMs: 60000,
        reconnectCooldownMs: 1000,
      };

      const parsed = N01ConfigSchema.parse(custom);
      expect(parsed).toEqual(custom);
    });

    it('should reject negative or zero values for debounceMs and buffer', () => {
      expect(() => N01ConfigSchema.parse({ debounceMs: 0 })).toThrow();
      expect(() => N01ConfigSchema.parse({ debounceMs: -100 })).toThrow();
      expect(() => N01ConfigSchema.parse({ maxDebounceBufferMs: -500 })).toThrow();
      expect(() => N01ConfigSchema.parse({ autoAttachTimeoutMs: 0 })).toThrow();
    });
  });
});
