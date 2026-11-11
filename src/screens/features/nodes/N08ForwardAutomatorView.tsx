import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N08Config {
  modalTimeoutMs: number;
  toastTimeoutMs: number;
  maxRetries: number;
  autoCloseModalOnFailure: boolean;
}

const DEFAULT_N08_CONFIG: N08Config = {
  modalTimeoutMs: 5000,
  toastTimeoutMs: 3000,
  maxRetries: 2,
  autoCloseModalOnFailure: true,
};

export function N08ForwardAutomatorView() {
  const [config, setConfig] = useState<N08Config>(DEFAULT_N08_CONFIG);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n08').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N08_CONFIG, ...(item.value as Partial<N08Config>) });
      }
    });
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n08',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 08 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N08_CONFIG);
  };

  return (
    <div class="space-y-6">
      {saveStatus && (
        <div class="p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm font-medium">
          {saveStatus}
        </div>
      )}

      {/* CẢNH BÁO BẮT BUỘC: Banner Chế độ Kiểm Thử An Toàn (Dry-Run) */}
      <div
        data-testid="safe-mode-warning-n08"
        class="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 text-amber-900 shadow-sm flex items-start gap-3"
      >
        <div class="text-2xl mt-0.5 shrink-0">⚠️</div>
        <div class="space-y-1">
          <div class="font-bold text-sm text-amber-950 uppercase tracking-wide">
            Cảnh Báo Kiểm Thử An Toàn (Safe Dry-Run Mode)
          </div>
          <p class="text-sm font-semibold text-amber-900 leading-relaxed">
            Chế độ Kiểm Thử An Toàn: Mặc định TẮT để chống spam nhóm Zalo thật. Khi bật, tiện ích sẽ
            tương tác trực tiếp lên DOM Zalo Web.
          </p>
          <p class="text-xs text-amber-800">
            Khi tắt Node này, pipeline vẫn kiểm thử thu thập và phân loại giá bình thường mà không
            gửi album ảnh/video ra ngoài.
          </p>
        </div>
      </div>

      {/* Thông tin nghiệp vụ */}
      <div class="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 space-y-1">
        <div class="font-semibold text-sm flex items-center gap-1.5">
          <span>🚀</span>
          <span>Nghiệp Vụ Chuyển Tiếp Media Pha 1 (Forward Automator)</span>
        </div>
        <p>
          Node 08 kích hoạt cửa sổ Native Forward Modal của Zalo Web, tìm kiếm và tick chọn các nhóm
          đích đã định tuyến, bấm chia sẻ media gốc giữ trọn chất lượng và độ nét.
        </p>
      </div>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Tham Số Chờ Modal & Nhận Diện Toast Thành Công
        </h2>

        {/* Modal Timeout */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label
              htmlFor="n08-modal-timeout"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Thời Gian Chờ Mở Modal (Modal Timeout ms)
            </label>
            <p class="text-xs text-gray-500">
              Thời gian tối đa đợi Native Forward Modal xuất hiện trên DOM (1000 - 10000ms).
            </p>
          </div>
          <input
            id="n08-modal-timeout"
            type="number"
            min={1000}
            max={10000}
            step={500}
            value={config.modalTimeoutMs}
            onInput={(e) =>
              setConfig({
                ...config,
                modalTimeoutMs: Number.parseInt((e.target as HTMLInputElement).value, 10) || 5000,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Toast Timeout */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <label
              htmlFor="n08-toast-timeout"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Thời Gian Bắt Toast Thành Công (Toast Timeout ms)
            </label>
            <p class="text-xs text-gray-500">
              Thời gian chờ Zalo hiển thị thông báo "Đã chia sẻ thành công" (1000 - 5000ms).
            </p>
          </div>
          <input
            id="n08-toast-timeout"
            type="number"
            min={1000}
            max={5000}
            step={500}
            value={config.toastTimeoutMs}
            onInput={(e) =>
              setConfig({
                ...config,
                toastTimeoutMs: Number.parseInt((e.target as HTMLInputElement).value, 10) || 3000,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Max Retries */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <div>
            <label
              htmlFor="n08-retries"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Số Lần Thử Lại Tối Đa (Max Retries)
            </label>
            <p class="text-xs text-gray-500">
              Số lần thử lại thao tác mở modal nếu lần đầu bị gián đoạn (1 - 3 lần).
            </p>
          </div>
          <input
            id="n08-retries"
            type="number"
            min={1}
            max={3}
            step={1}
            value={config.maxRetries}
            onInput={(e) =>
              setConfig({
                ...config,
                maxRetries: Number.parseInt((e.target as HTMLInputElement).value, 10) || 2,
              })
            }
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Auto Close Modal on Failure */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Tự Động Đóng Modal Khi Thất Bại (Auto Close on Failure)
            </span>
            <p class="text-xs text-gray-500">
              Chủ động nhấn phím Escape hoặc nút đóng để giải phóng màn hình nếu gửi tin không thành
              công.
            </p>
          </div>
          <ToggleSwitch
            id="n08-auto-close"
            checked={config.autoCloseModalOnFailure}
            onChange={(checked) => setConfig({ ...config, autoCloseModalOnFailure: checked })}
            label={config.autoCloseModalOnFailure ? 'Đang bật' : 'Đã tắt'}
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
