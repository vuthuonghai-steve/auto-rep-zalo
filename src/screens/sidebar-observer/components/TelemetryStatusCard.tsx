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
}) => {
  return (
    <div
      data-testid="telemetry-status-card"
      className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4"
    >
      {/* Cột 1: Nhóm Whitelist */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-slate-400">Đang theo dõi</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span data-testid="stat-watched-groups" className="text-xl font-bold text-blue-400">
            {totalWatchedGroups}
          </span>
          <span className="text-xs text-slate-500">nhóm</span>
        </div>
      </div>

      {/* Cột 2: Nhóm phát hiện trên DOM */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-slate-400">Khám phá DOM</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span data-testid="stat-discovered-groups" className="text-xl font-bold text-slate-200">
            {totalDiscoveredGroups}
          </span>
          <span className="text-xs text-slate-500">nhóm</span>
        </div>
      </div>

      {/* Cột 3: Tin nhắn đã bóc tách */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-slate-400">Tin nhắn nhận</span>
        <div className="flex items-baseline gap-1 mt-1">
          <span
            data-testid="stat-processed-messages"
            className="text-xl font-bold text-emerald-400"
          >
            {totalProcessed}
          </span>
          <span className="text-xs text-slate-500">tin</span>
        </div>
      </div>

      {/* Cột 4: Trạng thái Observer */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-slate-400">Trạng thái</span>
        <div className="flex items-center gap-2 mt-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isObserving ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span
            data-testid="stat-observer-status"
            className={`text-xs font-medium ${isObserving ? 'text-emerald-400' : 'text-slate-400'}`}
          >
            {isObserving ? 'Đang quan sát' : 'Trực chờ'}
          </span>
          {totalIgnoredNonWhitelist > 0 && (
            <span
              className="text-[10px] text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20"
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
