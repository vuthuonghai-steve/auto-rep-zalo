import { normalizeTextForHash, sha256 } from '@/utils/crypto-hash';
import { describe, expect, it } from 'vitest';

describe('CryptoHash & Text Normalization (Unit Tests)', () => {
  describe('normalizeTextForHash', () => {
    it('should strip emojis and punctuation whitespace', () => {
      const raw = '🔥 Bán nhà Cầu Giấy 🏡 3.8 tỷ! \n\n Liên hệ ngay 🚀';
      const normalized = normalizeTextForHash(raw);

      expect(normalized).not.toContain('🔥');
      expect(normalized).not.toContain('🏡');
      expect(normalized).not.toContain('🚀');
      expect(normalized).toBe('bán nhà cầu giấy 3.8 tỷ! liên hệ ngay');
    });

    it('should normalize double spaces and line breaks', () => {
      const raw = '  Bán   đất  \r\n\t  thổ cư   120m2   ';
      expect(normalizeTextForHash(raw)).toBe('bán đất thổ cư 120m2');
    });

    it('should handle empty or null string gracefully', () => {
      expect(normalizeTextForHash('')).toBe('');
    });
  });

  describe('sha256', () => {
    it('should generate deterministic 64-character hex hash', async () => {
      const text = 'bán nhà cầu giấy 3.8 tỷ';
      const hash1 = await sha256(text);
      const hash2 = await sha256(text);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different texts', async () => {
      const hash1 = await sha256('Nhà 3.8 tỷ');
      const hash2 = await sha256('Nhà 4.5 tỷ');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce identical hash for same content with different emojis or extra spaces after normalization', async () => {
      const text1 = 'Bán nhà Cầu Giấy 🔥 3.8 tỷ\nLiên hệ';
      const text2 = '  bán  nhà  Cầu Giấy   3.8 tỷ   liên hệ  ';

      const hash1 = await sha256(normalizeTextForHash(text1));
      const hash2 = await sha256(normalizeTextForHash(text2));

      expect(hash1).toBe(hash2);
    });
  });
});
