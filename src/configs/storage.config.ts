import { type FeatureFlagState, getDefaultFlagState } from '@/configs/features.config';
import { logger } from '@/utils/logger';
import { signal } from '@preact/signals';

export const FEATURE_FLAGS_STORAGE_KEY_V1 = 'feature_flags_state';
export const FEATURE_FLAGS_STORAGE_KEY_V2 = 'feature_flags_state_v2';
export const FEATURE_FLAGS_BACKUP_KEY = 'feature_flags_state_v1_backup';

// Backward compatibility alias pointing to active v2 key
export const FEATURE_FLAGS_STORAGE_KEY = FEATURE_FLAGS_STORAGE_KEY_V2;

export interface IFeatureStorageAdapter {
  loadFlags(): Promise<Record<string, boolean>>;
  saveFlag(featureId: string, isEnabled: boolean): Promise<void>;
  saveAllFlags(flags: Record<string, boolean>): Promise<void>;
  getRaw?(key: string): Promise<Record<string, boolean> | undefined>;
  setRaw?(key: string, value: Record<string, boolean>): Promise<void>;
  removeRaw?(key: string): Promise<void>;
}

export class InMemoryFeatureStorageAdapter implements IFeatureStorageAdapter {
  private rawStore: Map<string, Record<string, boolean>>;

  constructor(
    initialState?: Record<string, boolean>,
    rawStorage?: Record<string, Record<string, boolean>>,
  ) {
    this.rawStore = new Map();
    if (rawStorage) {
      for (const [key, value] of Object.entries(rawStorage)) {
        this.rawStore.set(key, { ...value });
      }
    }
    if (initialState) {
      this.rawStore.set(FEATURE_FLAGS_STORAGE_KEY_V2, { ...initialState });
    }
  }

  async getRaw(key: string): Promise<Record<string, boolean> | undefined> {
    const data = this.rawStore.get(key);
    return data ? { ...data } : undefined;
  }

  async setRaw(key: string, value: Record<string, boolean>): Promise<void> {
    this.rawStore.set(key, { ...value });
  }

  async removeRaw(key: string): Promise<void> {
    this.rawStore.delete(key);
  }

  async loadFlags(): Promise<Record<string, boolean>> {
    const flags = this.rawStore.get(FEATURE_FLAGS_STORAGE_KEY_V2);
    return flags ? { ...flags } : {};
  }

  async saveFlag(featureId: string, isEnabled: boolean): Promise<void> {
    const current = await this.loadFlags();
    current[featureId] = isEnabled;
    this.rawStore.set(FEATURE_FLAGS_STORAGE_KEY_V2, current);
  }

  async saveAllFlags(flags: Record<string, boolean>): Promise<void> {
    this.rawStore.set(FEATURE_FLAGS_STORAGE_KEY_V2, { ...flags });
  }
}

export class ChromeLocalStorageAdapter implements IFeatureStorageAdapter {
  async getRaw(key: string): Promise<Record<string, boolean> | undefined> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return undefined;
    }
    const result = await chrome.storage.local.get(key);
    return result[key] as Record<string, boolean> | undefined;
  }

  async setRaw(key: string, value: Record<string, boolean>): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }
    await chrome.storage.local.set({ [key]: value });
  }

  async removeRaw(key: string): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }
    await chrome.storage.local.remove(key);
  }

  async loadFlags(): Promise<Record<string, boolean>> {
    const flags = await this.getRaw(FEATURE_FLAGS_STORAGE_KEY_V2);
    return flags || {};
  }

  async saveFlag(featureId: string, isEnabled: boolean): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }
    const current = await this.loadFlags();
    current[featureId] = isEnabled;
    await this.setRaw(FEATURE_FLAGS_STORAGE_KEY_V2, current);
  }

  async saveAllFlags(flags: Record<string, boolean>): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }
    await this.setRaw(FEATURE_FLAGS_STORAGE_KEY_V2, flags);
  }
}

export function createFeatureStorageAdapter(): IFeatureStorageAdapter {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new ChromeLocalStorageAdapter();
  }
  return new InMemoryFeatureStorageAdapter();
}

let defaultAdapter: IFeatureStorageAdapter | null = null;

export function getFeatureStorageAdapter(): IFeatureStorageAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createFeatureStorageAdapter();
  }
  return defaultAdapter;
}

