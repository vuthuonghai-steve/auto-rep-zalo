import { getDefaultFlagState } from '@/configs/features.config';
import {
  ChromeLocalStorageAdapter,
  FEATURE_FLAGS_BACKUP_KEY,
  FEATURE_FLAGS_STORAGE_KEY,
  FEATURE_FLAGS_STORAGE_KEY_V1,
  FEATURE_FLAGS_STORAGE_KEY_V2,
  type IFeatureStorageAdapter,
  InMemoryFeatureStorageAdapter,
  createFeatureStorageAdapter,
  flagsSignal,
  initFeatureFlags,
  isFeatureEnabled,
  migrateLegacyFlagsIfNeeded,
  saveFeatureFlags,
  setDefaultStorageAdapterForTesting,
  setFeatureFlag,
  toggleFeature,
  toggleFeatureFlag,
} from '@/configs/storage.config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Feature Storage Subsystem & Reactive Signals (T003, T007, T008, Migration v1->v2)', () => {
  beforeEach(() => {
    setDefaultStorageAdapterForTesting(null);
    flagsSignal.value = getDefaultFlagState();
    vi.restoreAllMocks();
  });

  describe('InMemoryFeatureStorageAdapter', () => {
    it('should initialize empty or with initial state and save/load flags', async () => {
      const adapter = new InMemoryFeatureStorageAdapter({ 'core-settings': true });
      let flags = await adapter.loadFlags();
      expect(flags).toEqual({ 'core-settings': true });

      await adapter.saveFlag('n01-sidebar-observer', true);
      flags = await adapter.loadFlags();
      expect(flags).toEqual({
        'core-settings': true,
        'n01-sidebar-observer': true,
      });

      await adapter.saveAllFlags({ 'core-settings': false });
      flags = await adapter.loadFlags();
      expect(flags).toEqual({ 'core-settings': false });
    });

    it('should handle raw storage keys get, set, and remove', async () => {
      const adapter = new InMemoryFeatureStorageAdapter(undefined, {
        custom_key: { test: true },
      });

      expect(await adapter.getRaw('custom_key')).toEqual({ test: true });
      await adapter.setRaw('new_key', { value: false });
      expect(await adapter.getRaw('new_key')).toEqual({ value: false });
      await adapter.removeRaw('custom_key');
      expect(await adapter.getRaw('custom_key')).toBeUndefined();
    });
  });

  describe('ChromeLocalStorageAdapter', () => {
    it('should read and write using chrome.storage.local with v2 key', async () => {
      const mockStorage: Record<string, unknown> = {};
      const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;

      (globalThis as unknown as { chrome?: unknown }).chrome = {
        storage: {
          local: {
            get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
            set: vi.fn(async (items: Record<string, unknown>) => {
              Object.assign(mockStorage, items);
            }),
            remove: vi.fn(async (keys: string | string[]) => {
              const list = Array.isArray(keys) ? keys : [keys];
              for (const k of list) {
                delete mockStorage[k];
              }
            }),
          },
        },
      };

      try {
        const adapter = new ChromeLocalStorageAdapter();
        await adapter.saveFlag('n01-sidebar-observer', true);
        expect(mockStorage[FEATURE_FLAGS_STORAGE_KEY_V2]).toEqual({ 'n01-sidebar-observer': true });
        expect(mockStorage[FEATURE_FLAGS_STORAGE_KEY]).toEqual({ 'n01-sidebar-observer': true });

        const loaded = await adapter.loadFlags();
        expect(loaded).toEqual({ 'n01-sidebar-observer': true });

        await adapter.saveAllFlags({ f1: true, f2: false });
        expect(mockStorage[FEATURE_FLAGS_STORAGE_KEY_V2]).toEqual({ f1: true, f2: false });

        expect(await adapter.getRaw(FEATURE_FLAGS_STORAGE_KEY_V2)).toEqual({ f1: true, f2: false });
        await adapter.setRaw('test_raw', { ok: true });
        expect(mockStorage.test_raw).toEqual({ ok: true });
        await adapter.removeRaw('test_raw');
        expect(mockStorage.test_raw).toBeUndefined();
      } finally {
        (globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
      }
    });

    it('should safely return empty object when chrome is undefined', async () => {
      const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;
      (globalThis as unknown as { chrome?: unknown }).chrome = undefined;

      try {
        const adapter = new ChromeLocalStorageAdapter();
        const loaded = await adapter.loadFlags();
        expect(loaded).toEqual({});
        await expect(adapter.saveFlag('any', true)).resolves.toBeUndefined();
        await expect(adapter.saveAllFlags({ any: true })).resolves.toBeUndefined();
        expect(await adapter.getRaw('any')).toBeUndefined();
        await expect(adapter.setRaw('any', { a: true })).resolves.toBeUndefined();
        await expect(adapter.removeRaw('any')).resolves.toBeUndefined();
      } finally {
        (globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
      }
    });
  });

  describe('createFeatureStorageAdapter Factory', () => {
    it('should return InMemoryFeatureStorageAdapter when chrome.storage.local is missing', () => {
      const adapter = createFeatureStorageAdapter();
      expect(adapter).toBeInstanceOf(InMemoryFeatureStorageAdapter);
    });
  });

  describe('Migration Script v1 -> v2 (migrateLegacyFlagsIfNeeded)', () => {
    it('should migrate legacy v1 flags to 11 nodes in v2, create backup and delete v1 key', async () => {
      const adapter = new InMemoryFeatureStorageAdapter(undefined, {
        [FEATURE_FLAGS_STORAGE_KEY_V1]: {
          'core-settings': true,
          'message-collector': true,
          'message-forwarder': false,
        },
      });

      await migrateLegacyFlagsIfNeeded(adapter);

      const v2Data = await adapter.getRaw(FEATURE_FLAGS_STORAGE_KEY_V2);
      expect(v2Data).toBeDefined();
      expect(v2Data).toEqual({
        'core-settings': true,
        'n01-sidebar-observer': true,
        'n02-queue-manager': true,
        'n03-chat-switcher': true,
        'n04-delta-stitcher': false,
        'n05-bundle-aggregator': false,
        'n06-dedup-gate': false,
        'n07-price-router': false,
        'n08-forward-automator': false,
        'n09-text-injector': false,
        'n10-committer-drain': false,
      });

      const backupData = await adapter.getRaw(FEATURE_FLAGS_BACKUP_KEY);
      expect(backupData).toEqual({
        'core-settings': true,
        'message-collector': true,
        'message-forwarder': false,
      });

      const v1Data = await adapter.getRaw(FEATURE_FLAGS_STORAGE_KEY_V1);
      expect(v1Data).toBeUndefined();
    });

    it('should not overwrite v2 data if v2 already exists', async () => {
      const adapter = new InMemoryFeatureStorageAdapter(undefined, {
        [FEATURE_FLAGS_STORAGE_KEY_V1]: {
          'core-settings': true,
          'message-collector': true,
          'message-forwarder': true,
        },
        [FEATURE_FLAGS_STORAGE_KEY_V2]: {
          'core-settings': false,
          'n01-sidebar-observer': false,
        },
      });

      await migrateLegacyFlagsIfNeeded(adapter);

      const v2Data = await adapter.getRaw(FEATURE_FLAGS_STORAGE_KEY_V2);
      expect(v2Data).toEqual({
        'core-settings': false,
        'n01-sidebar-observer': false,
      });

      // Backup should not be created, v1 untouched
      const backupData = await adapter.getRaw(FEATURE_FLAGS_BACKUP_KEY);
      expect(backupData).toBeUndefined();

      const v1Data = await adapter.getRaw(FEATURE_FLAGS_STORAGE_KEY_V1);
      expect(v1Data).toEqual({
        'core-settings': true,
        'message-collector': true,
        'message-forwarder': true,
      });
    });

    it('should do nothing if neither v1 nor v2 has data', async () => {
      const adapter = new InMemoryFeatureStorageAdapter();
      await migrateLegacyFlagsIfNeeded(adapter);

      expect(await adapter.getRaw(FEATURE_FLAGS_STORAGE_KEY_V2)).toBeUndefined();
      expect(await adapter.getRaw(FEATURE_FLAGS_BACKUP_KEY)).toBeUndefined();
      expect(await adapter.getRaw(FEATURE_FLAGS_STORAGE_KEY_V1)).toBeUndefined();
    });
  });

  describe('initFeatureFlags', () => {
    it('should automatically run migration and initialize flagsSignal from legacy v1', async () => {
      const adapter = new InMemoryFeatureStorageAdapter(undefined, {
        [FEATURE_FLAGS_STORAGE_KEY_V1]: {
          'core-settings': true,
          'message-collector': true,
          'message-forwarder': true,
        },
      });

      const state = await initFeatureFlags(adapter);

      expect(state['core-settings']).toBe(true);
      expect(state['n01-sidebar-observer']).toBe(true);
      expect(state['n02-queue-manager']).toBe(true);
      expect(state['n03-chat-switcher']).toBe(true);
      expect(state['n04-delta-stitcher']).toBe(true);
      expect(state['n08-forward-automator']).toBe(true);
      expect(state['n09-text-injector']).toBe(true);
      expect(flagsSignal.value).toEqual(state);
      expect(isFeatureEnabled('n08-forward-automator')).toBe(true);
    });

    it('should initialize with default 11 flags when storage is empty', async () => {
      const adapter = new InMemoryFeatureStorageAdapter();
      const state = await initFeatureFlags(adapter);
      const defaults = getDefaultFlagState();

      expect(state).toEqual(defaults);
      expect(state['core-settings']).toBe(true);
      expect(state['n01-sidebar-observer']).toBe(true);
      expect(state['n08-forward-automator']).toBe(false);
      expect(state['n09-text-injector']).toBe(false);
      expect(flagsSignal.value).toEqual(defaults);
    });

    it('should merge defaults with existing stored flags', async () => {
      const adapter = new InMemoryFeatureStorageAdapter({
        'n08-forward-automator': true,
      });

      const merged = await initFeatureFlags(adapter);
      expect(merged['core-settings']).toBe(true); // default
      expect(merged['n01-sidebar-observer']).toBe(true); // default
      expect(merged['n08-forward-automator']).toBe(true); // override from storage
      expect(merged['n09-text-injector']).toBe(false); // default
      expect(flagsSignal.value).toEqual(merged);
    });
  });

  describe('Optimistic Updates and Rollback (T007, T008)', () => {
    it('should optimistically update flag and persist successfully', async () => {
      const adapter = new InMemoryFeatureStorageAdapter();
      await initFeatureFlags(adapter);

      expect(flagsSignal.value['n08-forward-automator']).toBe(false);

      const nextVal = await toggleFeatureFlag('n08-forward-automator', adapter);
      expect(nextVal).toBe(true);
      expect(flagsSignal.value['n08-forward-automator']).toBe(true);

      const stored = await adapter.loadFlags();
      expect(stored['n08-forward-automator']).toBe(true);

      // Verify toggleFeature alias
      const toggledBack = await toggleFeature('n08-forward-automator', adapter);
      expect(toggledBack).toBe(false);
      expect(flagsSignal.value['n08-forward-automator']).toBe(false);
    });

    it('should rollback flag value when storage persistence fails', async () => {
      const failingAdapter: IFeatureStorageAdapter = {
        loadFlags: async () => ({}),
        saveFlag: vi.fn().mockRejectedValue(new Error('QuotaExceededError')),
        saveAllFlags: async () => {},
      };

      await initFeatureFlags(failingAdapter);
      const initialValue = flagsSignal.value['core-settings'];
      expect(initialValue).toBe(true);

      await expect(setFeatureFlag('core-settings', false, failingAdapter)).rejects.toThrow(
        'QuotaExceededError',
      );

      // Verify rollback
      expect(flagsSignal.value['core-settings']).toBe(initialValue);
    });

    it('should rollback toggleFeatureFlag when persistence fails', async () => {
      const failingAdapter: IFeatureStorageAdapter = {
        loadFlags: async () => ({}),
        saveFlag: vi.fn().mockRejectedValue(new Error('Disk write failure')),
        saveAllFlags: async () => {},
      };

      await initFeatureFlags(failingAdapter);
      const initialValue = flagsSignal.value['n08-forward-automator'];
      expect(initialValue).toBe(false);

      await expect(toggleFeatureFlag('n08-forward-automator', failingAdapter)).rejects.toThrow(
        'Disk write failure',
      );

      expect(flagsSignal.value['n08-forward-automator']).toBe(initialValue);
    });

    it('should support saveFeatureFlags helper', async () => {
      const adapter = new InMemoryFeatureStorageAdapter();
      await saveFeatureFlags({ 'n01-sidebar-observer': false }, adapter);
      const stored = await adapter.loadFlags();
      expect(stored['n01-sidebar-observer']).toBe(false);
    });
  });
});
