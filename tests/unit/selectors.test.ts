import fs from 'node:fs';
import path from 'node:path';
import {
  SELECTORS,
  SelectorHealthChecker,
  UNREAD_BADGE_ICON_CLASSES,
  extractUnreadBadgeCount,
  resolveElement,
  resolveSelector,
  runSelectorDiagnostic,
} from '@/contracts/selectors';
import { GlobalWindow } from 'happy-dom';
import { beforeEach, describe, expect, it } from 'vitest';

// Khởi tạo Happy-DOM globals khi chạy với Bun Test hoặc môi trường không có DOM
if (typeof document === 'undefined') {
  const happyWin = new GlobalWindow();
  globalThis.window = happyWin as unknown as Window & typeof globalThis;
  globalThis.document = happyWin.document as unknown as Document;
  globalThis.HTMLElement = happyWin.HTMLElement as unknown as typeof HTMLElement;
}

describe('Selectors 3-Tier Fallback Resolver & Node 01 Contracts (Unit Tests)', () => {
  const mockFixturePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
  const mockHtml = fs.readFileSync(mockFixturePath, 'utf-8');

  const sidebarFixturePath = path.resolve(__dirname, '../../Temps/zalo-element/sidebar.html');
  const sidebarHtml = fs.existsSync(sidebarFixturePath)
    ? fs.readFileSync(sidebarFixturePath, 'utf-8')
    : '';

  describe('Suite 1: Mock Fixture 3-Tier Fallback Verification', () => {
    beforeEach(() => {
      document.body.innerHTML = mockHtml;
    });

    it('should resolve SIDEBAR_CONVERSATIONS at Tier 1 (data-id="conversation-list")', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_CONVERSATIONS);
      expect(res.matchedTier).toBe(1);
      expect(res.element).not.toBeNull();
      expect(res.element?.getAttribute('data-id')).toBe('conversation-list');
    });

    it('should fallback to Tier 2 when Tier 1 is absent', () => {
      const el = document.querySelector('[data-id="conversation-list"]');
      el?.removeAttribute('data-id');

      const res = resolveSelector(SELECTORS.SIDEBAR_CONVERSATIONS);
      expect(res.matchedTier).toBe(2);
      expect(res.element).not.toBeNull();
      expect(res.element?.getAttribute('tabindex')).toBe('0');
    });

    it('should fallback to Tier 3 when both Tier 1 and Tier 2 fail', () => {
      const el = document.querySelector('[data-id="conversation-list"]');
      el?.removeAttribute('data-id');
      el?.removeAttribute('tabindex');

      const res = resolveSelector(SELECTORS.SIDEBAR_CONVERSATIONS);
      expect(res.matchedTier).toBe(3);
      expect(res.element?.id).toBe('conversationList');
    });

    it('should resolve CHAT_MESSAGE_CONTAINER correctly', () => {
      const el = resolveElement(SELECTORS.CHAT_MESSAGE_CONTAINER);
      expect(el).not.toBeNull();
      expect(el?.classList.contains('chat-message-list')).toBe(true);
    });

    it('should resolve CHAT_INPUT_BOX and FORWARD_MODAL', () => {
      const input = resolveElement(SELECTORS.CHAT_INPUT_BOX);
      expect(input).not.toBeNull();
      expect(input?.getAttribute('contenteditable')).toBe('true');

      const modal = resolveElement(SELECTORS.FORWARD_MODAL);
      expect(modal).not.toBeNull();
    });

    it('should handle pseudo :has-text in Tier 2 for FORWARD_MODAL', () => {
      const modalEl = document.querySelector('.forward-dialog');
      modalEl?.removeAttribute('role');
      modalEl?.removeAttribute('aria-label');

      const res = resolveSelector(SELECTORS.FORWARD_MODAL);
      expect(res.matchedTier).toBe(2);
      expect(res.element).not.toBeNull();
      expect(res.element?.textContent).toContain('Chia sẻ');
    });

    it('should runSelectorDiagnostic and report all selectors healthy on mock-zalo', () => {
      const diagnostics = runSelectorDiagnostic(document);
      for (const key of Object.keys(SELECTORS)) {
        expect(diagnostics[key]?.healthy).toBe(true);
        expect(diagnostics[key]?.matchedTier).not.toBeNull();
      }
    });

    it('should check health via SelectorHealthChecker utility', () => {
      expect(SelectorHealthChecker.isElementHealthy('SIDEBAR_CONVERSATIONS', document)).toBe(true);
      expect(SelectorHealthChecker.isElementHealthy('CHAT_MESSAGE_CONTAINER', document)).toBe(true);

      expect(SelectorHealthChecker.isCaptchaPresent(document)).toBe(false);

      const captchaEl = document.querySelector<HTMLElement>('.captcha-modal');
      if (captchaEl) {
        captchaEl.style.display = 'block';
        expect(SelectorHealthChecker.isCaptchaPresent(document)).toBe(true);
        captchaEl.style.display = 'none';
      }
    });

    it('should return null and healthy: false for missing selectors', () => {
      document.body.innerHTML = '<div>Empty Body</div>';
      const res = resolveSelector(SELECTORS.CHAT_INPUT_BOX);
      expect(res.element).toBeNull();
      expect(res.matchedTier).toBeNull();

      const diagnostics = runSelectorDiagnostic(document);
      expect(diagnostics.CHAT_INPUT_BOX?.healthy).toBe(false);
    });
  });

  describe('Suite 2: Real-World Production DOM Verification (sidebar.html)', () => {
    beforeEach(() => {
      document.body.innerHTML = sidebarHtml;
    });

    it('1. should resolve SIDEBAR_CONVERSATIONS at Tier 1 on sidebar.html', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_CONVERSATIONS, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(
        res.element?.id === 'conversationListId' || res.element?.id === 'conversationList',
      ).toBe(true);
    });

    it('2. should resolve SIDEBAR_ITEM at Tier 1 with data-id="div_TabMsg_ThrdChItem" and anim-data-id prefix "g"', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_ITEM, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(res.element?.getAttribute('data-id')).toBe('div_TabMsg_ThrdChItem');
      expect(res.element?.getAttribute('anim-data-id')).toMatch(/^g\d+/);
    });

    it('3. should resolve SIDEBAR_ITEM_AVATAR at Tier 1 matching img[data-ava-uid^="g"]', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_ITEM_AVATAR, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(res.element?.tagName.toLowerCase()).toBe('img');
      expect(res.element?.getAttribute('data-ava-uid')).toMatch(/^g\d+/);
    });

    it('4. should resolve SIDEBAR_ITEM_TITLE at Tier 1 matching div-b16.conv-item-title__name... > div.truncate', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_ITEM_TITLE, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(res.element?.textContent).toContain('TL21House');
    });

    it('5. should resolve SIDEBAR_COMMUNITY_ICON at Tier 1 matching i.fa-Community_16_Filled.community__conv-indicator', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_COMMUNITY_ICON, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(res.element?.classList.contains('community__conv-indicator')).toBe(true);
      expect(res.element?.classList.contains('fa-Community_16_Filled')).toBe(true);
    });

    it('6. should resolve UNREAD_BADGE_CONTAINER at Tier 1 matching div.conv-item-body__action > div.conv-action__unread-v2', () => {
      const res = resolveSelector(SELECTORS.UNREAD_BADGE_CONTAINER, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(res.element?.classList.contains('conv-action__unread-v2')).toBe(true);
    });

    it('7. should resolve UNREAD_BADGE at Tier 1 matching .conv-action__unread-v2 .z-noti-badge', () => {
      const res = resolveSelector(SELECTORS.UNREAD_BADGE, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(res.element?.classList.contains('z-noti-badge')).toBe(true);
    });

    it('8. should resolve PREVIEW_MESSAGE at Tier 1 matching .z-conv-message__preview-message .inline', () => {
      const res = resolveSelector(SELECTORS.PREVIEW_MESSAGE, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(res.element?.textContent).toContain('https://drive');
    });

    it('9. should resolve PREVIEW_SENDER at Tier 1 matching .z-conv-message__preview-sender-name', () => {
      const res = resolveSelector(SELECTORS.PREVIEW_SENDER, document);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1);
      expect(res.element?.textContent?.replace(/\s+/g, ' ').trim()).toContain('Linh Nguyễn');
    });
  });

  describe('Suite 3: extractUnreadBadgeCount & UNREAD_BADGE_ICON_CLASSES Contract', () => {
    it('should export all 6 standard unread badge classes', () => {
      expect(UNREAD_BADGE_ICON_CLASSES).toEqual([
        'fa-1_24_Line',
        'fa-2_24_Line',
        'fa-3_24_Line',
        'fa-4_24_Line',
        'fa-5_Plus_24_Line',
        '--dot',
      ]);
    });

    it('should detect dot badge (--dot) as unreadCount: 1, isDot: true', () => {
      const dotEl = document.createElement('div');
      dotEl.className = 'z-noti-badge --big --dot --noti-disable';

      const result = extractUnreadBadgeCount(dotEl);
      expect(result).toEqual({ unreadCount: 1, isDot: true });
    });

    it('should detect red dot fallback class (.unread-red-dot) as isDot: true', () => {
      const dotEl = document.createElement('span');
      dotEl.className = 'unread-red-dot';

      const result = extractUnreadBadgeCount(dotEl);
      expect(result).toEqual({ unreadCount: 1, isDot: true });
    });

    it.each([
      { iconClass: 'fa-1_24_Line', expectedCount: 1 },
      { iconClass: 'fa-2_24_Line', expectedCount: 2 },
      { iconClass: 'fa-3_24_Line', expectedCount: 3 },
      { iconClass: 'fa-4_24_Line', expectedCount: 4 },
      { iconClass: 'fa-5_Plus_24_Line', expectedCount: 5 },
    ])(
      'should decode icon $iconClass to unreadCount: $expectedCount',
      ({ iconClass, expectedCount }) => {
        const badgeEl = document.createElement('div');
        badgeEl.className = 'z-noti-badge --big --counter --noti-disable';
        const iconEl = document.createElement('i');
        iconEl.className = `fa ${iconClass} z-noti-badge__content --big`;
        badgeEl.appendChild(iconEl);

        const result = extractUnreadBadgeCount(badgeEl);
        expect(result).toEqual({ unreadCount: expectedCount, isDot: false });
      },
    );

    it('should fallback to numeric text content when icon is missing', () => {
      const badgeEl = document.createElement('div');
      badgeEl.className = 'z-noti-badge --counter';
      badgeEl.textContent = ' 12 ';

      const result = extractUnreadBadgeCount(badgeEl);
      expect(result).toEqual({ unreadCount: 12, isDot: false });
    });

    it('should return unreadCount: 0 when badge element is null or non-badge', () => {
      expect(extractUnreadBadgeCount(null)).toEqual({ unreadCount: 0, isDot: false });

      const normalEl = document.createElement('div');
      normalEl.className = 'normal-container';
      expect(extractUnreadBadgeCount(normalEl)).toEqual({ unreadCount: 0, isDot: false });
    });
  });

  describe('Suite 4: Structured Logging & Telemetry Evidence', () => {
    it('should output verifiable extraction snapshot from sidebar.html', () => {
      document.body.innerHTML = sidebarHtml;

      const itemEl = resolveElement(SELECTORS.SIDEBAR_ITEM, document);
      expect(itemEl).not.toBeNull();

      if (!itemEl) return;

      const groupId = itemEl.getAttribute('anim-data-id');
      const avatarEl = resolveElement(SELECTORS.SIDEBAR_ITEM_AVATAR, itemEl);
      const titleEl = resolveElement(SELECTORS.SIDEBAR_ITEM_TITLE, itemEl);
      const communityIconEl = resolveElement(SELECTORS.SIDEBAR_COMMUNITY_ICON, itemEl);
      const badgeEl = resolveElement(SELECTORS.UNREAD_BADGE, itemEl);
      const senderEl = resolveElement(SELECTORS.PREVIEW_SENDER, itemEl);
      const messageEl = resolveElement(SELECTORS.PREVIEW_MESSAGE, itemEl);

      const badgeInfo = extractUnreadBadgeCount(badgeEl);

      const telemetrySnapshot = {
        groupId,
        groupName: titleEl?.textContent?.trim().replace(/\u00a0/g, ' '),
        hasAvatar: Boolean(avatarEl?.getAttribute('data-ava-uid')),
        isCommunityGroup: communityIconEl !== null,
        unreadCount: badgeInfo.unreadCount,
        isDotBadge: badgeInfo.isDot,
        previewSender: senderEl?.textContent?.replace(/\s+/g, ' ').trim(),
        previewSnippet: messageEl?.textContent?.trim(),
      };

      // In structured log phục vụ kiểm chứng nhị phân và quan sát
      console.log('=== [NODE 01 SIDEBAR DOM EXTRACTION SNAPSHOT] ===');
      console.log(JSON.stringify(telemetrySnapshot, null, 2));

      expect(telemetrySnapshot.groupId).toBe('g1206626154231863388');
      expect(telemetrySnapshot.groupName).toContain('TL21House');
      expect(telemetrySnapshot.hasAvatar).toBe(true);
      expect(telemetrySnapshot.isCommunityGroup).toBe(true);
      expect(telemetrySnapshot.unreadCount).toBe(5);
      expect(telemetrySnapshot.isDotBadge).toBe(false);
      expect(telemetrySnapshot.previewSender).toBe('Linh Nguyễn:');
      expect(telemetrySnapshot.previewSnippet).toBe('https://drive....');
    });
  });
});
