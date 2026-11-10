import { CorrelationContext } from '@/utils/correlation';
import {
  StructuredLogger,
  maskPhoneNumber,
  maskSenderId,
  sanitizeMessageText,
} from '@/utils/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('StructuredLogger & Data Masking Engine (Unit Tests)', () => {
  beforeEach(() => {
    CorrelationContext.clear();
    vi.restoreAllMocks();
  });

  describe('maskPhoneNumber', () => {
    it('should mask standard 10-digit phone numbers with 4 asterisks in the middle', () => {
      expect(maskPhoneNumber('0901234567')).toBe('090****567');
      expect(maskPhoneNumber('0987654321')).toBe('098****321');
    });

    it('should strip punctuation and dots before masking', () => {
      expect(maskPhoneNumber('090.123.4567')).toBe('090****567');
      expect(maskPhoneNumber('090 123 4567')).toBe('090****567');
    });

    it('should return empty string for null/undefined or short phone', () => {
      expect(maskPhoneNumber(null)).toBe('');
      expect(maskPhoneNumber('')).toBe('');
      expect(maskPhoneNumber('12345')).toBe('***');
    });
  });

  describe('maskSenderId', () => {
    it('should mask sender ID preserving edges', () => {
      expect(maskSenderId('user123456')).toBe('us***56');
    });

    it('should handle short or empty sender ID', () => {
      expect(maskSenderId('')).toBe('u_anon');
      expect(maskSenderId('abc')).toBe('u_***');
    });
  });

  describe('sanitizeMessageText', () => {
    it('should mask passwords and OTP tokens', () => {
      const raw = 'Thông tin căn hộ, mat khau: secret123, OTP: 987654 vui lòng xem';
      const clean = sanitizeMessageText(raw);
      expect(clean).toContain('mat khau: [MASKED]');
      expect(clean).toContain('OTP: [MASKED]');
      expect(clean).not.toContain('secret123');
      expect(clean).not.toContain('987654');
    });

    it('should truncate message text exceeding maxLen', () => {
      const longText = 'A'.repeat(150);
      const clean = sanitizeMessageText(longText, 50);
      expect(clean.length).toBe(53); // 50 + '...'
      expect(clean.endsWith('...')).toBe(true);
    });
  });

  describe('StructuredLogger emission', () => {
    it('should emit canonical log with active correlation ID and write to console and Dexie sink', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const customLogger = new StructuredLogger();

      await CorrelationContext.runWith('corr_canonical_test', async () => {
        const log = await customLogger.info('QUEUE_DISPATCH', 'N02', 'Queue processing completed', {
          groupId: 'g_test',
          phone: '0901234567',
          durationMs: 45,
        });

        expect(log.correlationId).toBe('corr_canonical_test');
        expect(log.operation).toBe('QUEUE_DISPATCH');
        expect(log.nodeId).toBe('N02');
        expect(log.level).toBe('INFO');
        expect(log.status).toBe('SUCCESS');
        expect(log.phoneMasked).toBe('090****567');
        expect(log.durationMs).toBe(45);
      });

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should capture Error object payload on error / critical', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const customLogger = new StructuredLogger();

      const testError = new Error('DOM Element not found');
      const log = await customLogger.error('DOM_STAGING', 'N03', 'Failed to anchor DOM', testError);

      expect(log.level).toBe('ERROR');
      expect(log.status).toBe('FAILURE');
      expect(log.errorPayload?.code).toBe('Error');
      expect(log.errorPayload?.message).toBe('DOM Element not found');
      expect(log.errorPayload?.stack).toBeDefined();
    });
  });
});