export function setDefaultStorageAdapterForTesting(adapter: IFeatureStorageAdapter | null): void {
  defaultAdapter = adapter;
}

export async function migrateLegacyFlagsIfNeeded(
  storage: IFeatureStorageAdapter = getFeatureStorageAdapter(),
): Promise<void> {
  if (!storage.getRaw || !storage.setRaw || !storage.removeRaw) {
    return;
  }

  // Nếu v2 đã có dữ liệu -> không chạy migration đè dữ liệu
  const existingV2 = await storage.getRaw(FEATURE_FLAGS_STORAGE_KEY_V2);
  if (existingV2 && Object.keys(existingV2).length > 0) {
    return;
  }

  // Kiểm tra nếu tồn tại bản ghi ở key v1
  const legacyFlags = await storage.getRaw(FEATURE_FLAGS_STORAGE_KEY_V1);
  if (!legacyFlags || Object.keys(legacyFlags).length === 0) {
    return;
  }

  const collectorEnabled = legacyFlags['message-collector'] ?? false;
  const forwarderEnabled = legacyFlags['message-forwarder'] ?? false;
  const coreSettingsEnabled = legacyFlags['core-settings'] ?? true;

  const migratedFlags: Record<string, boolean> = {
    'core-settings': coreSettingsEnabled,
    'n01-sidebar-observer': collectorEnabled,
    'n02-queue-manager': collectorEnabled,
    'n03-chat-switcher': collectorEnabled,
    'n04-delta-stitcher': forwarderEnabled,
    'n05-bundle-aggregator': forwarderEnabled,
    'n06-dedup-gate': forwarderEnabled,
    'n07-price-router': forwarderEnabled,
    'n08-forward-automator': forwarderEnabled,
    'n09-text-injector': forwarderEnabled,
    'n10-committer-drain': forwarderEnabled,
  };

  await storage.setRaw(FEATURE_FLAGS_STORAGE_KEY_V2, migratedFlags);
  await storage.setRaw(FEATURE_FLAGS_BACKUP_KEY, legacyFlags);
  await storage.removeRaw(FEATURE_FLAGS_STORAGE_KEY_V1);

  await logger.info(
    'STORAGE',
    'FEATURE_FLAG',
    `Successfully migrated legacy feature flags from v1 to v2: ${Object.keys(migratedFlags).length} flags`,
  );
}

export const flagsSignal = signal<FeatureFlagState>(getDefaultFlagState());

export const isFeatureEnabled = (featureId: string): boolean => {
  return flagsSignal.value[featureId] ?? false;
};

export async function initFeatureFlags(
  adapter: IFeatureStorageAdapter = getFeatureStorageAdapter(),
): Promise<FeatureFlagState> {
  await migrateLegacyFlagsIfNeeded(adapter);
  const defaults = getDefaultFlagState();
  const stored = await adapter.loadFlags();
  const merged: FeatureFlagState = { ...defaults, ...stored };
  flagsSignal.value = merged;
  return merged;
}

export async function setFeatureFlag(
  featureId: string,
  isEnabled: boolean,
  adapter: IFeatureStorageAdapter = getFeatureStorageAdapter(),
): Promise<void> {
  const previousValue = flagsSignal.value[featureId] ?? false;

  // Optimistic update
  flagsSignal.value = {
    ...flagsSignal.value,
    [featureId]: isEnabled,
  };

  try {
    await adapter.saveFlag(featureId, isEnabled);
  } catch (error) {
    // Rollback to previous value on persistence failure
    flagsSignal.value = {
      ...flagsSignal.value,
      [featureId]: previousValue,
    };
    await logger.warn(
      'STORAGE',
      'FEATURE_FLAG',
      `Failed to persist flag [${featureId}], rolled back`,
      {
        error,
      },
    );
    throw error;
  }
}

export async function toggleFeatureFlag(
  featureId: string,
  adapter: IFeatureStorageAdapter = getFeatureStorageAdapter(),
): Promise<boolean> {
  const current = flagsSignal.value[featureId] ?? false;
  const next = !current;
  await setFeatureFlag(featureId, next, adapter);
  return next;
}

export const toggleFeature = toggleFeatureFlag;

export async function saveFeatureFlags(
  flags: Record<string, boolean>,
  adapter: IFeatureStorageAdapter = getFeatureStorageAdapter(),
): Promise<void> {
  await adapter.saveAllFlags(flags);
}
