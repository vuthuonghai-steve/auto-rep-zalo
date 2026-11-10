import { CorrelationContext } from '@/utils/correlation';
import { beforeEach, describe, expect, it } from 'vitest';

describe('CorrelationContext (Unit Tests)', () => {
  beforeEach(() => {
    CorrelationContext.clear();
  });

  it('should generate valid correlation ID with corr_ prefix', () => {
    const id = CorrelationContext.generate();
    expect(id).toMatch(/^corr_\d+_[a-f0-9]+$/i);
  });

  it('should auto-generate ID when get() is called without context', () => {
    const id = CorrelationContext.get();
    expect(id).toBeDefined();
    expect(id.startsWith('corr_')).toBe(true);
  });

  it('should support manual set and clear', () => {
    CorrelationContext.set('corr_custom_123');
    expect(CorrelationContext.get()).toBe('corr_custom_123');

    CorrelationContext.clear();
    const newId = CorrelationContext.get();
    expect(newId).not.toBe('corr_custom_123');
  });

  it('should isolate context within synchronous runWith', () => {
    CorrelationContext.set('parent_id');

    const result = CorrelationContext.runWith('child_id', () => {
      expect(CorrelationContext.get()).toBe('child_id');
      return 42;
    });

    expect(result).toBe(42);
    expect(CorrelationContext.get()).toBe('parent_id');
  });

  it('should isolate context within asynchronous runWith', async () => {
    CorrelationContext.set('initial_id');

    const result = await CorrelationContext.runWith('async_child_id', async () => {
      await new Promise((r) => setTimeout(r, 10));
      expect(CorrelationContext.get()).toBe('async_child_id');
      return 'async_success';
    });

    expect(result).toBe('async_success');
    expect(CorrelationContext.get()).toBe('initial_id');
  });

  it('should restore previous context even if runWith throws an error', () => {
    CorrelationContext.set('error_parent_id');

    expect(() => {
      CorrelationContext.runWith('error_child_id', () => {
        throw new Error('Test failure');
      });
    }).toThrow('Test failure');

    expect(CorrelationContext.get()).toBe('error_parent_id');
  });
});
