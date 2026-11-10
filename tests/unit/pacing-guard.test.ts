import { CircuitBreaker, microDelay, randomJitter } from '@/utils/pacing-guard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('PacingGuard & CircuitBreaker (Unit Tests)', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker();
  });

  describe('randomJitter and microDelay', () => {
    it('should wait within range for randomJitter', async () => {
      const start = Date.now();
      const delay = await randomJitter(10, 30);
      const elapsed = Date.now() - start;

      expect(delay).toBeGreaterThanOrEqual(10);
      expect(delay).toBeLessThanOrEqual(30);
      expect(elapsed).toBeGreaterThanOrEqual(8);
    });

    it('should wait within range for microDelay', async () => {
      const delay = await microDelay(5, 15);
      expect(delay).toBeGreaterThanOrEqual(5);
      expect(delay).toBeLessThanOrEqual(15);
    });
  });

  describe('CircuitBreaker transitions', () => {
    it('should start in NORMAL state and not blocked', () => {
      expect(cb.getState()).toBe('NORMAL');
      expect(cb.isBlocked()).toBe(false);
      expect(() => cb.assertNotBlocked()).not.toThrow();
    });

    it('should transition to PAUSED_BY_CAPTCHA on tripCaptcha', () => {
      const listener = vi.fn();
      cb.onStateChange(listener);

      cb.tripCaptcha('Slide puzzle detected');

      expect(cb.getState()).toBe('PAUSED_BY_CAPTCHA');
      expect(cb.isBlocked()).toBe(true);
      expect(listener).toHaveBeenCalledWith('PAUSED_BY_CAPTCHA', 'Slide puzzle detected');
      expect(() => cb.assertNotBlocked()).toThrow(/Slide puzzle detected/);
    });

    it('should transition to EMERGENCY_STOPPED on emergencyStop', () => {
      cb.emergencyStop('Operator pressed button');

      expect(cb.getState()).toBe('EMERGENCY_STOPPED');
      expect(cb.isBlocked()).toBe(true);
      expect(() => cb.assertNotBlocked()).toThrow(/Operator pressed button/);
    });

    it('should resume to NORMAL state', () => {
      cb.tripCaptcha('Blocked');
      expect(cb.isBlocked()).toBe(true);

      cb.resume();
      expect(cb.getState()).toBe('NORMAL');
      expect(cb.isBlocked()).toBe(false);
      expect(() => cb.assertNotBlocked()).not.toThrow();
    });

    it('should allow unsubscribing from state change listener', () => {
      const listener = vi.fn();
      const unsubscribe = cb.onStateChange(listener);

      unsubscribe();
      cb.tripCaptcha('Test');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
