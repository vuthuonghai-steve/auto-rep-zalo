/**
 * Badge Extractor Utility for Node 01: Sidebar Observer
 * Trích xuất huy hiệu số lượng tin chưa đọc (Unread Badge / Dot) từ DOM Sidebar Zalo.
 * Pure function: zero side-effects.
 */

export interface UnreadBadgeResult {
  unreadCount: number;
  isDot: boolean;
  hasUnread: boolean;
}

export const ZERO_UNREAD_RESULT: Readonly<UnreadBadgeResult> = Object.freeze({
  unreadCount: 0,
  isDot: false,
  hasUnread: false,
});

/**
 * Danh sách mẫu nhận diện Zalo Font Icon classes và số lượng tương ứng
 */
const ZALO_ICON_COUNT_MAP: ReadonlyArray<{ readonly pattern: RegExp; readonly count: number }> = [
  { pattern: /\bfa-5_Plus(?:_\d+)?(?:_Line)?\b/, count: 5 },
  { pattern: /\bfa-4(?:_\d+)?(?:_Line)?\b/, count: 4 },
  { pattern: /\bfa-3(?:_\d+)?(?:_Line)?\b/, count: 3 },
  { pattern: /\bfa-2(?:_\d+)?(?:_Line)?\b/, count: 2 },
  { pattern: /\bfa-1(?:_\d+)?(?:_Line)?\b/, count: 1 },
];

/**
 * Trích xuất thông tin badge chưa đọc từ container hoặc badge element của hội thoại Zalo.
 *
 * @param container - Element chứa badge hoặc chính element badge (Element | null | undefined)
 * @returns {UnreadBadgeResult} Thông tin unreadCount, isDot, hasUnread
 */
export function extractUnreadBadge(container: Element | null | undefined): UnreadBadgeResult {
  if (!container) {
    return { ...ZERO_UNREAD_RESULT };
  }

  // 1. Thu thập ứng viên phần tử có thể chứa Font Icon hoặc Dot hoặc Text Badge
  const badgeSelector =
    '.conv-action__unread-v2, .z-noti-badge, .--dot, .unread-badge, .unread-red-dot, [data-translate-inner*="unread"]';

  const badgeElement =
    (container.matches?.(badgeSelector) ? container : null) ||
    container.querySelector?.(badgeSelector) ||
    container;

  // 2. Tìm kiếm Zalo Font Icon classes (fa-1_24_Line đến fa-5_Plus_24_Line)
  const iconCandidates: Element[] = [];
  if (typeof container.className === 'string' && container.className.length > 0) {
    iconCandidates.push(container);
  }
  if (container.querySelectorAll) {
    const iconEls = container.querySelectorAll('[class*="fa-"]');
    for (let i = 0; i < iconEls.length; i++) {
      const el = iconEls[i];
      if (el) iconCandidates.push(el);
    }
  }

  for (const candidate of iconCandidates) {
    const cls = typeof candidate.className === 'string' ? candidate.className : '';
    for (const { pattern, count } of ZALO_ICON_COUNT_MAP) {
      if (pattern.test(cls)) {
        return {
          unreadCount: count,
          isDot: false,
          hasUnread: true,
        };
      }
    }
  }

  // 3. Phát hiện chấm đỏ tắt chuông (--dot hoặc unread-red-dot)
  const isDotBadge =
    container.classList?.contains('--dot') ||
    container.classList?.contains('unread-red-dot') ||
    container.querySelector?.('.--dot, .unread-red-dot') !== null;

  if (isDotBadge) {
    return {
      unreadCount: 1,
      isDot: true,
      hasUnread: true,
    };
  }

  // 4. Fallback trích xuất văn bản (nếu Zalo dùng số text thuần túy trong badge)
  const targetForText = badgeElement !== container ? badgeElement : container;
  const rawText = targetForText.textContent?.trim() || '';

  // Chỉ chấp nhận chuỗi đại diện cho số lượng (ví dụ: "3", "99+", "+5")
  if (/^\+?\d+\+?$/.test(rawText)) {
    const parsed = Number.parseInt(rawText.replace(/\+/g, ''), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return {
        unreadCount: parsed,
        isDot: false,
        hasUnread: true,
      };
    }
  }

  return { ...ZERO_UNREAD_RESULT };
}

/**
 * Tiện ích lấy trực tiếp số lượng tin nhắn chưa đọc dạng số nguyên.
 */
export function extractUnreadBadgeCount(container: Element | null | undefined): number {
  return extractUnreadBadge(container).unreadCount;
}
