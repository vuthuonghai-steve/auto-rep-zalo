import type { FeatureDefinition } from '@/configs/features.config';
import { useRouter } from '@/configs/router.config';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';

export interface FeatureCardProps {
  feature: FeatureDefinition;
  isEnabled: boolean;
  onToggle: (featureId: string, nextState: boolean) => void;
  onNavigate?: (routePath: string) => void;
}

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
      class="group relative bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div class="flex items-start justify-between gap-4 mb-3">
          <h3 class="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {feature.name}
          </h3>
          <span
            class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
              isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isEnabled ? 'Đang Bật' : 'Đã Tắt'}
          </span>
        </div>

        <p class="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4">{feature.description}</p>
      </div>

      <div class="pt-4 border-t border-gray-100 flex items-center justify-between">
        <span class="text-xs text-blue-600 font-medium group-hover:underline flex items-center gap-1">
          Chi tiết cấu hình →
        </span>
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
