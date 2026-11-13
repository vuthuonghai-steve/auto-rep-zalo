import { z } from 'zod';

export const AppSettingSchema = z.object({
  key: z.string().min(1),
  value: z.record(z.unknown()),
  updatedAt: z.number().int().positive(),
});
export type AppSetting = z.infer<typeof AppSettingSchema>;

export const GroupCheckpointSchema = z.object({
  groupId: z.string().min(1),
  lastMessageId: z.string(),
  lastSenderId: z.string(),
  updatedAt: z.number().int().positive(),
});
export type GroupCheckpoint = z.infer<typeof GroupCheckpointSchema>;

export const QueueStatusSchema = z.enum(['PENDING', 'PROCESSING', 'FAILED', 'COMPLETED']);
export type QueueStatus = z.infer<typeof QueueStatusSchema>;

export const DispatchQueueItemSchema = z.object({
  id: z.number().int().positive().optional(),
  groupId: z.string().min(1),
  status: QueueStatusSchema,
  retryCount: z.number().int().nonnegative().default(0),
  enqueuedAt: z.number().int().positive(),
});
export type DispatchQueueItem = z.infer<typeof DispatchQueueItemSchema>;

export const MessageEntitySchema = z.object({
  id: z.number().int().positive().optional(),
  entityKey: z.string().min(1),
  contentHash: z.string().min(1),
  rawText: z.string(),
  sourceGroupId: z.string().min(1),
  targetGroupIds: z.array(z.string()),
  createdAt: z.number().int().positive(),
});
export type MessageEntity = z.infer<typeof MessageEntitySchema>;

export const SystemLogLevelSchema = z.enum(['INFO', 'WARN', 'ERROR', 'CRITICAL']);
export type SystemLogLevel = z.infer<typeof SystemLogLevelSchema>;

export const SystemLogStatusSchema = z.enum(['SUCCESS', 'FAILURE', 'DEGRADED']);
export type SystemLogStatus = z.infer<typeof SystemLogStatusSchema>;

export const SystemLogSchema = z.object({
  id: z.number().int().positive().optional(),
  correlationId: z.string().min(1),
  operation: z.string().min(1),
  nodeId: z.string().min(1),
  level: SystemLogLevelSchema,
  status: SystemLogStatusSchema,
  durationMs: z.number().int().nonnegative(),
  groupId: z.string(),
  senderIdMasked: z.string(),
  phoneMasked: z.string().optional(),
  message: z.string(),
  errorPayload: z
    .object({
      code: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  timestamp: z.number().int().positive(),
});
export type SystemLog = z.infer<typeof SystemLogSchema>;

export const PriceRouteRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  minPrice: z.number().nonnegative(),
  maxPrice: z.number().positive().nullable().optional(),
  targetGroupIds: z.array(z.string().min(1)).max(2),
});
export type PriceRouteRule = z.infer<typeof PriceRouteRuleSchema>;

export const MessageItemSchema = z.object({
  msgId: z.string().min(1),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'ALBUM']),
  text: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  timestamp: z.number().int().positive(),
});
export type MessageItem = z.infer<typeof MessageItemSchema>;

export const EntityBundleSchema = z.object({
  bundleId: z.string().min(1),
  sourceGroupId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().optional(),
  messages: z.array(MessageItemSchema).min(1),
  rawCombinedText: z.string(),
  extractedPhone: z.string().optional(),
  detectedPrice: z.number().optional(),
  targetGroupIds: z.array(z.string()).max(2).default([]),
  createdAt: z.number().int().positive(),
});
export type EntityBundle = z.infer<typeof EntityBundleSchema>;

// ==========================================
// Node 01: Sidebar Observer & Whitelist Ingestion Schemas
// ==========================================

export const WhitelistMatchingRuleSchema = z.enum(['EXACT', 'CONTAINS']);
export type WhitelistMatchingRule = z.infer<typeof WhitelistMatchingRuleSchema>;

export const WhitelistGroupItemSchema = z.object({
  groupId: z.string().min(1),
  groupName: z.string().min(1),
  matchingRule: WhitelistMatchingRuleSchema,
  priority: z.number().int().min(1).max(5).default(1),
  isEnabled: z.boolean().default(true),
  addedAt: z.number().int().positive(),
  lastUpdatedAt: z.number().int().positive(),
});
export type WhitelistGroupItem = z.infer<typeof WhitelistGroupItemSchema>;

export const DiscoveredGroupItemSchema = z.object({
  groupId: z.string().min(1),
  groupName: z.string(),
  avatarUrl: z.string().optional(),
  isCommunity: z.boolean().default(false),
  unreadCount: z.number().int().nonnegative().default(0),
  lastSnippet: z.string().optional(),
  isInWhitelist: z.boolean().default(false),
});
export type DiscoveredGroupItem = z.infer<typeof DiscoveredGroupItemSchema>;

export const GroupDetectedEventSchema = z.object({
  groupId: z.string().min(1),
  groupName: z.string(),
  unreadCount: z.number().int().nonnegative(),
  lastSnippet: z.string().optional(),
  senderName: z.string().optional(),
  detectedAt: z.number().int().positive(),
  correlationId: z.string().min(1),
  isCommunity: z.boolean().default(false),
});
export type GroupDetectedEvent = z.infer<typeof GroupDetectedEventSchema>;

export const N01ConfigSchema = z.object({
  debounceMs: z.number().int().positive().default(300),
  maxDebounceBufferMs: z.number().int().positive().default(1500),
  autoAttachTimeoutMs: z.number().int().positive().default(30000),
  reconnectCooldownMs: z.number().int().positive().default(500),
});
export type N01Config = z.infer<typeof N01ConfigSchema>;

