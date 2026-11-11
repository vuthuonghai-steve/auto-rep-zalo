import { type FeatureFlagState, getDefaultFlagState } from '@/configs/features.config';
import { logger } from '@/utils/logger';
import { signal } from '@preact/signals';

export const FEATURE_FLAGS_STORAGE_KEY = 'feature_flags_state';

export interface IFeatureStorageAdapter {
  loadFlags(): Promise<Record<string, boolean>>;
  saveFlag(featureId: string, isEnabled: boolean): Promise<void>;
  saveAllFlags(flags: Record<string, boolean>): Promise<void>;
}

export class InMemoryFeatureStorageAdapter implements IFeatureStorageAdapter {
  private store: Map<string, boolean>;

  constructor(initialState?: Record<string, boolean>) {
    this.store = new Map(initialState ? Object.entries(initialState) : []);
  }

  async loadFlags(): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};
    for (const [key, value] of this.store.entries()) {
      result[key] = value;
    }
    return result;
  }

  async saveFlag(featureId: string, isEnabled: boolean): Promise<void> {
    this.store.set(featureId, isEnabled);
  }

  async saveAllFlags(flags: Record<string, boolean>): Promise<void> {
    this.store.clear();
    for (const [key, value] of Object.entries(flags)) {
      this.store.set(key, value);
    }
  }
}

export class ChromeLocalStorageAdapter implements IFeatureStorageAdapter {
  async loadFlags(): Promise<Record<string, boolean>> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return {};
    }
    const result = await chrome.storage.local.get(FEATURE_FLAGS_STORAGE_KEY);
    return (result[FEATURE_FLAGS_STORAGE_KEY] as Record<string, boolean>) || {};
  }

  async saveFlag(featureId: string, isEnabled: boolean): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }
    const current = await this.loadFlags();
    current[featureId] = isEnabled;
    await chrome.storage.local.set({ [FEATURE_FLAGS_STORAGE_KEY]: current });
  }

  async saveAllFlags(flags: Record<string, boolean>): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }
    await chrome.storage.local.set({ [FEATURE_FLAGS_STORAGE_KEY]: flags });
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

export const flagsSignal = signal<FeatureFlagState>(getDefaultFlagState());

export async function initFeatureFlags(
  adapter: IFeatureStorageAdapter = getFeatureStorageAdapter(),
): Promise<FeatureFlagState> {
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
