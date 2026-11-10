import { describe, expect, it } from 'vitest';
import {
  computeContentHash,
  isHashMatch,
  truncateHash,
} from '../../src/utils/cryptoHasher';

describe('Surgical Crypto Hasher Utility (tests/unit/cryptoHasher.test.ts)', () => {
  describe('computeContentHash', () => {
    it('should compute valid 64-character SHA-256 hex string for nominal input', async () => {
      const input = 'hello world';
      const hash = await computeContentHash(input);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      // SHA-256 of "hello world" is b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should produce identical deterministic hash across multiple invocations', async () => {
      const input = 'deterministic content verification';
      const hash1 = await computeContentHash(input);
      const hash2 = await computeContentHash(input);

      expect(hash1).toBe(hash2);
    });

    it('should differentiate output when salt is provided', async () => {
      const input = 'secret message';
      const unsalted = await computeContentHash(input);
      const salted = await computeContentHash(input, 'tenant-salt-123');

      expect(salted).toHaveLength(64);
      expect(salted).not.toBe(unsalted);
    });

    it('should handle empty string correctly', async () => {
      const hash = await computeContentHash('');
      // SHA-256 of empty string is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should handle UTF-8 and Vietnamese characters with emojis properly', async () => {
      const input = 'Tin nhắn Zalo cá nhân tự động hóa 24/7 🎉🚀';
      const hash = await computeContentHash(input);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('isHashMatch', () => {
    it('should return true for exact matching hash', async () => {
      const content = 'antigravity-worker-b-test';
      const hash = await computeContentHash(content);

      const isMatch = await isHashMatch(content, hash);
      expect(isMatch).toBe(true);
    });

    it('should return true ignoring case variations and leading/trailing whitespace in expectedHash', async () => {
      const content = 'test payload';
      const hash = await computeContentHash(content);
      const upperHashWithSpaces = `  ${hash.toUpperCase()}  `;

      const isMatch = await isHashMatch(content, upperHashWithSpaces);
      expect(isMatch).toBe(true);
    });

    it('should return false when content does not match', async () => {
      const content = 'valid message';
      const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';

      const isMatch = await isHashMatch(content, fakeHash);
      expect(isMatch).toBe(false);
    });

    it('should return false when expectedHash is empty or invalid', async () => {
      expect(await isHashMatch('message', '')).toBe(false);
      // @ts-expect-error testing invalid type defensively
      expect(await isHashMatch('message', null)).toBe(false);
    });

    it('should match correctly when salt is applied', async () => {
      const content = 'salted verification';
      const salt = 'custom_salt_99';
      const saltedHash = await computeContentHash(content, salt);

      expect(await isHashMatch(content, saltedHash, salt)).toBe(true);
      expect(await isHashMatch(content, saltedHash, 'wrong_salt')).toBe(false);
    });
  });

  describe('truncateHash', () => {
    const fullHash = 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

    it('should default to 8 characters if length is omitted', () => {
      expect(truncateHash(fullHash)).toBe('b94d27b9');
    });

    it('should respect custom length', () => {
      expect(truncateHash(fullHash, 12)).toBe('b94d27b9934d');
      expect(truncateHash(fullHash, 4)).toBe('b94d');
    });

    it('should return empty string if hash is empty or length <= 0', () => {
      expect(truncateHash('')).toBe('');
      expect(truncateHash(fullHash, 0)).toBe('');
      expect(truncateHash(fullHash, -5)).toBe('');
    });

    it('should return entire string if length exceeds hash length', () => {
      expect(truncateHash('abc', 10)).toBe('abc');
    });
  });
});
