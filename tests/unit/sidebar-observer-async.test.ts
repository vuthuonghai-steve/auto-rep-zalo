import { SidebarObserver } from '@/nodes/n01-sidebar-observer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('SidebarObserver Auto-Attach & Delayed DOM Mount (tests/unit/sidebar-observer-async.test.ts)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should immediately attach when sidebar element is already present in DOM', () => {
    document.body.innerHTML = `
      <div id="conversationListId" data-id="div_TabMsg_ThrdChList">
        <div id="conversationList" role="grid"></div>
      </div>
    `;

    const onNewMsg = vi.fn();
    const observer = new SidebarObserver({
      whitelist: ['conv-1'],
      onNewMessage: onNewMsg,
      rootDocument: document,
    });

    const started = observer.start();
    expect(started).toBe(true);
    expect(observer.isObserving()).toBe(true);
    expect(observer.isAttached()).toBe(true);

    observer.stop();
    expect(observer.isObserving()).toBe(false);
    expect(observer.isAttached()).toBe(false);
  });

  it('should enter waiting mode and auto-attach when sidebar is mounted after 50ms', async () => {
    document.body.innerHTML = '<div id="root-loading"><span>React App Loading...</span></div>';

    const onNewMsg = vi.fn();
    const observer = new SidebarObserver({
      whitelist: ['group-test-delayed'],
      onNewMessage: onNewMsg,
      rootDocument: document,
      autoAttachTimeoutMs: 5000,
    });

    const started = observer.start();
    expect(started).toBe(true);
    expect(observer.isObserving()).toBe(true);
    expect(observer.isAttached()).toBe(false);

    // Mô phỏng sau 50ms React render xong danh sách hội thoại
    await new Promise((resolve) => setTimeout(resolve, 50));

    const sidebarContainer = document.createElement('div');
    sidebarContainer.id = 'conversationList';
    sidebarContainer.setAttribute('role', 'grid');
    sidebarContainer.innerHTML = `
      <div class="conv-item" data-id="group-test-delayed">
        <span class="conv-name">Nhóm BĐS Đầu Tư</span>
        <span class="unread-badge">1</span>
      </div>
    `;
    document.body.appendChild(sidebarContainer);

    // Chờ một khoảng ngắn để MutationObserver kích hoạt callback
    // Chờ cửa sổ khử rung debounce (300ms) kích hoạt callback
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(observer.isAttached()).toBe(true);
    expect(onNewMsg).toHaveBeenCalledWith('group-test-delayed');

    // Sau khi đã attach, kiểm tra sự kiện đột biến tin nhắn mới tiếp theo
    const item = sidebarContainer.querySelector('.conv-item') as HTMLElement;
    const dot = document.createElement('span');
    dot.className = 'unread-red-dot';
    item.appendChild(dot);

    // Chờ cửa sổ khử rung debounce (300ms) kích hoạt callback
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(onNewMsg).toHaveBeenCalledTimes(2);

    observer.stop();
    expect(observer.isObserving()).toBe(false);
    expect(observer.isAttached()).toBe(false);
  });

  it('should cancel waiting mode and clean up on stop() before DOM mounts', async () => {
    document.body.innerHTML = '<div id="empty-app"></div>';

    const onNewMsg = vi.fn();
    const observer = new SidebarObserver({
      whitelist: ['group-test'],
      onNewMessage: onNewMsg,
      rootDocument: document,
      autoAttachTimeoutMs: 1000,
    });

    observer.start();
    expect(observer.isObserving()).toBe(true);
    expect(observer.isAttached()).toBe(false);

    observer.stop();
    expect(observer.isObserving()).toBe(false);
    expect(observer.isAttached()).toBe(false);

    // Chèn phần tử sau khi đã stop -> không được attach và không gọi callback
    const sidebar = document.createElement('div');
    sidebar.id = 'conversationList';
    sidebar.innerHTML =
      '<div class="conv-item" data-id="group-test"><span class="unread-badge">5</span></div>';
    document.body.appendChild(sidebar);

    // Chờ cửa sổ khử rung debounce (300ms) kích hoạt callback
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(observer.isAttached()).toBe(false);
    expect(onNewMsg).not.toHaveBeenCalled();
  });

  it('should handle timeout when sidebar element never appears', async () => {
    document.body.innerHTML = '<div>Never renders sidebar</div>';

    const onNewMsg = vi.fn();
    const observer = new SidebarObserver({
      whitelist: ['group-test'],
      onNewMessage: onNewMsg,
      rootDocument: document,
      autoAttachTimeoutMs: 50, // Short timeout for test
    });

    observer.start();
    expect(observer.isAttached()).toBe(false);

    // Chờ quá thời gian timeout 50ms
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(observer.isAttached()).toBe(false);
    observer.stop();
  });
});
