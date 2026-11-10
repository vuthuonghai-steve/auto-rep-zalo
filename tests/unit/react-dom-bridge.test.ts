import { setReactInputValue, simulateKeyStroke } from '@/utils/react-dom-bridge';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('React 18 DOM Bridge (Unit Tests)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should set value on HTMLInputElement and trigger input & change events', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);

    const onInput = vi.fn();
    const onChange = vi.fn();
    input.addEventListener('input', onInput);
    input.addEventListener('change', onChange);

    setReactInputValue(input, 'Hello Input');

    expect(input.value).toBe('Hello Input');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should set value on HTMLTextAreaElement and trigger input & change events', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const onInput = vi.fn();
    textarea.addEventListener('input', onInput);

    setReactInputValue(textarea, 'Multi-line\nText');

    expect(textarea.value).toBe('Multi-line\nText');
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('should set value on contenteditable div (Zalo Chat Input) and trigger events', () => {
    const chatInput = document.createElement('div');
    chatInput.setAttribute('contenteditable', 'true');
    chatInput.id = 'chat-input-text';
    document.body.appendChild(chatInput);

    const onBeforeInput = vi.fn();
    const onInput = vi.fn();
    const onChange = vi.fn();

    chatInput.addEventListener('beforeinput', onBeforeInput);
    chatInput.addEventListener('input', onInput);
    chatInput.addEventListener('change', onChange);

    setReactInputValue(chatInput, 'Bán nhà 3.5 tỷ chính chủ');

    expect(chatInput.textContent).toBe('Bán nhà 3.5 tỷ chính chủ');
    expect(onBeforeInput).toHaveBeenCalledTimes(1);
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should simulate keystroke keydown, keypress, keyup', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    const keys: string[] = [];
    target.addEventListener('keydown', (e) => keys.push(`down:${e.key}`));
    target.addEventListener('keypress', (e) => keys.push(`press:${e.key}`));
    target.addEventListener('keyup', (e) => keys.push(`up:${e.key}`));

    simulateKeyStroke(target, 'Enter');

    expect(keys).toEqual(['down:Enter', 'press:Enter', 'up:Enter']);
  });
});
