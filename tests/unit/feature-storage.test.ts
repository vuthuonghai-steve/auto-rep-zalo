import { getDefaultFlagState } from '@/configs/features.config';
import {
  ChromeLocalStorageAdapter,
  FEATURE_FLAGS_STORAGE_KEY,
  type IFeatureStorageAdapter,
  InMemoryFeatureStorageAdapter,
  createFeatureStorageAdapter,
  flagsSignal,
  initFeatureFlags,
  setDefaultStorageAdapterForTesting,
  setFeatureFlag,
  toggleFeatureFlag,
} from '@/configs/storage.config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Feature Storage Subsystem & Reactive Signals (T003, T007, T008)', () => {
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

      await adapter.saveFlag('message-collector', true);
      flags = await adapter.loadFlags();
      expect(flags).toEqual({
        'core-settings': true,
        'message-collector': true,
      });

      await adapter.saveAllFlags({ 'test-feature': false });
      flags = await adapter.loadFlags();
      expect(flags).toEqual({ 'test-feature': false });
    });
  });

  describe('ChromeLocalStorageAdapter', () => {
    it('should read and write using chrome.storage.local', async () => {
      const mockStorage: Record<string, unknown> = {};
      const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;

      (globalThis as unknown as { chrome?: unknown }).chrome = {
        storage: {
          local: {
            get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
            set: vi.fn(async (items: Record<string, unknown>) => {
              Object.assign(mockStorage, items);
            }),
          },
        },
      };

      try {
        const adapter = new ChromeLocalStorageAdapter();
        await adapter.saveFlag('custom-feature', true);
        expect(mockStorage[FEATURE_FLAGS_STORAGE_KEY]).toEqual({ 'custom-feature': true });

        const loaded = await adapter.loadFlags();
        expect(loaded).toEqual({ 'custom-feature': true });

        await adapter.saveAllFlags({ f1: true, f2: false });
        expect(mockStorage[FEATURE_FLAGS_STORAGE_KEY]).toEqual({ f1: true, f2: false });
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
        await expect(adapter.saveFlag('any', true)).resolves.not.toThrow();
        await expect(adapter.saveAllFlags({ any: true })).resolves.not.toThrow();
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

  describe('initFeatureFlags', () => {
    it('should merge defaults with stored flags', async () => {
      const adapter = new InMemoryFeatureStorageAdapter({
        'message-collector': true,
      });

      const merged = await initFeatureFlags(adapter);
      expect(merged['core-settings']).toBe(true); // default
      expect(merged['message-collector']).toBe(true); // override from storage
      expect(merged['message-forwarder']).toBe(false); // default
      expect(flagsSignal.value).toEqual(merged);
    });
  });

  describe('Optimistic Updates and Rollback (T007, T008)', () => {
    it('should optimistically update flag and persist successfully', async () => {
      const adapter = new InMemoryFeatureStorageAdapter();
      await initFeatureFlags(adapter);

      expect(flagsSignal.value['message-collector']).toBe(false);

      const nextVal = await toggleFeatureFlag('message-collector', adapter);
      expect(nextVal).toBe(true);
      expect(flagsSignal.value['message-collector']).toBe(true);

      const stored = await adapter.loadFlags();
      expect(stored['message-collector']).toBe(true);
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
      const initialValue = flagsSignal.value['message-collector'];
      expect(initialValue).toBe(false);

      await expect(toggleFeatureFlag('message-collector', failingAdapter)).rejects.toThrow(
        'Disk write failure',
      );

      expect(flagsSignal.value['message-collector']).toBe(initialValue);
    });
  });
});
