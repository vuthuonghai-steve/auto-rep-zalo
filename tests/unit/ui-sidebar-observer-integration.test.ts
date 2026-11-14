import { GlobalWindow } from 'happy-dom';

// DOM polyfill for happy-dom runner
if (typeof document === 'undefined') {
  const window = new GlobalWindow();
  for (const key of Object.getOwnPropertyNames(window)) {
    if (!(key in globalThis)) {
      try {
        // @ts-expect-error polyfill global
        globalThis[key] = window[key];
      } catch {}
    }
  }
}

import type { WhitelistGroupItem } from '@/contracts/schemas';
import { ZaloAutomationDatabase } from '@/db/database';
import { loadWhitelistSettings, syncWhitelistSettings } from '@/nodes/n01-sidebar-observer';
import { CoreSettingsDetailScreen } from '@/screens/features/CoreSettingsDetailScreen';
import { FEATURE_COMPONENTS_MAP, getFeatureDetailComponent } from '@/screens/features/registry';
import { SidebarObserverScreen } from '@/screens/sidebar-observer/SidebarObserverScreen';
import { sidebarObserverSignals } from '@/screens/sidebar-observer/sidebar-observer.signals';
import { h, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('UI Sidebar Observer Integration & Whitelist SSOT (tests/unit/ui-sidebar-observer-integration.test.ts)', () => {
  let testDb: ZaloAutomationDatabase;
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    sidebarObserverSignals.reset();
    testDb = new ZaloAutomationDatabase(`TestIntegrationDB_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    render(null, container);
    container.remove();
    sidebarObserverSignals.reset();
    if (testDb) {
      await testDb.delete();
    }
  });

  describe('Test Case 1: Registry Resolution (GATE-N01-REGISTRY)', () => {
    it('should map feature key n01-sidebar-observer to SidebarObserverScreen in FEATURE_COMPONENTS_MAP', () => {
      const comp = getFeatureDetailComponent('n01-sidebar-observer');
      expect(comp).toBeDefined();
      expect(comp).toBe(SidebarObserverScreen);
      expect(FEATURE_COMPONENTS_MAP['n01-sidebar-observer']).toBe(SidebarObserverScreen);
    });
  });

  describe('Test Case 2: Whitelist SSOT Synchronization (GATE-N01-SSOT)', () => {
    it('should persist and load WhitelistGroupItem array via syncWhitelistSettings and loadWhitelistSettings with SSOT key n01_whitelist_groups', async () => {
      const mockGroups: WhitelistGroupItem[] = [
        {
          groupId: 'g-test-ssot-1',
          groupName: 'Nhóm Nguồn BĐS Cầu Giấy',
          matchingRule: 'EXACT',
          priority: 1,
          isEnabled: true,
          addedAt: 1700000000000,
          lastUpdatedAt: 1700000000000,
        },
        {
          groupId: 'g-test-ssot-2',
          groupName: 'Hội Môi Giới Đống Đa',
          matchingRule: 'CONTAINS',
          priority: 2,
          isEnabled: false,
          addedAt: 1700000001000,
          lastUpdatedAt: 1700000002000,
        },
      ];

      // Lưu trữ Whitelist vào Dexie testDb
      await syncWhitelistSettings(mockGroups, testDb);

      // Kiểm tra bản ghi Dexie lưu đúng SSOT key 'n01_whitelist_groups'
      const record = await testDb.app_settings.get('n01_whitelist_groups');
      expect(record).toBeDefined();
      expect(record?.key).toBe('n01_whitelist_groups');
      expect(record?.value).toEqual({ groups: mockGroups });

      // Kiểm tra hàm loadWhitelistSettings đọc đúng dữ liệu từ testDb
      const loaded = await loadWhitelistSettings(testDb);
      expect(loaded).toHaveLength(2);
      expect(loaded[0]?.groupId).toBe('g-test-ssot-1');
      expect(loaded[0]?.groupName).toBe('Nhóm Nguồn BĐS Cầu Giấy');
      expect(loaded[0]?.matchingRule).toBe('EXACT');
      expect(loaded[0]?.priority).toBe(1);
      expect(loaded[0]?.isEnabled).toBe(true);

      expect(loaded[1]?.groupId).toBe('g-test-ssot-2');
      expect(loaded[1]?.groupName).toBe('Hội Môi Giới Đống Đa');
      expect(loaded[1]?.matchingRule).toBe('CONTAINS');
      expect(loaded[1]?.priority).toBe(2);
      expect(loaded[1]?.isEnabled).toBe(false);
    });
  });

  describe('Test Case 3: Legacy Auto-Migration (GATE-N01-MIGRATION)', () => {
    it('should auto-migrate legacy config.whitelist into n01_whitelist_groups when n01_whitelist_groups is absent', async () => {
      // Khởi tạo DB có bản ghi key 'config' chứa trường whitelist cũ nhưng chưa có key 'n01_whitelist_groups'
      const legacyWhitelist = [
        { groupId: 'g-test-1', name: 'Nhóm Test 1' },
        { groupId: 'g-test-2', name: 'Nhóm Đầu Tư Phố Cổ' },
      ];

      await testDb.app_settings.put({
        key: 'config',
        value: {
          whitelist: legacyWhitelist,
          priceRules: [],
          quiescenceDelaySec: 10,
        },
        updatedAt: Date.now(),
      });

      // Xác nhận ban đầu chưa có key 'n01_whitelist_groups'
      const beforeRecord = await testDb.app_settings.get('n01_whitelist_groups');
      expect(beforeRecord).toBeUndefined();

      // Gọi loadWhitelistSettings(testDb) -> kỳ vọng tự động migrate
      const migrated = await loadWhitelistSettings(testDb);

      // Kiểm tra kết quả trả về đã được chuyển đổi sang chuẩn WhitelistGroupItem[]
      expect(migrated).toBeDefined();
      expect(migrated).toHaveLength(2);
      expect(migrated[0]?.groupId).toBe('g-test-1');
      expect(migrated[0]?.groupName).toBe('Nhóm Test 1');
      expect(migrated[0]?.matchingRule).toBe('EXACT');
      expect(migrated[0]?.priority).toBe(1);
      expect(migrated[0]?.isEnabled).toBe(true);

      expect(migrated[1]?.groupId).toBe('g-test-2');
      expect(migrated[1]?.groupName).toBe('Nhóm Đầu Tư Phố Cổ');
      expect(migrated[1]?.matchingRule).toBe('EXACT');
      expect(migrated[1]?.priority).toBe(1);
      expect(migrated[1]?.isEnabled).toBe(true);

      // Kiểm tra n01_whitelist_groups đã được lưu vĩnh viễn vào Dexie
      const afterRecord = await testDb.app_settings.get('n01_whitelist_groups');
      expect(afterRecord).toBeDefined();
      expect(afterRecord?.key).toBe('n01_whitelist_groups');
      const saved = afterRecord?.value as { groups: WhitelistGroupItem[] };
      expect(saved.groups).toHaveLength(2);
      expect(saved.groups[0]?.groupId).toBe('g-test-1');
    });
  });

  describe('Test Case 4: Design System Light Mode Token Integrity (GATE-N01-LIGHTMODE)', () => {
    it('should render SidebarObserverScreen without dark mode tokens (bg-slate-900, text-slate-100)', () => {
      render(
        h(SidebarObserverScreen, { title: 'Node 01: Sidebar Observer & Khám Phá Nhóm' }),
        container,
      );

      const renderedHtml = container.innerHTML;
      expect(renderedHtml).toBeTruthy();

      // Kiểm tra root screen container tồn tại
      const screenElement = container.querySelector('[data-testid="sidebar-observer-screen"]');
      expect(screenElement).not.toBeNull();

      // Kiểm tra HTML rendered class không còn chứa các token dark mode của slate-900 / slate-100
      expect(renderedHtml).not.toContain('bg-slate-900');
      expect(renderedHtml).not.toContain('text-slate-100');
    });
  });

  describe('Test Case 5: CoreSettingsDetailScreen SSOT & Quick-Link CTA (GATE-N01-CORESETTINGS)', () => {
    it('should render CTA Quick-Link to navigate to sidebar observer screen', () => {
      render(h(CoreSettingsDetailScreen, null), container);

      const ctaBtn = container.querySelector(
        '[data-testid="cta-goto-sidebar-observer"]',
      ) as HTMLButtonElement;
      expect(ctaBtn).not.toBeNull();
      expect(ctaBtn.textContent).toContain('Quét Nhóm Tự Động Từ Sidebar');
    });
  });

  describe('Test Case 6: SidebarObserverScreen Mount/Unmount Telemetry & Whitelist Lifecycle', () => {
    it('should initialize telemetry listener and load whitelist on mount, and dispose on unmount', async () => {
      const initSpy = vi.spyOn(sidebarObserverSignals, 'initTelemetryListener');
      const loadSpy = vi.spyOn(sidebarObserverSignals, 'loadWhitelistFromDB').mockResolvedValue([]);
      const disposeSpy = vi.spyOn(sidebarObserverSignals, 'disposeTelemetryListener');

      render(
        h(SidebarObserverScreen, { title: 'Node 01: Sidebar Observer & Khám Phá Nhóm' }),
        container,
      );

      // Chờ Preact flush useEffect lifecycle
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy).toHaveBeenCalledTimes(1);

      // Unmount component
      render(null, container);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
