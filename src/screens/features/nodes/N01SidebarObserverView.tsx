import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N01Config {
  debounceMs: number;
  activeScanning: boolean;
  scanIntervalMs: number;
  monitorSelector: string;
}

const DEFAULT_N01_CONFIG: N01Config = {
  debounceMs: 300,
  activeScanning: false,
  scanIntervalMs: 5000,
  monitorSelector: '#conversationList, div[role="list"]',
};

export function N01SidebarObserverView() {
  const [config, setConfig] = useState<N01Config>(DEFAULT_N01_CONFIG);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n01').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N01_CONFIG, ...(item.value as Partial<N01Config>) });
      }
    });
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n01',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 01 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N01_CONFIG);
  };

  return (
    <div class="space-y-6">
      {saveStatus && (
        <div class="p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm font-medium">
          {saveStatus}
        </div>
      )}

      {/* Thông tin nghiệp vụ */}
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <div class="font-semibold text-sm flex items-center gap-1.5">
          <span>📡</span>
          <span>Nghiệp Vụ Quan Sát Danh Sách Hội Thoại Zalo (Sidebar)</span>
        </div>
        <p>
          Node 01 sử dụng MutationObserver theo dõi container danh sách chat ảo hóa Zalo Web, phát
          hiện hội thoại có tin nhắn mới theo thời gian thực và lọc theo Whitelist.
        </p>
      </div>

      {/* Tham số vận hành */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Tham Số Vận Hành MutationObserver
        </h2>

        {/* Debounce */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label
              htmlFor="n01-debounce"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Thời gian Debounce (ms)
            </label>
            <p class="text-xs text-gray-500">
              Gom cụm các đột biến DOM liên tiếp trước khi đẩy nhóm vào hàng chờ (Mặc định: 300ms).
            </p>
          </div>
          <input
            id="n01-debounce"
            type="number"
            min={100}
            max={2000}
            step={50}
            value={config.debounceMs}
            onInput={(e) =>
              setConfig({
                ...config,
                debounceMs: Number.parseInt((e.target as HTMLInputElement).value, 10) || 300,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Monitor Selector */}
        <div class="space-y-2">
          <label htmlFor="n01-selector" class="block text-sm font-medium text-gray-800">
            CSS Selector Giám Sát Sidebar
          </label>
          <input
            id="n01-selector"
            type="text"
            value={config.monitorSelector}
            onInput={(e) =>
              setConfig({
                ...config,
                monitorSelector: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="#conversationList, div[role='list']"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <p class="text-xs text-gray-500">
            Bộ chọn DOM trỏ tới container cuộn danh sách hội thoại Zalo Web (hỗ trợ selector dự
            phòng ngăn cách bằng dấu phẩy).
          </p>
        </div>

        {/* Active Scanning Fallback Toggle */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Quét Chủ Động Dự Phòng (Active Polling)
            </span>
            <p class="text-xs text-gray-500">
              Duyệt định kỳ sidebar đề phòng trường hợp MutationObserver bị Zalo Web ngắt kết nối.
            </p>
          </div>
          <ToggleSwitch
            id="n01-active-scan-toggle"
            checked={config.activeScanning}
            onChange={(checked) => setConfig({ ...config, activeScanning: checked })}
            label={config.activeScanning ? 'Đang bật' : 'Đã tắt'}
          />
        </div>

        {/* Scan Interval if active scanning is enabled */}
        {config.activeScanning && (
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div>
              <label
                htmlFor="n01-scan-interval"
                class="block text-sm font-medium text-gray-800 cursor-pointer"
              >
                Chu kỳ Quét Dự Phòng (ms)
              </label>
              <p class="text-xs text-gray-500">
                Khoảng thời gian giữa các lần quét (tối thiểu 2000ms).
              </p>
            </div>
            <input
              id="n01-scan-interval"
              type="number"
              min={2000}
              max={30000}
              step={1000}
              value={config.scanIntervalMs}
              onInput={(e) =>
                setConfig({
                  ...config,
                  scanIntervalMs: Number.parseInt((e.target as HTMLInputElement).value, 10) || 5000,
                })
              }
              class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}
      </section>

      {/* Thẻ Trạng Thái & Thao Tác */}
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
