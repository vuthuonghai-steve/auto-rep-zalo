import type { WhitelistMatchingRule } from '@/contracts/schemas';
import type { FunctionalComponent } from 'preact';
import type { WhitelistDrawerProps } from '../sidebar-observer.types';

/**
 * Pure Presentational Component (Layer 2)
 * Component: WhitelistDrawer
 *
 * Quy tắc:
 * 1. Chỉ nhận props và emit events.
 * 2. Không chứa side-effect ngầm hoặc gọi storage trực tiếp.
 */
export const WhitelistDrawer: FunctionalComponent<WhitelistDrawerProps> = ({
  isOpen,
  groups,
  onClose,
  onRemove,
  onUpdateRule,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="presentation"
      data-testid="whitelist-drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div
        data-testid="whitelist-drawer-content"
        className="w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full text-slate-100 animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <h2 className="text-base font-semibold text-white">Quản Lý Danh Sách Whitelist</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Đang theo dõi {groups.length} nhóm được cấp phép
            </p>
          </div>
          <button
            type="button"
            data-testid="close-drawer-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Đóng panel"
          >
            <span className="text-lg leading-none font-bold">&times;</span>
          </button>
        </div>

        {/* Drawer Body - List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {groups.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <p>Chưa có nhóm nào trong Whitelist.</p>
              <p className="text-xs mt-1 text-slate-600">
                Hãy dùng nút "+ Thêm" từ danh sách khám phá để theo dõi nhóm.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.groupId}
                data-testid={`whitelist-item-${group.groupId}`}
                className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-lg flex flex-col gap-2 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate" title={group.groupName}>
                      {group.groupName}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                      ID: {group.groupId}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`remove-whitelist-btn-${group.groupId}`}
                    onClick={() => onRemove(group.groupId)}
                    className="px-2 py-1 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded cursor-pointer transition-colors"
                    title="Gỡ khỏi Whitelist"
                  >
                    Gỡ bỏ
                  </button>
                </div>

                {/* Cấu hình Matching Rule: EXACT / CONTAINS */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-750">
                  <span className="text-[11px]">Quy tắc so khớp:</span>
                  <select
                    data-testid={`rule-select-${group.groupId}`}
                    value={group.matchingRule}
                    onChange={(e) =>
                      onUpdateRule(
                        group.groupId,
                        (e.target as HTMLSelectElement).value as WhitelistMatchingRule,
                      )
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
                  >
                    <option value="EXACT">EXACT (Khớp tuyệt đối)</option>
                    <option value="CONTAINS">CONTAINS (Chứa chuỗi)</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
