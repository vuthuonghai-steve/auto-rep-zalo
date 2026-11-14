import { db } from '@/db/database';
import { ToggleSwitch } from '@/screens/common/ToggleSwitch';
import { useComputed } from '@preact/signals';
import type { FunctionalComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { TelemetryStatusCard } from './components/TelemetryStatusCard';
import { WhitelistDrawer } from './components/WhitelistDrawer';
import { sidebarObserverSignals } from './sidebar-observer.signals';
import type { GroupFilter, SidebarObserverScreenProps } from './sidebar-observer.types';

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

/**
 * Screen View Container (Layer 1 Flat Pattern)
 * Screen: SidebarObserverScreen
 *
 * Quy chuẩn:
 * 1. Đóng vai trò container layout, quản lý sub-tabs và kết nối signals.
 * 2. Tách UI components con vào thư mục `components/` đồng cấp.
 * 3. Hỗ trợ 2 chế độ:
 *    - DISCOVERY: Khám phá & Lắng nghe DOM Zalo Web (Sidebar)
 *    - CONFIG: Tham số vận hành MutationObserver
 * 4. Chuẩn hóa 100% Light Mode Tailwind CSS Design Tokens.
 */
export const SidebarObserverScreen: FunctionalComponent<SidebarObserverScreenProps> = ({
  title = 'Node 01: Sidebar Observer & Khám Phá Nhóm',
}) => {
  const [activeTab, setActiveTab] = useState<'DISCOVERY' | 'CONFIG'>('DISCOVERY');

  // Config tab state
  const [config, setConfig] = useState<N01Config>(DEFAULT_N01_CONFIG);
  const [configSaveStatus, setConfigSaveStatus] = useState<string | null>(null);

  // Discovery signals
  const isLoading = useComputed(() => sidebarObserverSignals.isLoading.value);
  const groups = useComputed(() => sidebarObserverSignals.filteredGroups.value);
  const whitelist = useComputed(() => sidebarObserverSignals.whitelistGroups.value);
  const searchQuery = useComputed(() => sidebarObserverSignals.searchQuery.value);
  const activeFilter = useComputed(() => sidebarObserverSignals.activeFilter.value);
  const isDrawerOpen = useComputed(() => sidebarObserverSignals.isDrawerOpen.value);
  const telemetry = useComputed(() => sidebarObserverSignals.telemetryStats.value);
  const totalDiscovered = useComputed(() => sidebarObserverSignals.totalDiscovered.value);
  const totalWhitelisted = useComputed(() => sidebarObserverSignals.totalWhitelisted.value);

  useEffect(() => {
    db.app_settings.get('node_config_n01').then((item) => {
      if (item?.value) {
        setConfig({ ...DEFAULT_N01_CONFIG, ...(item.value as Partial<N01Config>) });
      }
    });

    sidebarObserverSignals.initTelemetryListener();
    sidebarObserverSignals.loadWhitelistFromDB().then(() => {
      sidebarObserverSignals.scanGroups().catch(() => {});
    });

    return () => {
      sidebarObserverSignals.disposeTelemetryListener();
    };
  }, []);

  const handleScan = () => {
    sidebarObserverSignals.scanGroups();
  };

  const handleFilterChange = (filter: GroupFilter) => {
    sidebarObserverSignals.setActiveFilter(filter);
  };

  const handleSearchChange = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    sidebarObserverSignals.setSearchQuery(val);
  };

  const handleSaveConfig = async () => {
    await db.app_settings.put({
      key: 'node_config_n01',
      value: config as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    });
    setConfigSaveStatus('Đã lưu cấu hình Node 01 thành công!');
    setTimeout(() => setConfigSaveStatus(null), 3000);
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_N01_CONFIG);
  };

  return (
    <div
      data-testid="sidebar-observer-screen"
      className="flex flex-col h-full bg-white text-gray-900 p-6 space-y-6 border border-gray-200 rounded-xl shadow-xs"
    >
      {/* Header */}
      <header className="border-b border-gray-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500 mt-1">
            Nghiệp Vụ Quan Sát Danh Sách Hội Thoại Zalo (Sidebar) - Bóc tách đột biến DOM Sidebar
            Zalo Web &amp; Đồng bộ Whitelist thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Nút Quét Nhóm */}
          <button
            type="button"
            data-testid="scan-groups-btn"
            disabled={isLoading.value}
            onClick={handleScan}
            className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading.value ? <span>Đang quét...</span> : <span>Quét Nhóm Từ Sidebar</span>}
          </button>

          {/* Nút Mở Whitelist Drawer */}
          <button
            type="button"
            data-testid="toggle-whitelist-drawer-btn"
            onClick={() => sidebarObserverSignals.toggleDrawer(true)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg border border-gray-300 transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>Whitelist</span>
            <span
              data-testid="whitelist-badge-count"
              className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold"
            >
              {totalWhitelisted.value}
            </span>
          </button>
        </div>
      </header>

      {/* Sub-Tab Navigation Bar */}
      <nav className="flex items-center gap-6 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('DISCOVERY')}
          className={`pb-3 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'DISCOVERY'
              ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>🔍</span>
          <span>Khám Phá &amp; Lắng Nghe DOM</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CONFIG')}
          className={`pb-3 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'CONFIG'
              ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>⚙️</span>
          <span>Tham Số Vận Hành</span>
        </button>
      </nav>

      {/* Tab 1: Discovery & Telemetry */}
      {activeTab === 'DISCOVERY' && (
        <>
          {/* Telemetry Status Card */}
          <TelemetryStatusCard
            totalWatchedGroups={totalWhitelisted.value}
            totalDiscoveredGroups={totalDiscovered.value}
            totalProcessed={telemetry.value.totalProcessed}
            totalIgnoredNonWhitelist={telemetry.value.totalIgnoredNonWhitelist}
            isObserving={telemetry.value.isObserving}
            isAttached={telemetry.value.isAttached}
            queueStatus={telemetry.value.queueStatus}
            lastActiveTimestamp={telemetry.value.lastActiveTimestamp}
          />

          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            {/* Search Input */}
            <div className="w-full sm:w-72">
              <input
                type="text"
                data-testid="group-search-input"
                value={searchQuery.value}
                onInput={handleSearchChange}
                placeholder="Tìm theo tên hoặc ID nhóm..."
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                data-testid="filter-all-btn"
                onClick={() => handleFilterChange('ALL')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  activeFilter.value === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                Tất cả ({totalDiscovered.value})
              </button>
              <button
                type="button"
                data-testid="filter-whitelisted-btn"
                onClick={() => handleFilterChange('WHITELISTED')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  activeFilter.value === 'WHITELISTED'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                Đã theo dõi ({whitelist.value.length})
              </button>
              <button
                type="button"
                data-testid="filter-non-whitelisted-btn"
                onClick={() => handleFilterChange('NON_WHITELISTED')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  activeFilter.value === 'NON_WHITELISTED'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                Chưa thêm
              </button>
            </div>
          </div>

          {/* Main Content: Group Discovery List */}
          <main className="flex-1 overflow-y-auto">
            {groups.value.length === 0 ? (
              <div
                data-testid="empty-group-list"
                className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-300 rounded-xl text-center text-gray-500"
              >
                <div className="text-gray-600 text-sm font-medium">Không tìm thấy nhóm nào</div>
                <p className="text-gray-400 text-xs mt-1 max-w-sm">
                  {totalDiscovered.value === 0
                    ? 'Nhấn nút "Quét Nhóm Từ Sidebar" để tải danh sách các cuộc hội thoại trên giao diện Zalo Web.'
                    : 'Không có nhóm nào khớp với bộ lọc tìm kiếm hiện tại.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groups.value.map((group) => (
                  <div
                    key={group.groupId}
                    data-testid={`discovered-card-${group.groupId}`}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                      group.isInWhitelist
                        ? 'bg-blue-50/50 border-blue-200 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 text-gray-700">
                        {group.avatarUrl ? (
                          <img
                            src={group.avatarUrl}
                            alt={group.groupName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-700">
                            {group.groupName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Group Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2
                            className="text-xs font-semibold text-gray-900 truncate"
                            title={group.groupName}
                          >
                            {group.groupName}
                          </h2>
                          {group.isCommunity && (
                            <span
                              className="px-1 py-0.2 text-[9px] bg-purple-50 text-purple-700 rounded border border-purple-200"
                              title="Nhóm cộng đồng"
                            >
                              Cộng đồng
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">
                          {group.groupId}
                        </div>
                        {group.lastSnippet && (
                          <p className="text-[11px] text-gray-500 truncate mt-1 italic">
                            &ldquo;{group.lastSnippet}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        {group.unreadCount > 0 ? (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[10px] font-bold border border-rose-200">
                            {group.unreadCount} tin mới
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">Đã đọc</span>
                        )}
                      </div>

                      <div>
                        {group.isInWhitelist ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-blue-600 font-medium">
                              Đã theo dõi
                            </span>
                            <button
                              type="button"
                              data-testid={`card-remove-btn-${group.groupId}`}
                              onClick={() =>
                                sidebarObserverSignals.removeFromWhitelist(group.groupId)
                              }
                              className="px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            >
                              Gỡ
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            data-testid={`card-add-btn-${group.groupId}`}
                            onClick={() => sidebarObserverSignals.addToWhitelist(group)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer shadow-xs"
                          >
                            + Thêm
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {/* Tab 2: Config Parameters */}
      {activeTab === 'CONFIG' && (
        <div className="space-y-6">
          {configSaveStatus && (
            <div className="p-3 bg-green-50 border border-green-300 text-green-700 rounded-lg text-sm font-medium">
              {configSaveStatus}
            </div>
          )}

          {/* Thông tin nghiệp vụ */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <span>📡</span>
              <span>Nghiệp Vụ Quan Sát Danh Sách Hội Thoại Zalo (Sidebar)</span>
            </div>
            <p>
              Node 01 sử dụng MutationObserver theo dõi container danh sách chat ảo hóa Zalo Web,
              phát hiện hội thoại có tin nhắn mới theo thời gian thực và lọc theo Whitelist.
            </p>
          </div>

          {/* Tham số vận hành */}
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-6">
            <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
              Tham Số Vận Hành MutationObserver
            </h2>

            {/* Debounce */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label
                  htmlFor="n01-debounce"
                  className="block text-sm font-medium text-gray-800 cursor-pointer"
                >
                  Thời gian Debounce (ms)
                </label>
                <p className="text-xs text-gray-500">
                  Gom cụm các đột biến DOM liên tiếp trước khi đẩy nhóm vào hàng chờ (Mặc định:
                  300ms).
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
                className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Monitor Selector */}
            <div className="space-y-2">
              <label htmlFor="n01-selector" className="block text-sm font-medium text-gray-800">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500">
                Bộ chọn DOM trỏ tới container cuộn danh sách hội thoại Zalo Web (hỗ trợ selector dự
                phòng ngăn cách bằng dấu phẩy).
              </p>
            </div>

            {/* Active Scanning Fallback Toggle */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <div className="space-y-1">
                <span className="text-sm font-medium text-gray-800 block">
                  Quét Chủ Động Dự Phòng (Active Polling)
                </span>
                <p className="text-xs text-gray-500">
                  Duyệt định kỳ sidebar đề phòng trường hợp MutationObserver bị Zalo Web ngắt kết
                  nối.
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div>
                  <label
                    htmlFor="n01-scan-interval"
                    className="block text-sm font-medium text-gray-800 cursor-pointer"
                  >
                    Chu kỳ Quét Dự Phòng (ms)
                  </label>
                  <p className="text-xs text-gray-500">
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
                      scanIntervalMs:
                        Number.parseInt((e.target as HTMLInputElement).value, 10) || 5000,
                    })
                  }
                  className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}
          </section>

          {/* Thao Tác Cấu Hình */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetConfig}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Khôi Phục Mặc Định
            </button>
            <button
              type="button"
              onClick={handleSaveConfig}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors cursor-pointer"
            >
              Lưu Cấu Hình
            </button>
          </div>
        </div>
      )}

      {/* Whitelist Drawer */}
      <WhitelistDrawer
        isOpen={isDrawerOpen.value}
        groups={whitelist.value}
        onClose={() => sidebarObserverSignals.toggleDrawer(false)}
        onRemove={(groupId) => sidebarObserverSignals.removeFromWhitelist(groupId)}
        onUpdateRule={(groupId, rule) => sidebarObserverSignals.updateRule(groupId, rule)}
      />
    </div>
  );
};
