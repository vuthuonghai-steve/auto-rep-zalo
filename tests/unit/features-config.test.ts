import {
  FEATURES_REGISTRY,
  FeatureDefinitionSchema,
  NodeLayerEnum,
  featureRegistry,
  getAllFeatures,
  getDefaultFlagState,
  getFeatureById,
  getFeatureByRoute,
} from '@/configs/features.config';
import { describe, expect, it } from 'vitest';

describe('FeatureDefinitionSchema & 10 Feature Nodes Registry Contract', () => {
  it('should validate a correct feature definition with nodeCode and layer', () => {
    const validFeature = {
      id: 'n01-sidebar-observer',
      nodeCode: 'N01',
      layer: 'OBSERVATION',
      name: 'Bộ Lắng Nghe Sidebar',
      description: 'Mô tả tính năng',
      isEnabledByDefault: true,
      routePath: '/feature/n01-sidebar-observer',
      detailComponentKey: 'n01-sidebar-observer',
    };

    const parsed = FeatureDefinitionSchema.safeParse(validFeature);
    expect(parsed.success).toBe(true);
  });

  it('should validate core-settings feature definition', () => {
    const coreFeature = {
      id: 'core-settings',
      nodeCode: 'CORE',
      layer: 'CORE',
      name: 'Cấu hình Hệ Thống & Whitelist',
      description: 'Mô tả cấu hình hệ thống',
      isEnabledByDefault: true,
      routePath: '/feature/core-settings',
      detailComponentKey: 'core-settings',
    };

    const parsed = FeatureDefinitionSchema.safeParse(coreFeature);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid NodeLayerEnum values', () => {
    const invalidLayers = ['INVALID', 'observation', 'core', 'CUSTOM', ''];

    for (const layer of invalidLayers) {
      const parsed = NodeLayerEnum.safeParse(layer);
      expect(parsed.success).toBe(false);
    }

    const validLayers = [
      'CORE',
      'OBSERVATION',
      'ORCHESTRATION',
      'INGESTION',
      'DECISION',
      'EXECUTION',
    ];
    for (const layer of validLayers) {
      expect(NodeLayerEnum.safeParse(layer).success).toBe(true);
    }
  });

  it('should reject invalid nodeCode patterns', () => {
    const invalidCodes = ['N00', 'N11', 'N99', 'n01', 'core', 'CORE_SETTING', 'N1', ''];

    for (const nodeCode of invalidCodes) {
      const parsed = FeatureDefinitionSchema.safeParse({
        id: 'n01-sidebar-observer',
        nodeCode,
        layer: 'OBSERVATION',
        name: 'Test',
        description: 'Test',
        isEnabledByDefault: true,
        routePath: '/test',
        detailComponentKey: 'test',
      });
      expect(parsed.success).toBe(false);
    }

    // Valid nodeCodes: CORE, N01..N10
    const validCodes = [
      'CORE',
      'N01',
      'N02',
      'N03',
      'N04',
      'N05',
      'N06',
      'N07',
      'N08',
      'N09',
      'N10',
    ];
    for (const nodeCode of validCodes) {
      const parsed = FeatureDefinitionSchema.safeParse({
        id: nodeCode === 'CORE' ? 'core-settings' : `n${nodeCode.slice(1).toLowerCase()}-feature`,
        nodeCode,
        layer: 'EXECUTION',
        name: 'Valid Name',
        description: 'Valid Description',
        isEnabledByDefault: false,
        routePath: '/test',
        detailComponentKey: 'test',
      });
      expect(parsed.success).toBe(true);
    }
  });

  it('should reject invalid feature ID formats', () => {
    const invalidIds = [
      'invalidId',
      'INVALID_ID',
      'invalid id',
      'invalid_id',
      'n00-test',
      'n11-test',
      'custom-feature',
      '',
    ];

    for (const id of invalidIds) {
      const parsed = FeatureDefinitionSchema.safeParse({
        id,
        nodeCode: 'N01',
        layer: 'OBSERVATION',
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
      id: 'n01-test',
      nodeCode: 'N01',
      layer: 'OBSERVATION',
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
    const base = {
      id: 'n01-test',
      nodeCode: 'N01',
      layer: 'OBSERVATION' as const,
      name: 'Test',
      description: 'Test',
      isEnabledByDefault: true,
      routePath: '/test',
      detailComponentKey: 'test',
    };

    expect(FeatureDefinitionSchema.safeParse({ ...base, name: '' }).success).toBe(false);
    expect(FeatureDefinitionSchema.safeParse({ ...base, description: '' }).success).toBe(false);
    expect(FeatureDefinitionSchema.safeParse({ ...base, detailComponentKey: '' }).success).toBe(
      false,
    );
  });

  it('should ensure FEATURES_REGISTRY defines exactly 11 valid features', () => {
    const features = getAllFeatures();
    expect(features).toHaveLength(11);

    for (const feature of features) {
      const parsed = FeatureDefinitionSchema.safeParse(feature);
      expect(parsed.success).toBe(true);
    }
  });

  it('should ensure no duplicate IDs, nodeCodes, or routePaths in FEATURES_REGISTRY', () => {
    const features = getAllFeatures();

    const ids = features.map((f) => f.id);
    expect(new Set(ids).size).toBe(11);

    const nodeCodes = features.map((f) => f.nodeCode);
    expect(new Set(nodeCodes).size).toBe(11);

    const routePaths = features.map((f) => f.routePath);
    expect(new Set(routePaths).size).toBe(11);
  });

  it('should produce valid default flag state with exactly 11 keys and N08/N09 disabled', () => {
    const defaultFlags = getDefaultFlagState();
    const flagKeys = Object.keys(defaultFlags);

    expect(flagKeys).toHaveLength(11);

    // N08 & N09 MUST be false for dry-run safety
    expect(defaultFlags['n08-forward-automator']).toBe(false);
    expect(defaultFlags['n09-text-injector']).toBe(false);

    // Other features are enabled by default
    expect(defaultFlags['core-settings']).toBe(true);
    expect(defaultFlags['n01-sidebar-observer']).toBe(true);
    expect(defaultFlags['n02-queue-manager']).toBe(true);
    expect(defaultFlags['n03-chat-switcher']).toBe(true);
    expect(defaultFlags['n04-delta-stitcher']).toBe(true);
    expect(defaultFlags['n05-bundle-aggregator']).toBe(true);
    expect(defaultFlags['n06-dedup-gate']).toBe(true);
    expect(defaultFlags['n07-price-router']).toBe(true);
    expect(defaultFlags['n10-committer-drain']).toBe(true);
  });

  it('should retrieve features by id and routePath correctly', () => {
    const n01ById = getFeatureById('n01-sidebar-observer');
    expect(n01ById).toBeDefined();
    expect(n01ById?.nodeCode).toBe('N01');
    expect(n01ById?.layer).toBe('OBSERVATION');

    const n01ByRoute = getFeatureByRoute('/feature/n01-sidebar-observer');
    expect(n01ByRoute).toEqual(n01ById);

    const coreById = getFeatureById('core-settings');
    expect(coreById).toBeDefined();
    expect(coreById?.nodeCode).toBe('CORE');
    expect(coreById?.layer).toBe('CORE');

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
