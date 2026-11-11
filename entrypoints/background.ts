import { onMessage } from '@/contracts/messaging';
import { logRepo } from '@/db/log-repo';
import { logger } from '@/utils/logger';
import { circuitBreaker } from '@/utils/pacing-guard';
import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  logger.info('SERVICE_WORKER', 'N00', 'Service Worker 24/7 background initialized');

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

  // 6. Mở trang Options trong một tab mới khi người dùng nhấp vào biểu tượng Extension
  chrome.action?.onClicked?.addListener(() => {
    const optionsUrl = chrome.runtime.getURL('options.html');
    if (chrome.tabs?.create) {
      chrome.tabs.create({ url: optionsUrl });
    } else {
      chrome.runtime.openOptionsPage();
    }
  });
});
