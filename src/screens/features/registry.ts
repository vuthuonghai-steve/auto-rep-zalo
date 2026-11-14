import { type ComponentType, h } from 'preact';
import { SidebarObserverScreen } from '../sidebar-observer/SidebarObserverScreen';
import { CoreSettingsDetailScreen } from './CoreSettingsDetailScreen';
import {
  N02QueueManagerView,
  N03ChatSwitcherView,
  N04DeltaStitcherView,
  N05BundleAggregatorView,
  N06DedupGateView,
  N07PriceRouterView,
  N08ForwardAutomatorView,
  N09TextInjectorView,
  N10CommitterDrainView,
} from './nodes';
import { CollectorPlaceholderView } from './placeholders/CollectorPlaceholderView';
import { MessengerPlaceholderView } from './placeholders/MessengerPlaceholderView';

// Alias CoreSettingsView for consistency
export const CoreSettingsView = CoreSettingsDetailScreen;

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
  // Core system settings
  'core-settings': CoreSettingsDetailScreen,

  // 10 Dedicated Feature Nodes
  'n01-sidebar-observer': SidebarObserverScreen,
  'n02-queue-manager': N02QueueManagerView,
  'n03-chat-switcher': N03ChatSwitcherView,
  'n04-delta-stitcher': N04DeltaStitcherView,
  'n05-bundle-aggregator': N05BundleAggregatorView,
  'n06-dedup-gate': N06DedupGateView,
  'n07-price-router': N07PriceRouterView,
  'n08-forward-automator': N08ForwardAutomatorView,
  'n09-text-injector': N09TextInjectorView,
  'n10-committer-drain': N10CommitterDrainView,

  // Deprecated legacy placeholder mappings
  /** @deprecated use dedicated node views instead */
  'placeholder-collector': CollectorPlaceholderView,
  /** @deprecated use dedicated node views instead */
  'placeholder-forwarder': MessengerPlaceholderView,
};

export function getFeatureDetailComponent(key: string): ComponentType {
  return FEATURE_COMPONENTS_MAP[key] ?? DefaultFallbackView;
}
