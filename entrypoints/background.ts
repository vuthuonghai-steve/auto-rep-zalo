import { onMessage, sendMessage } from '@/contracts/messaging';
import { logRepo } from '@/db/log-repo';
import { logger } from '@/utils/logger';
import { circuitBreaker } from '@/utils/pacing-guard';
import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  logger.info('SERVICE_WORKER', 'N00', 'Service Worker 24/7 background initialized');

  // 0. Cấu hình hành vi Side Panel MV3 tự động mở khi click vào Action icon
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    }
  } catch {
    // API có thể chưa hỗ trợ trong môi trường giả lập test
  }

  // 1. Kích hoạt giữ thức hệ thống để OS không đưa màn hình/tab vào chế độ ngủ
  try {
    if (chrome.power?.requestKeepAwake) {
      chrome.power.requestKeepAwake('display');
    }
  } catch {
    // Chrome power API có thể không khả dụng trong một số môi trường kiểm thử
  }

  // 2. Quản lý kết nối Heartbeat Port 20s từ Content Script trên tab Zalo
  let lastHeartbeatTimestamp = Date.now();
  let hasActiveContentScript = false;

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'zalo-heartbeat') {
      hasActiveContentScript = true;
      lastHeartbeatTimestamp = Date.now();

      port.onMessage.addListener((msg) => {
        if (msg && msg.type === 'HEARTBEAT') {
          lastHeartbeatTimestamp = Date.now();
          port.postMessage({ type: 'HEARTBEAT_ACK', timestamp: Date.now() });
        }
      });

      port.onDisconnect.addListener(() => {
        hasActiveContentScript = false;
        logger.warn('HEARTBEAT_WATCHDOG', 'N00', 'Zalo Content Script port disconnected');
      });
    }
  });

  // 3. Watchdog Timer 60s: Cảnh báo nếu Content Script mất kết nối quá 60s
  setInterval(() => {
    if (hasActiveContentScript && Date.now() - lastHeartbeatTimestamp > 60000) {
      logger.warn(
        'HEARTBEAT_WATCHDOG',
        'N00',
        'Watchdog: Không nhận được nhịp tim từ Zalo Web trong 60s!',
      );
      if (chrome.notifications?.create) {
        chrome.notifications.create('zalo-watchdog-alert', {
          type: 'basic',
          iconUrl: '/icon/128.png',
          title: 'Zalo Automation Cảnh Báo',
          message: 'Mất kết nối Heartbeat với Zalo Web quá 60 giây. Vui lòng kiểm tra tab Zalo.',
          priority: 2,
        });
      }
    }
  }, 60000);

  // 4. Lắng nghe các lệnh điều khiển IPC từ Options và Content Script
  onMessage('ping', () => {
    return { status: 'PONG', timestamp: Date.now() };
  });

  // 5. Tự động dọn dẹp log hệ thống cũ > 7 ngày định kỳ
  logRepo.cleanLogsOlderThan(7).catch(() => {});
  setInterval(
    () => {
      logRepo.cleanLogsOlderThan(7).catch(() => {});
    },
    24 * 60 * 60 * 1000,
  );

  onMessage('emergencyStop', (msg) => {
    circuitBreaker.emergencyStop(msg.data.reason);
    logger.warn('EMERGENCY_STOP', 'N00', `Emergency Stop activated via IPC: ${msg.data.reason}`);
    return { stopped: true };
  });

  onMessage('exportLogs', async (msg) => {
    const json = await logRepo.exportLogsToJson(msg.data.days || 7);
    return { json };
  });

  // 6. Lắng nghe yêu cầu mở Side Panel từ Content Script hoặc Popup
  onMessage('openSidePanel', async ({ sender }) => {
    try {
      const tabId = sender?.tab?.id;
      if (tabId && chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ tabId });
        return { success: true };
      }
      if (chrome.sidePanel?.open) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          await chrome.sidePanel.open({ tabId: activeTab.id });
          return { success: true };
        }
      }
    } catch (err) {
      logger.error('SIDE_PANEL', 'N00', 'Failed to open side panel', err);
    }
    return { success: false };
  });

  // 7. Chuyển tiếp yêu cầu quét danh sách nhóm từ Side Panel tới Content Script trên Zalo Tab
  onMessage('scanSidebarGroups', async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        let zaloTab: chrome.tabs.Tab | undefined;
        try {
          const tabs = await chrome.tabs.query({ url: '*://chat.zalo.me/*' });
          zaloTab = tabs.find((t) => t.id !== undefined && !t.discarded) || tabs[0];
        } catch {
          // Fallback query all tabs
        }

        if (!zaloTab?.id) {
          const allTabs = await chrome.tabs.query({});
          zaloTab = allTabs.find((t) => t.url && t.url.includes('chat.zalo.me'));
        }

        if (zaloTab?.id) {
          const response = await sendMessage('scanSidebarGroups', undefined, zaloTab.id);
          return response || { groups: [] };
        }
      }
    } catch (err) {
      logger.error(
        'SERVICE_WORKER',
        'N00',
        'Failed to scan sidebar groups via content script',
        err,
      );
    }
    return { groups: [] };
  });
});
