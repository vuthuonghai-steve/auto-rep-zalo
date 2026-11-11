import type { FeatureDefinition } from '@/configs/features.config';
import { useRouter } from '@/configs/router.config';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';

export interface FeatureCardProps {
  feature: FeatureDefinition;
  isEnabled: boolean;
  onToggle: (featureId: string, nextState: boolean) => void;
  onNavigate?: (routePath: string) => void;
}

export const LAYER_BADGE_STYLES: Record<string, string> = {
  CORE: 'bg-purple-100 text-purple-700 border-purple-200',
  OBSERVATION: 'bg-sky-100 text-sky-700 border-sky-200',
  ORCHESTRATION: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  INGESTION: 'bg-amber-100 text-amber-700 border-amber-200',
  DECISION: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EXECUTION: 'bg-rose-100 text-rose-700 border-rose-200',
};

export function FeatureCard({ feature, isEnabled, onToggle, onNavigate }: FeatureCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    if (onNavigate) {
      onNavigate(feature.routePath);
    } else {
      router.navigate(feature.routePath);
    }
  };

  const handleToggle = (checked: boolean) => {
    onToggle(feature.id, checked);
  };

  const nodeCode = feature.nodeCode ?? (feature.id === 'core-settings' ? 'CORE' : 'NODE');
  const layer = feature.layer ?? 'CORE';
  const layerBadgeClass = LAYER_BADGE_STYLES[layer] ?? 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <div
      data-testid={`feature-card-${feature.id}`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      class="group relative bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-400 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Header Node ID & Layer Badges */}
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              data-testid={`node-code-${feature.id}`}
              class="inline-flex items-center px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300"
            >
              [{nodeCode}]
            </span>
            <span
              data-testid={`layer-badge-${feature.id}`}
              class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wider uppercase ${layerBadgeClass}`}
            >
              {layer}
            </span>
          </div>

          <span
            data-testid={`status-badge-${feature.id}`}
            class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
              isEnabled
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {isEnabled ? 'Đang Bật' : 'Đã Tắt'}
          </span>
        </div>

        {/* Feature Title */}
        <h3 class="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
          {feature.name}
        </h3>

        {/* Feature Description */}
        <p class="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4">{feature.description}</p>
      </div>

      {/* Footer Actions */}
      <div class="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
        <span class="text-xs text-blue-600 font-medium group-hover:underline flex items-center gap-1">
          Chi tiết cấu hình →
        </span>
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          data-testid={`toggle-wrapper-${feature.id}`}
        >
          <ToggleSwitch
            id={`toggle-${feature.id}`}
            checked={isEnabled}
            onChange={handleToggle}
            ariaLabel={`Bật tắt ${feature.name}`}
          />
        </div>
      </div>
    </div>
  );
}
