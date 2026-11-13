export interface SelectorDefinition {
  name: string;
  tier1_semantic: string; // data-id, data-translate-inner, role
  tier2_hierarchy: string; // DOM hierarchy or text container
  tier3_class: string; // CSS class / ID fallback
}

export const UNREAD_BADGE_ICON_CLASSES = [
  'fa-1_24_Line',
  'fa-2_24_Line',
  'fa-3_24_Line',
  'fa-4_24_Line',
  'fa-5_Plus_24_Line',
  '--dot',
] as const;

export type UnreadBadgeIconClass = (typeof UNREAD_BADGE_ICON_CLASSES)[number];

export const SELECTORS = {
  SIDEBAR_CONVERSATIONS: {
    name: 'SIDEBAR_CONVERSATIONS',
    tier1_semantic:
      '#conversationListId[data-id="div_TabMsg_ThrdChList"], #conversationList[role="grid"], [data-id="div_TabMsg_ThrdChList"], [data-id="conversation-list"]',
    tier2_hierarchy:
      '#conversationListId #conversationList, div.virtualized-scroll #conversationList, nav div[tabindex="0"]',
    tier3_class: '#conversationList, #conversationListId, .virtualized-scroll',
  },
  SIDEBAR_ITEM: {
    name: 'SIDEBAR_ITEM',
    tier1_semantic:
      'div.msg-item[data-id="div_TabMsg_ThrdChItem"][anim-data-id^="g"], div.msg-item[data-id="div_TabMsg_ThrdChItem"], [data-id="div_TabMsg_ThrdChItem"], [anim-data-id^="g"], [data-id^="conv-"]',
    tier2_hierarchy: '#conversationList .msg-item, #conversationList .conv-item, nav .conv-item',
    tier3_class: '.conv-item, .msg-item',
  },
  SIDEBAR_ITEM_AVATAR: {
    name: 'SIDEBAR_ITEM_AVATAR',
    tier1_semantic: 'img[data-ava-uid^="g"]',
    tier2_hierarchy:
      '.conv-item__avatar img, .conversationList__avatar img, .conv-item .conv-avatar img, .conv-item .conv-avatar',
    tier3_class: '.conversationList__avatar img, .conv-avatar, .grd-ava img',
  },
  SIDEBAR_ITEM_TITLE: {
    name: 'SIDEBAR_ITEM_TITLE',
    tier1_semantic:
      'div-b16.conv-item-title__name.truncate.grid-item > div.truncate, div-b16.conv-item-title__name .truncate, .conv-name',
    tier2_hierarchy:
      '.conv-item-title__name > div.truncate, .conv-item-title__name .truncate, .conv-info .conv-name',
    tier3_class: '.conv-item-title__name, .conv-name',
  },
  SIDEBAR_COMMUNITY_ICON: {
    name: 'SIDEBAR_COMMUNITY_ICON',
    tier1_semantic:
      'i.fa-Community_16_Filled.community__conv-indicator, i.community__conv-indicator',
    tier2_hierarchy:
      '.conv-item-title__name i.community__conv-indicator, .conv-item i[class*="Community"]',
    tier3_class: '.community__conv-indicator, .fa-Community_16_Filled',
  },
  UNREAD_BADGE_CONTAINER: {
    name: 'UNREAD_BADGE_CONTAINER',
    tier1_semantic:
      'div.conv-item-body__action > div.conv-action__unread-v2, div.conv-item-body__action .conv-action__unread-v2',
    tier2_hierarchy:
      '.conv-item .conv-item-body__action, .conv-item .conv-action__unread-v2, .conv-item .unread-badge, .conv-item .unread-red-dot',
    tier3_class: '.conv-action__unread-v2, .conv-item-body__action, .unread-badge, .unread-red-dot',
  },
  UNREAD_BADGE: {
    name: 'UNREAD_BADGE',
    tier1_semantic:
      '.conv-action__unread-v2 .z-noti-badge, .z-noti-badge, [data-translate-inner*="unread"]',
    tier2_hierarchy:
      '.conv-action__unread-v2 .z-noti-badge, .conv-item .unread-badge, .conv-item .unread-red-dot',
    tier3_class: '.z-noti-badge, .unread-badge, .unread-red-dot',
  },
  PREVIEW_MESSAGE: {
    name: 'PREVIEW_MESSAGE',
    tier1_semantic:
      '.z-conv-message__preview-message .inline, .z-conv-message .inline, .conv-last-msg',
    tier2_hierarchy:
      '.conv-item-body .z-conv-message__preview-message, .conv-item-body .z-conv-message, .conv-info .conv-last-msg',
    tier3_class: '.z-conv-message__preview-message, .conv-last-msg',
  },
  PREVIEW_SENDER: {
    name: 'PREVIEW_SENDER',
    tier1_semantic: '.z-conv-message__preview-sender-name',
    tier2_hierarchy:
      '.z-conv-message .z-conv-message__preview-sender-name, .conv-item-body .z-conv-message__preview-sender-name, .msg-sender',
    tier3_class: '.z-conv-message__preview-sender-name, .msg-sender',
  },
  CHAT_MESSAGE_CONTAINER: {
    name: 'CHAT_MESSAGE_CONTAINER',
    tier1_semantic: '[data-id="message-view-list"], #messageViewContainer[class*="message-view"]',
    tier2_hierarchy: 'div[role="main"] div[data-scroll="true"], #messageView #messageViewContainer',
    tier3_class: '.chat-message-list, #messageViewContainer, .message-view__scroll',
  },
  CHAT_INPUT_BOX: {
    name: 'CHAT_INPUT_BOX',
    tier1_semantic: '[data-id="chat-input-content"]',
    tier2_hierarchy: 'footer div[contenteditable="true"]',
    tier3_class: '#chat-input-text',
  },
  JUMP_TO_NEWEST: {
    name: 'JUMP_TO_NEWEST',
    tier1_semantic: '[aria-label="Jump to 0 newest messages"], [aria-label*="newest messages"]',
    tier2_hierarchy:
      '.bottom-nav-floating-container .new-messages-container, .bottom-nav-floating-container [aria-label*="newest messages"]',
    tier3_class: '.new-messages-container, .bottom-nav-floating-container',
  },
  LOCK_SEND_MESSAGE: {
    name: 'LOCK_SEND_MESSAGE',
    tier1_semantic:
      '[data-translate-inner*="STR_LOCK_SEND_MESSAGE"], [data-translate-inner*="STR_COMMUNITY_LOCK_SEND_MESSAGE"]',
    tier2_hierarchy:
      '.lockSendMessageBox .lockSendMessageBox--hightlight, .lockSendMessageBox .message',
    tier3_class: '.lockSendMessageBox, .lockSendMessageBox--hightlight',
  },
  ALBUM_CONTAINER: {
    name: 'ALBUM_CONTAINER',
    tier1_semantic: '[data-id="div_ReceivedMsg_GrpPhoto"]',
    tier2_hierarchy:
      '#album-container .card--group-photo, .msg-card .album-container, #album-container',
    tier3_class: '#album-container, .card--group-photo, .album-container',
  },
  ALBUM_ITEM_PHOTO: {
    name: 'ALBUM_ITEM_PHOTO',
    tier1_semantic:
      '.album__item[data-component="photo"], [data-component="photo"], img.zimg-el[data-z-element-type="image"]',
    tier2_hierarchy:
      '#album-container .card--group-photo, .album .album__item, .album-container .album-item',
    tier3_class: '.album__item, img.zimg-el, .card--group-photo__row__item, .album-item',
  },
  FORWARD_MODAL: {
    name: 'FORWARD_MODAL',
    tier1_semantic: '[role="dialog"][aria-label*="Chia sẻ"]',
    tier2_hierarchy: 'div.modal-container:has-text("Chia sẻ")',
    tier3_class: '.forward-dialog',
  },
  TOAST_SUCCESS: {
    name: 'TOAST_SUCCESS',
    tier1_semantic: '[data-translate-inner="STR_SHARED_SUCCESS"]',
    tier2_hierarchy: 'div[role="status"]:has-text("Đã chia sẻ")',
    tier3_class: '.toast-success',
  },
  CAPTCHA_MODAL: {
    name: 'CAPTCHA_MODAL',
    tier1_semantic: '[role="dialog"][aria-label*="Xác minh"]',
    tier2_hierarchy: 'div.modal-container:has-text("Xác minh bảo mật")',
    tier3_class: '.captcha-modal',
  },
} as const;

