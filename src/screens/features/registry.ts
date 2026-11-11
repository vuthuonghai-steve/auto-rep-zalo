import { type ComponentType, h } from 'preact';
import { CoreSettingsDetailScreen } from './CoreSettingsDetailScreen';
import { CollectorPlaceholderView } from './placeholders/CollectorPlaceholderView';
import { MessengerPlaceholderView } from './placeholders/MessengerPlaceholderView';

export function DefaultFallbackView() {
  return h(
    'div',
    { class: 'bg-white border border-gray-200 rounded-xl p-8 text-center space-y-3' },
    h(
      'div',
      {
        class:
          'w-12 h-12 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center mx-auto text-xl',
      },
      '⚙️',
    ),
    h(
      'h3',
      { class: 'text-base font-semibold text-gray-800' },
      'Giao diện chi tiết đang được cập nhật',
    ),
    h(
      'p',
      { class: 'text-xs text-gray-500' },
      'Tính năng này chưa cấu hình giao diện quản trị riêng.',
    ),
  );
}

export const FEATURE_COMPONENTS_MAP: Record<string, ComponentType> = {
  'core-settings': CoreSettingsDetailScreen,
  'placeholder-collector': CollectorPlaceholderView,
  'placeholder-forwarder': MessengerPlaceholderView,
};

export function getFeatureDetailComponent(key: string): ComponentType {
  return FEATURE_COMPONENTS_MAP[key] ?? DefaultFallbackView;
}
