import { GlobalWindow } from 'happy-dom';

// DOM polyfill for happy-dom runner
if (typeof document === 'undefined') {
  const window = new GlobalWindow();
  for (const key of Object.getOwnPropertyNames(window)) {
    if (!(key in globalThis)) {
      try {
        // @ts-expect-error polyfill global
        globalThis[key] = window[key];
      } catch {}
    }
  }
}

import { getAllFeatures } from '@/configs/features.config';
import { RouterProvider, resetRouter } from '@/configs/router.config';
import { FeatureDetailScreen } from '@/screens/features/FeatureDetailScreen';
import {
  N01SidebarObserverView,
  N02QueueManagerView,
  N03ChatSwitcherView,
  N04DeltaStitcherView,
  N05BundleAggregatorView,
  N06DedupGateView,
  N07PriceRouterView,
  N08ForwardAutomatorView,
  N09TextInjectorView,
  N10CommitterDrainView,
} from '@/screens/features/nodes';
import {
  DefaultFallbackView,
  FEATURE_COMPONENTS_MAP,
  getFeatureDetailComponent,
} from '@/screens/features/registry';
import { h, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Phase 3: 10 Dedicated Feature Node Detail Views & Component Registry', () => {
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

  describe('Task 3.1 & 3.2: Component Registry 100% Coverage', () => {
    const allFeatures = getAllFeatures();

    it('should have exactly 11 features registered in system', () => {
      expect(allFeatures.length).toBe(11);
    });

    it('should resolve a dedicated, non-fallback component for every feature in registry', () => {
      for (const feature of allFeatures) {
        const comp = getFeatureDetailComponent(feature.detailComponentKey);
        expect(comp).toBeDefined();
        expect(comp).not.toBe(DefaultFallbackView);
        expect(FEATURE_COMPONENTS_MAP[feature.detailComponentKey]).toBe(comp);
      }
    });

    it('should maintain backward compatibility for deprecated placeholder keys', () => {
      const collectorComp = getFeatureDetailComponent('placeholder-collector');
      expect(collectorComp).toBeDefined();
      expect(collectorComp).not.toBe(DefaultFallbackView);

      const forwarderComp = getFeatureDetailComponent('placeholder-forwarder');
      expect(forwarderComp).toBeDefined();
      expect(forwarderComp).not.toBe(DefaultFallbackView);
    });
  });

  describe('Task 3.3: Individual Node Views Rendering Without Exceptions', () => {
    it('N01SidebarObserverView should render debounce and selector inputs', () => {
      render(h(N01SidebarObserverView, {}), container);
      expect(container.textContent).toContain('Nghiệp Vụ Quan Sát Danh Sách Hội Thoại Zalo');
      expect(container.textContent).toContain('Thời gian Debounce');
      expect(container.textContent).toContain('CSS Selector Giám Sát Sidebar');
      expect(container.textContent).toContain('Quét Chủ Động Dự Phòng');

      const input = container.querySelector('#n01-debounce') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('300');
    });

    it('N02QueueManagerView should render max queue size and mutex lock status', () => {
      render(h(N02QueueManagerView, {}), container);
      expect(container.textContent).toContain('Nghiệp Vụ Hàng Chờ Điều Phối Tuần Tự');
      expect(container.textContent).toContain('Trạng Thái Mutex Lock & Hàng Chờ');
      expect(container.textContent).toContain('Single Mutex (Concurrency: 1)');
      expect(container.textContent).toContain('Dung Lượng Tối Đa Của Hàng Chờ');

      const input = container.querySelector('#n02-max-queue') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('100');
    });

    it('N03ChatSwitcherView should render human jitter range and bottom anchor', () => {
      render(h(N03ChatSwitcherView, {}), container);
      expect(container.textContent).toContain('Nghiệp Vụ Chuyển Đổi Hội Thoại An Toàn');
      expect(container.textContent).toContain('Khoảng Độ Trễ Ngẫu Nhiên Human Jitter');
      expect(container.textContent).toContain('.new-messages-container');

      const minJitter = container.querySelector('#n03-min-jitter') as HTMLInputElement;
      const maxJitter = container.querySelector('#n03-max-jitter') as HTMLInputElement;
      expect(minJitter.value).toBe('1000');
      expect(maxJitter.value).toBe('2000');
    });

    it('N04DeltaStitcherView should render delta scan options and ignore 99+ badge', () => {
      render(h(N04DeltaStitcherView, {}), container);
      expect(container.textContent).toContain('Nghiệp Vụ Ghép Nối Tin Mới Ngược Từ Đáy');
      expect(container.textContent).toContain('Số Lượng Tin Đáy Quét Mỗi Lần');
      expect(container.textContent).toContain('99+ Tin Chưa Đọc');

      const deltaInput = container.querySelector('#n04-max-messages') as HTMLInputElement;
      expect(deltaInput.value).toBe('10');
    });

    it('N05BundleAggregatorView should render sliding window and debounce timers', () => {
      render(h(N05BundleAggregatorView, {}), container);
      expect(container.textContent).toContain('Nghiệp Vụ Gom Cụm Tin Nhắn & Media');
      expect(container.textContent).toContain('Thời Gian Cửa Sổ Trượt');
      expect(container.textContent).toContain('Thời Gian Tĩnh Lặng Chờ Tin Kế Tiếp');
      expect(container.textContent).toContain('Số Lượng Media Tối Đa Trong 1 Bundle');

      const windowInput = container.querySelector('#n05-window-sec') as HTMLInputElement;
      expect(windowInput.value).toBe('15');
    });

    it('N06DedupGateView should render 30-day TTL, phone dedup, and SHA-256 hash dedup', () => {
      render(h(N06DedupGateView, {}), container);
      expect(container.textContent).toContain('Nghiệp Vụ Cổng Lọc Trùng 2 Lớp 30 Ngày');
      expect(container.textContent).toContain('Thời Gian Lưu Vết Trừ Trùng');
      expect(container.textContent).toContain('Lớp 1: Lọc Trùng Theo Số Điện Thoại');
      expect(container.textContent).toContain('Lớp 2: Lọc Trùng Theo Mã Băm SHA-256');

      const ttlInput = container.querySelector('#n06-ttl-days') as HTMLInputElement;
      expect(ttlInput.value).toBe('30');
    });

    it('N07PriceRouterView should render price rules and enforce max target groups <= 2', () => {
      render(h(N07PriceRouterView, {}), container);
      expect(container.textContent).toContain('Nghiệp Vụ Bóc Tách Giá & Định Tuyến Nhóm Đích');
      expect(container.textContent).toContain('Số Lượng Nhóm Đích Tối Đa');
      expect(container.textContent).toContain('Bắt buộc ≤ 2 nhóm');
      expect(container.textContent).toContain('Ma Trận Quy Tắc Định Tuyến Phân Khúc Giá');

      const targetInput = container.querySelector('#n07-max-targets') as HTMLInputElement;
      expect(targetInput.value).toBe('2');
      expect(targetInput.max).toBe('2');
    });

    it('N08ForwardAutomatorView MUST display amber safe mode warning banner', () => {
      render(h(N08ForwardAutomatorView, {}), container);
      expect(container.textContent).toContain(
        'Chế độ Kiểm Thử An Toàn: Mặc định TẮT để chống spam nhóm Zalo thật. Khi bật, tiện ích sẽ tương tác trực tiếp lên DOM Zalo Web.',
      );
      expect(container.textContent).toContain('Nghiệp Vụ Chuyển Tiếp Media Pha 1');
      expect(container.textContent).toContain('Thời Gian Chờ Mở Modal');
      expect(container.textContent).toContain('Thời Gian Bắt Toast Thành Công');

      const warningEl = container.querySelector('[data-testid="safe-mode-warning-n08"]');
      expect(warningEl).not.toBeNull();
      expect(warningEl?.textContent).toContain('Safe Dry-Run Mode');
    });

    it('N09TextInjectorView MUST display amber safe mode warning banner and .lockSendMessageBox check', () => {
      render(h(N09TextInjectorView, {}), container);
      expect(container.textContent).toContain(
        'Chế độ Kiểm Thử An Toàn: Mặc định TẮT để chống spam nhóm Zalo thật. Khi bật, tiện ích sẽ tương tác trực tiếp lên DOM Zalo Web.',
      );
      expect(container.textContent).toContain('Nghiệp Vụ Tiêm Nội Dung Văn Bản Pha 2');
      expect(container.textContent).toContain('Khoảng Micro-Jitter Gõ Phím');
      expect(container.textContent).toContain('.lockSendMessageBox');
      expect(container.textContent).toContain('Tự Động Quay Lại Nhóm Nguồn');

      const warningEl = container.querySelector('[data-testid="safe-mode-warning-n09"]');
      expect(warningEl).not.toBeNull();
      expect(warningEl?.textContent).toContain('Safe Dry-Run Mode');

      const minJitter = container.querySelector('#n09-min-jitter') as HTMLInputElement;
      const maxJitter = container.querySelector('#n09-max-jitter') as HTMLInputElement;
      expect(minJitter.value).toBe('30');
      expect(maxJitter.value).toBe('80');
    });

    it('N10CommitterDrainView should render 10s quiescence delay and checkpoint Dexie persistence', () => {
      render(h(N10CommitterDrainView, {}), container);
      expect(container.textContent).toContain('Nghiệp Vụ Lưu Vết & Giải Phóng Hàng Chờ');
      expect(container.textContent).toContain('Khoảng Đệm Tĩnh Lặng');
      expect(container.textContent).toContain('Lưu Checkpoint Bền Vững Vào IndexedDB');
      expect(container.textContent).toContain('Giải Phóng Tác Vụ Khỏi Hàng Chờ');

      const quiescenceInput = container.querySelector('#n10-quiescence-sec') as HTMLInputElement;
      expect(quiescenceInput.value).toBe('10');
    });
  });

  describe('Task 3.4: FeatureDetailScreen Full Integration', () => {
    it('should render header with [N01] nodeCode, OBSERVATION layer badge, and N01 view', () => {
      render(
        h(
          RouterProvider,
          { initialPath: '/feature/n01-sidebar-observer' },
          h(FeatureDetailScreen, {}),
        ),
        container,
      );

      expect(container.textContent).toContain('← Quay lại');
      expect(container.textContent).toContain('[N01]');
      expect(container.textContent).toContain('OBSERVATION');
      expect(container.textContent).toContain('Bộ Lắng Nghe Sidebar (Sidebar Observer)');
      expect(container.textContent).toContain('Nghiệp Vụ Quan Sát Danh Sách Hội Thoại Zalo');
    });

    it('should render header with [N08] nodeCode, EXECUTION layer badge, and N08 view with warning banner', () => {
      render(
        h(
          RouterProvider,
          { initialPath: '/feature/n08-forward-automator' },
          h(FeatureDetailScreen, {}),
        ),
        container,
      );

      expect(container.textContent).toContain('← Quay lại');
      expect(container.textContent).toContain('[N08]');
      expect(container.textContent).toContain('EXECUTION');
      expect(container.textContent).toContain('Bộ Chuyển Tiếp Media (Forward Automator)');
      expect(container.textContent).toContain(
        'Chế độ Kiểm Thử An Toàn: Mặc định TẮT để chống spam nhóm Zalo thật. Khi bật, tiện ích sẽ tương tác trực tiếp lên DOM Zalo Web.',
      );
    });

    it('should render header with [N09] nodeCode, EXECUTION layer badge, and N09 view with warning banner', () => {
      render(
        h(
          RouterProvider,
          { initialPath: '/feature/n09-text-injector' },
          h(FeatureDetailScreen, {}),
        ),
        container,
      );

      expect(container.textContent).toContain('← Quay lại');
      expect(container.textContent).toContain('[N09]');
      expect(container.textContent).toContain('EXECUTION');
      expect(container.textContent).toContain('Bộ Tiêm Nội Dung Văn Bản (Text Injector)');
      expect(container.textContent).toContain(
        'Chế độ Kiểm Thử An Toàn: Mặc định TẮT để chống spam nhóm Zalo thật. Khi bật, tiện ích sẽ tương tác trực tiếp lên DOM Zalo Web.',
      );
    });
  });
});
