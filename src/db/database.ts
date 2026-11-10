import type {
  AppSetting,
  DispatchQueueItem,
  GroupCheckpoint,
  MessageEntity,
  SystemLog,
} from '@/contracts/schemas';
import Dexie, { type Table } from 'dexie';

export class ZaloAutomationDatabase extends Dexie {
  app_settings!: Table<AppSetting, string>;
  group_checkpoints!: Table<GroupCheckpoint, string>;
  group_dispatch_queue!: Table<DispatchQueueItem, number>;
  entities!: Table<MessageEntity, number>;
  system_logs!: Table<SystemLog, number>;

  constructor(databaseName = 'ZaloAutomationDB') {
    super(databaseName);
    this.version(1).stores({
      app_settings: 'key',
      group_checkpoints: 'groupId, updatedAt',
      group_dispatch_queue: '++id, groupId, status, enqueuedAt',
      entities: '++id, entityKey, contentHash, createdAt',
      system_logs: '++id, correlationId, operation, level, nodeId, status, timestamp',
    });
  }
}

export const db = new ZaloAutomationDatabase();
export type { AppSetting, GroupCheckpoint, DispatchQueueItem, MessageEntity, SystemLog };
