export interface PanelPosition {
  x: number;
  y: number;
}

export interface PanelStorageState {
  x: number;
  y: number;
  isCollapsed: boolean;
}

const STORAGE_KEY = 'zalo_floating_panel_state';
const VIEWPORT_PADDING = 16;

/**
 * Giới hạn vị trí panel luôn nằm trong khung nhìn viewport
 */
export function clampPosition(
  x: number,
  y: number,
  elementWidth = 240,
  elementHeight = 160,
  padding: number = VIEWPORT_PADDING,
  windowWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1920,
  windowHeight: number = typeof window !== 'undefined' ? window.innerHeight : 1080,
): PanelPosition {
  const minX = padding;
  const maxX = Math.max(padding, windowWidth - elementWidth - padding);
  const minY = padding;
  const maxY = Math.max(padding, windowHeight - elementHeight - padding);

  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  };
}

/**
 * Tải trạng thái và vị trí đã lưu từ localStorage
 */
export function loadPanelState(): PanelStorageState | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.x === 'number' &&
      typeof parsed?.y === 'number' &&
      typeof parsed?.isCollapsed === 'boolean'
    ) {
      return {
        x: parsed.x,
        y: parsed.y,
        isCollapsed: parsed.isCollapsed,
      };
    }
  } catch {
    // Dự phòng lỗi parse hoặc security restriction
  }
  return null;
}

/**
 * Lưu trạng thái và vị trí vào localStorage
 */
export function savePanelState(state: PanelStorageState): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Xử lý fail-safe khi storage quota full hoặc blocked
  }
}
