import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N09Config {
  minMicroJitterMs: number;
  maxMicroJitterMs: number;
  checkLockSendMessageBox: boolean;
  autoReturnToSource: boolean;
}

const DEFAULT_N09_CONFIG: N09Config = {
  minMicroJitterMs: 30,
  maxMicroJitterMs: 80,
  checkLockSendMessageBox: true,
  autoReturnToSource: true,
};

export function N09TextInjectorView() {
  const [config, setConfig] = useState<N09Config>(DEFAULT_N09_CONFIG);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n09').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N09_CONFIG, ...(item.value as Partial<N09Config>) });
      }
    });
  }, []);

  const handleSave = async () => {
    await db.app_settings.put({
      key: 'node_config_n09',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 09 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N09_CONFIG);
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
        data-testid="safe-mode-warning-n09"
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
            Khi tắt Node này, văn bản đã biên tập sẽ không được tiêm vào ô chat hay gửi tới nhóm
            đích, đảm bảo 100% an toàn cho tài khoản cá nhân.
          </p>
        </div>
      </div>

      {/* Thông tin nghiệp vụ */}
      <div class="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 space-y-1">
        <div class="font-semibold text-sm flex items-center gap-1.5">
          <span>✍️</span>
          <span>Nghiệp Vụ Tiêm Nội Dung Văn Bản Pha 2 (Text Injector)</span>
        </div>
        <p>
          Node 09 chuyển sang nhóm đích, sử dụng React 18 DOM Bridge tiêm nội dung văn bản đã chuẩn
          hóa kèm micro-jitter gõ phím con người (30-80ms), kiểm tra an toàn nhóm bị khóa chat và
          quay về nhóm nguồn.
        </p>
      </div>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Cấu Hình Micro-Jitter Gõ Phím & An Toàn Khóa Chat
        </h2>

        {/* Micro-jitter Range */}
        <div class="space-y-3">
          <div>
            <span class="block text-sm font-medium text-gray-800">
              Khoảng Micro-Jitter Gõ Phím (ms / Ký Tự)
            </span>
            <p class="text-xs text-gray-500">
              Độ trễ ngẫu nhiên giữa các lần gõ phím mô phỏng tốc độ gõ phím của con người (Khuyến
              nghị: 30 - 80ms).
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label htmlFor="n09-min-jitter" class="text-xs text-gray-500 block">
                Tối thiểu (Min Micro-Jitter ms)
              </label>
              <input
                id="n09-min-jitter"
                type="number"
                min={10}
                max={60}
                step={5}
                value={config.minMicroJitterMs}
                onInput={(e) =>
                  setConfig({
                    ...config,
                    minMicroJitterMs:
                      Number.parseInt((e.target as HTMLInputElement).value, 10) || 30,
                  })
                }
                class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div class="space-y-1">
              <label htmlFor="n09-max-jitter" class="text-xs text-gray-500 block">
                Tối đa (Max Micro-Jitter ms)
              </label>
              <input
                id="n09-max-jitter"
                type="number"
                min={50}
                max={200}
                step={10}
                value={config.maxMicroJitterMs}
                onInput={(e) =>
                  setConfig({
                    ...config,
                    maxMicroJitterMs:
                      Number.parseInt((e.target as HTMLInputElement).value, 10) || 80,
                  })
                }
                class="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Kiểm tra an toàn .lockSendMessageBox */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Kiểm Tra An Toàn Nhóm Khóa Chat (.lockSendMessageBox)
            </span>
            <p class="text-xs text-gray-500">
              Phát hiện các nhóm cộng đồng Zalo chỉ cho phép Trưởng/Phó nhóm gửi tin; an toàn bỏ qua
              mà không gây treo hoặc lỗi crash tiện ích.
            </p>
          </div>
          <ToggleSwitch
            id="n09-check-lock"
            checked={config.checkLockSendMessageBox}
            onChange={(checked) => setConfig({ ...config, checkLockSendMessageBox: checked })}
            label={config.checkLockSendMessageBox ? 'Đang bật' : 'Đã tắt'}
          />
        </div>

        {/* Tự động quay về nhóm nguồn */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Tự Động Quay Lại Nhóm Nguồn Sau Khi Gửi (Return to Source)
            </span>
            <p class="text-xs text-gray-500">
              Sau khi tiêm text và hoàn tất gửi tin tại nhóm đích, tự động click chuyển tab trở về
              nhóm nguồn ban đầu để tiếp tục chu trình quan sát.
            </p>
          </div>
          <ToggleSwitch
            id="n09-return-source"
            checked={config.autoReturnToSource}
            onChange={(checked) => setConfig({ ...config, autoReturnToSource: checked })}
            label={config.autoReturnToSource ? 'Đang bật' : 'Đã tắt'}
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
