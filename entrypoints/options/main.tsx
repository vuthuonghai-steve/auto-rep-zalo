import type { PriceRouteRule, SystemLog } from '@/contracts/schemas';
import { db } from '@/db/database';
import { logRepo } from '@/db/log-repo';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './style.css';

interface WhitelistItem {
  groupId: string;
  name: string;
}

interface AppConfig {
  whitelist: WhitelistItem[];
  priceRules: PriceRouteRule[];
  quiescenceDelaySec: number;
}

const DEFAULT_PRICE_RULES: PriceRouteRule[] = [
  {
    id: 'rule_1',
    label: 'Dưới 3 Tỷ',
    minPrice: 0,
    maxPrice: 3,
    targetGroupIds: ['conv-target-under-2b'],
  },
  {
    id: 'rule_2',
    label: '3 - 5 Tỷ',
    minPrice: 3,
    maxPrice: 5,
    targetGroupIds: ['conv-target-2b-5b'],
  },
  {
    id: 'rule_3',
    label: '5 - 10 Tỷ',
    minPrice: 5,
    maxPrice: 10,
    targetGroupIds: ['conv-target-2b-5b'],
  },
  {
    id: 'rule_4',
    label: 'Trên 10 Tỷ',
    minPrice: 10,
    maxPrice: null,
    targetGroupIds: ['conv-target-2b-5b'],
  },
];

export function OptionsApp() {
  const [whitelist, setWhitelist] = useState<WhitelistItem[]>([
    { groupId: 'conv-group-source-1', name: 'Nguồn BĐS Cầu Giấy' },
    { groupId: 'conv-group-source-2', name: 'Nguồn BĐS Đống Đa' },
  ]);
  const [priceRules, setPriceRules] = useState<PriceRouteRule[]>(DEFAULT_PRICE_RULES);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    // Tải cấu hình từ Dexie app_settings
    db.app_settings.get('config').then((item) => {
      if (item?.value) {
        const conf = item.value as unknown as AppConfig;
        if (conf.whitelist) setWhitelist(conf.whitelist);
        if (conf.priceRules) setPriceRules(conf.priceRules);
      }
    });

    // Tải logs gần nhất
    logRepo.getRecentLogs(15).then((logs) => setRecentLogs(logs));
  }, []);

  const handleAddSourceGroup = () => {
    if (!newGroupId.trim() || !newGroupName.trim()) return;
    setWhitelist([...whitelist, { groupId: newGroupId.trim(), name: newGroupName.trim() }]);
    setNewGroupId('');
    setNewGroupName('');
  };

  const handleRemoveSourceGroup = (id: string) => {
    setWhitelist(whitelist.filter((w) => w.groupId !== id));
  };

  const handleSaveConfig = async () => {
    const configData: AppConfig = {
      whitelist,
      priceRules,
      quiescenceDelaySec: 10,
    };

    await db.app_settings.put({
      key: 'config',
      value: configData as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });

    setSaveStatus('Đã lưu cấu hình thành công vào IndexedDB!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleExportLogs = async () => {
    const jsonStr = await logRepo.exportLogsToJson(7, '1.0.0');
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagnostic_logs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="max-w-4xl mx-auto p-6 space-y-8">
      <header class="border-b pb-4">
        <h1 class="text-2xl font-bold text-blue-600">
          Zalo Personal Automation - Cấu Hình & Quản Trị
        </h1>
        <p class="text-sm text-gray-500 mt-1">
          Hệ thống phân phối tin tự động 24/7 cho Solo Operator
        </p>
      </header>

      {saveStatus && (
        <div class="p-3 bg-green-100 border border-green-300 text-green-700 rounded font-medium">
          {saveStatus}
        </div>
      )}

      {/* Phần 1: Whitelist Nhóm Nguồn */}
      <section class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <h2 class="text-lg font-semibold text-gray-800">1. Quản lý Whitelist Nhóm Nguồn</h2>
        <div class="space-y-2">
          {whitelist.map((item) => (
            <div
              key={item.groupId}
              class="flex items-center justify-between p-2 bg-gray-50 rounded border"
            >
              <div>
                <span class="font-medium text-gray-900">{item.name}</span>
                <span class="text-xs text-gray-500 ml-2">({item.groupId})</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveSourceGroup(item.groupId)}
                class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>

        <div class="flex gap-2 pt-2">
          <input
            type="text"
            placeholder="Tên nhóm (ví dụ: Nguồn Cầu Giấy)"
            value={newGroupName}
            onInput={(e) => setNewGroupName((e.target as HTMLInputElement).value)}
            class="flex-1 px-3 py-2 border rounded text-sm"
          />
          <input
            type="text"
            placeholder="ID nhóm (ví dụ: conv-group-123)"
            value={newGroupId}
            onInput={(e) => setNewGroupId((e.target as HTMLInputElement).value)}
            class="flex-1 px-3 py-2 border rounded text-sm"
          />
          <button
            type="button"
            onClick={handleAddSourceGroup}
            class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Thêm Nhóm
          </button>
        </div>
      </section>

      {/* Phần 2: Ma Trận Định Tuyến Khoảng Giá */}
      <section class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <h2 class="text-lg font-semibold text-gray-800">
          2. Ma Trận Định Tuyến Khoảng Giá (Tối đa 2 nhóm đích)
        </h2>
        <div class="space-y-2">
          {priceRules.map((rule) => (
            <div
              key={rule.id}
              class="p-3 bg-gray-50 rounded border text-sm flex items-center justify-between"
            >
              <div>
                <span class="font-bold text-gray-800">{rule.label}</span>
                <span class="text-xs text-gray-500 ml-2">
                  ({rule.minPrice} tỷ{' '}
                  {rule.maxPrice !== null && rule.maxPrice !== undefined
                    ? `- ${rule.maxPrice} tỷ`
                    : 'trở lên'}
                  )
                </span>
                <div class="text-xs text-blue-600 mt-1">Đích: {rule.targetGroupIds.join(', ')}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Nút Lưu Cấu Hình */}
      <div class="flex justify-end">
        <button
          type="button"
          onClick={handleSaveConfig}
          class="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded shadow hover:bg-blue-700"
        >
          Lưu Cấu Hình
        </button>
      </div>

      {/* Phần 3: Nhật Ký Hệ Thống & Xuất File Chẩn Đoán */}
      <section class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-800">
            3. Nhật Ký Hệ Thống (Ring-Buffer 7 Ngày)
          </h2>
          <button
            type="button"
            onClick={handleExportLogs}
            class="px-3 py-1.5 bg-gray-800 text-white text-xs rounded font-medium hover:bg-gray-900"
          >
            Xuất diagnostic_logs.json
          </button>
        </div>
        <div class="max-h-60 overflow-y-auto text-xs font-mono bg-gray-900 text-gray-100 p-3 rounded">
          {recentLogs.length === 0 ? (
            <div class="text-gray-400">Chưa có nhật ký ghi nhận.</div>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} class="py-0.5 border-b border-gray-800">
                <span class="text-blue-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                <span class="text-yellow-400">[{log.operation}]</span> <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<OptionsApp />, root);
}
