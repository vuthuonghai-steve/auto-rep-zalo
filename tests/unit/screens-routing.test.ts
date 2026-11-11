import { resetRouter } from '@/configs/router.config';
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

    it('should render FeatureDetailScreen with placeholder for /feature/message-collector', () => {
      render(h(AppRoot, { initialPath: '/feature/message-collector' }), container);

      expect(container.textContent).toContain('Bộ Thu Thập Tin Nhắn Nguồn (Node 1 - Node 3)');
      expect(container.textContent).toContain('Slot tích hợp cho observer sidebar');
    });

    it('should render NotFoundScreen when route is not recognized', () => {
      render(h(AppRoot, { initialPath: '/invalid/non-existent' }), container);

      expect(container.textContent).toContain('404');
      expect(container.textContent).toContain('Không tìm thấy trang');
    });
  });
});
