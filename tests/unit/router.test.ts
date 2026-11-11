import {
  RouterProvider,
  currentPathSignal,
  goBack,
  historySignal,
  matchRoute,
  navigate,
  resetRouter,
  useRouter,
} from '@/configs/router.config';
import { h, render } from 'preact';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Reactive In-Memory Router (T004)', () => {
  beforeEach(() => {
    resetRouter('/');
  });

  describe('Core Navigation & History Signals', () => {
    it('should default to initial path / with empty history', () => {
      expect(currentPathSignal.value).toBe('/');
      expect(historySignal.value).toEqual([]);
    });

    it('should update currentPath and push previous path to history on navigate', () => {
      navigate('/feature/core-settings');
      expect(currentPathSignal.value).toBe('/feature/core-settings');
      expect(historySignal.value).toEqual(['/']);

      navigate('/feature/message-collector');
      expect(currentPathSignal.value).toBe('/feature/message-collector');
      expect(historySignal.value).toEqual(['/', '/feature/core-settings']);
    });

    it('should ignore duplicate navigate to same path', () => {
      navigate('/feature/core-settings');
      expect(historySignal.value).toEqual(['/']);

      navigate('/feature/core-settings');
      expect(historySignal.value).toEqual(['/']);
    });

    it('should revert to previous path and pop history on goBack', () => {
      navigate('/feature/core-settings');
      navigate('/feature/message-collector');

      goBack();
      expect(currentPathSignal.value).toBe('/feature/core-settings');
      expect(historySignal.value).toEqual(['/']);

      goBack();
      expect(currentPathSignal.value).toBe('/');
      expect(historySignal.value).toEqual([]);

      // Calling goBack when history is empty should be a safe no-op
      goBack();
      expect(currentPathSignal.value).toBe('/');
      expect(historySignal.value).toEqual([]);
    });

    it('should reset current path and clear history on resetRouter', () => {
      navigate('/feature/core-settings');
      navigate('/feature/message-collector');

      resetRouter('/custom-initial');
      expect(currentPathSignal.value).toBe('/custom-initial');
      expect(historySignal.value).toEqual([]);
    });
  });

  describe('Dynamic Route Matching (matchRoute)', () => {
    it('should match exact static paths', () => {
      expect(matchRoute('/', '/')).toEqual({});
      expect(matchRoute('/features', '/features')).toEqual({});
      expect(matchRoute('/features', '/other')).toBeNull();
    });

    it('should extract single dynamic parameter (:id)', () => {
      const result = matchRoute('/feature/:id', '/feature/core-settings');
      expect(result).toEqual({ id: 'core-settings' });
    });

    it('should extract multiple dynamic parameters', () => {
      const result = matchRoute('/org/:orgId/repo/:repoId', '/org/zalo-corp/repo/automation');
      expect(result).toEqual({
        orgId: 'zalo-corp',
        repoId: 'automation',
      });
    });

    it('should return null when segment length differs', () => {
      expect(matchRoute('/feature/:id', '/feature/core-settings/details')).toBeNull();
      expect(matchRoute('/feature/:id/details', '/feature/core-settings')).toBeNull();
    });

    it('should return null when static segments do not match', () => {
      expect(matchRoute('/feature/:id', '/settings/core-settings')).toBeNull();
    });
  });

  describe('RouterProvider & useRouter Hook', () => {
    it('should render children and provide router context values', () => {
      let contextSnapshot: ReturnType<typeof useRouter> | undefined;

      function TestConsumer() {
        const router = useRouter();
        contextSnapshot = router;
        return h('div', { id: 'test-output' }, router.currentPath);
      }

      const container = document.createElement('div');
      render(h(RouterProvider, { initialPath: '/feature/test' }, h(TestConsumer, null)), container);

      expect(container.textContent).toBe('/feature/test');
      expect(contextSnapshot).toBeDefined();
      if (contextSnapshot === undefined) {
        throw new Error('contextSnapshot must be defined');
      }
      const snapshot = contextSnapshot;

      expect(snapshot.currentPath).toBe('/feature/test');
      expect(snapshot.canGoBack).toBe(false);

      snapshot.navigate('/feature/next');
      expect(snapshot.currentPath).toBe('/feature/next');
      expect(snapshot.canGoBack).toBe(true);

      snapshot.goBack();
      expect(snapshot.currentPath).toBe('/feature/test');
      expect(snapshot.canGoBack).toBe(false);
    });
  });
});
