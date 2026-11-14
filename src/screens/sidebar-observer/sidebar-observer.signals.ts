import { sendMessage } from '@/contracts/messaging';
import type {
  DiscoveredGroupItem,
  WhitelistGroupItem,
  WhitelistMatchingRule,
} from '@/contracts/schemas';
import { type ZaloAutomationDatabase, db as defaultDb } from '@/db/database';
import {
  type SidebarObserver,
  discoverSidebarGroups,
  loadWhitelistSettings,
  syncWhitelistSettings,
} from '@/nodes/n01-sidebar-observer';
import { computed, signal } from '@preact/signals';
import type { GroupFilter, SidebarObserverTelemetryStats } from './sidebar-observer.types';

/**
 * Reactive Signal Store (Layer 2)
 * Phục vụ riêng cho Screen SidebarObserver
 */

const discoveredGroups = signal<DiscoveredGroupItem[]>([]);
const whitelistGroups = signal<WhitelistGroupItem[]>([]);
const isLoading = signal<boolean>(false);
const searchQuery = signal<string>('');
const isDrawerOpen = signal<boolean>(false);
const activeFilter = signal<GroupFilter>('ALL');
const telemetryStats = signal<SidebarObserverTelemetryStats>({
  totalDiscovered: 0,
  totalWhitelisted: 0,
  totalIgnoredNonWhitelist: 0,
  totalProcessed: 0,
  isObserving: false,
  isAttached: false,
  queueStatus: 'IDLE',
  lastActiveTimestamp: Date.now(),
});

let activeTelemetryChannel: BroadcastChannel | null = null;
let storageListenerAttached = false;

export function initTelemetryListener(
  channelName = 'n01_telemetry_channel',
): BroadcastChannel | null {
  // 1. BroadcastChannel (cho cùng Origin nếu có)
  if (!activeTelemetryChannel) {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        activeTelemetryChannel = new BroadcastChannel(channelName);
        activeTelemetryChannel.onmessage = (event: MessageEvent) => {
          if (event.data && typeof event.data === 'object') {
            sidebarObserverSignals.updateTelemetry(event.data);
          }
        };
      }
    } catch {
      // Fallback if BroadcastChannel is not supported
    }
  }

  // 2. chrome.storage.local & onChanged (cho liên lạc xuyên Origin giữa content script và Options page)
  if (!storageListenerAttached) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get('n01_telemetry').then((res) => {
          if (res?.n01_telemetry && typeof res.n01_telemetry === 'object') {
            sidebarObserverSignals.updateTelemetry(res.n01_telemetry);
          }
        }).catch(() => {});

        if (chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.n01_telemetry?.newValue) {
              sidebarObserverSignals.updateTelemetry(changes.n01_telemetry.newValue);
            }
          });
          storageListenerAttached = true;
        }
      }
    } catch {
      // Môi trường không có chrome.storage
    }
  }

  return activeTelemetryChannel;
}

export function disposeTelemetryListener(): void {
  if (activeTelemetryChannel) {
    activeTelemetryChannel.close();
    activeTelemetryChannel = null;
  }
}

// Computed Signals
const filteredGroups = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  const filter = activeFilter.value;

  return discoveredGroups.value.filter((group) => {
    // 1. Lọc theo trạng thái whitelist
    if (filter === 'WHITELISTED' && !group.isInWhitelist) return false;
    if (filter === 'NON_WHITELISTED' && group.isInWhitelist) return false;

    // 2. Lọc theo chuỗi tìm kiếm
    if (!query) return true;
    const nameMatch = group.groupName.toLowerCase().includes(query);
    const idMatch = group.groupId.toLowerCase().includes(query);
    return nameMatch || idMatch;
  });
});

const totalDiscovered = computed(() => discoveredGroups.value.length);
const totalWhitelisted = computed(() => whitelistGroups.value.length);

