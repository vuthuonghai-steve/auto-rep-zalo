import { onMessage, sendMessage } from '@/contracts/messaging';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Messaging IPC Protocol Map (Integration Tests)', () => {
  type MessageListener = (
    message: unknown,
    sender: unknown,
    sendResponse: (res: unknown) => void,
  ) => boolean | undefined;

  const listeners: MessageListener[] = [];

  beforeEach(() => {
    listeners.length = 0;

    // Thiết lập mock cục bộ chrome.runtime cho test runner Vitest
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        id: 'test-extension-id',
        lastError: null,
        onMessage: {
          addListener: vi.fn((fn: MessageListener) => {
            listeners.push(fn);
          }),
          removeListener: vi.fn((fn: MessageListener) => {
            const idx = listeners.indexOf(fn);
            if (idx >= 0) listeners.splice(idx, 1);
          }),
        },
        sendMessage: vi.fn((message: unknown, callback?: (res: unknown) => void) => {
          for (const listener of [...listeners]) {
            listener(message, { id: 'sender' }, (res) => {
              if (callback) callback(res);
            });
          }
        }),
      },
    };
  });

  it('should register and respond to ping message type-safely', async () => {
    const unregister = onMessage('ping', () => {
      return { status: 'PONG', timestamp: 1234567890 };
    });

    const response = await sendMessage('ping', undefined);
    expect(response).toEqual({ status: 'PONG', timestamp: 1234567890 });

    unregister();
  });

  it('should handle getSettings and updateSettings IPC calls', async () => {
    const mockStore: Record<string, unknown> = {
      whitelist: ['g_test_1', 'g_test_2'],
    };

    const unregGet = onMessage('getSettings', () => {
      return { settings: mockStore };
    });

    const unregUpdate = onMessage('updateSettings', (msg) => {
      mockStore[msg.data.key] = msg.data.value;
      return { success: true };
    });

    const getRes = await sendMessage('getSettings', undefined);
    expect(getRes.settings.whitelist).toEqual(['g_test_1', 'g_test_2']);

    const updateRes = await sendMessage('updateSettings', {
      key: 'priceRules',
      value: { min: 2, max: 5 },
    });
    expect(updateRes.success).toBe(true);
    expect(mockStore.priceRules).toEqual({ min: 2, max: 5 });

    unregGet();
    unregUpdate();
  });

  it('should handle emergencyStop command', async () => {
    const unregStop = onMessage('emergencyStop', (msg) => {
      expect(msg.data.reason).toBe('Captcha detected');
      return { stopped: true };
    });

    const result = await sendMessage('emergencyStop', { reason: 'Captcha detected' });
    expect(result.stopped).toBe(true);

    unregStop();
  });

  it('should handle getQueueStatus and exportLogs IPC messages', async () => {
    const unregQueue = onMessage('getQueueStatus', () => {
      return { count: 3, isProcessing: true };
    });

    const unregLogs = onMessage('exportLogs', (msg) => {
      return { json: JSON.stringify({ days: msg.data.days || 7, exported: true }) };
    });

    const qStatus = await sendMessage('getQueueStatus', undefined);
    expect(qStatus).toEqual({ count: 3, isProcessing: true });

    const logs = await sendMessage('exportLogs', { days: 3 });
    const parsed = JSON.parse(logs.json);
    expect(parsed.days).toBe(3);
    expect(parsed.exported).toBe(true);

    unregQueue();
    unregLogs();
  });

  it('should handle scanSidebarGroups IPC messages and return discovered groups', async () => {
    const mockGroups = [
      {
        groupId: 'g_test_123',
        groupName: 'Nhóm Mua Bán Test',
        isCommunity: true,
        unreadCount: 2,
        isInWhitelist: false,
      },
    ];

    const unregScan = onMessage('scanSidebarGroups', () => {
      return { groups: mockGroups };
    });

    const response = await sendMessage('scanSidebarGroups', undefined);
    expect(response).toBeDefined();
    expect(response.groups).toHaveLength(1);
    expect(response.groups[0]?.groupId).toBe('g_test_123');
    expect(response.groups[0]?.groupName).toBe('Nhóm Mua Bán Test');

    unregScan();
  });
});
