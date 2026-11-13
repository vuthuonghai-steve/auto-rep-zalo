/**
 * Compile-time Types & Interfaces (Layer 2)
 * Module: sidebar-observer
 * Cấm chứa mã runtime thực thi.
 */

import type {
  DiscoveredGroupItem,
  WhitelistGroupItem,
  WhitelistMatchingRule,
} from '@/contracts/schemas';

export type GroupFilter = 'ALL' | 'WHITELISTED' | 'NON_WHITELISTED';

export type QueueTelemetryStatus = 'IDLE' | 'PROCESSING' | 'DRAINED';

export interface DrawerState {
  isOpen: boolean;
}

export interface SidebarObserverTelemetryStats {
  totalDiscovered: number;
  totalWhitelisted: number;
  totalIgnoredNonWhitelist: number;
  totalProcessed: number;
  isObserving: boolean;
  isAttached?: boolean | undefined;
  queueStatus?: QueueTelemetryStatus | undefined;
  lastActiveTimestamp?: number | undefined;
}

export interface SidebarObserverUIState {
  discoveredGroups: DiscoveredGroupItem[];
  whitelistGroups: WhitelistGroupItem[];
  isLoading: boolean;
  searchQuery: string;
  isDrawerOpen: boolean;
  activeFilter: GroupFilter;
}

export interface SidebarObserverScreenProps {
  title?: string;
}

export interface WhitelistDrawerProps {
  isOpen: boolean;
  groups: WhitelistGroupItem[];
  onClose: () => void;
  onRemove: (groupId: string) => void;
  onUpdateRule: (groupId: string, rule: WhitelistMatchingRule) => void;
  onToggleEnabled?: (groupId: string, isEnabled: boolean) => void;
}

export interface TelemetryStatusCardProps {
  totalWatchedGroups: number;
  totalDiscoveredGroups?: number | undefined;
  totalProcessed?: number | undefined;
  totalIgnoredNonWhitelist?: number | undefined;
  isObserving?: boolean | undefined;
  isAttached?: boolean | undefined;
  queueStatus?: QueueTelemetryStatus | undefined;
  lastActiveTimestamp?: number | undefined;
}
