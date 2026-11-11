import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N10Config {
  quiescenceDelaySec: number;
  persistCheckpoint: boolean;
  drainQueueOnComplete: boolean;
  enablePacingGuard: boolean;
}

const DEFAULT_N10_CONFIG: N10Config = {
  quiescenceDelaySec: 10,
  persistCheckpoint: true,
  drainQueueOnComplete: true,
  enablePacingGuard: true,
};

export function N10CommitterDrainView() {
  const [config, setConfig] = useState<N10Config>(DEFAULT_N10_CONFIG);
  const [checkpointCount, setCheckpointCount] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n10').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N10_CONFIG, ...(item.value as Partial<N10Config>) });
      }
    });

    db.group_checkpoints.count().then((count) => setCheckpointCount(count));
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n10',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 10 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N10_CONFIG);
  };

  return (
    <div class="space-y-6">
      {saveStatus && (
        <div class="p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm font-medium">
          {saveStatus}
        </div>
      )}

      {/* Thông tin nghiệp vụ */}
      <div class="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 space-y-1">
        <div class="font-semibold text-sm flex items-center gap-1.5">
          <span>⏳</span>
          <span>Nghiệp Vụ Lưu Vết & Giải Phóng Hàng Chờ (Committer & Drain)</span>
        </div>
        <p>
          Node 10 chốt hạ chu trình xử lý bằng cách đếm ngược khoảng đệm tĩnh lặng (Quiescence
          Delay), lưu checkpoint tin nhắn mới nhất vào Dexie IndexedDB và giải phóng Single Mutex
          Lock cho nhóm tiếp theo.
        </p>
      </div>

      {/* Thẻ giám sát Checkpoints */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-2">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Thông Số Chốt Điểm Vết (Checkpoints)
        </h2>
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <span class="text-sm font-medium text-gray-800">Checkpoints Đã Lưu Bền Vững</span>
            <p class="text-xs text-gray-500">Bảng IndexedDB: group_checkpoints</p>
          </div>
          <span class="text-lg font-bold text-gray-900 font-mono">{checkpointCount} bản ghi</span>
        </div>
      </section>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Cấu Hình Đệm Tĩnh Lặng & Quản Trị Giải Phóng
        </h2>

        {/* Quiescence Delay */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label
              htmlFor="n10-quiescence-sec"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Khoảng Đệm Tĩnh Lặng (Quiescence Delay Giây)
            </label>
            <p class="text-xs text-gray-500">
              Thời gian đếm ngược tĩnh lặng sau khi hoàn tất gửi tin trước khi mở khóa Mutex (Khuyến
              nghị: 10s, từ 3 - 30s).
            </p>
          </div>
          <input
            id="n10-quiescence-sec"
            type="number"
            min={3}
            max={30}
            step={1}
            value={config.quiescenceDelaySec}
            onInput={(e) =>
              setConfig({
                ...config,
                quiescenceDelaySec: Number.parseInt((e.target as HTMLInputElement).value, 10) || 10,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Persist Checkpoint to Dexie */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Lưu Checkpoint Bền Vững Vào IndexedDB (Dexie)
            </span>
            <p class="text-xs text-gray-500">
              Chốt ID tin nhắn cuối cùng vào bảng group_checkpoints để Node 04 lần sau không quét
              lại.
            </p>
          </div>
          <ToggleSwitch
            id="n10-persist-checkpoint"
            checked={config.persistCheckpoint}
            onChange={(checked) => setConfig({ ...config, persistCheckpoint: checked })}
            label={config.persistCheckpoint ? 'Đang bật' : 'Đã tắt'}
          />
        </div>

        {/* Drain Queue Task on Complete */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Giải Phóng Tác Vụ Khỏi Hàng Chờ (Drain Queue Item)
            </span>
            <p class="text-xs text-gray-500">
              Đánh dấu trạng thái COMPLETED và loại bỏ tác vụ khỏi hàng chờ group_dispatch_queue.
            </p>
          </div>
          <ToggleSwitch
            id="n10-drain-queue"
            checked={config.drainQueueOnComplete}
            onChange={(checked) => setConfig({ ...config, drainQueueOnComplete: checked })}
            label={config.drainQueueOnComplete ? 'Đang bật' : 'Đã tắt'}
          />
        </div>

        {/* Pacing Guard */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Kích Hoạt Pacing Guard (Bảo Vệ Tốc Độ Điều Tốc Toàn Cục)
            </span>
            <p class="text-xs text-gray-500">
              Kiểm soát tần suất chuyển tiếp tổng thể, tự động giãn cách nếu tốc độ gửi tin quá dồn
              dập.
            </p>
          </div>
          <ToggleSwitch
            id="n10-pacing-guard"
            checked={config.enablePacingGuard}
            onChange={(checked) => setConfig({ ...config, enablePacingGuard: checked })}
            label={config.enablePacingGuard ? 'Đang bật' : 'Đã tắt'}
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
