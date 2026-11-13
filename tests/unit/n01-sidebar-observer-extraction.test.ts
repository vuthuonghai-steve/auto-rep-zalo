import type { GroupDetectedEvent, WhitelistGroupItem } from '@/contracts/schemas';
import { SidebarObserver } from '@/nodes/n01-sidebar-observer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_COMMUNITY_UNREAD_5_PLUS_HTML,
  ITEM_MUTED_RED_DOT_HTML,
  SIDEBAR_FIXTURE_METADATA,
  createMockSidebarDOM,
} from '../fixtures/sidebar-dom.fixture';

describe('Node 01: Sidebar Observer DOM Extraction & Multi-Signal Fusion (tests/unit/n01-sidebar-observer-extraction.test.ts)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Suite 1: DOM Extraction from Fixture (Happy Path - GATE-N01-02)', () => {
    it('should accurately extract community group with fa-5_Plus_24_Line badge', () => {
      const sidebar = createMockSidebarDOM({ attachToDocument: true });
      expect(sidebar).toBeDefined();

      const events: GroupDetectedEvent[] = [];
      const onNewMsg = vi.fn((event: GroupDetectedEvent) => {
        events.push(event);
      });

      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage: onNewMsg,
        rootDocument: document,
        emitEventPayload: true,
      });

      expect(observer.start()).toBe(true);
      expect(observer.isObserving()).toBe(true);
      expect(observer.isAttached()).toBe(true);

      // scanExisting verifies initial DOM state extraction
      observer.scanExisting();

      expect(onNewMsg).toHaveBeenCalledTimes(1);
      expect(events).toHaveLength(1);

      const detected = events[0];
      expect(detected).toBeDefined();
      if (!detected) throw new Error('Expected detected event to be defined');
      expect(detected.groupId).toBe(SIDEBAR_FIXTURE_METADATA.communityGroup.groupId);
      // Confirms &nbsp; and Unicode whitespace are cleaned into standard space
      expect(detected.groupName).toBe(SIDEBAR_FIXTURE_METADATA.communityGroup.groupName);
      expect(detected.groupName).not.toContain('&nbsp;');
      expect(detected.groupName).not.toContain('\u00A0');
      expect(detected.unreadCount).toBe(5);
      expect(detected.isCommunity).toBe(true);
      expect(detected.senderName).toBe('Linh Nguyễn:');
      expect(detected.lastSnippet).toBe('https://drive....');
      expect(detected.correlationId).toMatch(/^corr_\d+_[a-f0-9]+$/);
      expect(detected.detectedAt).toBeGreaterThan(0);

      // Evidence snapshot output for audit
      console.log('=== [GATE-N01-02 DOM EXTRACTION SNAPSHOT: COMMUNITY 5+ UNREAD] ===');
      console.log(JSON.stringify(detected, null, 2));

      observer.stop();
    });

    it('should accurately extract muted conversation with red dot (--dot) badge', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const events: GroupDetectedEvent[] = [];
      const onNewMsg = vi.fn((event: GroupDetectedEvent) => {
        events.push(event);
      });

      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId],
        onNewMessage: onNewMsg,
        rootDocument: document,
        emitEventPayload: true,
      });

      observer.start();
      observer.scanExisting();

      expect(onNewMsg).toHaveBeenCalledTimes(1);
      expect(events).toHaveLength(1);

      const detected = events[0];
      expect(detected).toBeDefined();
      if (!detected) throw new Error('Expected detected event to be defined');
      expect(detected.groupId).toBe(SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId);
      expect(detected.groupName).toBe(SIDEBAR_FIXTURE_METADATA.mutedGroup.groupName);
      expect(detected.unreadCount).toBe(1);
      expect(detected.isCommunity).toBe(false);
      expect(detected.lastSnippet).toBe('7h sáng khách đi xem phòng');

      console.log('=== [GATE-N01-02 DOM EXTRACTION SNAPSHOT: MUTED RED DOT] ===');
      console.log(JSON.stringify(detected, null, 2));

      observer.stop();
    });

    it('should not emit events for read conversations with 0 unread messages', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const onNewMsg = vi.fn();
      const observer = new SidebarObserver({
        whitelist: [
          SIDEBAR_FIXTURE_METADATA.readGroup.groupId,
          SIDEBAR_FIXTURE_METADATA.directChat.groupId,
        ],
        onNewMessage: onNewMsg,
        rootDocument: document,
      });

      observer.start();
      observer.scanExisting();

      expect(onNewMsg).not.toHaveBeenCalled();
      observer.stop();
    });
  });

  describe('Suite 2: Whitelist Matching Engine & Telemetry (T009)', () => {
    it('should match Whitelist by EXACT groupName ignoring Unicode and case variations', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const onNewMsg = vi.fn();
      const observer = new SidebarObserver({
        whitelist: ['🏆tl21house🏆- nguồn <4tr'], // Lowercase with regular space
        onNewMessage: onNewMsg,
        rootDocument: document,
      });

      observer.start();
      observer.scanExisting();

      expect(onNewMsg).toHaveBeenCalledWith(SIDEBAR_FIXTURE_METADATA.communityGroup.groupId);
      observer.stop();
    });

    it('should match WhitelistGroupItem rule with CONTAINS rule', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const structuredWhitelist: WhitelistGroupItem[] = [
        {
          groupId: 'dummy-id',
          groupName: 'Sales BTL',
          matchingRule: 'CONTAINS',
          priority: 2,
          isEnabled: true,
          addedAt: Date.now(),
          lastUpdatedAt: Date.now(),
        },
      ];

      const onNewMsg = vi.fn();
      const observer = new SidebarObserver({
        whitelist: structuredWhitelist,
        onNewMessage: onNewMsg,
        rootDocument: document,
      });

      observer.start();
      observer.scanExisting();

      // "DNT Home Team Sales BTL" CONTAINS "Sales BTL"
      expect(onNewMsg).toHaveBeenCalledWith(SIDEBAR_FIXTURE_METADATA.mutedGroup.groupId);
      observer.stop();
    });

    it('should respect isEnabled = false in WhitelistGroupItem and ignore group', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const structuredWhitelist: WhitelistGroupItem[] = [
        {
          groupId: SIDEBAR_FIXTURE_METADATA.communityGroup.groupId,
          groupName: SIDEBAR_FIXTURE_METADATA.communityGroup.groupName,
          matchingRule: 'EXACT',
          priority: 1,
          isEnabled: false, // Disabled
          addedAt: Date.now(),
          lastUpdatedAt: Date.now(),
        },
      ];

      const onNewMsg = vi.fn();
      const observer = new SidebarObserver({
        whitelist: structuredWhitelist,
        onNewMessage: onNewMsg,
        rootDocument: document,
      });

      observer.start();
      observer.scanExisting();

      expect(onNewMsg).not.toHaveBeenCalled();
      observer.stop();
    });

    it('should track totalIgnoredNonWhitelist and totalProcessed in telemetry', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const onNewMsg = vi.fn();
      // Only community group is whitelisted, mutedGroup has 1 unread and should be ignored
      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage: onNewMsg,
        rootDocument: document,
      });

      observer.start();
      observer.scanExisting();

      const telemetry = observer.getTelemetry();
      expect(telemetry.isObserving).toBe(true);
      expect(telemetry.isAttached).toBe(true);
      // Two items have unread in fixture: community (5 unread) and muted (1 unread)
      expect(telemetry.totalProcessed).toBe(2);
      expect(telemetry.totalIgnoredNonWhitelist).toBe(1);

      // getStats alias test
      expect(observer.getStats()).toEqual(telemetry);

      console.log('=== [TELEMETRY EVIDENCE SNAPSHOT] ===');
      console.log(JSON.stringify(telemetry, null, 2));

      observer.stop();
    });
  });

  describe('Suite 3: Multi-Signal Live MutationObserver Triggers (T008)', () => {
    it('should trigger on dynamic DOM mutation when unread badge is added', async () => {
      const sidebar = createMockSidebarDOM({
        customItemsHtml: `
          <div class="msg-item" data-id="div_TabMsg_ThrdChItem" anim-data-id="g999888777">
            <div-b16 class="conv-item-title__name truncate">
              <div class="truncate">Live Mutation Room</div>
            </div-b16>
            <div class="conv-item-body__action">
              <div class="conv-action__unread-v2"></div>
            </div>
          </div>
        `,
        attachToDocument: true,
      });

      const events: GroupDetectedEvent[] = [];
      const onNewMsg = vi.fn((event: GroupDetectedEvent) => {
        events.push(event);
      });

      const observer = new SidebarObserver({
        whitelist: ['g999888777'],
        onNewMessage: onNewMsg,
        rootDocument: document,
        emitEventPayload: true,
      });

      observer.start();
      expect(observer.isAttached()).toBe(true);

      // Initially no unread badge -> 0 calls
      observer.scanExisting();
      expect(onNewMsg).not.toHaveBeenCalled();

      // Dynamically insert unread badge into DOM
      const unreadContainer = sidebar.querySelector('.conv-action__unread-v2');
      const badge = document.createElement('div');
      badge.className = 'z-noti-badge';
      badge.innerHTML = '<i class="fa fa-3_24_Line"></i>';
      unreadContainer?.appendChild(badge);

      // Allow MutationObserver microtask to fire
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(onNewMsg).toHaveBeenCalledTimes(1);
      expect(events).toHaveLength(1);
      const event0 = events[0];
      if (!event0) throw new Error('Expected event0 to be defined');
      expect(event0.groupId).toBe('g999888777');
      expect(event0.groupName).toBe('Live Mutation Room');
      expect(event0.unreadCount).toBe(3);

      observer.stop();
    });

    it('should support callback signature (groupId, event)', () => {
      createMockSidebarDOM({ attachToDocument: true });

      const onNewMsg = vi.fn((groupId: string, event?: GroupDetectedEvent) => {
        expect(groupId).toBe(SIDEBAR_FIXTURE_METADATA.communityGroup.groupId);
        expect(event).toBeDefined();
        expect(event?.unreadCount).toBe(5);
      });

      const observer = new SidebarObserver({
        whitelist: [SIDEBAR_FIXTURE_METADATA.communityGroup.groupId],
        onNewMessage: onNewMsg,
        rootDocument: document,
      });

      observer.start();
      observer.scanExisting();

      expect(onNewMsg).toHaveBeenCalledTimes(1);
      observer.stop();
    });
  });

  describe('Suite 4: Extraction Methods Pure Unit Testing', () => {
    it('should correctly extract groupId with anim-data-id precedence', () => {
      const observer = new SidebarObserver({
        whitelist: [],
        onNewMessage: vi.fn(),
      });

      const div = document.createElement('div');
      div.setAttribute('anim-data-id', 'g123456');
      div.setAttribute('data-id', 'div_TabMsg_ThrdChItem');
      div.innerHTML = '<img data-ava-uid="g999999" />';

      expect(observer.extractGroupId(div)).toBe('g123456');
    });

    it('should fallback to avatar data-ava-uid if anim-data-id is missing', () => {
      const observer = new SidebarObserver({
        whitelist: [],
        onNewMessage: vi.fn(),
      });

      const div = document.createElement('div');
      div.setAttribute('data-id', 'div_TabMsg_ThrdChItem');
      div.innerHTML = '<img data-ava-uid="g999999" />';

      expect(observer.extractGroupId(div)).toBe('g999999');
    });

    it('should correctly extract groupName and strip &nbsp;', () => {
      const observer = new SidebarObserver({
        whitelist: [],
        onNewMessage: vi.fn(),
      });

      const div = document.createElement('div');
      div.innerHTML = `
        <div-b16 class="conv-item-title__name">
          <div class="truncate">Phòng&nbsp;Kinh&nbsp;Doanh&nbsp;Vinhomes</div>
        </div-b16>
      `;

      expect(observer.extractGroupName(div)).toBe('Phòng Kinh Doanh Vinhomes');
    });
  });
});
