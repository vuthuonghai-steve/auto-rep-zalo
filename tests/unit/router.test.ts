import { GlobalWindow } from 'happy-dom';

// DOM polyfill for non-browser runners (e.g. native bun test)
if (typeof document === 'undefined') {
  const window = new GlobalWindow();
  for (const key of Object.getOwnPropertyNames(window)) {
    if (!(key in globalThis)) {
      try {
        // @ts-expect-error polyfill global for bun test
        globalThis[key] = window[key];
      } catch {}
    }
  }
}

import {
  RouterProvider,
  currentPathSignal,
  goBack,
  historySignal,
  isValidRoute,
  matchRoute,
  navigate,
  paramsSignal,
  parseRoute,
  resetRouter,
  useRouter,
} from '@/configs/router.config';
import { h, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Reactive In-Memory Router (T004)', () => {
  beforeEach(() => {
    resetRouter('/');
  });

  afterEach(() => {
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

  describe('Dynamic Route Validation & Parsing (isValidRoute, parseRoute)', () => {
    it('should validate root and all 11 nodes routes', () => {
      expect(isValidRoute('/')).toBe(true);
      expect(isValidRoute('/feature/core-settings')).toBe(true);
      expect(isValidRoute('/feature/n01-sidebar-observer')).toBe(true);
      expect(isValidRoute('/feature/n10-committer-drain')).toBe(true);
      expect(isValidRoute('/invalid')).toBe(false);
      expect(isValidRoute('/feature/unknown')).toBe(false);
    });

    it('should parse route and return valid metadata', () => {
      const rootParsed = parseRoute('/');
      expect(rootParsed.isValid).toBe(true);
      expect(rootParsed.params).toEqual({});

      const nodeParsed = parseRoute('/feature/n01-sidebar-observer');
      expect(nodeParsed.isValid).toBe(true);
      expect(nodeParsed.params).toEqual({ id: 'n01-sidebar-observer' });
      expect(nodeParsed.feature?.id).toBe('n01-sidebar-observer');

      const invalidParsed = parseRoute('/feature/non-existent-node');
      expect(invalidParsed.isValid).toBe(false);
    });

    it('should update paramsSignal on navigation', () => {
      navigate('/feature/n02-queue-manager');
      expect(paramsSignal.value).toEqual({ id: 'n02-queue-manager' });

      navigate('/');
      expect(paramsSignal.value).toEqual({});
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

      render(null, container);
      container.remove();
    });
  });
});
