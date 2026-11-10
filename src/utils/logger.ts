import type { SystemLog, SystemLogLevel, SystemLogStatus } from '@/contracts/schemas';
import { logRepo } from '@/db/log-repo';
import { CorrelationContext } from './correlation';

/**
 * Che dấu số điện thoại theo chuẩn bảo mật:
 * Giữ 3 số đầu, 3 số cuối, thay 4 số ở giữa bằng ****.
 * Ví dụ: '0901234567' -> '090****567'.
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s.-]/g, '');
  if (cleaned.length < 7) {
    return '***';
  }
  const prefix = cleaned.substring(0, 3);
  const suffix = cleaned.substring(cleaned.length - 3);
  return `${prefix}****${suffix}`;
}

/**
 * Che dấu ID người gửi để bảo vệ quyền riêng tư người dùng.
 */
export function maskSenderId(senderId?: string | null): string {
  if (!senderId) return 'u_anon';
  if (senderId.length <= 4) return 'u_***';
  return `${senderId.substring(0, 2)}***${senderId.substring(senderId.length - 2)}`;
}

/**
 * Rút gọn và làm sạch văn bản nhạy cảm (mật khẩu, mã xác thực OTP).
 */
export function sanitizeMessageText(text?: string | null, maxLen = 80): string {
  if (!text) return '';
  let sanitized = text
    .replace(
      /(mật khẩu|mat khau|password|pass|otp|mã xác thực)[:=\s]+[a-zA-Z0-9_-]+/gi,
      '$1: [MASKED]',
    )
    .trim();

  if (sanitized.length > maxLen) {
    sanitized = `${sanitized.substring(0, maxLen)}...`;
  }
  return sanitized;
}

export interface LogEventOptions {
  operation: string;
  nodeId: string;
  level?: SystemLogLevel | undefined;
  status?: SystemLogStatus | undefined;
  durationMs?: number | undefined;
  groupId?: string | undefined;
  senderId?: string | undefined;
  phone?: string | undefined;
  message: string;
  error?: unknown;
}

export class StructuredLogger {
  /**
   * Phát ra bản ghi sự kiện toàn diện (Canonical Log Line) tới Console và Dexie Ring-Buffer Sink.
   */
  async logCanonicalEvent(options: LogEventOptions): Promise<SystemLog> {
    const timestamp = Date.now();
    const correlationId = CorrelationContext.get();
    const level: SystemLogLevel = options.level || 'INFO';
    const status: SystemLogStatus =
      options.status || (level === 'ERROR' || level === 'CRITICAL' ? 'FAILURE' : 'SUCCESS');
    const senderIdMasked = maskSenderId(options.senderId);
    const phoneMasked = options.phone ? maskPhoneNumber(options.phone) : undefined;

    let errorPayload: SystemLog['errorPayload'] | undefined;
    if (options.error) {
      if (options.error instanceof Error) {
        errorPayload = {
          code: options.error.name,
          message: options.error.message,
          stack: options.error.stack,
        };
      } else {
        errorPayload = {
          code: 'UNKNOWN_ERROR',
          message: String(options.error),
        };
      }
    }

    const logEntry: Omit<SystemLog, 'id'> = {
      correlationId,
      operation: options.operation,
      nodeId: options.nodeId,
      level,
      status,
      durationMs: options.durationMs ?? 0,
      groupId: options.groupId || 'g_global',
      senderIdMasked,
      phoneMasked,
      message: sanitizeMessageText(options.message, 120),
      errorPayload,
      timestamp,
    };

    // Sink 1: Console Sink formatted for Chrome DevTools
    this.writeToConsole(logEntry);

    // Sink 2: Dexie Ring-Buffer Sink
    try {
      const id = await logRepo.addLog(logEntry);
      return { ...logEntry, id };
    } catch {
      return { ...logEntry, id: -1 };
    }
  }

  private writeToConsole(log: Omit<SystemLog, 'id'>): void {
    const timeStr = new Date(log.timestamp).toISOString();
    const formatted = `[${timeStr}] [${log.level}] [OP=${log.operation}] [CORR=${log.correlationId}] status=${log.status} duration=${log.durationMs}ms group=${log.groupId} sender=${log.senderIdMasked} ${log.phoneMasked ? `phone=${log.phoneMasked} ` : ''}msg="${log.message}"`;

    switch (log.level) {
      case 'INFO':
        console.info(formatted);
        break;
      case 'WARN':
        console.warn(formatted);
        break;
      case 'ERROR':
      case 'CRITICAL':
        console.error(formatted, log.errorPayload);
        break;
    }
  }

  async info(
    operation: string,
    nodeId: string,
    message: string,
    meta?: Partial<LogEventOptions>,
  ): Promise<SystemLog> {
    return await this.logCanonicalEvent({ ...meta, operation, nodeId, message, level: 'INFO' });
  }

  async warn(
    operation: string,
    nodeId: string,
    message: string,
    meta?: Partial<LogEventOptions>,
  ): Promise<SystemLog> {
    return await this.logCanonicalEvent({ ...meta, operation, nodeId, message, level: 'WARN' });
  }

  async error(
    operation: string,
    nodeId: string,
    message: string,
    error?: unknown,
    meta?: Partial<LogEventOptions>,
  ): Promise<SystemLog> {
    return await this.logCanonicalEvent({
      ...meta,
      operation,
      nodeId,
      message,
      error,
      level: 'ERROR',
      status: 'FAILURE',
    });
  }

  async critical(
    operation: string,
    nodeId: string,
    message: string,
    error?: unknown,
    meta?: Partial<LogEventOptions>,
  ): Promise<SystemLog> {
    return await this.logCanonicalEvent({
      ...meta,
      operation,
      nodeId,
      message,
      error,
      level: 'CRITICAL',
      status: 'FAILURE',
    });
  }
}

export const logger = new StructuredLogger();
