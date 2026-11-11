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

import { isValidRoute, parseRoute, resetRouter } from '@/configs/router.config';
import { AppRoot } from '@/screens/AppRoot';
import { NotFoundScreen } from '@/screens/common/NotFoundScreen';
import { DefaultFallbackView, getFeatureDetailComponent } from '@/screens/features/registry';
import { h, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Screens & Router Integration (T005, T006, T014, T015)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    resetRouter('/');
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    resetRouter('/');
  });

  describe('T005: NotFoundScreen Component', () => {
    it('should display friendly 404 message and home button', () => {
      render(h(NotFoundScreen, { attemptedPath: '/unknown/path' }), container);

      expect(container.textContent).toContain('404');
      expect(container.textContent).toContain('Không tìm thấy trang');
      expect(container.textContent).toContain('/unknown/path');

      const homeBtn = container.querySelector<HTMLButtonElement>('button');
      expect(homeBtn).not.toBeNull();
    });
  });

  describe('T014: Component Registry', () => {
    it('should resolve defined components for valid keys', () => {
      const coreSettingsComp = getFeatureDetailComponent('core-settings');
      expect(coreSettingsComp).toBeDefined();

      const collectorComp = getFeatureDetailComponent('placeholder-collector');
      expect(collectorComp).toBeDefined();

      const forwarderComp = getFeatureDetailComponent('placeholder-forwarder');
      expect(forwarderComp).toBeDefined();
    });

    it('should return DefaultFallbackView for unknown component keys', () => {
      const fallbackComp = getFeatureDetailComponent('non-existent-key');
      expect(fallbackComp).toBe(DefaultFallbackView);

      render(h(fallbackComp, {}), container);
      expect(container.textContent).toContain('Giao diện chi tiết đang được cập nhật');
    });
  });

  describe('T006 & T015: AppRoot View Switching', () => {
    it('should render MasterMenuScreen when initialPath is /', () => {
      render(h(AppRoot, { initialPath: '/' }), container);

      expect(container.textContent).toContain('Trung Tâm Quản Trị Tính Năng');
      expect(container.textContent).toContain('Danh Sách Module Tính Năng');
      expect(container.textContent).toContain('Cấu hình Hệ Thống & Whitelist');
    });

    it('should render FeatureDetailScreen when navigating to /feature/core-settings', () => {
      render(h(AppRoot, { initialPath: '/feature/core-settings' }), container);

      expect(container.textContent).toContain('Cấu hình Hệ Thống & Whitelist');
      expect(container.textContent).toContain('Quản lý Whitelist Nhóm Nguồn');
      expect(container.textContent).toContain('Quay lại');
    });

    it('should render FeatureDetailScreen for node routes such as /feature/n01-sidebar-observer', () => {
      render(h(AppRoot, { initialPath: '/feature/n01-sidebar-observer' }), container);

      expect(container.textContent).toContain('Bộ Lắng Nghe Sidebar (Sidebar Observer)');
      expect(container.textContent).toContain(
        'Bắt tin mới qua MutationObserver trên danh sách hội thoại Zalo sidebar',
      );
      expect(container.textContent).toContain('Quay lại');
    });

    it('should render NotFoundScreen when route is not recognized or deprecated', () => {
      render(h(AppRoot, { initialPath: '/invalid/non-existent' }), container);

      expect(container.textContent).toContain('404');
      expect(container.textContent).toContain('Không tìm thấy trang');

      render(null, container);
      render(h(AppRoot, { initialPath: '/feature/message-collector' }), container);
      expect(container.textContent).toContain('404');
      expect(container.textContent).toContain('Không tìm thấy trang');
    });
  });

  describe('Dynamic Routing for All 11 Feature Nodes', () => {
    const ALL_11_ROUTES = [
      { path: '/feature/core-settings', name: 'Cấu hình Hệ Thống & Whitelist' },
      { path: '/feature/n01-sidebar-observer', name: 'Bộ Lắng Nghe Sidebar (Sidebar Observer)' },
      { path: '/feature/n02-queue-manager', name: 'Bộ Quản Lý Hàng Chờ (Queue Manager)' },
      { path: '/feature/n03-chat-switcher', name: 'Bộ Chuyển Hội Thoại (Chat Switcher)' },
      { path: '/feature/n04-delta-stitcher', name: 'Bộ Trích Xuất Tin Mới (Delta Stitcher)' },
      {
        path: '/feature/n05-bundle-aggregator',
        name: 'Bộ Gom Cụm Tin & Media (Bundle Aggregator)',
      },
      { path: '/feature/n06-dedup-gate', name: 'Cổng Lọc Trùng (Dedup Gate)' },
      { path: '/feature/n07-price-router', name: 'Bộ Định Tuyến & Lọc Giá (Price Router)' },
      {
        path: '/feature/n08-forward-automator',
        name: 'Bộ Chuyển Tiếp Media (Forward Automator)',
      },
      {
        path: '/feature/n09-text-injector',
        name: 'Bộ Tiêm Nội Dung Văn Bản (Text Injector)',
      },
      {
        path: '/feature/n10-committer-drain',
        name: 'Bộ Lưu Vết & Giải Phóng (Committer & Drain)',
      },
    ];

    for (const item of ALL_11_ROUTES) {
      it(`should correctly route and render ${item.path} without 404`, () => {
        resetRouter(item.path);
        render(null, container);
        render(h(AppRoot, { initialPath: item.path }), container);

        expect(container.textContent).not.toContain('404');
        expect(container.textContent).not.toContain('Không tìm thấy trang');
        expect(container.textContent).toContain(item.name);
        expect(container.textContent).toContain('Quay lại');
      });
    }

    it('should validate all 11 routes using isValidRoute and parseRoute helpers', () => {
      for (const item of ALL_11_ROUTES) {
        expect(isValidRoute(item.path)).toBe(true);
        const parsed = parseRoute(item.path);
        expect(parsed.isValid).toBe(true);
        expect(parsed.feature).toBeDefined();
        expect(parsed.feature?.routePath).toBe(item.path);
      }
      expect(isValidRoute('/')).toBe(true);
      expect(isValidRoute('/invalid/route')).toBe(false);
      expect(isValidRoute('/feature/message-collector')).toBe(false);
      expect(isValidRoute('/feature/message-forwarder')).toBe(false);

      const invalidParsed = parseRoute('/feature/message-collector');
      expect(invalidParsed.isValid).toBe(false);
    });
  });
});
