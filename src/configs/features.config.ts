import { z } from 'zod';

export const FeatureDefinitionSchema = z.object({
  id: z
    .string()
    .min(1, 'Feature ID cannot be empty')
    .regex(/^[a-z0-9-]+$/, 'Feature ID must be kebab-case'),
  name: z.string().min(1, 'Feature Name cannot be empty'),
  description: z.string().min(1, 'Feature Description cannot be empty'),
  isEnabledByDefault: z.boolean(),
  routePath: z.string().startsWith('/', 'Route path must start with /'),
  detailComponentKey: z.string().min(1, 'Component key cannot be empty'),
});

export type FeatureDefinition = z.infer<typeof FeatureDefinitionSchema>;

export type FeatureFlagState = Record<string, boolean>;

export interface IFeatureRegistry {
  getAllFeatures(): readonly FeatureDefinition[];
  getFeatureById(id: string): FeatureDefinition | undefined;
  getFeatureByRoute(routePath: string): FeatureDefinition | undefined;
  getDefaultFlagState(): FeatureFlagState;
}

export const FEATURES_REGISTRY: readonly FeatureDefinition[] = [
  {
    id: 'core-settings',
    name: 'Cấu hình Hệ Thống & Whitelist',
    description: 'Quản lý Whitelist nhóm nguồn, ma trận lọc giá và nhật ký hoạt động 24/7',
    isEnabledByDefault: true,
    routePath: '/feature/core-settings',
    detailComponentKey: 'core-settings',
  },
  {
    id: 'message-collector',
    name: 'Bộ Thu Thập Tin Nhắn Nguồn (Node 1 - Node 3)',
    description:
      'Theo dõi tin nhắn realtime từ nhóm nguồn, phân tích cú pháp và trích xuất dữ liệu giao dịch',
    isEnabledByDefault: false,
    routePath: '/feature/message-collector',
    detailComponentKey: 'placeholder-collector',
  },
  {
    id: 'message-forwarder',
    name: 'Bộ Phân Phối & Forward Tin Tự Động (Node 4 - Node 10)',
    description:
      'Tự động forward tin đã duyệt đến các nhóm đích được chỉ định theo cấu hình định tuyến',
    isEnabledByDefault: false,
    routePath: '/feature/message-forwarder',
    detailComponentKey: 'placeholder-forwarder',
  },
];

// Validate initial registry against schema at load time
for (const feature of FEATURES_REGISTRY) {
  FeatureDefinitionSchema.parse(feature);
}

export function getAllFeatures(): readonly FeatureDefinition[] {
  return FEATURES_REGISTRY;
}

export function getFeatureById(id: string): FeatureDefinition | undefined {
  return FEATURES_REGISTRY.find((f) => f.id === id);
}

export function getFeatureByRoute(routePath: string): FeatureDefinition | undefined {
  return FEATURES_REGISTRY.find((f) => f.routePath === routePath);
}

export function getDefaultFlagState(): FeatureFlagState {
  return FEATURES_REGISTRY.reduce<FeatureFlagState>((acc, feature) => {
    acc[feature.id] = feature.isEnabledByDefault;
    return acc;
  }, {});
}

export const featureRegistry: IFeatureRegistry = {
  getAllFeatures,
  getFeatureById,
  getFeatureByRoute,
  getDefaultFlagState,
};
