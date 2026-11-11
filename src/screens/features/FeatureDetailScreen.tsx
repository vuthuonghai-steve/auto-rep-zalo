import { getFeatureById, getFeatureByRoute } from '@/configs/features.config';
import { matchRoute, useRouter } from '@/configs/router.config';
import { flagsSignal, toggleFeatureFlag } from '@/configs/storage.config';
import { NotFoundScreen } from '@/screens/common/NotFoundScreen';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { getFeatureDetailComponent } from '@/screens/features/registry';
import { LAYER_BADGE_STYLES } from '@/screens/menu/components/FeatureCard';
import { h } from 'preact';

export function FeatureDetailScreen() {
  const router = useRouter();
  const currentPath = router.currentPath;

  // Find feature by exact route or extract id parameter
  let feature = getFeatureByRoute(currentPath);
  if (!feature) {
    const params = matchRoute('/feature/:id', currentPath);
    if (params?.id) {
      feature = getFeatureById(params.id);
    }
  }

  if (!feature) {
    return <NotFoundScreen attemptedPath={currentPath} />;
  }

  const isEnabled = flagsSignal.value[feature.id] ?? false;

  const handleBack = () => {
    if (router.canGoBack) {
      router.goBack();
    } else {
      router.navigate('/');
    }
  };

  const handleToggle = async (featureId: string) => {
    try {
      await toggleFeatureFlag(featureId);
    } catch {
      // Rollback is handled inside storage.config.ts
    }
  };

  const DetailComponent = getFeatureDetailComponent(feature.detailComponentKey);
  const layerBadgeClass =
    LAYER_BADGE_STYLES[feature.layer] ?? 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <div class="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header Scaffold */}
      <header class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="space-y-2">
          <div class="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleBack}
              class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors"
            >
              ← Quay lại
            </button>
            <span
              data-testid={`node-code-${feature.id}`}
              class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300"
            >
              [{feature.nodeCode}]
            </span>
            <span
              data-testid={`layer-badge-${feature.id}`}
              class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wider uppercase ${layerBadgeClass}`}
            >
              {feature.layer}
            </span>
            <h1 class="text-xl font-bold text-gray-900">{feature.name}</h1>
            <span
              class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {isEnabled ? 'Đang Bật' : 'Đã Tắt'}
            </span>
          </div>
          <p class="text-xs text-gray-500 pl-1">{feature.description}</p>
        </div>

        <div class="flex items-center gap-3 self-end md:self-auto pt-2 md:pt-0">
          <ToggleSwitch
            id={`header-toggle-${feature.id}`}
            checked={isEnabled}
            onChange={() => feature && handleToggle(feature.id)}
            label={isEnabled ? 'Module hoạt động' : 'Module tạm dừng'}
          />
        </div>
      </header>

      {/* Main Feature Content from Registry */}
      <main class="transition-opacity duration-200">{h(DetailComponent, {})}</main>
    </div>
  );
}
