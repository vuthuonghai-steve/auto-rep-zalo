import type { PriceRouteRule } from '@/contracts/schemas';
import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useEffect, useState } from 'preact/hooks';

export interface N07Config {
  maxTargetGroups: number;
  fallbackGroupId: string;
  enableKeywordExtraction: boolean;
}

const DEFAULT_N07_CONFIG: N07Config = {
  maxTargetGroups: 2,
  fallbackGroupId: '',
  enableKeywordExtraction: true,
};

const DEFAULT_PREVIEW_RULES: PriceRouteRule[] = [
  {
    id: 'rule_under_3',
    label: 'Phân Khúc Dưới 3 Tỷ',
    minPrice: 0,
    maxPrice: 3,
    targetGroupIds: ['conv-target-under-3b'],
  },
  {
    id: 'rule_3_to_5',
    label: 'Phân Khúc 3 - 5 Tỷ',
    minPrice: 3,
    maxPrice: 5,
    targetGroupIds: ['conv-target-3b-5b'],
  },
  {
    id: 'rule_5_to_10',
    label: 'Phân Khúc 5 - 10 Tỷ',
    minPrice: 5,
    maxPrice: 10,
    targetGroupIds: ['conv-target-5b-10b'],
  },
  {
    id: 'rule_above_10',
    label: 'Phân Khúc Trên 10 Tỷ',
    minPrice: 10,
    maxPrice: null,
    targetGroupIds: ['conv-target-above-10b'],
  },
];

export function N07PriceRouterView() {
  const [config, setConfig] = useState<N07Config>(DEFAULT_N07_CONFIG);
  const [rules, setRules] = useState<PriceRouteRule[]>(DEFAULT_PREVIEW_RULES);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    db.app_settings.get('node_config_n07').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N07_CONFIG, ...(item.value as Partial<N07Config>) });
      }
    });

    // Tải quy tắc giá thực tế nếu có cấu hình chung
    db.app_settings.get('config').then((item) => {
      const val = item?.value as { priceRules?: PriceRouteRule[] } | undefined;
      if (val?.priceRules && val.priceRules.length > 0) {
        setRules(val.priceRules);
      }
    });
  }, []);

  const handleSave = async () => {
    // Ràng buộc nghiêm ngặt: Tối đa 2 nhóm đích
    const sanitizedConfig: N07Config = {
      ...config,
      maxTargetGroups: Math.min(Math.max(config.maxTargetGroups, 1), 2),
    };
    setConfig(sanitizedConfig);

    await db.app_settings.put({
      key: 'node_config_n07',
      value: sanitizedConfig as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setSaveStatus('Đã lưu cấu hình Node 07 thành công!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_N07_CONFIG);
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
          <span>🎯</span>
          <span>Nghiệp Vụ Bóc Tách Giá & Định Tuyến Nhóm Đích (Price Router)</span>
        </div>
        <p>
          Node 07 trích xuất khoảng giá từ nội dung văn bản (đơn vị tỷ, triệu) và định tuyến tới tối
          đa 2 nhóm chat con phù hợp. Nếu tin không xác định được giá, tin sẽ được đưa vào nhóm dự
          phòng.
        </p>
      </div>

      {/* Cấu hình tham số */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Tham Số Định Tuyến & Giới Hạn Nhóm Đích
        </h2>

        {/* Max Target Groups (<= 2) */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label
              htmlFor="n07-max-targets"
              class="block text-sm font-medium text-gray-800 cursor-pointer"
            >
              Số Lượng Nhóm Đích Tối Đa (Max Target Groups)
            </label>
            <p class="text-xs text-gray-500">
              Quy tắc khống chế số lượng nhóm con nhận chuyển tiếp để chống spam (Bắt buộc ≤ 2
              nhóm).
            </p>
          </div>
          <input
            id="n07-max-targets"
            type="number"
            min={1}
            max={2}
            step={1}
            value={config.maxTargetGroups}
            onInput={(e) => {
              const val = Number.parseInt((e.target as HTMLInputElement).value, 10) || 2;
              setConfig({
                ...config,
                maxTargetGroups: Math.min(Math.max(val, 1), 2),
              });
            }}
            class="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* Fallback Group ID */}
        <div class="space-y-2 border-t border-gray-100 pt-4">
          <label htmlFor="n07-fallback-group" class="block text-sm font-medium text-gray-800">
            ID Nhóm Dự Phòng Khi Không Xác Định Được Giá
          </label>
          <input
            id="n07-fallback-group"
            type="text"
            value={config.fallbackGroupId}
            onInput={(e) =>
              setConfig({
                ...config,
                fallbackGroupId: (e.target as HTMLInputElement).value,
              })
            }
            placeholder="Ví dụ: g9129955304609610838 hoặc conv-target-general"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <p class="text-xs text-gray-500">
            Để trống nếu không muốn chuyển tiếp các tin bài không nhận diện được giá.
          </p>
        </div>

        {/* Keyword extraction */}
        <div class="flex items-center justify-between border-t border-gray-100 pt-4">
          <div class="space-y-1">
            <span class="text-sm font-medium text-gray-800 block">
              Trích Xuất Giá Tự Nhiên (Natural Price Keywords)
            </span>
            <p class="text-xs text-gray-500">
              Nhận diện các mẫu định dạng phong phú: "3.5 tỷ", "3ty5", "850 triệu", "4,2 tỏi"...
            </p>
          </div>
          <ToggleSwitch
            id="n07-keyword-extract"
            checked={config.enableKeywordExtraction}
            onChange={(checked) => setConfig({ ...config, enableKeywordExtraction: checked })}
            label={config.enableKeywordExtraction ? 'Đang bật' : 'Đã tắt'}
          />
        </div>
      </section>

      {/* Ma trận giá xem trước */}
      <section class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 class="text-base font-semibold text-gray-900">
            Ma Trận Quy Tắc Định Tuyến Phân Khúc Giá
          </h2>
          <span class="text-xs text-gray-500">Quản lý nâng cao tại Core Settings</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              class="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm space-y-1"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold text-gray-800">{rule.label}</span>
                <span class="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                  {rule.minPrice} tỷ {rule.maxPrice !== null ? `- ${rule.maxPrice} tỷ` : 'trở lên'}
                </span>
              </div>
              <div class="text-xs text-blue-600 font-mono">
                Đích: {rule.targetGroupIds.slice(0, config.maxTargetGroups).join(', ')}
              </div>
            </div>
          ))}
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
