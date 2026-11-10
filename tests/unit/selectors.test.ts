import fs from 'node:fs';
import path from 'node:path';
import {
  SELECTORS,
  SelectorHealthChecker,
  resolveElement,
  resolveSelector,
  runSelectorDiagnostic,
} from '@/contracts/selectors';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Selectors 3-Tier Fallback Resolver (Unit Tests)', () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf-8');

  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
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
    // Remove Tier 1 aria-label
    const modalEl = document.querySelector('.forward-dialog');
    modalEl?.removeAttribute('role');
    modalEl?.removeAttribute('aria-label');

    const res = resolveSelector(SELECTORS.FORWARD_MODAL);
    expect(res.matchedTier).toBe(2);
    expect(res.element).not.toBeNull();
    expect(res.element?.textContent).toContain('Chia sẻ');
  });

  it('should runSelectorDiagnostic and report all 5 selectors healthy on mock-zalo', () => {
    const diagnostics = runSelectorDiagnostic(document);
    for (const key of Object.keys(SELECTORS)) {
      expect(diagnostics[key]?.healthy).toBe(true);
      expect(diagnostics[key]?.matchedTier).not.toBeNull();
    }
  });

  it('should check health via SelectorHealthChecker utility', () => {
    expect(SelectorHealthChecker.isElementHealthy('SIDEBAR_CONVERSATIONS', document)).toBe(true);
    expect(SelectorHealthChecker.isElementHealthy('CHAT_MESSAGE_CONTAINER', document)).toBe(true);

    // Mặc định modal captcha đang ẩn
    expect(SelectorHealthChecker.isCaptchaPresent(document)).toBe(false);

    // Khi modal captcha hiển thị
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
