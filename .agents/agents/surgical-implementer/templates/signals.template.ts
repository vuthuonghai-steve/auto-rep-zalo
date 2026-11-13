import { signal, computed } from '@preact/signals';
import type { {{ModuleName}}State } from './{{moduleName}}.types';

/**
 * Reactive Signal Store (Layer 2)
 * Phục vụ riêng cho Screen {{ModuleName}}
 */
const loading = signal<boolean>(false);
const data = signal<{{ModuleName}}State[]>([]);
const filter = signal<string>('');

const filteredData = computed(() => {
  const currentFilter = filter.value.toLowerCase().trim();
  if (!currentFilter) return data.value;
  return data.value.filter((item) => item.label.toLowerCase().includes(currentFilter));
});

export const {{moduleName}}Signals = {
  loading,
  data,
  filter,
  filteredData,

  // Actions
  setLoading: (state: boolean) => {
    loading.value = state;
  },
  setData: (items: {{ModuleName}}State[]) => {
    data.value = items;
  },
  setFilter: (query: string) => {
    filter.value = query;
  },
  reset: () => {
    loading.value = false;
    data.value = [];
    filter.value = '';
  },
};

