import { SELECTORS, resolveSelector } from '@/contracts/selectors';
import { GlobalWindow } from 'happy-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SIDEBAR_ITEMS_HTML,
  ITEM_COMMUNITY_UNREAD_5_PLUS_HTML,
  ITEM_DIRECT_READ_NO_BADGE_HTML,
  ITEM_MUTED_RED_DOT_HTML,
  ITEM_READ_NO_BADGE_HTML,
  SIDEBAR_DOM_HTML,
  SIDEBAR_FIXTURE_METADATA,
  createMockSidebarDOM,
  getSidebarDomHtml,
} from '../fixtures/sidebar-dom.fixture';

// Khởi tạo Happy-DOM globals khi chạy với Bun Test hoặc môi trường không có DOM
if (typeof document === 'undefined') {
  const happyWin = new GlobalWindow();
  // @ts-expect-error happy-dom Window type compatibility
  globalThis.window = happyWin;
  // @ts-expect-error happy-dom Document type compatibility
  globalThis.document = happyWin.document;
  // @ts-expect-error happy-dom HTMLElement type compatibility
  globalThis.HTMLElement = happyWin.HTMLElement;
}

describe('Sidebar DOM Snapshot Fixture Verification (T003)', () => {
  describe('Suite 1: Raw HTML String Structure & Fidelity', () => {
    it('should export valid non-empty HTML strings for all fixture items', () => {
      expect(SIDEBAR_DOM_HTML).toBeDefined();
      expect(ITEM_COMMUNITY_UNREAD_5_PLUS_HTML).toContain('anim-data-id="g1206626154231863388"');
      expect(ITEM_MUTED_RED_DOT_HTML).toContain('anim-data-id="g7140739336053443835"');
      expect(ITEM_READ_NO_BADGE_HTML).toContain('anim-data-id="g2837343595483099522"');
      expect(ITEM_DIRECT_READ_NO_BADGE_HTML).toContain('anim-data-id="6123661134470420761"');
      expect(DEFAULT_SIDEBAR_ITEMS_HTML).toContain('g1206626154231863388');
    });

    it('should contain expected root container IDs and attributes matching Zalo production DOM', () => {
      expect(SIDEBAR_DOM_HTML).toContain('id="conversationListId"');
      expect(SIDEBAR_DOM_HTML).toContain('data-id="div_TabMsg_ThrdChList"');
      expect(SIDEBAR_DOM_HTML).toContain('id="conversationList"');
      expect(SIDEBAR_DOM_HTML).toContain('role="grid"');
      expect(SIDEBAR_DOM_HTML).toContain('class="ReactVirtualized__Grid ReactVirtualized__List"');
    });
  });

  describe('Suite 2: createMockSidebarDOM() Helper Instantiation', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should instantiate valid HTMLElement with full child hierarchy without reading disk', () => {
      const el = createMockSidebarDOM();
      expect(el).toBeInstanceOf(HTMLElement);
      expect(el.id).toBe('conversationListId');
      expect(el.getAttribute('data-id')).toBe('div_TabMsg_ThrdChList');

      const grid = el.querySelector('#conversationList[role="grid"]');
      expect(grid).not.toBeNull();

      const items = el.querySelectorAll('.msg-item');
      expect(items.length).toBe(4);
    });

    it('should support attachToDocument: true option to mount directly into document.body', () => {
      expect(document.body.children.length).toBe(0);
      const el = createMockSidebarDOM({ attachToDocument: true });
      expect(document.body.contains(el)).toBe(true);
      expect(document.querySelector('#conversationListId')).not.toBeNull();
    });

    it('should support customItemsHtml option for isolated item testing', () => {
      const customHtml = `<div class="msg-item" anim-data-id="g999">Custom</div>`;
      const el = createMockSidebarDOM({ customItemsHtml: customHtml });
      const items = el.querySelectorAll('.msg-item');
      expect(items.length).toBe(1);
      expect(items[0]?.getAttribute('anim-data-id')).toBe('g999');
    });
  });

  describe('Suite 3: 3-Tier Selector Fallback Compliance', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      createMockSidebarDOM({ attachToDocument: true });
    });

    it('should satisfy SIDEBAR_CONVERSATIONS at Tier 1', () => {
      const result = resolveSelector(SELECTORS.SIDEBAR_CONVERSATIONS);
      expect(result.matchedTier).toBe(1);
      expect(result.element).not.toBeNull();
      expect(result.element?.id).toBe('conversationListId');
    });

    it('should satisfy SIDEBAR_ITEM at Tier 1 with prefix "g"', () => {
      const result = resolveSelector(SELECTORS.SIDEBAR_ITEM);
      expect(result.matchedTier).toBe(1);
      expect(result.element).not.toBeNull();
      expect(result.element?.getAttribute('anim-data-id')).toBe('g1206626154231863388');
    });

    it('should satisfy SIDEBAR_ITEM_AVATAR at Tier 1', () => {
      const result = resolveSelector(SELECTORS.SIDEBAR_ITEM_AVATAR);
      expect(result.matchedTier).toBe(1);
      expect(result.element).not.toBeNull();
      expect(result.element?.getAttribute('data-ava-uid')).toBe('g1206626154231863388');
    });

    it('should satisfy SIDEBAR_ITEM_TITLE at Tier 1', () => {
      const result = resolveSelector(SELECTORS.SIDEBAR_ITEM_TITLE);
      expect(result.matchedTier).toBe(1);
      expect(result.element).not.toBeNull();
      expect(result.element?.textContent).toContain('TL21House');
    });

    it('should satisfy SIDEBAR_COMMUNITY_ICON at Tier 1', () => {
      const result = resolveSelector(SELECTORS.SIDEBAR_COMMUNITY_ICON);
      expect(result.matchedTier).toBe(1);
      expect(result.element).not.toBeNull();
      expect(result.element?.classList.contains('fa-Community_16_Filled')).toBe(true);
    });

    it('should satisfy UNREAD_BADGE_CONTAINER and UNREAD_BADGE at Tier 1', () => {
      const containerRes = resolveSelector(SELECTORS.UNREAD_BADGE_CONTAINER);
      expect(containerRes.matchedTier).toBe(1);
      expect(containerRes.element).not.toBeNull();

      const badgeRes = resolveSelector(SELECTORS.UNREAD_BADGE);
      expect(badgeRes.matchedTier).toBe(1);
      expect(badgeRes.element).not.toBeNull();
      expect(badgeRes.element?.classList.contains('z-noti-badge')).toBe(true);
    });

    it('should satisfy PREVIEW_MESSAGE and PREVIEW_SENDER at Tier 1', () => {
      const msgRes = resolveSelector(SELECTORS.PREVIEW_MESSAGE);
      expect(msgRes.matchedTier).toBe(1);
      expect(msgRes.element).not.toBeNull();

      const senderRes = resolveSelector(SELECTORS.PREVIEW_SENDER);
      expect(senderRes.matchedTier).toBe(1);
      expect(senderRes.element).not.toBeNull();
      expect(senderRes.element?.textContent).toContain('Linh Nguyễn');
    });
  });

  describe('Suite 4: Specific Conversation Types Verification', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      createMockSidebarDOM({ attachToDocument: true });
    });

    it('Case a) Community group with 5+ unread (g1206626154231863388)', () => {
      const meta = SIDEBAR_FIXTURE_METADATA.communityGroup;
      const item = document.querySelector(`[anim-data-id="${meta.groupId}"]`);
      expect(item).not.toBeNull();

      const communityIcon = item?.querySelector('i.fa-Community_16_Filled');
      expect(communityIcon).not.toBeNull();

      const badge = item?.querySelector('.z-noti-badge');
      expect(badge).not.toBeNull();
      const badgeIcon = badge?.querySelector(`i.${meta.unreadBadgeClass}`);
      expect(badgeIcon).not.toBeNull();

      const previewSender = item?.querySelector('.z-conv-message__preview-sender-name');
      expect(previewSender?.textContent?.trim()).toBe(meta.previewSender);
    });

    it('Case b) Muted group with red dot --dot (g7140739336053443835)', () => {
      const meta = SIDEBAR_FIXTURE_METADATA.mutedGroup;
      const item = document.querySelector(`[anim-data-id="${meta.groupId}"]`);
      expect(item).not.toBeNull();

      const muteIcon = item?.querySelector('i.fa-Notif_Off_24_Filled.conv__mute');
      expect(muteIcon).not.toBeNull();

      const dotBadge = item?.querySelector('.z-noti-badge.--dot');
      expect(dotBadge).not.toBeNull();
      expect(dotBadge?.querySelector('i')).toBeNull(); // Red dot has no inner icon
    });

    it('Case c1) Read group conversation with no badge (g2837343595483099522)', () => {
      const meta = SIDEBAR_FIXTURE_METADATA.readGroup;
      const item = document.querySelector(`[anim-data-id="${meta.groupId}"]`);
      expect(item).not.toBeNull();

      const badge = item?.querySelector('.z-noti-badge');
      expect(badge).toBeNull();

      const spanAllBody = item?.querySelector('.conv-item-body.span-all');
      expect(spanAllBody).not.toBeNull();
    });

    it('Case c2) Read direct personal conversation with no badge (6123661134470420761)', () => {
      const meta = SIDEBAR_FIXTURE_METADATA.directChat;
      const item = document.querySelector(`[anim-data-id="${meta.groupId}"]`);
      expect(item).not.toBeNull();

      expect(item?.getAttribute('anim-data-id')).not.toMatch(/^g/); // Direct personal has no 'g' prefix

      const badge = item?.querySelector('.z-noti-badge');
      expect(badge).toBeNull();
    });
  });

  describe('Suite 5: Structured Logging & Snapshot Evidence', () => {
    it('should log structured snapshot of the created mock sidebar DOM structure', () => {
      const el = createMockSidebarDOM();
      const items = Array.from(el.querySelectorAll('.msg-item')).map((itemEl) => {
        const animId = itemEl.getAttribute('anim-data-id') || '';
        const titleEl = itemEl.querySelector('.conv-item-title__name div.truncate');
        const isCommunity = !!itemEl.querySelector('i.fa-Community_16_Filled');
        const isMuted = !!itemEl.querySelector('i.fa-Notif_Off_24_Filled');
        const badgeEl = itemEl.querySelector('.z-noti-badge');
        const isDot = !!badgeEl?.classList.contains('--dot');
        const iconEl = badgeEl?.querySelector('i');
        const badgeClass = iconEl
          ? Array.from(iconEl.classList).find((c) => c.startsWith('fa-'))
          : isDot
            ? '--dot'
            : null;

        return {
          animDataId: animId,
          title: titleEl?.textContent?.replace(/&nbsp;/g, ' ').trim() || '',
          isCommunity,
          isMuted,
          hasBadge: !!badgeEl,
          badgeType: badgeClass || 'none',
        };
      });

      const snapshotReport = {
        fixtureContainer: '#conversationListId[data-id="div_TabMsg_ThrdChList"]',
        gridContainer: '#conversationList[role="grid"]',
        totalItemsCount: items.length,
        itemsSummary: items,
      };

      console.log('=== [T003 FIXTURE STRUCTURE SNAPSHOT] ===');
      console.log(JSON.stringify(snapshotReport, null, 2));

      expect(snapshotReport.totalItemsCount).toBe(4);
      expect(snapshotReport.itemsSummary[0]?.isCommunity).toBe(true);
      expect(snapshotReport.itemsSummary[1]?.badgeType).toBe('--dot');
      expect(snapshotReport.itemsSummary[2]?.hasBadge).toBe(false);
      expect(snapshotReport.itemsSummary[3]?.animDataId).not.toContain('g');
    });
  });
});
