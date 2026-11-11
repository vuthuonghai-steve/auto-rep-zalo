import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N05Config {
  slidingWindowSec: number;
  debounceSec: number;
  maxMediaItems: number;
  groupBySameAuthor: boolean;
}

const DEFAULT_N05_CONFIG: N05Config = {
  slidingWindowSec: 15,
  debounceSec: 2.5,
  maxMediaItems: 30,
  groupBySameAuthor: true,
};

export function N05BundleAggregatorView() {
  const [config, setConfig] = useState<N05Config>(DEFAULT_N05_CONFIG);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n05').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N05_CONFIG, ...(item.value as Partial<N05Config>) });
      }
    });
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n05',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 05 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N05_CONFIG);
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
          <span>📦</span>
          <span>Nghiệp Vụ Gom Cụm Tin Nhắn & Media (Bundle Aggregator)</span>
        </div>
        <p>
          Node 05 tự động gom các tin nhắn văn bản mô tả BĐS và các ảnh/video album gửi liên tiếp từ
          cùng một tác giả trong cửa sổ thời gian 15s thành một đơn vị Bundle trọn vẹn.
        </p>
      </div>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Cấu Hình Cửa Sổ Gom Cụm (Sliding Window & Debounce)
        </h2>

        {/* Sliding Window */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label
              htmlFor="n05-window-sec"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Thời Gian Cửa Sổ Trượt (Sliding Window Giây)
            </label>
            <p class="text-xs text-gray-500">
              Khoảng thời gian tối đa để gom các tin nhắn liên tiếp vào cùng một gói tin (5 - 60s).
            </p>
          </div>
          <input
            id="n05-window-sec"
            type="number"
            min={5}
            max={60}
            step={1}
            value={config.slidingWindowSec}
            onInput={(e) =>
              setConfig({
                ...config,
                slidingWindowSec: Number.parseInt((e.target as HTMLInputElement).value, 10) || 15,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Debounce */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <label
              htmlFor="n05-debounce-sec"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Thời Gian Tĩnh Lặng Chờ Tin Kế Tiếp (Debounce Giây)
            </label>
            <p class="text-xs text-gray-500">
              Thời gian đệm sau mỗi tin mới nhận để chờ tác giả gửi tiếp ảnh/text (Mặc định: 2.5s).
            </p>
          </div>
          <input
            id="n05-debounce-sec"
            type="number"
            min={1}
            max={5}
            step={0.5}
            value={config.debounceSec}
            onInput={(e) =>
              setConfig({
                ...config,
                debounceSec: Number.parseFloat((e.target as HTMLInputElement).value) || 2.5,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Max Media Items */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <label
              htmlFor="n05-max-media"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Số Lượng Media Tối Đa Trong 1 Bundle (Max Media Items)
            </label>
            <p class="text-xs text-gray-500">
              Giới hạn số ảnh/video trong một lần gom để phù hợp với giới hạn chuyển tiếp của Zalo
              (5 - 50 items).
            </p>
          </div>
          <input
            id="n05-max-media"
            type="number"
            min={5}
            max={50}
            step={5}
            value={config.maxMediaItems}
            onInput={(e) =>
              setConfig({
                ...config,
                maxMediaItems: Number.parseInt((e.target as HTMLInputElement).value, 10) || 30,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Group By Same Author */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Chỉ Gom Tin Của Cùng Một Người Gửi (Group By Same Author)
            </span>
            <p class="text-xs text-gray-500">
              Đảm bảo không gom lẫn lộn tin nhắn BĐS của hai người gửi khác nhau trong nhóm chat
              nguồn.
            </p>
          </div>
          <ToggleSwitch
            id="n05-group-author"
            checked={config.groupBySameAuthor}
            onChange={(checked) => setConfig({ ...config, groupBySameAuthor: checked })}
            label={config.groupBySameAuthor ? 'Đang bật' : 'Đã tắt'}
          />
        </div>
      </section>

      {/* Thao tác */}
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
