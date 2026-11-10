import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Zalo Web Mock Fixture Verification (tests/fixtures/mock-zalo.html)', () => {
  const fixturePath = path.resolve(__dirname, '../fixtures/mock-zalo.html');
  const htmlContent = fs.readFileSync(fixturePath, 'utf-8');

  it('should exist and contain valid HTML document structure', () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    expect(htmlContent).toContain('<!DOCTYPE html>');
    expect(htmlContent).toContain('<html lang="vi">');
  });

  it('should satisfy 3-tier selectors for SIDEBAR_CONVERSATIONS', () => {
    document.body.innerHTML = htmlContent;

    // Tier 1: semantic data-id
    const tier1 = document.querySelector('[data-id="conversation-list"]');
    expect(tier1).not.toBeNull();

    // Tier 2: hierarchy
    const tier2 = document.querySelector('nav div[tabindex="0"]');
    expect(tier2).not.toBeNull();

    // Tier 3: class/id fallback
    const tier3 = document.querySelector('#conversationList');
    expect(tier3).not.toBeNull();
  });

  it('should satisfy 3-tier selectors for CHAT_MESSAGE_CONTAINER', () => {
    document.body.innerHTML = htmlContent;

    const tier1 = document.querySelector('[data-id="message-view-list"]');
    expect(tier1).not.toBeNull();

    const tier2 = document.querySelector('div[role="main"] div[data-scroll="true"]');
    expect(tier2).not.toBeNull();

    const tier3 = document.querySelector('.chat-message-list');
    expect(tier3).not.toBeNull();
  });

  it('should satisfy 3-tier selectors for CHAT_INPUT_BOX', () => {
    document.body.innerHTML = htmlContent;

    const tier1 = document.querySelector('[data-id="chat-input-content"]');
    expect(tier1).not.toBeNull();

    const tier2 = document.querySelector('footer div[contenteditable="true"]');
    expect(tier2).not.toBeNull();

    const tier3 = document.querySelector('#chat-input-text');
    expect(tier3).not.toBeNull();
  });

  it('should satisfy selectors for FORWARD_MODAL and TOAST_SUCCESS', () => {
    document.body.innerHTML = htmlContent;

    const modalTier1 = document.querySelector('[role="dialog"][aria-label*="Chia sẻ"]');
    expect(modalTier1).not.toBeNull();

    const modalTier3 = document.querySelector('.forward-dialog');
    expect(modalTier3).not.toBeNull();

    const toastTier1 = document.querySelector('[data-translate-inner="STR_SHARED_SUCCESS"]');
    expect(toastTier1).not.toBeNull();

    const toastTier3 = document.querySelector('.toast-success');
    expect(toastTier3).not.toBeNull();
  });

  it('should contain album photo elements and sender attribution for bundling tests', () => {
    document.body.innerHTML = htmlContent;

    const albumContainer = document.querySelector('.album-container');
    expect(albumContainer).not.toBeNull();

    const albumItems = document.querySelectorAll('.album-item');
    expect(albumItems.length).toBeGreaterThanOrEqual(2);

    const forwardTrigger = document.querySelector('.btn-forward-trigger');
    expect(forwardTrigger).not.toBeNull();

    const msgWithSender = document.querySelector('[data-sender-id="user-author-99"]');
    expect(msgWithSender).not.toBeNull();
  });
});
