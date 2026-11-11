import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N03Config {
  minJitterMs: number;
  maxJitterMs: number;
  enableBottomAnchor: boolean;
  maxSwitchRetries: number;
}

const DEFAULT_N03_CONFIG: N03Config = {
  minJitterMs: 1000,
  maxJitterMs: 2000,
  enableBottomAnchor: true,
  maxSwitchRetries: 3,
};

export function N03ChatSwitcherView() {
  const [config, setConfig] = useState<N03Config>(DEFAULT_N03_CONFIG);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n03').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N03_CONFIG, ...(item.value as Partial<N03Config>) });
      }
    });
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n03',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 03 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N03_CONFIG);
  };

  return (
    <div class="space-y-6">
      {saveStatus && (
        <div class="p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm font-medium">
          {saveStatus}
        </div>
      )}

      {/* Thông tin nghiệp vụ */}
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
        <div class="font-semibold text-sm flex items-center gap-1.5">
          <span>🔀</span>
          <span>Nghiệp Vụ Chuyển Đổi Hội Thoại An Toàn (Chat Switcher)</span>
        </div>
        <p>
          Node 03 mô phỏng thao tác nhấp chuột người dùng kèm độ trễ ngẫu nhiên (Human Jitter) để
          chuyển tab nhóm chat nguồn và tự động neo xuống đáy danh sách tin nhắn mới nhất.
        </p>
      </div>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Cấu Hình Human Jitter & Điều Hướng
        </h2>

        {/* Jitter Range */}
        <div class="space-y-3">
          <div>
            <span class="block text-sm font-medium text-gray-800">
              Khoảng Độ Trễ Ngẫu Nhiên Human Jitter (ms)
            </span>
            <p class="text-xs text-gray-500">
              Độ trễ tối thiểu và tối đa khi nhấp chuyển tab nhóm chat để mô phỏng hành vi tự nhiên
              (1000 - 3000ms).
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label htmlFor="n03-min-jitter" class="text-xs text-gray-500 block">
                Độ trễ tối thiểu (Min Jitter ms)
              </label>
              <input
                id="n03-min-jitter"
                type="number"
                min={500}
                max={3000}
                step={100}
                value={config.minJitterMs}
                onInput={(e) =>
                  setConfig({
                    ...config,
                    minJitterMs: Number.parseInt((e.target as HTMLInputElement).value, 10) || 1000,
                  })
                }
                class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div class="space-y-1">
              <label htmlFor="n03-max-jitter" class="text-xs text-gray-500 block">
                Độ trễ tối đa (Max Jitter ms)
              </label>
              <input
                id="n03-max-jitter"
                type="number"
                min={1000}
                max={5000}
                step={100}
                value={config.maxJitterMs}
                onInput={(e) =>
                  setConfig({
                    ...config,
                    maxJitterMs: Number.parseInt((e.target as HTMLInputElement).value, 10) || 2000,
                  })
                }
                class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Neo đáy qua .new-messages-container */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Tự Động Neo Đáy Qua Nút Tin Mới (.new-messages-container)
            </span>
            <p class="text-xs text-gray-500">
              Khi phát hiện nút nhảy nhanh xuống tin mới nhất của Zalo Web, tự động kích hoạt để đưa
              viewport về cuối danh sách.
            </p>
          </div>
          <ToggleSwitch
            id="n03-bottom-anchor"
            checked={config.enableBottomAnchor}
            onChange={(checked) => setConfig({ ...config, enableBottomAnchor: checked })}
            label={config.enableBottomAnchor ? 'Đang bật' : 'Đã tắt'}
          />
        </div>

        {/* Retry Count */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <label
              htmlFor="n03-retries"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Số Lần Thử Lại Tối Đa (Max Switch Retries)
            </label>
            <p class="text-xs text-gray-500">
              Số lần thử lại nếu giao diện chat Zalo không tải xong hội thoại mục tiêu (1 - 5 lần).
            </p>
          </div>
          <input
            id="n03-retries"
            type="number"
            min={1}
            max={5}
            step={1}
            value={config.maxSwitchRetries}
            onInput={(e) =>
              setConfig({
                ...config,
                maxSwitchRetries: Number.parseInt((e.target as HTMLInputElement).value, 10) || 3,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
