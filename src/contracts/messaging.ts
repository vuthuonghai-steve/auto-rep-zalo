import { defineExtensionMessaging } from '@webext-core/messaging';

export interface ProtocolMap {
  ping(): { status: 'PONG'; timestamp: number };
  getSettings(): { settings: Record<string, unknown> };
  updateSettings(data: { key: string; value: Record<string, unknown> }): { success: boolean };
  emergencyStop(data: { reason: string }): { stopped: boolean };
  getQueueStatus(): { count: number; isProcessing: boolean };
  exportLogs(data: { days?: number }): { json: string };
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
