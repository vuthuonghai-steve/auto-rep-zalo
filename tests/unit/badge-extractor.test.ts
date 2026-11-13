import {
  ZERO_UNREAD_RESULT,
  extractUnreadBadge,
  extractUnreadBadgeCount,
} from '@/utils/badge-extractor';
import { GlobalWindow } from 'happy-dom';
import { beforeEach, describe, expect, it } from 'vitest';

// Khởi tạo Happy-DOM globals khi chạy với Bun Test hoặc môi trường không có DOM
if (typeof document === 'undefined') {
  const happyWin = new GlobalWindow();
  globalThis.window = happyWin as unknown as Window & typeof globalThis;
  globalThis.document = happyWin.document as unknown as Document;
  globalThis.HTMLElement = happyWin.HTMLElement as unknown as typeof HTMLElement;
}

describe('Badge Extractor Utility (Unit Tests - T005)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Suite 1: Null, Undefined, and Empty Container Handling', () => {
    it('should return zero unread result when container is null', () => {
      const res = extractUnreadBadge(null);
      expect(res).toEqual(ZERO_UNREAD_RESULT);
      expect(res.unreadCount).toBe(0);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(false);
      expect(extractUnreadBadgeCount(null)).toBe(0);
    });

    it('should return zero unread result when container is undefined', () => {
      const res = extractUnreadBadge(undefined);
      expect(res).toEqual(ZERO_UNREAD_RESULT);
      expect(res.unreadCount).toBe(0);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(false);
      expect(extractUnreadBadgeCount(undefined)).toBe(0);
    });

    it('should return zero unread result for empty HTML element', () => {
      const el = document.createElement('div');
      const res = extractUnreadBadge(el);
      expect(res).toEqual(ZERO_UNREAD_RESULT);
      expect(extractUnreadBadgeCount(el)).toBe(0);
    });

    it('should return zero unread for non-badge element containing text with numbers', () => {
      const el = document.createElement('div');
      el.className = 'conv-item';
      el.innerHTML =
        '<span class="conv-name">Nhóm Bất Động Sản 2026</span><span class="time">14:30</span>';
      const res = extractUnreadBadge(el);
      expect(res).toEqual(ZERO_UNREAD_RESULT);
      expect(extractUnreadBadgeCount(el)).toBe(0);
    });
  });

  describe('Suite 2: Zalo Font Icon Classes Resolution (fa-1_24_Line to fa-5_Plus_24_Line)', () => {
    const iconCases = [
      { className: 'fa-1_24_Line', expectedCount: 1 },
      { className: 'fa-2_24_Line', expectedCount: 2 },
      { className: 'fa-3_24_Line', expectedCount: 3 },
      { className: 'fa-4_24_Line', expectedCount: 4 },
      { className: 'fa-5_Plus_24_Line', expectedCount: 5 },
    ] as const;

    for (const { className, expectedCount } of iconCases) {
      it(`should correctly extract count ${expectedCount} from icon class ${className}`, () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'conv-item-body__action hasOption grid-item';
        wrapper.innerHTML = `
          <div class="conv-action__unread-v2 flx flx-al-c">
            <div class="z-noti-badge --big --counter --noti-disable">
              <i class="fa ${className} z-noti-badge__content --big"></i>
            </div>
          </div>
        `;

        const res = extractUnreadBadge(wrapper);
        expect(res.unreadCount).toBe(expectedCount);
        expect(res.isDot).toBe(false);
        expect(res.hasUnread).toBe(true);
        expect(extractUnreadBadgeCount(wrapper)).toBe(expectedCount);
      });
    }

    it('should correctly extract when passing the icon element directly', () => {
      const icon = document.createElement('i');
      icon.className = 'fa fa-3_24_Line z-noti-badge__content';
      const res = extractUnreadBadge(icon);
      expect(res.unreadCount).toBe(3);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(true);
    });

    it('should correctly extract when passing the badge container directly', () => {
      const badge = document.createElement('div');
      badge.className = 'z-noti-badge --big --counter';
      badge.innerHTML = '<i class="fa fa-5_Plus_24_Line"></i>';
      const res = extractUnreadBadge(badge);
      expect(res.unreadCount).toBe(5);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(true);
    });
  });

  describe('Suite 3: Dot Badge Resolution (Muted Conversations --dot)', () => {
    it('should extract dot badge from realistic Zalo sidebar HTML structure', () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'conv-item-body__action hasOption grid-item';
      wrapper.innerHTML = `
        <div class="conv-action__unread-v2 flx flx-al-c">
          <div class="z-noti-badge --big --dot --noti-disable"></div>
        </div>
      `;

      const res = extractUnreadBadge(wrapper);
      expect(res.unreadCount).toBe(1);
      expect(res.isDot).toBe(true);
      expect(res.hasUnread).toBe(true);
      expect(extractUnreadBadgeCount(wrapper)).toBe(1);
    });

    it('should extract dot badge when passing badge element directly with class --dot', () => {
      const dotBadge = document.createElement('div');
      dotBadge.className = 'z-noti-badge --big --dot --noti-disable';

      const res = extractUnreadBadge(dotBadge);
      expect(res.unreadCount).toBe(1);
      expect(res.isDot).toBe(true);
      expect(res.hasUnread).toBe(true);
    });

    it('should extract dot badge when using legacy unread-red-dot class', () => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = '<span class="unread-red-dot"></span>';

      const res = extractUnreadBadge(wrapper);
      expect(res.unreadCount).toBe(1);
      expect(res.isDot).toBe(true);
      expect(res.hasUnread).toBe(true);
    });
  });

  describe('Suite 4: Fallback Text Extraction (Pure Text & Number Badges)', () => {
    it('should extract count from text inside z-noti-badge', () => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = '<div class="z-noti-badge"> 8 </div>';

      const res = extractUnreadBadge(wrapper);
      expect(res.unreadCount).toBe(8);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(true);
      expect(extractUnreadBadgeCount(wrapper)).toBe(8);
    });

    it('should extract count from unread-badge with 99+ text', () => {
      const badge = document.createElement('div');
      badge.className = 'unread-badge';
      badge.textContent = '99+';

      const res = extractUnreadBadge(badge);
      expect(res.unreadCount).toBe(99);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(true);
    });

    it('should extract count from text with leading plus (+5)', () => {
      const badge = document.createElement('div');
      badge.className = 'z-noti-badge';
      badge.textContent = '+5';

      const res = extractUnreadBadge(badge);
      expect(res.unreadCount).toBe(5);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(true);
    });

    it('should handle zero count text as no unread', () => {
      const badge = document.createElement('div');
      badge.className = 'z-noti-badge';
      badge.textContent = '0';

      const res = extractUnreadBadge(badge);
      expect(res.unreadCount).toBe(0);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(false);
    });

    it('should handle non-numeric badge content gracefully', () => {
      const badge = document.createElement('div');
      badge.className = 'z-noti-badge';
      badge.textContent = 'NEW';

      const res = extractUnreadBadge(badge);
      expect(res.unreadCount).toBe(0);
      expect(res.isDot).toBe(false);
      expect(res.hasUnread).toBe(false);
    });
  });

  describe('Suite 5: Structured Logging & Terminal Snapshot Outputs', () => {
    it('should log verifiable badge extraction snapshots', () => {
      const fixtures = [
        {
          name: 'Realistic Zalo Sidebar 5+ Messages Badge',
          html: `
            <div class="conv-item-body__action hasOption grid-item">
              <div class="conv-action__unread-v2 flx flx-al-c">
                <div class="z-noti-badge --big --counter --noti-disable">
                  <i class="fa fa-5_Plus_24_Line z-noti-badge__content --big"></i>
                </div>
              </div>
            </div>
          `,
        },
        {
          name: 'Realistic Zalo Sidebar Muted Dot Badge',
          html: `
            <div class="conv-item-body__action hasOption grid-item">
              <div class="conv-action__unread-v2 flx flx-al-c">
                <div class="z-noti-badge --big --dot --noti-disable"></div>
              </div>
            </div>
          `,
        },
        {
          name: 'Fallback Text Numeric Badge',
          html: `<div class="conv-action__unread-v2"><div class="z-noti-badge">42</div></div>`,
        },
      ];

      const snapshotResults = fixtures.map((f) => {
        const container = document.createElement('div');
        container.innerHTML = f.html;
        const result = extractUnreadBadge(container);
        return {
          scenario: f.name,
          extractionResult: result,
        };
      });

      console.log('=== [T005 BADGE EXTRACTOR SNAPSHOT OUTPUT] ===');
      console.log(JSON.stringify(snapshotResults, null, 2));

      expect(snapshotResults[0]?.extractionResult.unreadCount).toBe(5);
      expect(snapshotResults[1]?.extractionResult.isDot).toBe(true);
      expect(snapshotResults[2]?.extractionResult.unreadCount).toBe(42);
    });
  });
});
