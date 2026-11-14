import { initFeatureFlags } from '@/configs/storage.config';
import { onMessage } from '@/contracts/messaging';
import { discoverSidebarGroups, loadWhitelistSettings } from '@/nodes/n01-sidebar-observer';
import { orchestrator } from '@/orchestrator';
import { render } from 'preact';
import { createShadowRootUi } from 'wxt/client';
import { defineContentScript } from 'wxt/sandbox';
import { FloatingPanel, lastHeartbeat } from './FloatingPanel';
import './style.css';

export default defineContentScript({
  matches: ['https://chat.zalo.me/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    // 1. Khởi tạo giao diện nổi Floating Panel trong Shadow DOM cô lập hoàn toàn
    const ui = await createShadowRootUi(ctx, {
      name: 'zalo-automation-floating-panel',
      position: 'overlay',
      anchor: 'body',
      isolateEvents: ['keydown', 'keyup', 'keypress', 'click'],
      onMount: (container) => {
        render(<FloatingPanel />, container);
      },
      onRemove: () => {
        // Cleanup UI khi content script unmount
      },
    });
    ui.mount();

    // 2. Thiết lập kết nối Heartbeat Port 20s tới Service Worker background
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.connect) {
        const port = chrome.runtime.connect({ name: 'zalo-heartbeat' });

        port.onMessage.addListener((msg) => {
          if (msg && msg.type === 'HEARTBEAT_ACK') {
            lastHeartbeat.value = Date.now();
          }
        });

        const heartbeatTimer = setInterval(() => {
          try {
            port.postMessage({ type: 'HEARTBEAT' });
          } catch {
            clearInterval(heartbeatTimer);
          }
        }, 20000);

        ctx.onInvalidated(() => {
          clearInterval(heartbeatTimer);
          try {
            port.disconnect();
          } catch {
            // Port đã ngắt trước đó
          }
        });
      }
    } catch {
      // Môi trường test không có chrome.runtime.connect
    }

    // 3. Khởi động Orchestrator tự động hóa 10 Node
    orchestrator.start().catch((err) => {
      console.error('[ZaloAutomation] Orchestrator start failed:', err);
    });

    // 3.1. Lắng nghe thay đổi Feature Flags từ Side Panel/Options theo thời gian thực
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        const handleStorageChange = (
          changes: { [key: string]: chrome.storage.StorageChange },
          areaName: string,
        ) => {
          if (areaName === 'local' && (changes.feature_flags_state_v2 || changes.feature_flags_state)) {
            initFeatureFlags()
              .then(() => orchestrator.syncFeatures())
              .catch((err) => {
                console.error('[ZaloAutomation] Sync features on flag change failed:', err);
              });
          }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        ctx.onInvalidated(() => {
          chrome.storage.onChanged.removeListener(handleStorageChange);
        });
      }
    } catch {
      // Môi trường test không có chrome.storage
    }

    // 4. Lắng nghe yêu cầu quét danh sách nhóm từ Background / Side Panel
    try {
      const removeScanListener = onMessage('scanSidebarGroups', async () => {
        try {
          const whitelist = await loadWhitelistSettings();
          const results = discoverSidebarGroups(document, whitelist);
          return { groups: results };
        } catch (err) {
          console.error('[ZaloAutomation] scanSidebarGroups failed:', err);
          return { groups: [] };
        }
      });

      ctx.onInvalidated(() => {
        removeScanListener();
      });
    } catch (err) {
      console.error('[ZaloAutomation] Failed to register scanSidebarGroups listener:', err);
    }

    ctx.onInvalidated(() => {
      orchestrator.stop();
    });
  },
});
