import { isGroupNameMatching, normalizeZaloText } from '@/utils/text-normalizer';
import { describe, expect, it } from 'vitest';

describe('Text Normalizer Utility (Node 01: T004)', () => {
  describe('normalizeZaloText', () => {
    it('nominal: should normalize Vietnamese Unicode NFD (composite) to NFC (precomposed)', () => {
      // "Hải" dạng NFD (H + a + dấu hỏi \u0309 + i) vs NFC (H + ả \u1EA3 + i)
      const nfdText = 'H\u0061\u0309i';
      const nfcText = 'H\u1EA3i';

      expect(nfdText).not.toBe(nfcText); // Khác nhau ở biểu diễn mã nhị phân
      expect(nfdText.length).toBe(4);
      expect(nfcText.length).toBe(3);

      const normalizedNfd = normalizeZaloText(nfdText);
      const normalizedNfc = normalizeZaloText(nfcText);

      expect(normalizedNfd).toBe('Hải');
      expect(normalizedNfc).toBe('Hải');
      expect(normalizedNfd).toBe(normalizedNfc);

      console.info('[Proof: Vietnamese Unicode NFC Normalization]', {
        inputNFD: nfdText,
        inputNFCLen: nfcText.length,
        normalizedNFD: normalizedNfd,
        normalizedNFCLen: normalizedNfd.length,
        isIdentical: normalizedNfd === normalizedNfc,
      });
    });

    it('nominal: should replace non-breaking space (\\u00A0 and &nbsp;) with standard space', () => {
      const domExtracted = 'Bất\u00A0Động&nbsp;Sản\u00A0Hà&nbsp;Nội';
      const normalized = normalizeZaloText(domExtracted);

      expect(normalized).toBe('Bất Động Sản Hà Nội');
      expect(normalized.includes('\u00A0')).toBe(false);
      expect(normalized.includes('&nbsp;')).toBe(false);

      console.info('[Proof: Non-breaking space cleaning]', {
        input: domExtracted,
        output: normalized,
      });
    });

    it('nominal: should remove zero-width spaces (\\u200B and \\uFEFF)', () => {
      const textWithZeroWidth = 'Zalo\u200BAutomation\uFEFFVIP';
      const normalized = normalizeZaloText(textWithZeroWidth);

      expect(normalized).toBe('Zalo Automation VIP');
      expect(normalized.includes('\u200B')).toBe(false);
      expect(normalized.includes('\uFEFF')).toBe(false);

      console.info('[Proof: Zero-width space removal]', {
        input: textWithZeroWidth,
        output: normalized,
      });
    });

    it('nominal: should collapse multiple spaces and trim whitespace at both ends', () => {
      const messyInput = '   \u00A0  Nhóm    Chia   Sẻ   Kinh   Nghiệm   \u200B   ';
      const normalized = normalizeZaloText(messyInput);

      expect(normalized).toBe('Nhóm Chia Sẻ Kinh Nghiệm');

      console.info('[Proof: Whitespace collapse & trim]', {
        raw: messyInput,
        clean: normalized,
      });
    });

    it('boundary: should handle empty, null, undefined, or invisible-only inputs gracefully', () => {
      expect(normalizeZaloText('')).toBe('');
      expect(normalizeZaloText(null)).toBe('');
      expect(normalizeZaloText(undefined)).toBe('');
      expect(normalizeZaloText('     ')).toBe('');
      expect(normalizeZaloText('\u00A0\u200B\uFEFF')).toBe('');
    });
  });

  describe('isGroupNameMatching', () => {
    it('nominal: should match EXACT rule case-insensitively with Unicode and space variations', () => {
      // Chuỗi thực tế có NFD + non-breaking space + khoảng trắng thừa
      const actualName = '  H\u0061\u0309i   Phòng\u00A0Bất   Động   Sản  ';
      const targetName = 'hải phòng bất động sản';

      const isMatch = isGroupNameMatching(actualName, targetName, 'EXACT');
      expect(isMatch).toBe(true);

      console.info('[Proof: EXACT Matching]', {
        actualName,
        targetName,
        rule: 'EXACT',
        matched: isMatch,
      });
    });

    it('nominal: should respect caseSensitive option in EXACT rule', () => {
      const actual = 'Bất Động Sản Miền Bắc';
      const target = 'bất động sản miền bắc';

      expect(isGroupNameMatching(actual, target, 'EXACT', { caseSensitive: false })).toBe(true);
      expect(isGroupNameMatching(actual, target, 'EXACT', { caseSensitive: true })).toBe(false);
      expect(isGroupNameMatching(actual, actual, 'EXACT', { caseSensitive: true })).toBe(true);
    });

    it('nominal: should match CONTAINS rule properly', () => {
      const actualName = 'Cộng Đồng Đầu Tư Bất Động Sản Việt Nam [VIP]';
      const targetName = 'bất động sản việt nam';

      const isMatch = isGroupNameMatching(actualName, targetName, 'CONTAINS');
      expect(isMatch).toBe(true);

      const notMatch = isGroupNameMatching(actualName, 'Chứng Khoán Phái Sinh', 'CONTAINS');
      expect(notMatch).toBe(false);

      console.info('[Proof: CONTAINS Matching]', {
        actualName,
        targetName,
        rule: 'CONTAINS',
        matched: isMatch,
      });
    });

    it('boundary: should return false when actualName or targetName is empty or falsy', () => {
      expect(isGroupNameMatching('', 'Nhóm Test', 'EXACT')).toBe(false);
      expect(isGroupNameMatching('Nhóm Test', '', 'EXACT')).toBe(false);
      expect(isGroupNameMatching(null, 'Nhóm Test', 'EXACT')).toBe(false);
      expect(isGroupNameMatching('Nhóm Test', undefined, 'EXACT')).toBe(false);
      expect(isGroupNameMatching('   ', '   ', 'EXACT')).toBe(false);
      expect(isGroupNameMatching('\u200B\uFEFF', 'Nhóm Test', 'CONTAINS')).toBe(false);
    });
  });
});
