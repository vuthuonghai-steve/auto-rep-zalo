import { h, render } from 'preact';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  FloatingPanel,
  queueCount,
  workerStatus,
} from '../../entrypoints/zalo.content/FloatingPanel';
import {
  clampPosition,
  loadPanelState,
  savePanelState,
} from '../../entrypoints/zalo.content/panel-storage';

describe('FloatingPanel UX Features (Draggable, Collapsible & Storage Persistence)', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    Object.defineProperty(window, 'localStorage', {
      value: storageMock,
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = '';
    workerStatus.value = 'IDLE';
    queueCount.value = 0;
  });

  describe('clampPosition utility', () => {
    it('should clamp position within viewport boundaries with padding', () => {
      // Bị vượt mép trái và mép trên
      const clampedMin = clampPosition(-50, -20, 240, 160, 16, 1000, 800);
      expect(clampedMin.x).toBe(16);
      expect(clampedMin.y).toBe(16);

      // Bị vượt mép phải và mép dưới
      const clampedMax = clampPosition(950, 750, 240, 160, 16, 1000, 800);
      expect(clampedMax.x).toBe(1000 - 240 - 16); // 744
      expect(clampedMax.y).toBe(800 - 160 - 16); // 624

      // Tọa độ hợp lệ ở giữa
      const clampedMid = clampPosition(300, 400, 240, 160, 16, 1000, 800);
      expect(clampedMid.x).toBe(300);
      expect(clampedMid.y).toBe(400);
    });
  });

  describe('Storage persistence (loadPanelState & savePanelState)', () => {
    it('should correctly save and load panel state from localStorage', () => {
      expect(loadPanelState()).toBeNull();

      savePanelState({ x: 120, y: 250, isCollapsed: true });
      const loaded = loadPanelState();
      expect(loaded).toEqual({ x: 120, y: 250, isCollapsed: true });
    });

    it('should handle corrupted localStorage gracefully', () => {
      window.localStorage.setItem('zalo_floating_panel_state', 'invalid-json');
      expect(loadPanelState()).toBeNull();
    });
  });

  describe('FloatingPanel Collapsible & Toggle view', () => {
    it('should toggle between expanded panel and mini bubble view', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      render(h(FloatingPanel, null), container);

      // Ban đầu ở trạng thái mở rộng (full panel)
      let root = container.querySelector('#zalo-floating-panel-root');
      expect(root).not.toBeNull();
      expect(container.querySelector('#panel-worker-status')).not.toBeNull();
      expect(container.querySelector('#btn-emergency-stop')).not.toBeNull();

      // Click nút thu nhỏ
      const toggleBtn = container.querySelector('#btn-panel-toggle') as HTMLButtonElement;
      expect(toggleBtn).not.toBeNull();
      toggleBtn.click();
      await new Promise((r) => setTimeout(r, 20));

      // Đã chuyển sang dạng Mini Bubble
      root = container.querySelector('#zalo-floating-panel-root');
      expect(root).not.toBeNull();
      expect(container.querySelector('#panel-worker-status')).toBeNull(); // Không còn body đầy đủ
      expect(root?.textContent).toContain('Zalo Auto');

      // Click nút mở rộng lại trên Mini Bubble
      const expandBtn = container.querySelector('#btn-panel-toggle') as HTMLButtonElement;
      expect(expandBtn).not.toBeNull();
      expandBtn.click();
      await new Promise((r) => setTimeout(r, 20));

      // Quay lại dạng panel đầy đủ
      expect(container.querySelector('#panel-worker-status')).not.toBeNull();
      expect(container.querySelector('#btn-emergency-stop')).not.toBeNull();
    });

    it('should restore persisted collapsed state from localStorage on initial render', async () => {
      savePanelState({ x: 300, y: 150, isCollapsed: true });

      const container = document.createElement('div');
      document.body.appendChild(container);
      render(h(FloatingPanel, null), container);

      // Phải render trực tiếp dưới dạng mini bubble
      const root = container.querySelector('#zalo-floating-panel-root');
      expect(root).not.toBeNull();
      expect(container.querySelector('#panel-worker-status')).toBeNull();
      expect(root?.textContent).toContain('Zalo Auto');
    });
  });

  describe('FloatingPanel Native Pointer Dragging', () => {
    it('should update panel coordinates during pointer drag', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      render(h(FloatingPanel, null), container);

      const root = container.querySelector('#zalo-floating-panel-root') as HTMLDivElement;
      const header = root.firstElementChild as HTMLElement;

      // Pointer down tại (100, 100)
      const pointerDownEvt = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
        bubbles: true,
      });
      header.dispatchEvent(pointerDownEvt);

      // Pointer move tới (150, 180)
      const pointerMoveEvt = new PointerEvent('pointermove', {
        clientX: 150,
        clientY: 180,
        pointerId: 1,
        bubbles: true,
      });
      header.dispatchEvent(pointerMoveEvt);

      // Pointer up
      const pointerUpEvt = new PointerEvent('pointerup', {
        clientX: 150,
        clientY: 180,
        pointerId: 1,
        bubbles: true,
      });
      header.dispatchEvent(pointerUpEvt);

      await new Promise((r) => setTimeout(r, 20));

      // Trạng thái tọa độ đã được lưu vào localStorage
      const saved = loadPanelState();
      expect(saved).not.toBeNull();
      expect(typeof saved?.x).toBe('number');
      expect(typeof saved?.y).toBe('number');
    });
  });
});
