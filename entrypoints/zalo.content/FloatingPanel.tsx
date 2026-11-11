import { logger } from '@/utils/logger';
import { circuitBreaker } from '@/utils/pacing-guard';
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { clampPosition, loadPanelState, savePanelState } from './panel-storage';

export type PanelWorkerStatus = 'IDLE' | 'PROCESSING' | 'STOPPED' | 'PAUSED_BY_CAPTCHA';

export const workerStatus = signal<PanelWorkerStatus>('IDLE');
export const queueCount = signal<number>(0);
export const isExpanded = signal<boolean>(false);
export const lastHeartbeat = signal<number>(Date.now());

export function FloatingPanel() {
  const panelRef = useRef<HTMLDivElement>(null);

  // Khởi tạo tọa độ và trạng thái thu nhỏ từ localStorage (nếu có)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = loadPanelState();
    if (saved) {
      return { x: saved.x, y: saved.y };
    }
    // Mặc định góc trên bên phải (cách mép 16px)
    const initWidth = 240;
    const defaultX =
      typeof window !== 'undefined' ? Math.max(16, window.innerWidth - initWidth - 16) : 16;
    return { x: defaultX, y: 16 };
  });

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = loadPanelState();
    return saved ? saved.isCollapsed : false;
  });

  // Lưu trạng thái bền vững khi position hoặc isCollapsed thay đổi
  useEffect(() => {
    savePanelState({
      x: position.x,
      y: position.y,
      isCollapsed,
    });
  }, [position, isCollapsed]);

  // Đảm bảo panel luôn nằm trong viewport khi resize cửa sổ
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const width = panelRef.current?.offsetWidth || 240;
        const height = panelRef.current?.offsetHeight || 160;
        return clampPosition(prev.x, prev.y, width, height);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Xử lý kéo thả bằng Native Pointer Events
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  });

  const onPointerDown = (e: PointerEvent) => {
    // Chỉ kích hoạt khi click chuột trái hoặc chạm ngón tay
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Không kích hoạt kéo thả nếu người dùng bấm vào các nút điều khiển
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') || target?.closest('a') || target?.closest('input')) {
      return;
    }

    const currentTarget = e.currentTarget as HTMLElement;
    currentTarget.setPointerCapture?.(e.pointerId);

    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      hasMoved: false,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragRef.current.isDragging) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      dragRef.current.hasMoved = true;
    }

    const nextX = dragRef.current.initialX + deltaX;
    const nextY = dragRef.current.initialY + deltaY;

    const width = panelRef.current?.offsetWidth || 240;
    const height = panelRef.current?.offsetHeight || 160;
    const clamped = clampPosition(nextX, nextY, width, height);

    setPosition(clamped);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    const currentTarget = e.currentTarget as HTMLElement;
    if (currentTarget.hasPointerCapture?.(e.pointerId)) {
      currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  const handleEmergencyStop = () => {
    circuitBreaker.emergencyStop('Emergency Stop button clicked on Floating Panel');
    workerStatus.value = 'STOPPED';
    logger.warn('EMERGENCY_STOP', 'N00', 'Emergency Stop activated by operator on Floating Panel');
  };

  const handleResume = () => {
    circuitBreaker.resume();
    workerStatus.value = 'IDLE';
    logger.info('CIRCUIT_BREAKER', 'N00', 'Operator resumed automation from Floating Panel');
  };

  const handleOpenOptions = () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        if (chrome.tabs?.create) {
          chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        } else if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      }
    } catch {
      // Bỏ qua lỗi trong môi trường test
    }
  };

  const getStatusColor = () => {
    switch (workerStatus.value) {
      case 'IDLE':
        return 'bg-emerald-500 text-white';
      case 'PROCESSING':
        return 'bg-blue-600 text-white animate-pulse';
      case 'PAUSED_BY_CAPTCHA':
        return 'bg-amber-500 text-white animate-bounce';
      case 'STOPPED':
        return 'bg-red-600 text-white';
    }
  };

  const getStatusDotColor = () => {
    switch (workerStatus.value) {
      case 'IDLE':
        return 'bg-emerald-500';
      case 'PROCESSING':
        return 'bg-blue-600 animate-pulse';
      case 'PAUSED_BY_CAPTCHA':
        return 'bg-amber-500 animate-bounce';
      case 'STOPPED':
        return 'bg-red-600';
    }
  };

  // Render dạng Mini Bubble/Pill khi isCollapsed = true
  if (isCollapsed) {
    return (
      <div
        id="zalo-floating-panel-root"
        ref={panelRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        class="fixed z-[999999] font-sans text-xs select-none shadow-xl rounded-full border border-gray-200/90 bg-white/95 backdrop-blur-md cursor-grab active:cursor-grabbing hover:shadow-2xl transition-shadow flex items-center gap-2 px-3 py-1.5"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none',
        }}
      >
        <span class={`inline-block w-2.5 h-2.5 rounded-full ${getStatusDotColor()}`} />
        <span class="font-bold text-gray-800 text-[11px] tracking-tight">Zalo Auto</span>
        {queueCount.value > 0 && (
          <span class="bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
            {queueCount.value}
          </span>
        )}
        <button
          type="button"
          id="btn-panel-toggle"
          onClick={() => {
            if (!dragRef.current.hasMoved) {
              setIsCollapsed(false);
            }
          }}
          class="text-gray-400 hover:text-gray-700 pl-1 pr-0.5 font-mono text-[11px] focus:outline-none"
          title="Mở rộng bảng điều khiển"
        >
          {'\u25B6'}
        </button>
      </div>
    );
  }

  return (
    <div
      id="zalo-floating-panel-root"
      ref={panelRef}
      class="fixed z-[999999] font-sans text-xs select-none shadow-2xl rounded-xl border border-gray-200/80 bg-white/95 backdrop-blur-md overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isExpanded.value ? '280px' : '220px',
      }}
    >
      {/* Header bar - Khu vực kéo thả */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        class="flex items-center justify-between px-3 py-2 bg-gray-50/90 border-b border-gray-100 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <div class="flex items-center gap-1.5 font-semibold text-gray-800 pointer-events-none">
          <span class={`inline-block w-2 h-2 rounded-full ${getStatusDotColor()}`} />
          <span>Zalo Auto 24/7</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            id="btn-panel-toggle"
            onClick={() => {
              setIsCollapsed(true);
            }}
            class="text-gray-400 hover:text-gray-700 px-1 font-mono text-[10px] focus:outline-none"
            title="Thu nhỏ thành Mini Bubble"
          >
            {'\u2014'}
          </button>
          <button
            type="button"
            id="btn-panel-expand"
            onClick={() => {
              isExpanded.value = !isExpanded.value;
            }}
            class="text-gray-500 hover:text-gray-700 px-1 font-mono text-[10px] focus:outline-none"
            title="Mở rộng / Thu gọn chi tiết"
          >
            {isExpanded.value ? '\u25B2' : '\u25BC'}
          </button>
        </div>
      </div>

      {/* Main status strip */}
      <div class="p-3 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-gray-500">Trạng thái:</span>
          <span
            id="panel-worker-status"
            class={`px-2 py-0.5 rounded-full font-bold text-[11px] tracking-wide ${getStatusColor()}`}
          >
            {workerStatus.value}
          </span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-gray-500">Hàng chờ (Queue):</span>
          <span id="panel-queue-count" class="font-bold text-gray-800">
            {queueCount.value} nhóm
          </span>
        </div>

        {/* Action buttons */}
        <div class="pt-1 flex gap-2">
          {workerStatus.value === 'STOPPED' || workerStatus.value === 'PAUSED_BY_CAPTCHA' ? (
            <button
              type="button"
              id="btn-panel-resume"
              onClick={handleResume}
              class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm text-center"
            >
              Tiếp Tục
            </button>
          ) : (
            <button
              type="button"
              id="btn-emergency-stop"
              onClick={handleEmergencyStop}
              class="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm text-center active:scale-95 transition-transform"
            >
              Emergency Stop
            </button>
          )}

          <button
            type="button"
            id="btn-open-options"
            onClick={handleOpenOptions}
            class="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
            title="Mở cấu hình Whitelist & Giá"
          >
            {'\u2699'}
          </button>
        </div>

        {/* Expanded details */}
        {isExpanded.value && (
          <div class="pt-2 border-t border-gray-100 text-[10px] text-gray-500 space-y-1">
            <div class="flex justify-between">
              <span>Heartbeat:</span>
              <span>{new Date(lastHeartbeat.value).toLocaleTimeString()}</span>
            </div>
            <div class="flex justify-between">
              <span>CircuitBreaker:</span>
              <span class="font-mono">{circuitBreaker.getState()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