export type SelectorKey = keyof typeof SELECTORS;

export interface ResolvedSelectorResult {
  element: HTMLElement | null;
  matchedTier: 1 | 2 | 3 | null;
}

/**
 * Thực hiện tìm phần tử theo selector có hỗ trợ cú pháp giả lập :has-text("...")
 */
function querySelectorWithFallback(root: ParentNode, selector: string): HTMLElement | null {
  if (selector.includes(':has-text(')) {
    const hasTextMatch = selector.match(/^(.*?):has-text\(["'](.*?)["']\)$/);
    if (hasTextMatch) {
      const baseSelector = hasTextMatch[1]?.trim() || '*';
      const searchText = hasTextMatch[2] || '';
      try {
        const candidates = root.querySelectorAll<HTMLElement>(baseSelector);
        for (const candidate of candidates) {
          if (candidate.textContent?.includes(searchText)) {
            return candidate;
          }
        }
      } catch {
        return null;
      }
      return null;
    }
  }

  try {
    return root.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

/**
 * Bộ giải quyết DOM Selector 3 tầng Fallback:
 * Tier 1 (Semantic attributes) -> Tier 2 (DOM hierarchy / text) -> Tier 3 (Class / ID cụ thể).
 */
export function resolveSelector(
  selectorDef: SelectorDefinition,
  root: ParentNode = typeof document !== 'undefined' ? document : (null as unknown as ParentNode),
): ResolvedSelectorResult {
  if (!root) {
    return { element: null, matchedTier: null };
  }

  // Tier 1: Semantic data-id / role / translate
  if (selectorDef.tier1_semantic) {
    const el1 = querySelectorWithFallback(root, selectorDef.tier1_semantic);
    if (el1) {
      return { element: el1, matchedTier: 1 };
    }
  }

  // Tier 2: DOM hierarchy + text
  if (selectorDef.tier2_hierarchy) {
    const el2 = querySelectorWithFallback(root, selectorDef.tier2_hierarchy);
    if (el2) {
      return { element: el2, matchedTier: 2 };
    }
  }

  // Tier 3: Class / ID fallback
  if (selectorDef.tier3_class) {
    const el3 = querySelectorWithFallback(root, selectorDef.tier3_class);
    if (el3) {
      return { element: el3, matchedTier: 3 };
    }
  }

  return { element: null, matchedTier: null };
}

/**
 * Tiện ích lấy trực tiếp HTMLElement hoặc null
 */
export function resolveElement(
  selectorDef: SelectorDefinition,
  root?: ParentNode,
): HTMLElement | null {
  return resolveSelector(selectorDef, root).element;
}

/**
 * Chạy chẩn đoán toàn diện sức khỏe các Selectors trên DOM hiện hành.
 */
export function runSelectorDiagnostic(
  root?: ParentNode,
): Record<string, { matchedTier: 1 | 2 | 3 | null; healthy: boolean }> {
  const diagnostic: Record<string, { matchedTier: 1 | 2 | 3 | null; healthy: boolean }> = {};

  for (const [key, def] of Object.entries(SELECTORS)) {
    const res = resolveSelector(def, root);
    diagnostic[key] = {
      matchedTier: res.matchedTier,
      healthy: res.element !== null,
    };
  }

  return diagnostic;
}

export const SelectorHealthChecker = {
  check(root?: ParentNode) {
    return runSelectorDiagnostic(root);
  },

  isElementHealthy(name: SelectorKey, root?: ParentNode): boolean {
    const def = SELECTORS[name];
    if (!def) return false;
    return resolveSelector(def, root).element !== null;
  },

  isCaptchaPresent(root?: ParentNode): boolean {
    const el = resolveSelector(SELECTORS.CAPTCHA_MODAL, root).element;
    if (!el) return false;
    // Captcha modal chỉ được tính là đang xuất hiện khi không bị ẩn
    return (
      el.style.display !== 'none' && !el.hasAttribute('hidden') && !el.classList.contains('hidden')
    );
  },

  isChatLocked(root?: ParentNode): boolean {
    const el = resolveSelector(SELECTORS.LOCK_SEND_MESSAGE, root).element;
    if (!el) return false;
    const box = el.closest<HTMLElement>('.lockSendMessageBox') || el;
    return (
      box.style.display !== 'none' &&
      !box.hasAttribute('hidden') &&
      !box.classList.contains('hidden')
    );
  },

  hasJumpToNewest(root?: ParentNode): boolean {
    const el = resolveSelector(SELECTORS.JUMP_TO_NEWEST, root).element;
    if (!el) return false;
    const container = el.closest<HTMLElement>('.bottom-nav-floating-container') || el;
    return (
      container.style.display !== 'none' &&
      !container.hasAttribute('hidden') &&
      !container.classList.contains('hidden')
    );
  },
};

/**
 * Trích xuất số lượng tin nhắn chưa đọc từ element huy hiệu (badge),
 * hỗ trợ giải mã Font Icon Zalo (fa-1_24_Line -> fa-5_Plus_24_Line) và class --dot.
 */
export function extractUnreadBadgeCount(badgeElement: Element | null): {
  unreadCount: number;
  isDot: boolean;
} {
  if (!badgeElement) return { unreadCount: 0, isDot: false };

  // Trường hợp 1: Chấm đỏ không có số (Dot badge cho nhóm tắt chuông)
  if (
    badgeElement.classList.contains('--dot') ||
    badgeElement.classList.contains('unread-red-dot')
  ) {
    return { unreadCount: 1, isDot: true };
  }

  // Trường hợp 2: Huy hiệu đếm số (--counter hoặc fallback class / text)
  if (
    badgeElement.classList.contains('--counter') ||
    badgeElement.classList.contains('unread-badge') ||
    badgeElement.classList.contains('z-noti-badge')
  ) {
    const iconChild = badgeElement.querySelector('i[class*="fa-"]');
    if (iconChild) {
      const classList = iconChild.className;
      if (classList.includes('fa-5_Plus_24_Line')) return { unreadCount: 5, isDot: false };
      if (classList.includes('fa-4_24_Line')) return { unreadCount: 4, isDot: false };
      if (classList.includes('fa-3_24_Line')) return { unreadCount: 3, isDot: false };
      if (classList.includes('fa-2_24_Line')) return { unreadCount: 2, isDot: false };
      if (classList.includes('fa-1_24_Line')) return { unreadCount: 1, isDot: false };
    }
    // Fallback: nếu Zalo cập nhật render số trực tiếp dạng text
    const textVal = Number.parseInt(badgeElement.textContent?.trim() || '0', 10);
    if (!Number.isNaN(textVal) && textVal > 0) return { unreadCount: textVal, isDot: false };

    return { unreadCount: 1, isDot: false };
  }

  return { unreadCount: 0, isDot: false };
}
