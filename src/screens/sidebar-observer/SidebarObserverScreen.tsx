import { useComputed } from '@preact/signals';
import type { FunctionalComponent } from 'preact';
import { TelemetryStatusCard } from './components/TelemetryStatusCard';
import { WhitelistDrawer } from './components/WhitelistDrawer';
import { sidebarObserverSignals } from './sidebar-observer.signals';
import type { GroupFilter, SidebarObserverScreenProps } from './sidebar-observer.types';

/**
 * Screen View Container (Layer 1 Flat Pattern)
 * Screen: SidebarObserverScreen
 *
 * Quy chuẩn:
 * 1. Chỉ đóng vai trò layout và kết nối signals.
 * 2. Tách UI components con vào thư mục `components/` đồng cấp.
 * 3. Không gọi trực tiếp chrome.* raw APIs tại đây.
 */
export const SidebarObserverScreen: FunctionalComponent<SidebarObserverScreenProps> = ({
  title = 'Node 01: Sidebar Observer & Khám Phá Nhóm',
}) => {
  const isLoading = useComputed(() => sidebarObserverSignals.isLoading.value);
  const groups = useComputed(() => sidebarObserverSignals.filteredGroups.value);
  const whitelist = useComputed(() => sidebarObserverSignals.whitelistGroups.value);
  const searchQuery = useComputed(() => sidebarObserverSignals.searchQuery.value);
  const activeFilter = useComputed(() => sidebarObserverSignals.activeFilter.value);
  const isDrawerOpen = useComputed(() => sidebarObserverSignals.isDrawerOpen.value);
  const telemetry = useComputed(() => sidebarObserverSignals.telemetryStats.value);
  const totalDiscovered = useComputed(() => sidebarObserverSignals.totalDiscovered.value);
  const totalWhitelisted = useComputed(() => sidebarObserverSignals.totalWhitelisted.value);

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

  return (
    <div
      data-testid="sidebar-observer-screen"
      className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 space-y-6"
    >
      {/* Header */}
      <header className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Bóc tách đột biến DOM Sidebar Zalo Web & Đồng bộ Whitelist thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Nút Quét Nhóm */}
          <button
            type="button"
            data-testid="scan-groups-btn"
            disabled={isLoading.value}
            onClick={handleScan}
            className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading.value ? (
              <span>Đang quét...</span>
            ) : (
              <>
                <span>Quét Nhóm Từ Sidebar</span>
              </>
            )}
          </button>

          {/* Nút Mở Whitelist Drawer */}
          <button
            type="button"
            data-testid="toggle-whitelist-drawer-btn"
            onClick={() => sidebarObserverSignals.toggleDrawer(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-lg border border-slate-700/80 transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>Whitelist</span>
            <span
              data-testid="whitelist-badge-count"
              className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-bold"
            >
              {totalWhitelisted.value}
            </span>
          </button>
        </div>
      </header>

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
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-850 p-3 rounded-lg border border-slate-800">
        {/* Search Input */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            data-testid="group-search-input"
            value={searchQuery.value}
            onInput={handleSearchChange}
            placeholder="Tìm theo tên hoặc ID nhóm..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
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
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
            className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-800 rounded-xl text-center"
          >
            <div className="text-slate-500 text-sm font-medium">Không tìm thấy nhóm nào</div>
            <p className="text-slate-600 text-xs mt-1 max-w-sm">
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
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  group.isInWhitelist
                    ? 'bg-blue-950/20 border-blue-600/40'
                    : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden border border-slate-600">
                    {group.avatarUrl ? (
                      <img
                        src={group.avatarUrl}
                        alt={group.groupName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-300">
                        {group.groupName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Group Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2
                        className="text-xs font-semibold text-white truncate"
                        title={group.groupName}
                      >
                        {group.groupName}
                      </h2>
                      {group.isCommunity && (
                        <span
                          className="px-1 py-0.2 text-[9px] bg-purple-500/20 text-purple-300 rounded border border-purple-500/30"
                          title="Nhóm cộng đồng"
                        >
                          Cộng đồng
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      {group.groupId}
                    </div>
                    {group.lastSnippet && (
                      <p className="text-[11px] text-slate-400 truncate mt-1 italic">
                        &ldquo;{group.lastSnippet}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer: Action */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-750/60">
                  <div>
                    {group.unreadCount > 0 ? (
                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-full text-[10px] font-bold">
                        {group.unreadCount} tin mới
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Đã đọc</span>
                    )}
                  </div>

                  <div>
                    {group.isInWhitelist ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-blue-400 font-medium">Đã theo dõi</span>
                        <button
                          type="button"
                          data-testid={`card-remove-btn-${group.groupId}`}
                          onClick={() => sidebarObserverSignals.removeFromWhitelist(group.groupId)}
                          className="px-2 py-0.5 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                        >
                          Gỡ
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid={`card-add-btn-${group.groupId}`}
                        onClick={() => sidebarObserverSignals.addToWhitelist(group)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer shadow-xs"
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
