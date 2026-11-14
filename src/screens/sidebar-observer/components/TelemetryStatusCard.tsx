import type { FunctionalComponent } from 'preact';
import type { TelemetryStatusCardProps } from '../sidebar-observer.types';

/**
 * Pure Presentational Component (Layer 2)
 * Component: TelemetryStatusCard
 *
 * Quy tắc:
 * 1. Chỉ nhận props và hiển thị thông tin viễn trắc.
 * 2. Không chứa side-effect ngầm hoặc gọi storage trực tiếp.
 */
export const TelemetryStatusCard: FunctionalComponent<TelemetryStatusCardProps> = ({
  totalWatchedGroups,
  totalDiscoveredGroups = 0,
  totalProcessed = 0,
  totalIgnoredNonWhitelist = 0,
  isObserving = false,
  isAttached = false,
  queueStatus = 'IDLE',
}) => {
  const getQueueBadge = () => {
    switch (queueStatus) {
      case 'PROCESSING':
        return {
          text: 'Đang xử lý (PROCESSING)',
          className: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
        };
      case 'DRAINED':
        return {
          text: 'Đã hoàn tất (DRAINED)',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      default:
        return {
          text: 'Trực chờ (IDLE)',
          className: 'bg-gray-100 text-gray-600 border-gray-200',
        };
    }
  };

  const queueBadgeInfo = getQueueBadge();

  return (
    <div
      data-testid="telemetry-status-card"
      className="p-4 bg-slate-50 border border-gray-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 shadow-xs"
    >
      {/* Cột 1: Nhóm Whitelist */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-500">Đang theo dõi</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span data-testid="stat-watched-groups" className="text-xl font-bold text-blue-600">
            {totalWatchedGroups}
          </span>
          <span className="text-xs text-gray-400">nhóm</span>
        </div>
      </div>

      {/* Cột 2: Nhóm phát hiện trên DOM */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-500">Khám phá DOM</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span data-testid="stat-discovered-groups" className="text-xl font-bold text-gray-800">
            {totalDiscoveredGroups}
          </span>
          <span className="text-xs text-gray-400">nhóm</span>
        </div>
      </div>

      {/* Cột 3: Tin nhắn đã bóc tách */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-500">Tin nhắn nhận</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span
            data-testid="stat-processed-messages"
            className="text-xl font-bold text-emerald-600"
          >
            {totalProcessed}
          </span>
          <span className="text-xs text-gray-400">tin</span>
        </div>
      </div>

      {/* Cột 4: Trạng thái Observer & Hàng đợi */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">Trạng thái</span>
          <span
            data-testid="stat-queue-status"
            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${queueBadgeInfo.className}`}
          >
            {queueBadgeInfo.text}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isObserving
                ? isAttached
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500 animate-ping'
                : 'bg-gray-300'
            }`}
          />
          <span
            data-testid="stat-observer-status"
            className={`text-xs font-medium ${isObserving ? (isAttached ? 'text-emerald-600' : 'text-amber-600') : 'text-gray-500'}`}
          >
            {isObserving ? (isAttached ? 'Đang quan sát' : 'Đang kết nối lại...') : 'Trực chờ'}
          </span>
          <span
            data-testid="stat-attached-status"
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              isAttached
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {isAttached ? 'Gắn kết' : 'Mất kết nối'}
          </span>
          {totalIgnoredNonWhitelist > 0 && (
            <span
              className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium"
              title={`Đã bỏ qua ${totalIgnoredNonWhitelist} tin ngoài whitelist`}
            >
              -{totalIgnoredNonWhitelist}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
