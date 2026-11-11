import {
  type FeatureDefinition,
  type FeatureFlagState,
  getAllFeatures,
} from '@/configs/features.config';
import { useRouter } from '@/configs/router.config';
import {
  flagsSignal,
  saveFeatureFlags,
  setFeatureFlag,
  toggleFeatureFlag,
} from '@/configs/storage.config';
import { FeatureCard } from '@/screens/menu/components/FeatureCard';
import { useMemo, useState } from 'preact/hooks';

export interface ArchitecturalLayerSection {
  id: string;
  orderNumber: number;
  title: string;
  badgeLabel: string;
  badgeClass: string;
  roleNote: string;
  matchingLayers: readonly string[];
}

export const ARCHITECTURAL_LAYER_SECTIONS: readonly ArchitecturalLayerSection[] = [
  {
    id: 'layer-core',
    orderNumber: 1,
    title: 'Cấu Hình Cốt Lõi (Core & Whitelist)',
    badgeLabel: 'CORE',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    roleNote:
      'Quản lý danh sách Whitelist nhóm nguồn Zalo, ma trận bộ lọc khoảng giá và thiết lập hệ thống 24/7',
    matchingLayers: ['CORE'],
  },
  {
    id: 'layer-observation-orchestration',
    orderNumber: 2,
    title: 'Tầng Quan Sát & Điều Phối',
    badgeLabel: 'OBSERVATION & ORCHESTRATION',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    roleNote:
      'Giám sát thay đổi hội thoại realtime qua MutationObserver và tuần tự hóa hàng chờ Single Mutex FIFO',
    matchingLayers: ['OBSERVATION', 'ORCHESTRATION'],
  },
  {
    id: 'layer-ingestion',
    orderNumber: 3,
    title: 'Tầng Thu Thập & Gom Cụm',
    badgeLabel: 'INGESTION',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    roleNote:
      'Chuyển tab hội thoại bằng Human Jitter, trích xuất delta tin nhắn mới và gom cụm bundle 15s',
    matchingLayers: ['INGESTION'],
  },
  {
    id: 'layer-decision',
    orderNumber: 4,
    title: 'Tầng Thẩm Định & Định Tuyến',
    badgeLabel: 'DECISION',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    roleNote:
      'Khử trùng lặp 30 ngày theo SĐT & SHA-256 nội dung, lọc khoảng giá và định tuyến tới tối đa 2 nhóm đích',
    matchingLayers: ['DECISION'],
  },
  {
    id: 'layer-execution',
    orderNumber: 5,
    title: 'Tầng Tác Động Giao Diện & Hoàn Tất',
    badgeLabel: 'EXECUTION',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    roleNote:
      'Tự động mở Native Forward Modal chia sẻ media, tiêm văn bản đã biên tập và chốt checkpoint an toàn',
    matchingLayers: ['EXECUTION'],
  },
];

