import type { WhitelistGroupItem } from '@/contracts/schemas';
import { ZaloAutomationDatabase } from '@/db/database';
import {
  SidebarObserver,
  discoverSidebarGroups,
  loadWhitelistSettings,
  syncWhitelistSettings,
} from '@/nodes/n01-sidebar-observer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_FIXTURE_METADATA, createMockSidebarDOM } from '../fixtures/sidebar-dom.fixture';

describe('Node 01: Sidebar Observer Discovery & Hot-Sync Whitelist (tests/unit/n01-sidebar-discovery.test.ts)', () => {
  let testDb: ZaloAutomationDatabase;

  beforeEach(() => {
    document.body.innerHTML = '';
    testDb = new ZaloAutomationDatabase(`TestDiscoveryDB_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (testDb) {
      await testDb.delete();
    }
  });

  describe('Suite 1: discoverSidebarGroups DOM Extraction & Normalization (GATE-N01-06)', () => {
    it('should accurately discover all groups from sidebar DOM fixture with normalized properties', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const discovered = discoverSidebarGroups(document);
      expect(discovered).toBeDefined();
      expect(discovered.length).toBeGreaterThanOrEqual(3);

      // 1. Kiểm chứng Community Group (5+ unread)
      const commItem = discovered.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.communityGroup.groupId,
      );
      expect(commItem).toBeDefined();
      if (!commItem) throw new Error('Community item not found');

      expect(commItem.groupId).toBe(SIDEBAR_FIXTURE_METADATA.communityGroup.groupId);
      expect(commItem.groupName).toBe(SIDEBAR_FIXTURE_METADATA.communityGroup.groupName);
      expect(commItem.groupName).not.toContain('&nbsp;');
      expect(commItem.isCommunity).toBe(true);
      expect(commItem.unreadCount).toBe(5);
      expect(commItem.lastSnippet).toBe('https://drive....');
      expect(commItem.avatarUrl).toContain('2dc8873c255f5e7e19212d5421429d7a.jpg');
      expect(commItem.isInWhitelist).toBe(false);

      // 2. Kiểm chứng Muted Group (red dot = 1 unread)
      const mutedItem = discovered.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
      );
      expect(mutedItem).toBeDefined();
      if (!mutedItem) throw new Error('Muted item not found');

      expect(mutedItem.groupId).toBe(SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId);
      expect(mutedItem.groupName).toBe(SIDEBAR_FIXTURE_METADATA.mutedGroup.groupName);
      expect(mutedItem.isCommunity).toBe(false);
      expect(mutedItem.unreadCount).toBe(1);
      expect(mutedItem.lastSnippet).toBe('7h sáng khách đi xem phòng');
      expect(mutedItem.isInWhitelist).toBe(false);

      // In snapshot kiểm chứng GATE-N01-06
      console.log('=== [GATE-N01-06 DISCOVERY SNAPSHOT: ALL DISCOVERED GROUPS] ===');
      console.log(JSON.stringify(discovered, null, 2));
    });

    it('should reflect isInWhitelist correctly based on currentWhitelist input', () => {
      createMockSidebarDOM({ attachToDocument: true });

      // Trường hợp 1: Whitelist truyền Set các groupId
      const whitelistSet = new Set([SIDEBAR_FIXTURE_METADATA.communityGroup.groupId]);
      const resWithSet = discoverSidebarGroups(document, whitelistSet);

      const comm1 = resWithSet.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.communityGroup.groupId,
      );
      const muted1 = resWithSet.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
      );

      expect(comm1?.isInWhitelist).toBe(true);
      expect(muted1?.isInWhitelist).toBe(false);

      // Trường hợp 2: Whitelist truyền mảng WhitelistGroupItem với matchingRule CONTAINS
      const whitelistRules: WhitelistGroupItem[] = [
        {
          groupId: '',
          groupName: 'Home Team',
          matchingRule: 'CONTAINS',
          priority: 1,
          isEnabled: true,
          addedAt: Date.now(),
          lastUpdatedAt: Date.now(),
        },
      ];
      const resWithRules = discoverSidebarGroups(document, whitelistRules);

      const comm2 = resWithRules.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.communityGroup.groupId,
      );
      const muted2 = resWithRules.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
      );

      expect(comm2?.isInWhitelist).toBe(false);
      expect(muted2?.isInWhitelist).toBe(true);
    });

    it('should work via observer instance method discoverGroups()', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage: vi.fn(),
        rootDocument: document,
      });

      const discovered = observer.discoverGroups();
      expect(discovered.length).toBeGreaterThan(0);

      const comm = discovered.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.communityGroup.groupId,
      );
      expect(comm?.isInWhitelist).toBe(true);
    });
  });

  describe('Suite 2: Hot-Sync Whitelist Settings & Dexie Storage (GATE-N01-04)', () => {
    it('should persist whitelist to Dexie app_settings and live update observer in RAM without restart', async () => {
      createMockSidebarDOM({ attachToDocument: true });

      const onNewMsg = vi.fn();
      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage: onNewMsg,
        rootDocument: document,
        dbInstance: testDb,
      });

      // Ban đầu: chỉ có communityGroup trong whitelist
      expect(observer.matchWhitelist(SIDEBAR_FIXTURE_METADATA.communityGroup.groupId, '')).toBe(
        true,
      );
      expect(
        observer.matchWhitelist(
          SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
          SIDEBAR_FIXTURE_METADATA.mutedGroup.groupName,
        ),
      ).toBe(false);

      // Thao tác 1-Click: Thêm mutedGroup vào whitelist qua Hot-Sync
      const updatedRules: WhitelistGroupItem[] = [
        {
          groupId: SIDEBAR_FIXTURE_METADATA.communityGroup.groupId,
          groupName: SIDEBAR_FIXTURE_METADATA.communityGroup.groupName,
          matchingRule: 'EXACT',
          priority: 1,
          isEnabled: true,
          addedAt: Date.now(),
          lastUpdatedAt: Date.now(),
        },
        {
          groupId: SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
          groupName: SIDEBAR_FIXTURE_METADATA.mutedGroup.groupName,
          matchingRule: 'EXACT',
          priority: 2,
          isEnabled: true,
          addedAt: Date.now(),
          lastUpdatedAt: Date.now(),
        },
      ];

      await syncWhitelistSettings(updatedRules, testDb, observer);

      // 1. Kiểm chứng bản ghi trong bảng app_settings của Dexie
      const savedInDb = await testDb.app_settings.get('n01_whitelist_groups');
      expect(savedInDb).toBeDefined();
      expect(savedInDb?.key).toBe('n01_whitelist_groups');
      expect((savedInDb?.value as { groups: WhitelistGroupItem[] }).groups).toHaveLength(2);

      // 2. Kiểm chứng loadWhitelistSettings đọc đúng dữ liệu từ DB
      const loadedRules = await loadWhitelistSettings(testDb);
      expect(loadedRules).toHaveLength(2);
      expect(loadedRules[1]?.groupId).toBe(SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId);

      // 3. Kiểm chứng hiệu lực tức thời trong RAM (Zero F5)
      expect(
        observer.matchWhitelist(
          SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
          SIDEBAR_FIXTURE_METADATA.mutedGroup.groupName,
        ),
      ).toBe(true);

      // 4. Thao tác 1-Click: Gỡ bỏ mutedGroup khỏi Whitelist
      const prunedRules = updatedRules.filter(
        (r) => r.groupId !== SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
      );
      await syncWhitelistSettings(prunedRules, testDb, observer);

      const reloadedRules = await loadWhitelistSettings(testDb);
      expect(reloadedRules).toHaveLength(1);
      expect(
        observer.matchWhitelist(
          SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
          SIDEBAR_FIXTURE_METADATA.mutedGroup.groupName,
        ),
      ).toBe(false);

      console.log('=== [GATE-N01-04 HOT-SYNC SNAPSHOT: WHITELIST PERSISTED & RAM UPDATED] ===');
      console.log(JSON.stringify(reloadedRules, null, 2));
    });
  });

  describe('Suite 3: Boundary & Resilience Guard', () => {
    it('should return empty array if document or sidebar container is missing', () => {
      // document rỗng, không có sidebar
      const emptyResult = discoverSidebarGroups(document);
      expect(emptyResult).toEqual([]);

      // targetDoc là undefined
      const undefinedResult = discoverSidebarGroups(undefined);
      expect(Array.isArray(undefinedResult)).toBe(true);
    });

    it('should gracefully handle malformed conversation items without throwing errors', () => {
      const wrapper = document.createElement('div');
      wrapper.id = 'conversationList';
      wrapper.innerHTML = `
        <div class="msg-item" data-id="malformed_item_1"></div>
        <div class="msg-item" anim-data-id="g99999">
          <div class="conv-item-title__name"></div>
        </div>
      `;
      document.body.appendChild(wrapper);

      const result = discoverSidebarGroups(document);
      expect(result).toHaveLength(2);
      expect(result[0]?.groupId).toBe('malformed_item_1');
      expect(result[0]?.groupName).toBe('Nhóm malformed_item_1');
      expect(result[0]?.unreadCount).toBe(0);
      expect(result[1]?.groupId).toBe('g99999');
      expect(result[1]?.groupName).toBe('Nhóm g99999');
    });
  });
});
