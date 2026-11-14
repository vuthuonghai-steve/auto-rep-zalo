import { ZaloAutomationDatabase } from '@/db/database';
import { SidebarObserver } from '@/nodes/n01-sidebar-observer';
import { sidebarObserverSignals } from '@/screens/sidebar-observer/sidebar-observer.signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIDEBAR_FIXTURE_METADATA, createMockSidebarDOM } from '../fixtures/sidebar-dom.fixture';

describe('Node 01: Sidebar Observer Screen & Reactive Signals Store (tests/unit/n01-sidebar-screen.test.ts)', () => {
  let testDb: ZaloAutomationDatabase;

  beforeEach(() => {
    document.body.innerHTML = '';
    sidebarObserverSignals.reset();
    testDb = new ZaloAutomationDatabase(`TestScreenDB_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    sidebarObserverSignals.reset();
    if (testDb) {
      await testDb.delete();
    }
  });

  describe('Suite 1: Signals Store - Scan & Discovery Lifecycle', () => {
    it('should scan groups from DOM fixture and update reactive signals', async () => {
      createMockSidebarDOM({ attachToDocument: true });

      expect(sidebarObserverSignals.discoveredGroups.value).toHaveLength(0);
      expect(sidebarObserverSignals.totalDiscovered.value).toBe(0);

      const results = await sidebarObserverSignals.scanGroups(document);

      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(sidebarObserverSignals.discoveredGroups.value.length).toBe(results.length);
      expect(sidebarObserverSignals.totalDiscovered.value).toBe(results.length);

      // Kiểm chứng viễn trắc telemetryStats
      expect(sidebarObserverSignals.telemetryStats.value.totalDiscovered).toBe(results.length);
    });

    it('should filter discovered groups by search query (name or id)', async () => {
      createMockSidebarDOM({ attachToDocument: true });
      await sidebarObserverSignals.scanGroups(document);

      expect(sidebarObserverSignals.filteredGroups.value.length).toBeGreaterThanOrEqual(3);

      // 1. Tìm theo từ khóa trong tên: "TL21"
      sidebarObserverSignals.setSearchQuery('TL21');
      expect(sidebarObserverSignals.filteredGroups.value).toHaveLength(1);
      expect(sidebarObserverSignals.filteredGroups.value[0]?.groupId).toBe(
        SIDEBAR_FIXTURE_METADATA.communityGroup.groupId,
      );

      // 2. Tìm theo groupId một phần
      sidebarObserverSignals.setSearchQuery('7140739336');
      expect(sidebarObserverSignals.filteredGroups.value).toHaveLength(1);
      expect(sidebarObserverSignals.filteredGroups.value[0]?.groupId).toBe(
        SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
      );

      // 3. Reset tìm kiếm
      sidebarObserverSignals.setSearchQuery('');
      expect(sidebarObserverSignals.filteredGroups.value.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter groups by activeFilter tab (ALL / WHITELISTED / NON_WHITELISTED)', async () => {
      createMockSidebarDOM({ attachToDocument: true });
      await sidebarObserverSignals.scanGroups(document);

      const firstGroup = sidebarObserverSignals.discoveredGroups.value[0];
      if (!firstGroup) throw new Error('First group not found');

      // Ban đầu: chưa nhóm nào trong whitelist
      sidebarObserverSignals.setActiveFilter('WHITELISTED');
      expect(sidebarObserverSignals.filteredGroups.value).toHaveLength(0);

      sidebarObserverSignals.setActiveFilter('NON_WHITELISTED');
      expect(sidebarObserverSignals.filteredGroups.value.length).toBe(
        sidebarObserverSignals.discoveredGroups.value.length,
      );

      // Thêm nhóm 1 vào whitelist
      await sidebarObserverSignals.addToWhitelist(firstGroup, 'EXACT', testDb);

      sidebarObserverSignals.setActiveFilter('WHITELISTED');
      expect(sidebarObserverSignals.filteredGroups.value).toHaveLength(1);
      expect(sidebarObserverSignals.filteredGroups.value[0]?.groupId).toBe(firstGroup.groupId);

      sidebarObserverSignals.setActiveFilter('NON_WHITELISTED');
      expect(sidebarObserverSignals.filteredGroups.value.length).toBe(
        sidebarObserverSignals.discoveredGroups.value.length - 1,
      );
    });
  });

  describe('Suite 2: 1-Click Whitelist Enrollment & Hot-Sync Integration', () => {
    it('should add group to whitelist, update RAM observer, and persist to Dexie app_settings', async () => {
      createMockSidebarDOM({ attachToDocument: true });
      await sidebarObserverSignals.scanGroups(document);

      const observer = new SidebarObserver({
        whitelist: [],
        onNewMessage: vi.fn(),
        rootDocument: document,
        dbInstance: testDb,
      });

      const targetGroup = sidebarObserverSignals.discoveredGroups.value.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.communityGroup.groupId,
      );
      if (!targetGroup) throw new Error('Target group not found');

      expect(targetGroup.isInWhitelist).toBe(false);
      expect(sidebarObserverSignals.totalWhitelisted.value).toBe(0);

      // 1-Click: Thêm nhóm vào Whitelist
      await sidebarObserverSignals.addToWhitelist(targetGroup, 'EXACT', testDb, observer);

      // Kiểm chứng Signal
      expect(sidebarObserverSignals.totalWhitelisted.value).toBe(1);
      const updatedGroupInList = sidebarObserverSignals.discoveredGroups.value.find(
        (g) => g.groupId === targetGroup.groupId,
      );
      expect(updatedGroupInList?.isInWhitelist).toBe(true);

      // Kiểm chứng RAM observer
      expect(observer.matchWhitelist(targetGroup.groupId, targetGroup.groupName)).toBe(true);

      // Kiểm chứng Dexie app_settings
      const dbRecord = await testDb.app_settings.get('n01_whitelist_groups');
      expect(dbRecord).toBeDefined();

      // Kiểm chứng snapshot 1-Click enrollment
      console.log('=== [US3 1-CLICK WHITELIST ENROLLMENT SNAPSHOT] ===');
      console.log(JSON.stringify(sidebarObserverSignals.whitelistGroups.value, null, 2));

      // 1-Click: Gỡ bỏ nhóm khỏi Whitelist
      await sidebarObserverSignals.removeFromWhitelist(targetGroup.groupId, testDb, observer);

      expect(sidebarObserverSignals.totalWhitelisted.value).toBe(0);
      expect(
        sidebarObserverSignals.discoveredGroups.value.find((g) => g.groupId === targetGroup.groupId)
          ?.isInWhitelist,
      ).toBe(false);
      expect(observer.matchWhitelist(targetGroup.groupId, targetGroup.groupName)).toBe(false);
    });

    it('should update matching rule (EXACT -> CONTAINS) and persist', async () => {
      const sampleItem = {
        groupId: 'g999111',
        groupName: 'Group Test',
      };
      await sidebarObserverSignals.addToWhitelist(sampleItem, 'EXACT', testDb);

      expect(sidebarObserverSignals.whitelistGroups.value[0]?.matchingRule).toBe('EXACT');

      await sidebarObserverSignals.updateRule('g999111', 'CONTAINS', testDb);

      expect(sidebarObserverSignals.whitelistGroups.value[0]?.matchingRule).toBe('CONTAINS');
      const loaded = await testDb.app_settings.get('n01_whitelist_groups');
      const groups = (loaded?.value as { groups: Array<{ matchingRule: string }> })?.groups;
      expect(groups?.[0]?.matchingRule).toBe('CONTAINS');
    });

    it('should load initial whitelist from Dexie on startup via loadWhitelistFromDB', async () => {
      createMockSidebarDOM({ attachToDocument: true });
      await sidebarObserverSignals.scanGroups(document);

      // Ghi sẵn 1 rule vào Dexie
      await testDb.app_settings.put({
        key: 'n01_whitelist_groups',
        value: {
          groups: [
            {
              groupId: SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
              groupName: SIDEBAR_FIXTURE_METADATA.mutedGroup.groupName,
              matchingRule: 'EXACT',
              priority: 1,
              isEnabled: true,
              addedAt: Date.now(),
              lastUpdatedAt: Date.now(),
            },
          ],
        },
        updatedAt: Date.now(),
      });

      // Tải từ DB vào Signals Store
      await sidebarObserverSignals.loadWhitelistFromDB(testDb);

      expect(sidebarObserverSignals.whitelistGroups.value).toHaveLength(1);
      expect(sidebarObserverSignals.whitelistGroups.value[0]?.groupId).toBe(
        SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
      );

      // Kiểm chứng flag isInWhitelist trong discoveredGroups được cập nhật
      const mutedGroup = sidebarObserverSignals.discoveredGroups.value.find(
        (g) => g.groupId === SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId,
      );
      expect(mutedGroup?.isInWhitelist).toBe(true);
    });

    it('should control drawer open/close state via toggleDrawer', () => {
      expect(sidebarObserverSignals.isDrawerOpen.value).toBe(false);

      sidebarObserverSignals.toggleDrawer(true);
      expect(sidebarObserverSignals.isDrawerOpen.value).toBe(true);

      sidebarObserverSignals.toggleDrawer(false);
      expect(sidebarObserverSignals.isDrawerOpen.value).toBe(false);

      sidebarObserverSignals.toggleDrawer();
      expect(sidebarObserverSignals.isDrawerOpen.value).toBe(true);
    });
  });
});
