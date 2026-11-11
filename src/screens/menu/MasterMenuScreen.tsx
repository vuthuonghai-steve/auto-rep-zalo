import { getAllFeatures } from '@/configs/features.config';
import { useRouter } from '@/configs/router.config';
import { flagsSignal, toggleFeatureFlag } from '@/configs/storage.config';
import { FeatureCard } from '@/screens/menu/FeatureCard';

export function MasterMenuScreen() {
  const router = useRouter();
  const features = getAllFeatures();
  const currentFlags = flagsSignal.value;

  const handleToggle = async (featureId: string) => {
    try {
      await toggleFeatureFlag(featureId);
    } catch {
      // Rollback is handled inside storage.config.ts
    }
  };

  const handleNavigate = (path: string) => {
    router.navigate(path);
  };

  return (
    <div class="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Dashboard */}
      <header class="border-b border-gray-200 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <span class="p-2 bg-blue-600 text-white rounded-lg font-bold text-sm">ZPA 24/7</span>
            <h1 class="text-2xl font-bold text-gray-900">Trung Tâm Quản Trị Tính Năng</h1>
          </div>
          <p class="text-sm text-gray-500 mt-2">
            Hệ thống phân phối & tự động hóa Zalo cá nhân. Bật/tắt các module tính năng độc lập theo
            nhu cầu.
          </p>
        </div>

        <div class="flex items-center gap-2 self-start md:self-auto">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Tổng cộng: {features.length} module
          </span>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            Hoạt động: {Object.values(currentFlags).filter(Boolean).length} module
          </span>
        </div>
      </header>

      {/* Grid danh sách FeatureCard */}
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-gray-800">Danh Sách Module Tính Năng</h2>
          <span class="text-xs text-gray-400">
            Click vào thẻ để truy cập giao diện cấu hình chi tiết
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
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
    </div>
  );
}
