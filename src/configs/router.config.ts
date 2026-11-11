import { signal } from '@preact/signals';
import { type ComponentChildren, createContext, h } from 'preact';
import { useContext } from 'preact/hooks';
import {
  FEATURES_REGISTRY,
  type FeatureDefinition,
  getFeatureById,
  getFeatureByRoute,
} from './features.config';

export interface RouteState {
  currentPath: string;
  params: Record<string, string>;
  history: string[];
}

export interface ParsedRoute {
  path: string;
  params: Record<string, string>;
  isValid: boolean;
  feature?: FeatureDefinition;
}

export interface IRouterContext {
  currentPath: string;
  params: Record<string, string>;
  canGoBack: boolean;
  navigate: (path: string) => void;
  goBack: () => void;
  reset: (initialPath?: string) => void;
  isValidRoute?: (path: string) => boolean;
  parseRoute?: (path: string) => ParsedRoute;
}

export interface RouterProviderProps {
  initialPath?: string;
  children?: ComponentChildren;
}

/**
 * Khớp đường dẫn theo pattern dạng dynamic segments (ví dụ: '/feature/:id').
 * Trả về object params nếu khớp, hoặc null nếu không khớp.
 */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternBase = pattern.split('?')[0] ?? '';
  const pathBase = path.split('?')[0] ?? '';
  const normalizedPattern = patternBase.replace(/\/+$/, '') || '/';
  const normalizedPath = pathBase.replace(/\/+$/, '') || '/';

  if (normalizedPattern === normalizedPath) {
    return {};
  }

  const patternParts = normalizedPattern.split('/').filter(Boolean);
  const pathParts = normalizedPath.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pPart = patternParts[i];
    const actualPart = pathParts[i];

    if (!pPart || !actualPart) {
      return null;
    }

    if (pPart.startsWith(':')) {
      params[pPart.slice(1)] = decodeURIComponent(actualPart);
    } else if (pPart !== actualPart) {
      return null;
    }
  }

  return params;
}

/**
 * Kiểm tra tính hợp lệ của đường dẫn ứng dụng:
 * Chấp nhận root ('/') hoặc các dynamic routes của 11 nodes (từ FEATURES_REGISTRY).
 */
export function isValidRoute(path: string): boolean {
  const normalized = path.split('?')[0]?.replace(/\/+$/, '') || '/';
  if (normalized === '/') {
    return true;
  }
  return FEATURES_REGISTRY.some((f) => f.routePath === normalized);
}

/**
 * Phân tích đường dẫn ứng dụng, trích xuất parameters và đối chiếu với FEATURES_REGISTRY.
 */
export function parseRoute(path: string): ParsedRoute {
  const normalized = path.split('?')[0]?.replace(/\/+$/, '') || '/';
  if (normalized === '/') {
    return { path: normalized, params: {}, isValid: true };
  }

  // Khớp chính xác với routePath trong registry trước
  const directFeature = getFeatureByRoute(normalized);
  if (directFeature) {
    const params = matchRoute('/feature/:id', normalized) ?? {};
    return {
      path: normalized,
      params,
      isValid: true,
      feature: directFeature,
    };
  }

  // Thử khớp theo dynamic pattern /feature/:id
  const params = matchRoute('/feature/:id', normalized);
  if (params?.id) {
    const feature = getFeatureById(params.id);
    if (feature) {
      return {
        path: normalized,
        params,
        isValid: true,
        feature,
      };
    }
  }

  return {
    path: normalized,
    params: params ?? {},
    isValid: false,
  };
}

// Module-level reactive signals for lightweight zero-dependency routing
export const currentPathSignal = signal<string>('/');
export const historySignal = signal<string[]>([]);
export const paramsSignal = signal<Record<string, string>>({});

export function navigate(path: string): void {
  if (path === currentPathSignal.value) {
    return;
  }
  const parsed = parseRoute(path);
  paramsSignal.value = parsed.params;
  historySignal.value = [...historySignal.value, currentPathSignal.value];
  currentPathSignal.value = path;
}

export function goBack(): void {
  if (historySignal.value.length === 0) {
    return;
  }
  const nextHistory = [...historySignal.value];
  const previous = nextHistory.pop();
  if (previous !== undefined) {
    historySignal.value = nextHistory;
    paramsSignal.value = parseRoute(previous).params;
    currentPathSignal.value = previous;
  }
}

export function resetRouter(initialPath = '/'): void {
  currentPathSignal.value = initialPath;
  historySignal.value = [];
  paramsSignal.value = parseRoute(initialPath).params;
}

export const RouterContext = createContext<IRouterContext>({
  currentPath: '/',
  params: {},
  canGoBack: false,
  navigate,
  goBack,
  reset: resetRouter,
  isValidRoute,
  parseRoute,
});

export function useRouter(): IRouterContext {
  return useContext(RouterContext);
}

export function RouterProvider({ initialPath = '/', children }: RouterProviderProps) {
  // Sync initialPath if history is empty
  if (historySignal.value.length === 0) {
    currentPathSignal.value = initialPath;
    paramsSignal.value = parseRoute(initialPath).params;
  }

  const contextValue: IRouterContext = {
    get currentPath() {
      return currentPathSignal.value;
    },
    get params() {
      return paramsSignal.value;
    },
    get canGoBack() {
      return historySignal.value.length > 0;
    },
    navigate,
    goBack,
    reset: resetRouter,
    isValidRoute,
    parseRoute,
  };

  return h(RouterContext.Provider, { value: contextValue }, children);
}
