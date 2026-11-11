import { signal } from '@preact/signals';
import { type ComponentChildren, createContext, h } from 'preact';
import { useContext } from 'preact/hooks';

export interface RouteState {
  currentPath: string;
  params: Record<string, string>;
  history: string[];
}

export interface IRouterContext {
  currentPath: string;
  params: Record<string, string>;
  canGoBack: boolean;
  navigate: (path: string) => void;
  goBack: () => void;
  reset: (initialPath?: string) => void;
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

// Module-level reactive signals for lightweight zero-dependency routing
export const currentPathSignal = signal<string>('/');
export const historySignal = signal<string[]>([]);
export const paramsSignal = signal<Record<string, string>>({});

export function navigate(path: string): void {
  if (path === currentPathSignal.value) {
    return;
  }
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
    currentPathSignal.value = previous;
  }
}

export function resetRouter(initialPath = '/'): void {
  currentPathSignal.value = initialPath;
  historySignal.value = [];
  paramsSignal.value = {};
}

export const RouterContext = createContext<IRouterContext>({
  currentPath: '/',
  params: {},
  canGoBack: false,
  navigate,
  goBack,
  reset: resetRouter,
});

export function useRouter(): IRouterContext {
  return useContext(RouterContext);
}

export function RouterProvider({ initialPath = '/', children }: RouterProviderProps) {
  // Sync initialPath if not initialized yet or if path is root
  if (historySignal.value.length === 0 && currentPathSignal.value === '/') {
    currentPathSignal.value = initialPath;
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
  };

  return h(RouterContext.Provider, { value: contextValue }, children);
}