function refreshDiscoveryWhitelistFlags(): void {
  const whitelistIds = new Set(whitelistGroups.value.map((g) => g.groupId));
  discoveredGroups.value = discoveredGroups.value.map((group) => ({
    ...group,
    isInWhitelist: whitelistIds.has(group.groupId),
  }));
}

export const sidebarObserverSignals = {
  // Signals
  discoveredGroups,
  whitelistGroups,
  isLoading,
  searchQuery,
  isDrawerOpen,
  activeFilter,
  telemetryStats,

  // Computed
  filteredGroups,
  totalDiscovered,
  totalWhitelisted,

  // Actions
  setLoading: (state: boolean): void => {
    isLoading.value = state;
  },

  setSearchQuery: (query: string): void => {
    searchQuery.value = query;
  },

  setActiveFilter: (filter: GroupFilter): void => {
    activeFilter.value = filter;
  },

  toggleDrawer: (open?: boolean): void => {
    isDrawerOpen.value = open !== undefined ? open : !isDrawerOpen.value;
  },

  updateTelemetry: (stats: Partial<SidebarObserverTelemetryStats>): void => {
    telemetryStats.value = {
      ...telemetryStats.value,
      ...stats,
    };
  },

  /**
   * Quét các nhóm trên Sidebar DOM hiện tại (hoặc gửi IPC đến Zalo Tab nếu đang ở Options Page)
   * và đồng bộ trạng thái whitelist.
   */
  scanGroups: async (
    doc?: Document,
    _observerInstance?: SidebarObserver,
  ): Promise<DiscoveredGroupItem[]> => {
    isLoading.value = true;
    const targetDoc =
      doc || (typeof document !== 'undefined' ? document : (null as unknown as Document));

    // Kiểm tra nếu có conversation list trên targetDoc -> Quét trực tiếp trên DOM
    const hasConversationList =
      targetDoc &&
      (targetDoc.querySelector('#conversationList') !== null ||
        targetDoc.querySelector('#conversationListId') !== null ||
        targetDoc.querySelector('[data-id="div_TabMsg_ThrdChList"]') !== null);

    if (hasConversationList) {
      try {
        const results = discoverSidebarGroups(targetDoc, whitelistGroups.value);
        discoveredGroups.value = results;
        telemetryStats.value = {
          ...telemetryStats.value,
          totalDiscovered: results.length,
          totalWhitelisted: whitelistGroups.value.length,
        };
        return results;
      } finally {
        isLoading.value = false;
      }
    }

    // Nếu không có conversationList trên document (ví dụ chạy trong Options page), gửi IPC tới Zalo tab
    try {
      const response = await sendMessage('scanSidebarGroups', undefined);
      const results = response?.groups || [];
      discoveredGroups.value = results;
      refreshDiscoveryWhitelistFlags();
      telemetryStats.value = {
        ...telemetryStats.value,
        totalDiscovered: results.length,
        totalWhitelisted: whitelistGroups.value.length,
      };
      return results;
    } catch {
      // Fallback: nếu IPC không thành công (Zalo tab chưa mở), thử quét trên targetDoc cục bộ
      const fallbackResults = discoverSidebarGroups(targetDoc, whitelistGroups.value);
      discoveredGroups.value = fallbackResults;
      telemetryStats.value = {
        ...telemetryStats.value,
        totalDiscovered: fallbackResults.length,
        totalWhitelisted: whitelistGroups.value.length,
      };
      return fallbackResults;
    } finally {
      isLoading.value = false;
    }
  },

  /**
   * Tải danh sách Whitelist từ Dexie app_settings.
   */
  loadWhitelistFromDB: async (
    dbInstance: ZaloAutomationDatabase = defaultDb,
    observerInstance?: SidebarObserver,
  ): Promise<WhitelistGroupItem[]> => {
    isLoading.value = true;
    try {
      const items = await loadWhitelistSettings(dbInstance);
      whitelistGroups.value = items;
      refreshDiscoveryWhitelistFlags();
      if (observerInstance) {
        observerInstance.updateWhitelist(items);
      }
      telemetryStats.value = {
        ...telemetryStats.value,
        totalWhitelisted: items.length,
      };
      return items;
    } finally {
      isLoading.value = false;
    }
  },

  /**
   * Thêm 1 nhóm vào Whitelist với cơ chế Hot-Sync Dexie & RAM Observer.
   */
  addToWhitelist: async (
    group: DiscoveredGroupItem | { groupId: string; groupName: string },
    rule: WhitelistMatchingRule = 'EXACT',
    dbInstance: ZaloAutomationDatabase = defaultDb,
    observerInstance?: SidebarObserver,
  ): Promise<void> => {
    const existingIndex = whitelistGroups.value.findIndex((g) => g.groupId === group.groupId);
    const now = Date.now();

    let nextList: WhitelistGroupItem[];
    if (existingIndex >= 0) {
      nextList = whitelistGroups.value.map((item, idx) =>
        idx === existingIndex
          ? {
              ...item,
              groupName: group.groupName || item.groupName,
              matchingRule: rule,
              isEnabled: true,
              lastUpdatedAt: now,
            }
          : item,
      );
    } else {
      const newItem: WhitelistGroupItem = {
        groupId: group.groupId,
        groupName: group.groupName,
        matchingRule: rule,
        priority: 1,
        isEnabled: true,
        addedAt: now,
        lastUpdatedAt: now,
      };
      nextList = [...whitelistGroups.value, newItem];
    }

    whitelistGroups.value = nextList;
    refreshDiscoveryWhitelistFlags();
    await syncWhitelistSettings(nextList, dbInstance, observerInstance);

    telemetryStats.value = {
      ...telemetryStats.value,
      totalWhitelisted: nextList.length,
    };
  },

  /**
   * Gỡ bỏ 1 nhóm khỏi Whitelist với cơ chế Hot-Sync.
   */
  removeFromWhitelist: async (
    groupId: string,
    dbInstance: ZaloAutomationDatabase = defaultDb,
    observerInstance?: SidebarObserver,
  ): Promise<void> => {
    const nextList = whitelistGroups.value.filter((g) => g.groupId !== groupId);
    whitelistGroups.value = nextList;
    refreshDiscoveryWhitelistFlags();
    await syncWhitelistSettings(nextList, dbInstance, observerInstance);

    telemetryStats.value = {
      ...telemetryStats.value,
      totalWhitelisted: nextList.length,
    };
  },

  /**
   * Cập nhật quy tắc so khớp (EXACT / CONTAINS) của 1 nhóm trong Whitelist.
   */
  updateRule: async (
    groupId: string,
    rule: WhitelistMatchingRule,
    dbInstance: ZaloAutomationDatabase = defaultDb,
    observerInstance?: SidebarObserver,
  ): Promise<void> => {
    const nextList = whitelistGroups.value.map((item) =>
      item.groupId === groupId
        ? {
            ...item,
            matchingRule: rule,
            lastUpdatedAt: Date.now(),
          }
        : item,
    );
    whitelistGroups.value = nextList;
    await syncWhitelistSettings(nextList, dbInstance, observerInstance);
  },

  /**
   * Reset trạng thái Store về mặc định.
   */
  reset: (): void => {
    discoveredGroups.value = [];
    whitelistGroups.value = [];
    isLoading.value = false;
    searchQuery.value = '';
    isDrawerOpen.value = false;
    activeFilter.value = 'ALL';
    telemetryStats.value = {
      totalDiscovered: 0,
      totalWhitelisted: 0,
      totalIgnoredNonWhitelist: 0,
      totalProcessed: 0,
      isObserving: false,
      isAttached: false,
      queueStatus: 'IDLE',
      lastActiveTimestamp: Date.now(),
    };
  },
  initTelemetryListener,
  disposeTelemetryListener,
};
