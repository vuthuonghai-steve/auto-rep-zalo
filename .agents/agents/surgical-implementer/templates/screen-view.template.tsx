import { FunctionalComponent } from 'preact';
import { useComputed } from '@preact/signals';
import { {{moduleName}}Signals } from './{{moduleName}}.signals';
import type { {{ModuleName}}Props } from './{{moduleName}}.types';

/**
 * Screen View Container (Layer 1 Flat Pattern)
 * Quy chuẩn:
 * 1. Chỉ đóng vai trò layout và kết nối signals.
 * 2. Tách UI components con vào thư mục `components/` đồng cấp.
 * 3. Không gọi trực tiếp chrome.* raw APIs tại đây.
 */
export const {{ModuleName}}Screen: FunctionalComponent<{{ModuleName}}Props> = ({ title }) => {
  const isLoading = useComputed(() => {{moduleName}}Signals.loading.value);
  const data = useComputed(() => {{moduleName}}Signals.data.value);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 space-y-6">
      <header className="border-b border-slate-800 pb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        {isLoading.value && (
          <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">
            Đang đồng bộ...
          </span>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* Render child components từ ./components/ */}
      </main>
    </div>
  );
};