export function MasterMenuScreen() {
  const router = useRouter();
  const features = getAllFeatures();
  const currentFlags = flagsSignal.value;
  const [searchQuery, setSearchQuery] = useState('');

  const activeCount = useMemo(() => {
    return features.filter((f) => currentFlags[f.id]).length;
  }, [features, currentFlags]);

  const handleToggle = async (featureId: string, nextState?: boolean) => {
    try {
      if (typeof nextState === 'boolean') {
        await setFeatureFlag(featureId, nextState);
      } else {
        await toggleFeatureFlag(featureId);
      }
    } catch {
      // Rollback is handled inside storage.config.ts
    }
  };

  const handleToggleAll = async (targetState: boolean) => {
    const nextFlags: FeatureFlagState = { ...flagsSignal.value };
    for (const f of features) {
      nextFlags[f.id] = targetState;
    }
    flagsSignal.value = nextFlags;
    try {
      await saveFeatureFlags(nextFlags);
    } catch {
      // Rollback is handled in caller/storage
    }
  };

  const handleNavigate = (path: string) => {
    router.navigate(path);
  };

  const filteredFeatures = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return features;
    }
    return features.filter((feature: FeatureDefinition) => {
      const matchName = feature.name.toLowerCase().includes(query);
      const matchCode = feature.nodeCode?.toLowerCase().includes(query) ?? false;
      const matchId = feature.id.toLowerCase().includes(query);
      const matchDesc = feature.description.toLowerCase().includes(query);
      const matchLayer = feature.layer?.toLowerCase().includes(query) ?? false;
      return matchName || matchCode || matchId || matchDesc || matchLayer;
    });
  }, [features, searchQuery]);

  return (
    <div class="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Dashboard */}
      <header class="border-b border-gray-200 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <span class="p-2 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-sm">
              ZPA 24/7
            </span>
            <h1 class="text-2xl font-bold text-gray-900 tracking-tight">
              Trung Tâm Quản Trị Tính Năng
            </h1>
          </div>
          <p class="text-sm text-gray-500 mt-2">
            Hệ thống phân phối & tự động hóa Zalo cá nhân. Bật/tắt các module tính năng độc lập theo
            nhu cầu.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <span
            data-testid="stat-total-features"
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
          >
            Tổng cộng: {features.length} module
          </span>
          <span
            data-testid="stat-active-features"
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"
          >
            Hoạt động: {activeCount}/{features.length} module
          </span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            5 Tầng Kiến Trúc
          </span>
        </div>
      </header>

      {/* Control Bar: Search & Batch Actions */}
      <section class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div class="relative flex-1">
          <input
            type="text"
            data-testid="search-input"
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            placeholder="Tìm kiếm module theo mã (N01..N10), tên hoặc mô tả..."
            class="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          <span class="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              class="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="toggle-all-enable"
            onClick={() => handleToggleAll(true)}
            class="px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors cursor-pointer"
          >
            Bật tất cả
          </button>
          <button
            type="button"
            data-testid="toggle-all-disable"
            onClick={() => handleToggleAll(false)}
            class="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors cursor-pointer"
          >
            Tắt tất cả
          </button>
        </div>
      </section>

      {/* Danh sách 5 Architectural Layers */}
      <div class="space-y-10">
        {ARCHITECTURAL_LAYER_SECTIONS.map((section) => {
          const sectionFeatures = filteredFeatures.filter((f) =>
            section.matchingLayers.includes(f.layer ?? 'CORE'),
          );

          if (sectionFeatures.length === 0 && searchQuery) {
            return null;
          }

          const activeSectionCount = sectionFeatures.filter((f) => currentFlags[f.id]).length;

          return (
            <section
              key={section.id}
              data-testid={`layer-section-${section.id}`}
              class="space-y-4 pt-2"
            >
              {/* Tiêu đề tầng & ghi chú vai trò */}
              <div class="border-b border-gray-200 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-lg font-bold text-gray-900">
                      {section.orderNumber}. {section.title}
                    </h2>
                    <span
                      class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wider uppercase ${section.badgeClass}`}
                    >
                      {section.badgeLabel}
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1 leading-relaxed">{section.roleNote}</p>
                </div>

                <span class="text-xs font-medium text-gray-500 shrink-0">
                  Hoạt động: {activeSectionCount}/{sectionFeatures.length} module
                </span>
              </div>

              {/* Grid danh sách FeatureCard trong tầng */}
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sectionFeatures.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    isEnabled={currentFlags[feature.id] ?? false}
                    onToggle={handleToggle}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* Empty Search Result State */}
        {filteredFeatures.length === 0 && (
          <div
            data-testid="no-results-found"
            class="text-center py-12 bg-white rounded-xl border border-gray-200 p-8 space-y-3"
          >
            <p class="text-gray-500 text-sm">
              Không tìm thấy module nào khớp với từ khóa{' '}
              <span class="font-semibold text-gray-700">"{searchQuery}"</span>
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              class="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
