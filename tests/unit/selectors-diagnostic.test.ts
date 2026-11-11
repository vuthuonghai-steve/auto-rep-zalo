import fs from 'node:fs';
import path from 'node:path';
import {
  SELECTORS,
  SelectorHealthChecker,
  type SelectorKey,
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

describe('Selectors Diagnostic & Temps.html Mapping Verification', () => {
  const mockFixturePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
  const mockHtml = fs.readFileSync(mockFixturePath, 'utf-8');

  const tempsFixturePath = path.resolve(__dirname, '../../Temps/zalo-element/temps.html');
  const tempsHtml = fs.existsSync(tempsFixturePath)
    ? fs.readFileSync(tempsFixturePath, 'utf-8')
    : '';

  describe('1. Selector Definition Contract Integrity', () => {
    const requiredKeys: SelectorKey[] = [
      'SIDEBAR_CONVERSATIONS',
      'SIDEBAR_ITEM',
      'UNREAD_BADGE',
      'CHAT_MESSAGE_CONTAINER',
      'CHAT_INPUT_BOX',
      'JUMP_TO_NEWEST',
      'LOCK_SEND_MESSAGE',
      'ALBUM_CONTAINER',
      'ALBUM_ITEM_PHOTO',
      'FORWARD_MODAL',
      'TOAST_SUCCESS',
      'CAPTCHA_MODAL',
    ];

    it.each(requiredKeys)('should have valid non-empty definition for key: %s', (key) => {
      const def = SELECTORS[key];
      expect(def).toBeDefined();
      expect(def.name).toBe(key);
      expect(def.tier1_semantic.length).toBeGreaterThan(0);
      expect(def.tier2_hierarchy.length).toBeGreaterThan(0);
      expect(def.tier3_class.length).toBeGreaterThan(0);
    });
  });

  describe('2. Resolution on Mock Fixture (mock-zalo.html)', () => {
    beforeEach(() => {
      document.body.innerHTML = mockHtml;
    });

    it('should resolve SIDEBAR_ITEM on mock-zalo', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_ITEM);
      expect(res.element).not.toBeNull();
      expect(res.element?.getAttribute('data-id')).toContain('conv-');
    });

    it('should resolve UNREAD_BADGE on mock-zalo', () => {
      const res = resolveSelector(SELECTORS.UNREAD_BADGE);
      expect(res.element).not.toBeNull();
      expect(
        res.element?.classList.contains('unread-badge') ||
          res.element?.classList.contains('unread-red-dot'),
      ).toBe(true);
    });

    it('should resolve ALBUM_CONTAINER and ALBUM_ITEM_PHOTO on mock-zalo', () => {
      const albumContainer = resolveElement(SELECTORS.ALBUM_CONTAINER);
      expect(albumContainer).not.toBeNull();
      expect(albumContainer?.classList.contains('album-container')).toBe(true);

      const albumPhoto = resolveElement(SELECTORS.ALBUM_ITEM_PHOTO);
      expect(albumPhoto).not.toBeNull();
      expect(albumPhoto?.classList.contains('album-item')).toBe(true);
    });

    it('should report healthy for all selectors in runSelectorDiagnostic on mock-zalo', () => {
      const diagnostics = runSelectorDiagnostic(document);
      for (const key of Object.keys(SELECTORS)) {
        expect(diagnostics[key]?.healthy).toBe(true);
        expect(diagnostics[key]?.matchedTier).not.toBeNull();
      }
    });

    it('should verify health checker helpers for locked chat and jump to newest', () => {
      // Mặc định các banner này ẩn trong mock fixture
      expect(SelectorHealthChecker.isChatLocked(document)).toBe(false);
      expect(SelectorHealthChecker.hasJumpToNewest(document)).toBe(false);

      // Hiển thị phần tử locked chat
      const lockEl = document.querySelector<HTMLElement>('.lockSendMessageBox');
      if (lockEl) {
        lockEl.style.display = 'block';
        expect(SelectorHealthChecker.isChatLocked(document)).toBe(true);
        lockEl.style.display = 'none';
      }

      // Hiển thị nút neo đáy jump to newest
      const jumpEl = document.querySelector<HTMLElement>('.bottom-nav-floating-container');
      if (jumpEl) {
        jumpEl.style.display = 'block';
        expect(SelectorHealthChecker.hasJumpToNewest(document)).toBe(true);
        jumpEl.style.display = 'none';
      }
    });
  });

  describe('3. Production DOM Mapping Verification (temps.html)', () => {
    beforeEach(() => {
      document.body.innerHTML = tempsHtml;
    });

    it('should resolve SIDEBAR_CONVERSATIONS on temps.html DOM', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_CONVERSATIONS);
      expect(res.element).not.toBeNull();
      expect(res.element?.id).toBe('conversationList');
    });

    it('should resolve SIDEBAR_ITEM supporting anim-data-id prefix "g" and div_TabMsg_ThrdChItem', () => {
      const res = resolveSelector(SELECTORS.SIDEBAR_ITEM);
      expect(res.element).not.toBeNull();
      const animDataId = res.element?.getAttribute('anim-data-id');
      const dataId = res.element?.getAttribute('data-id');
      expect(dataId === 'div_TabMsg_ThrdChItem' || Boolean(animDataId?.startsWith('g'))).toBe(true);
    });

    it('should resolve UNREAD_BADGE with .conv-action__unread-v2 .z-noti-badge or .z-conv-message.--unread on temps.html', () => {
      const res = resolveSelector(SELECTORS.UNREAD_BADGE);
      expect(res.element).not.toBeNull();
      const hasUnreadClass =
        res.element?.classList.contains('--unread') ||
        res.element?.classList.contains('z-noti-badge') ||
        res.element?.classList.contains('conv-action__unread-v2') ||
        res.element?.classList.contains('unread-badge');
      expect(hasUnreadClass).toBe(true);
    });

    it('should resolve CHAT_MESSAGE_CONTAINER on temps.html', () => {
      const res = resolveSelector(SELECTORS.CHAT_MESSAGE_CONTAINER);
      expect(res.element).not.toBeNull();
      expect(res.element?.id).toBe('messageViewContainer');
    });

    it('should resolve JUMP_TO_NEWEST neo đáy on temps.html', () => {
      const res = resolveSelector(SELECTORS.JUMP_TO_NEWEST);
      expect(res.element).not.toBeNull();
      expect(res.matchedTier).toBe(1); // Khớp aria-label="Jump to 0 newest messages"
    });

    it('should resolve LOCK_SEND_MESSAGE banner on temps.html', () => {
      const res = resolveSelector(SELECTORS.LOCK_SEND_MESSAGE);
      expect(res.element).not.toBeNull();
      expect(res.element?.getAttribute('data-translate-inner')).toContain('STR_LOCK_SEND_MESSAGE');
    });

    it('should resolve ALBUM_CONTAINER and ALBUM_ITEM_PHOTO on temps.html', () => {
      const containerRes = resolveSelector(SELECTORS.ALBUM_CONTAINER);
      expect(containerRes.element).not.toBeNull();
      expect(containerRes.element?.getAttribute('data-id')).toBe('div_ReceivedMsg_GrpPhoto');

      const photoRes = resolveSelector(SELECTORS.ALBUM_ITEM_PHOTO);
      expect(photoRes.element).not.toBeNull();
      expect(
        photoRes.element?.getAttribute('data-component') === 'photo' ||
          photoRes.element?.classList.contains('zimg-el'),
      ).toBe(true);
    });
  });
});
