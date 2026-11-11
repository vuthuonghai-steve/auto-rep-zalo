import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N04Config {
  maxDeltaMessages: number;
  ignoreUnreadBadge99: boolean;
  backwardScanDepth: number;
}

const DEFAULT_N04_CONFIG: N04Config = {
  maxDeltaMessages: 10,
  ignoreUnreadBadge99: true,
  backwardScanDepth: 5,
};

export function N04DeltaStitcherView() {
  const [config, setConfig] = useState<N04Config>(DEFAULT_N04_CONFIG);
  const [checkpointCount, setCheckpointCount] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n04').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N04_CONFIG, ...(item.value as Partial<N04Config>) });
      }
    });

    db.group_checkpoints.count().then((count) => setCheckpointCount(count));
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n04',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 04 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N04_CONFIG);
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
          <span>🧵</span>
          <span>Nghiệp Vụ Ghép Nối Tin Mới Ngược Từ Đáy (Delta Stitcher)</span>
        </div>
        <p>
          Node 04 trích xuất tin mới bằng cách quét từ đáy viewport ngược lên và đối chiếu với
          Checkpoint lưu trong IndexedDB, chủ động bỏ qua nút 99+ tin chưa đọc để chống nghẽn DOM.
        </p>
      </div>

      {/* Thẻ giám sát Checkpoints */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-2">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Thông Tin Checkpoint Đối Chiếu
        </h2>
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <span class="text-sm font-medium text-gray-800">Số Nhóm Đã Lưu Checkpoint</span>
            <p class="text-xs text-gray-500">Bảng IndexedDB: group_checkpoints</p>
          </div>
          <span class="text-lg font-bold text-gray-900 font-mono">{checkpointCount} nhóm</span>
        </div>
      </section>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Cấu Hình Quét & Đối Chiếu Delta
        </h2>

        {/* Max Delta Messages */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label
              htmlFor="n04-max-messages"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Số Lượng Tin Đáy Quét Mỗi Lần (Max Delta Messages)
            </label>
            <p class="text-xs text-gray-500">
              Số lượng phần tử tin nhắn đáy viewport cần bóc tách để đối chiếu (Khuyến nghị: 5 - 10
              tin).
            </p>
          </div>
          <input
            id="n04-max-messages"
            type="number"
            min={5}
            max={20}
            step={1}
            value={config.maxDeltaMessages}
            onInput={(e) =>
              setConfig({
                ...config,
                maxDeltaMessages: Number.parseInt((e.target as HTMLInputElement).value, 10) || 10,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Bỏ qua nút 99+ tin chưa đọc */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Bỏ Qua Nút "99+ Tin Chưa Đọc" (Ignore 99+ Badge)
            </span>
            <p class="text-xs text-gray-500">
              Không bấm vào nút nhảy lên 99+ tin cũ, tránh tải dồn dập hàng nghìn node DOM làm chậm
              trình duyệt.
            </p>
          </div>
          <ToggleSwitch
            id="n04-ignore-99"
            checked={config.ignoreUnreadBadge99}
            onChange={(checked) => setConfig({ ...config, ignoreUnreadBadge99: checked })}
            label={config.ignoreUnreadBadge99 ? 'Đang bật' : 'Đã tắt'}
          />
        </div>

        {/* Backward Scan Depth */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <label
              htmlFor="n04-scan-depth"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Độ Sâu Quét Ngược (Backward Scan Depth)
            </label>
            <p class="text-xs text-gray-500">
              Số lượng tin liên tiếp trùng khớp Checkpoint trước khi chốt danh sách tin mới (3 - 15
              tin).
            </p>
          </div>
          <input
            id="n04-scan-depth"
            type="number"
            min={3}
            max={15}
            step={1}
            value={config.backwardScanDepth}
            onInput={(e) =>
              setConfig({
                ...config,
                backwardScanDepth: Number.parseInt((e.target as HTMLInputElement).value, 10) || 5,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
