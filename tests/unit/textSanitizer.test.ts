import { sanitizeText, stripControlChars, stripHtml } from '@/utils/textSanitizer';
import { describe, expect, it } from 'vitest';

describe('Text Sanitizer Utility (Unit Tests)', () => {
  describe('stripHtml', () => {
    it('should strip basic HTML tags', () => {
      const input = '<p>Xin chào <strong>Zalo</strong> người dùng!</p>';
      expect(stripHtml(input)).toBe('Xin chào Zalo người dùng!');
    });

    it('should return empty string for empty input', () => {
      expect(stripHtml('')).toBe('');
    });

    it('should handle nested and malformed tags cleanly', () => {
      const input = '<div><span>Nội dung <i>nghiêng</i></span><br/></div>';
      expect(stripHtml(input)).toBe('Nội dung nghiêng');
    });
  });

  describe('stripControlChars', () => {
    it('should remove zero-width spaces and invisible characters', () => {
      // \u200B is zero-width space, \uFEFF is byte order mark
      const input = 'Bất\u200Bđộng\uFEFFsản';
      expect(stripControlChars(input)).toBe('Bấtđộngsản');
    });

    it('should remove non-printable ASCII control characters but preserve newlines and tabs', () => {
      const input = 'Dòng 1\x00\x07\n\tDòng 2\x1F';
      expect(stripControlChars(input)).toBe('Dòng 1\n\tDòng 2');
    });

    it('should return empty string for empty input', () => {
      expect(stripControlChars('')).toBe('');
    });
  });

  describe('sanitizeText', () => {
    it('nominal path: should strip HTML, remove zero-width chars and normalize whitespace', () => {
      const raw = '  <div class="msg">  Thông   báo: \u200B <b>Zalo</b> 24/7  </div>  ';
      const result = sanitizeText(raw);
      expect(result).toBe('Thông báo: Zalo 24/7');
    });

    it('boundary: should handle empty string or falsy input gracefully', () => {
      expect(sanitizeText('')).toBe('');
      // @ts-expect-error testing falsy boundary
      expect(sanitizeText(null)).toBe('');
      // @ts-expect-error testing falsy boundary
      expect(sanitizeText(undefined)).toBe('');
    });

    it('boundary: should handle input containing only HTML tags', () => {
      const raw = '<div><span><br/></span></div>';
      expect(sanitizeText(raw)).toBe('');
    });

    it('boundary: should handle input containing only zero-width or control characters', () => {
      const raw = '\u200B\u200C\u200D\uFEFF\x00\x08';
      expect(sanitizeText(raw)).toBe('');
    });

    it('options: should respect stripHtmlTags = false', () => {
      const raw = '<b>In đậm</b>';
      expect(sanitizeText(raw, { stripHtmlTags: false })).toBe('<b>In đậm</b>');
    });

    it('options: should respect normalizeWhitespace = false', () => {
      const raw = 'Từ 1    Từ 2';
      expect(sanitizeText(raw, { normalizeWhitespace: false })).toBe('Từ 1    Từ 2');
    });

    it('options: should respect trim = false', () => {
      const raw = '  Nội dung có khoảng trắng  ';
      expect(sanitizeText(raw, { trim: false })).toBe(' Nội dung có khoảng trắng ');
    });

    it('multiline: should preserve clean linebreaks while removing redundant whitespace', () => {
      const raw = '  <p>Dòng 1   </p>\n\n\n   <p>Dòng 2</p>  ';
      const result = sanitizeText(raw);
      expect(result).toBe('Dòng 1\nDòng 2');
    });
  });
});
