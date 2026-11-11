import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N02Config {
  maxQueueSize: number;
  mutexTimeoutSec: number;
  autoRecovery: boolean;
}

const DEFAULT_N02_CONFIG: N02Config = {
  maxQueueSize: 100,
  mutexTimeoutSec: 60,
  autoRecovery: true,
};

export function N02QueueManagerView() {
  const [config, setConfig] = useState<N02Config>(DEFAULT_N02_CONFIG);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n02').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N02_CONFIG, ...(item.value as Partial<N02Config>) });
      }
    });

    // Lấy số lượng hàng chờ hiện tại
    db.group_dispatch_queue.count().then((count) => setQueueCount(count));
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n02',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 02 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleClearQueue = async () => {
    await db.group_dispatch_queue.clear();
    setQueueCount(0);
    setSaveStatus('Đã dọn dẹp toàn bộ hàng chờ FIFO!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N02_CONFIG);
  };

  return (
    <div class="space-y-6">
      {saveStatus && (
        <div class="p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm font-medium">
          {saveStatus}
        </div>
      )}

      {/* Thông tin nghiệp vụ */}
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-800 space-y-1">
        <div class="font-semibold text-sm flex items-center gap-1.5">
          <span>🚦</span>
          <span>Nghiệp Vụ Hàng Chờ Điều Phối Tuần Tự (Single Mutex FIFO)</span>
        </div>
        <p>
          Node 02 đảm bảo tại một thời điểm chỉ có DUY NHẤT một nhóm chat nguồn được xử lý, loại trừ
          triệt để xung đột Race Condition khi chuyển tab nhóm và tương tác giao diện Zalo.
        </p>
      </div>

      {/* Giám sát trạng thái hàng chờ thực tế */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Trạng Thái Mutex Lock & Hàng Chờ
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
            <span class="text-xs text-gray-500 font-medium">Trạng Thái Khóa Mutex</span>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span class="text-sm font-bold text-gray-800">SẴN SÀNG (IDLE)</span>
            </div>
          </div>
          <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
            <span class="text-xs text-gray-500 font-medium">Số Tác Vụ Trong Hàng Chờ</span>
            <div class="text-xl font-bold text-gray-800">{queueCount}</div>
          </div>
          <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
            <span class="text-xs text-gray-500 font-medium">Cơ Chế Khóa</span>
            <div class="text-sm font-semibold text-indigo-700">Single Mutex (Concurrency: 1)</div>
          </div>
        </div>
        <div class="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleClearQueue}
            class="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 font-medium transition-colors"
          >
            Dọn Dẹp Hàng Chờ Dở Dang
          </button>
        </div>
      </section>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Cấu Hình Tham Số Hàng Chờ
        </h2>

        {/* maxQueueSize */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label
              htmlFor="n02-max-queue"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Dung Lượng Tối Đa Của Hàng Chờ (Max Queue Size)
            </label>
            <p class="text-xs text-gray-500">
              Giới hạn số lượng tác vụ hàng chờ FIFO chờ xử lý để chống tràn bộ nhớ (10 - 500).
            </p>
          </div>
          <input
            id="n02-max-queue"
            type="number"
            min={10}
            max={500}
            step={10}
            value={config.maxQueueSize}
            onInput={(e) =>
              setConfig({
                ...config,
                maxQueueSize: Number.parseInt((e.target as HTMLInputElement).value, 10) || 100,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Mutex Timeout */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <label
              htmlFor="n02-timeout"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Thời Gian Timeout Khóa Mutex (Giây)
            </label>
            <p class="text-xs text-gray-500">
              Tự động giải phóng khóa nếu tác vụ đang xử lý bị treo quá thời gian này (30 - 300s).
            </p>
          </div>
          <input
            id="n02-timeout"
            type="number"
            min={30}
            max={300}
            step={10}
            value={config.mutexTimeoutSec}
            onInput={(e) =>
              setConfig({
                ...config,
                mutexTimeoutSec: Number.parseInt((e.target as HTMLInputElement).value, 10) || 60,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Auto Recovery */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Tự Động Phục Hồi Khi Khởi Động Lại (Auto-Recovery)
            </span>
            <p class="text-xs text-gray-500">
              Quét các tác vụ trạng thái PROCESSING bị gián đoạn và trả về trạng thái PENDING khi
              extension khởi động.
            </p>
          </div>
          <ToggleSwitch
            id="n02-auto-recovery"
            checked={config.autoRecovery}
            onChange={(checked) => setConfig({ ...config, autoRecovery: checked })}
            label={config.autoRecovery ? 'Đang bật' : 'Đã tắt'}
          />
        </div>
      </section>

      {/* Thẻ Thao Tác */}
      <div class="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleReset}
          class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Khôi Phục Mặc Định
        </button>
        <button
          type="button"
          onClick={handleSave}
          class="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
        >
          Lưu Cấu Hình
        </button>
      </div>
    </div>
  );
}
