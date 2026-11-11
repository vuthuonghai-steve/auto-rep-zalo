export interface SelectorDefinition {
  name: string;
  tier1_semantic: string; // data-id, data-translate-inner, role
  tier2_hierarchy: string; // DOM hierarchy or text container
  tier3_class: string; // CSS class / ID fallback
}

export const SELECTORS = {
  SIDEBAR_CONVERSATIONS: {
    name: 'SIDEBAR_CONVERSATIONS',
    tier1_semantic:
      '[data-id="div_TabMsg_ThrdChList"], [data-id="conversation-list"], #conversationListId, #conversationList[role="grid"]',
    tier2_hierarchy:
      'nav div[tabindex="0"], #conversationListId #conversationList, div.virtualized-scroll #conversationList',
    tier3_class: '#conversationList, #conversationListId, .virtualized-scroll',
  },
  SIDEBAR_ITEM: {
    name: 'SIDEBAR_ITEM',
    tier1_semantic: '[data-id="div_TabMsg_ThrdChItem"], [anim-data-id^="g"], [data-id^="conv-"]',
    tier2_hierarchy: '#conversationList .msg-item, #conversationList .conv-item, nav .conv-item',
    tier3_class: '.conv-item, .msg-item',
  },
  UNREAD_BADGE: {
    name: 'UNREAD_BADGE',
    tier1_semantic: '.z-conv-message.--unread, [data-translate-inner*="unread"]',
    tier2_hierarchy:
      '.conv-action__unread-v2 .z-noti-badge, .conv-item .unread-badge, .conv-item .unread-red-dot',
    tier3_class: '.z-noti-badge, .unread-badge, .unread-red-dot',
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
