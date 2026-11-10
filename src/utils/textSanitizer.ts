/**
 * Tùy chọn cấu hình làm sạch văn bản
 */
export interface SanitizeOptions {
  /** Loại bỏ thẻ HTML (mặc định: true) */
  stripHtmlTags?: boolean;
  /** Loại bỏ ký tự điều khiển vô hình / zero-width (mặc định: true) */
  removeControlChars?: boolean;
  /** Chuẩn hóa khoảng trắng liên tiếp về khoảng trắng đơn (mặc định: true) */
  normalizeWhitespace?: boolean;
  /** Cắt tỉa khoảng trắng ở hai đầu chuỗi (mặc định: true) */
  trim?: boolean;
}

/**
 * Loại bỏ toàn bộ thẻ HTML khỏi chuỗi văn bản.
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Loại bỏ ký tự điều khiển vô hình (zero-width characters, control codes ngoại trừ \n, \r, \t).
 */
export function stripControlChars(input: string): string {
  if (!input) return '';
  return (
    input
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: Cần loại bỏ zero-width marks và zero-width joiner (\u200D)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Cần lọc bỏ các mã điều khiển ASCII bất thường
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
  );
}

/**
 * Làm sạch chuỗi văn bản tổng hợp theo các tùy chọn chuẩn hóa.
 */
export function sanitizeText(input: string, options: SanitizeOptions = {}): string {
  if (!input) return '';

  const {
    stripHtmlTags = true,
    removeControlChars = true,
    normalizeWhitespace = true,
    trim = true,
  } = options;

  let result = input;

  if (stripHtmlTags) {
    result = stripHtml(result);
  }

  if (removeControlChars) {
    result = stripControlChars(result);
  }

  if (normalizeWhitespace) {
    result = result.replace(/[ \t]*[\r\n]+[ \t]*/g, '\n');
    result = result.replace(/[ \t]+/g, ' ');
  }

  if (trim) {
    result = result.trim();
  }

  return result;
}
