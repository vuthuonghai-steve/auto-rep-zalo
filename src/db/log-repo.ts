import type { SystemLog } from '@/contracts/schemas';
import { type ZaloAutomationDatabase, db as defaultDb } from './database';

const DEFAULT_LOG_RETENTION_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LogExportPayload {
  extensionVersion: string;
  exportTimestamp: number;
  totalLogs: number;
  logs: SystemLog[];
}

export class LogRepository {
  constructor(private db: ZaloAutomationDatabase = defaultDb) {}

  /**
   * Lưu Canonical Log Line vào bảng system_logs.
   * Tự động kích hoạt dọn dẹp xoay vòng Ring-Buffer (TTL 7 ngày).
   */
  async addLog(log: Omit<SystemLog, 'id'>): Promise<number> {
    const id = await this.db.system_logs.add(log);

    // Kích hoạt dọn dẹp cuốn chiếu bất đồng bộ
    this.cleanLogsOlderThan(DEFAULT_LOG_RETENTION_DAYS).catch(() => {
      // Bỏ qua lỗi dọn dẹp nền để không làm gián đoạn luồng chính
    });

    return id;
  }

  /**
   * Xóa toàn bộ logs vượt quá thời gian lưu trữ (mặc định 7 ngày).
   */
  async cleanLogsOlderThan(days = DEFAULT_LOG_RETENTION_DAYS): Promise<number> {
    const threshold = Date.now() - days * MS_PER_DAY;
    return await this.db.system_logs.where('timestamp').below(threshold).delete();
  }

  /**
   * Lấy danh sách logs gần nhất phục vụ giám sát và kiểm thử.
   */
  async getRecentLogs(limit = 100): Promise<SystemLog[]> {
    return await this.db.system_logs.orderBy('timestamp').reverse().limit(limit).toArray();
  }

  /**
   * Xuất toàn bộ logs của 7 ngày gần nhất thành chuỗi JSON chẩn đoán.
   */
  async exportLogsToJson(
    days = DEFAULT_LOG_RETENTION_DAYS,
    extensionVersion = '1.0.0',
  ): Promise<string> {
    const threshold = Date.now() - days * MS_PER_DAY;
    const logs = await this.db.system_logs
      .where('timestamp')
      .aboveOrEqual(threshold)
      .sortBy('timestamp');

    const payload: LogExportPayload = {
      extensionVersion,
      exportTimestamp: Date.now(),
      totalLogs: logs.length,
      logs,
    };

    return JSON.stringify(payload, null, 2);
  }

  /**
   * Đếm tổng số logs trong cơ sở dữ liệu.
   */
  async count(): Promise<number> {
    return await this.db.system_logs.count();
  }

  /**
   * Xóa toàn bộ bảng system_logs.
   */
  async clearLogs(): Promise<void> {
    await this.db.system_logs.clear();
  }
}

export const logRepo = new LogRepository();
