import { z } from 'zod';

/**
 * SSOT Runtime Schema & Type (Layer 2)
 * Đặt tại src/contracts/
 */
export const {{SchemaName}}Schema = z.object({
  id: z.string().min(1, 'ID khong duoc de trong'),
  action: z.enum(['START', 'PAUSE', 'SYNC']),
  payload: z.record(z.unknown()).optional(),
  timestamp: z.number().default(() => Date.now()),
});

export type {{SchemaName}}Payload = z.infer<typeof {{SchemaName}}Schema>;

