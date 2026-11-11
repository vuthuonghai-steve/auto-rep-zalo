import { z } from 'zod';

export const NodeLayerEnum = z.enum([
  'CORE',
  'OBSERVATION',
  'ORCHESTRATION',
  'INGESTION',
  'DECISION',
  'EXECUTION',
]);

export type NodeLayer = z.infer<typeof NodeLayerEnum>;

export const FeatureDefinitionSchema = z.object({
  id: z
    .string()
    .min(1, 'Feature ID cannot be empty')
    .regex(
      /^n(0[1-9]|10)-[a-z0-9-]+$|^core-settings$/,
      'Feature ID must be n01..n10 prefix or core-settings',
    ),
  nodeCode: z.string().regex(/^N(0[1-9]|10)$|^CORE$/, 'Node code must be N01-N10 or CORE'),
  layer: NodeLayerEnum,
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
    nodeCode: 'CORE',
    layer: 'CORE',
    name: 'Cấu hình Hệ Thống & Whitelist',
    description: 'Quản lý Whitelist nhóm nguồn, ma trận lọc giá và nhật ký hoạt động 24/7',
    isEnabledByDefault: true,
    routePath: '/feature/core-settings',
    detailComponentKey: 'core-settings',
  },
  {
    id: 'n01-sidebar-observer',
    nodeCode: 'N01',
    layer: 'OBSERVATION',
    name: 'Bộ Lắng Nghe Sidebar (Sidebar Observer)',
    description: 'Bắt tin mới qua MutationObserver trên danh sách hội thoại Zalo sidebar',
    isEnabledByDefault: true,
    routePath: '/feature/n01-sidebar-observer',
    detailComponentKey: 'n01-sidebar-observer',
  },
  {
    id: 'n02-queue-manager',
    nodeCode: 'N02',
    layer: 'ORCHESTRATION',
    name: 'Bộ Quản Lý Hàng Chờ (Queue Manager)',
    description: 'Hàng chờ Single Mutex FIFO tuần tự hóa điều phối xử lý nhóm chat nguồn',
    isEnabledByDefault: true,
    routePath: '/feature/n02-queue-manager',
    detailComponentKey: 'n02-queue-manager',
  },
  {
    id: 'n03-chat-switcher',
    nodeCode: 'N03',
    layer: 'INGESTION',
    name: 'Bộ Chuyển Hội Thoại (Chat Switcher)',
    description: 'Mô phỏng click Human Jitter chuyển tab nhóm chat nguồn và neo đáy',
    isEnabledByDefault: true,
    routePath: '/feature/n03-chat-switcher',
    detailComponentKey: 'n03-chat-switcher',
  },
  {
    id: 'n04-delta-stitcher',
    nodeCode: 'N04',
    layer: 'INGESTION',
    name: 'Bộ Trích Xuất Tin Mới (Delta Stitcher)',
    description: 'Đối chiếu checkpoint quét 5-10 tin đáy viewport và bỏ qua nút 99+ tin',
    isEnabledByDefault: true,
    routePath: '/feature/n04-delta-stitcher',
    detailComponentKey: 'n04-delta-stitcher',
  },
  {
    id: 'n05-bundle-aggregator',
    nodeCode: 'N05',
    layer: 'INGESTION',
    name: 'Bộ Gom Cụm Tin & Media (Bundle Aggregator)',
    description: 'Gom cụm tin văn bản và album ảnh/video trong cửa sổ thời gian 15s',
    isEnabledByDefault: true,
    routePath: '/feature/n05-bundle-aggregator',
    detailComponentKey: 'n05-bundle-aggregator',
  },
  {
    id: 'n06-dedup-gate',
    nodeCode: 'N06',
    layer: 'DECISION',
    name: 'Cổng Lọc Trùng (Dedup Gate)',
    description: 'Lọc trùng 30 ngày bằng chuẩn hóa SĐT và mã băm SHA-256 nội dung',
    isEnabledByDefault: true,
    routePath: '/feature/n06-dedup-gate',
    detailComponentKey: 'n06-dedup-gate',
  },
  {
    id: 'n07-price-router',
    nodeCode: 'N07',
    layer: 'DECISION',
    name: 'Bộ Định Tuyến & Lọc Giá (Price Router)',
    description: 'Trích xuất SĐT, lọc khoảng giá và định tuyến tới tối đa 2 nhóm đích',
    isEnabledByDefault: true,
    routePath: '/feature/n07-price-router',
    detailComponentKey: 'n07-price-router',
  },
  {
    id: 'n08-forward-automator',
    nodeCode: 'N08',
    layer: 'EXECUTION',
    name: 'Bộ Chuyển Tiếp Media (Forward Automator)',
    description: 'Mở Native Forward Modal Zalo, tick chọn nhóm đích và chia sẻ media gốc',
    isEnabledByDefault: false,
    routePath: '/feature/n08-forward-automator',
    detailComponentKey: 'n08-forward-automator',
  },
  {
    id: 'n09-text-injector',
    nodeCode: 'N09',
    layer: 'EXECUTION',
    name: 'Bộ Tiêm Nội Dung Văn Bản (Text Injector)',
    description: 'Chuyển sang nhóm đích và tiêm văn bản đã biên tập kèm human micro-jitter',
    isEnabledByDefault: false,
    routePath: '/feature/n09-text-injector',
    detailComponentKey: 'n09-text-injector',
  },
  {
    id: 'n10-committer-drain',
    nodeCode: 'N10',
    layer: 'EXECUTION',
    name: 'Bộ Lưu Vết & Giải Phóng (Committer & Drain)',
    description: 'Đếm ngược khoảng đệm tĩnh lặng 10s, lưu checkpoint và giải phóng hàng chờ',
    isEnabledByDefault: true,
    routePath: '/feature/n10-committer-drain',
    detailComponentKey: 'n10-committer-drain',
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
