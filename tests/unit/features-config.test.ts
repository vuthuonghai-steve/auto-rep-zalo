import {
  FEATURES_REGISTRY,
  FeatureDefinitionSchema,
  featureRegistry,
  getAllFeatures,
  getDefaultFlagState,
  getFeatureById,
  getFeatureByRoute,
} from '@/configs/features.config';
import { describe, expect, it } from 'vitest';

describe('FeatureDefinitionSchema & Registry Contract', () => {
  it('should validate a correct feature definition', () => {
    const validFeature = {
      id: 'custom-feature',
      name: 'Tính năng tùy biến',
      description: 'Mô tả tính năng',
      isEnabledByDefault: false,
      routePath: '/feature/custom-feature',
      detailComponentKey: 'custom-component',
    };

    const parsed = FeatureDefinitionSchema.safeParse(validFeature);
    expect(parsed.success).toBe(true);
  });

  it('should reject non-kebab-case feature ID', () => {
    const invalidIds = ['invalidId', 'INVALID_ID', 'invalid id', 'invalid_id', ''];

    for (const id of invalidIds) {
      const parsed = FeatureDefinitionSchema.safeParse({
        id,
        name: 'Test',
        description: 'Test',
        isEnabledByDefault: true,
        routePath: '/test',
        detailComponentKey: 'test',
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('should reject routePath that does not start with /', () => {
    const parsed = FeatureDefinitionSchema.safeParse({
      id: 'test-feature',
      name: 'Test',
      description: 'Test',
      isEnabledByDefault: true,
      routePath: 'invalid/path',
      detailComponentKey: 'test',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('Route path must start with /');
    }
  });

  it('should reject empty name, description, or detailComponentKey', () => {
    expect(
      FeatureDefinitionSchema.safeParse({
        id: 'test-feature',
        name: '',
        description: 'Test',
        isEnabledByDefault: true,
        routePath: '/test',
        detailComponentKey: 'test',
      }).success,
    ).toBe(false);

    expect(
      FeatureDefinitionSchema.safeParse({
        id: 'test-feature',
        name: 'Test',
        description: '',
        isEnabledByDefault: true,
        routePath: '/test',
        detailComponentKey: 'test',
      }).success,
    ).toBe(false);

    expect(
      FeatureDefinitionSchema.safeParse({
        id: 'test-feature',
        name: 'Test',
        description: 'Test',
        isEnabledByDefault: true,
        routePath: '/test',
        detailComponentKey: '',
      }).success,
    ).toBe(false);
  });

  it('should ensure initial FEATURES_REGISTRY has unique IDs and valid entries', () => {
    const features = getAllFeatures();
    expect(features.length).toBeGreaterThanOrEqual(3);

    const ids = features.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    for (const f of features) {
      expect(FeatureDefinitionSchema.safeParse(f).success).toBe(true);
    }
  });

  it('should produce valid default flag state from registry', () => {
    const defaultFlags = getDefaultFlagState();
    expect(defaultFlags).toEqual({
      'core-settings': true,
      'message-collector': false,
      'message-forwarder': false,
    });
  });

  it('should retrieve feature by id and routePath correctly', () => {
    const coreById = getFeatureById('core-settings');
    expect(coreById).toBeDefined();
    expect(coreById?.name).toBe('Cấu hình Hệ Thống & Whitelist');

    const coreByRoute = getFeatureByRoute('/feature/core-settings');
    expect(coreByRoute).toEqual(coreById);

    expect(getFeatureById('non-existent')).toBeUndefined();
    expect(getFeatureByRoute('/non-existent')).toBeUndefined();
  });

  it('should satisfy IFeatureRegistry interface methods', () => {
    expect(featureRegistry.getAllFeatures()).toEqual(FEATURES_REGISTRY);
    expect(featureRegistry.getFeatureById('core-settings')).toEqual(
      getFeatureById('core-settings'),
    );
    expect(featureRegistry.getFeatureByRoute('/feature/core-settings')).toEqual(
      getFeatureByRoute('/feature/core-settings'),
    );
    expect(featureRegistry.getDefaultFlagState()).toEqual(getDefaultFlagState());
  });
});
