/**
 * Cầu nối tương thích React 18 DOM Bridge:
 * Hỗ trợ điền giá trị và kích hoạt React Synthetic Events cho cả HTMLInputElement,
 * HTMLTextAreaElement và div contenteditable của Zalo Web.
 */
export function setReactInputValue(element: HTMLElement, value: string): void {
  if (!element) return;

  // Trường hợp 1: HTMLInputElement
  if (element instanceof HTMLInputElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Trường hợp 2: HTMLTextAreaElement
  if (element instanceof HTMLTextAreaElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Trường hợp 3: Div contenteditable (Zalo Web Chat Input)
  if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
    element.focus();

    // Cập nhật nội dung văn bản
    element.textContent = value;

    // Kích hoạt chuỗi sự kiện trước và sau khi nhập liệu của React 18
    try {
      element.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: value,
        }),
      );
    } catch {
      element.dispatchEvent(new Event('beforeinput', { bubbles: true }));
    }

    try {
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: value,
        }),
      );
    } catch {
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Mô phỏng một sự kiện phím nhấn đầy đủ (keydown -> keypress -> keyup).
 */
export function simulateKeyStroke(element: HTMLElement, key: string): void {
  if (!element) return;

  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  element.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true, cancelable: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
}
