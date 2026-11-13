import { FunctionalComponent } from 'preact';

export interface {{ComponentName}}Props {
  id: string;
  label: string;
  isActive?: boolean;
  onSelect?: (id: string) => void;
}

/**
 * Pure Presentational Component (Layer 2)
 * Quy tắc:
 * 1. Chỉ nhận props và emit events.
 * 2. Không chứa side-effect ngầm hoặc gọi storage trực tiếp.
 */
export const {{ComponentName}}: FunctionalComponent<{{ComponentName}}Props> = ({
  id,
  label,
  isActive = false,
  onSelect,
}) => {
  return (
    <div
      onClick={() => onSelect?.(id)}
      className={`p-4 rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
          : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:border-slate-600'
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
};

