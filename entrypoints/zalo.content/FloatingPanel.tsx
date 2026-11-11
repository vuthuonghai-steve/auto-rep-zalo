import { logger } from '@/utils/logger';
import { circuitBreaker } from '@/utils/pacing-guard';
import { signal } from '@preact/signals';

export type PanelWorkerStatus = 'IDLE' | 'PROCESSING' | 'STOPPED' | 'PAUSED_BY_CAPTCHA';

export const workerStatus = signal<PanelWorkerStatus>('IDLE');
export const queueCount = signal<number>(0);
export const isExpanded = signal<boolean>(false);
export const lastHeartbeat = signal<number>(Date.now());

export function FloatingPanel() {
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

  return (
    <div
      id="zalo-floating-panel-root"
      class="fixed top-4 right-4 z-[999999] font-sans text-xs select-none shadow-2xl rounded-xl border border-gray-200/80 bg-white/95 backdrop-blur-md transition-all overflow-hidden"
      style={{ width: isExpanded.value ? '280px' : '220px' }}
    >
      {/* Header bar */}
      <div class="flex items-center justify-between px-3 py-2 bg-gray-50/90 border-b border-gray-100">
        <div class="flex items-center gap-1.5 font-semibold text-gray-800">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          <span>Zalo Auto 24/7</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            id="btn-panel-toggle"
            onClick={() => {
              isExpanded.value = !isExpanded.value;
            }}
            class="text-gray-500 hover:text-gray-700 px-1 font-mono text-[10px]"
            title="Mở rộng / Thu gọn"
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
