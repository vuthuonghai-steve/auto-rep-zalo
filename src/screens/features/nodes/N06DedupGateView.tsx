import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N06Config {
  ttlDays: number;
  enablePhoneDedup: boolean;
  enableContentHashDedup: boolean;
  autoCleanExpired: boolean;
}

const DEFAULT_N06_CONFIG: N06Config = {
  ttlDays: 30,
  enablePhoneDedup: true,
  enableContentHashDedup: true,
  autoCleanExpired: true,
};

export function N06DedupGateView() {
  const [config, setConfig] = useState<N06Config>(DEFAULT_N06_CONFIG);
  const [entityCount, setEntityCount] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n06').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N06_CONFIG, ...(item.value as Partial<N06Config>) });
      }
    });

    db.entities.count().then((count) => setEntityCount(count));
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n06',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 06 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleClearEntities = async () => {
    await db.entities.clear();
    setEntityCount(0);
    setSaveStatus('Đã dọn sạch kho dữ liệu lọc trùng (entities)!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N06_CONFIG);
  };

  return (
    <div class="space-y-6">
      {saveStatus && (
        <div class="p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm font-medium">
          {saveStatus}
        </div>
      )}

      {/* Thông tin nghiệp vụ */}
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 space-y-1">
        <div class="font-semibold text-sm flex items-center gap-1.5">
          <span>🛡️</span>
          <span>Nghiệp Vụ Cổng Lọc Trùng 2 Lớp 30 Ngày (Dedup Gate)</span>
        </div>
        <p>
          Node 06 chặn tin rác và tin lặp lại bằng 2 lớp phòng vệ: Lớp 1 chuẩn hóa Số Điện Thoại
          người bán và Lớp 2 mã băm SHA-256 nội dung văn bản trong cửa sổ TTL 30 ngày.
        </p>
      </div>

      {/* Thẻ giám sát dữ liệu Entities */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Dữ Liệu Vết Lọc Trùng (IndexedDB: entities)
        </h2>
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <span class="text-sm font-medium text-gray-800">Tổng Bản Ghi Tin Đã Lưu Vết</span>
            <p class="text-xs text-gray-500">
              Bao gồm SĐT chuẩn hóa và mã băm SHA-256 64-ký tự hex
            </p>
          </div>
          <span class="text-xl font-bold text-gray-900 font-mono">{entityCount} bản ghi</span>
        </div>
        <div class="flex justify-end">
          <button
            type="button"
            onClick={handleClearEntities}
            class="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 font-medium transition-colors"
          >
            Xóa Lịch Sử Lọc Trùng
          </button>
        </div>
      </section>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Cấu Hình 2 Lớp Phòng Vệ & Thời Gian TTL
        </h2>

        {/* TTL Days */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label
              htmlFor="n06-ttl-days"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Thời Gian Lưu Vết Trừ Trùng (TTL Ngày)
            </label>
            <p class="text-xs text-gray-500">
              Khoảng thời gian một bài đăng bị từ chối nếu phát hiện trùng SĐT hoặc mã băm (1 - 90
              ngày).
            </p>
          </div>
          <input
            id="n06-ttl-days"
            type="number"
            min={1}
            max={90}
            step={1}
            value={config.ttlDays}
            onInput={(e) =>
              setConfig({
                ...config,
                ttlDays: Number.parseInt((e.target as HTMLInputElement).value, 10) || 30,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Lớp 1: Phone Dedup */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Lớp 1: Lọc Trùng Theo Số Điện Thoại (Phone Deduplication)
            </span>
            <p class="text-xs text-gray-500">
              Nhận diện và chuẩn hóa mọi định dạng SĐT (09x, 84x, khoảng trắng, dấu chấm). Bỏ qua
              bài đăng nếu SĐT này đã được chia sẻ trong thời gian TTL.
            </p>
          </div>
          <ToggleSwitch
            id="n06-phone-dedup"
            checked={config.enablePhoneDedup}
            onChange={(checked) => setConfig({ ...config, enablePhoneDedup: checked })}
            label={config.enablePhoneDedup ? 'Đang bật' : 'Đã tắt'}
          />
        </div>

        {/* Lớp 2: SHA-256 Hash Dedup */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Lớp 2: Lọc Trùng Theo Mã Băm SHA-256 (Content Hash Deduplication)
            </span>
            <p class="text-xs text-gray-500">
              Tính mã băm mật mã học của nội dung (đã chuẩn hóa bỏ emoji và khoảng trắng) để phát
              hiện chính xác tin copy hoặc re-post từ môi giới khác.
            </p>
          </div>
          <ToggleSwitch
            id="n06-hash-dedup"
            checked={config.enableContentHashDedup}
            onChange={(checked) => setConfig({ ...config, enableContentHashDedup: checked })}
            label={config.enableContentHashDedup ? 'Đang bật' : 'Đã tắt'}
          />
        </div>

        {/* Auto clean expired */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Tự Động Dọn Dẹp Bản Ghi Quá Hạn (Auto Cleanup)
            </span>
            <p class="text-xs text-gray-500">
              Tự động xóa các bản ghi vết đã hết hạn TTL khi tiện ích khởi động để tối ưu dung lượng
              IndexedDB.
            </p>
          </div>
          <ToggleSwitch
            id="n06-auto-clean"
            checked={config.autoCleanExpired}
            onChange={(checked) => setConfig({ ...config, autoCleanExpired: checked })}
            label={config.autoCleanExpired ? 'Đang bật' : 'Đã tắt'}
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
