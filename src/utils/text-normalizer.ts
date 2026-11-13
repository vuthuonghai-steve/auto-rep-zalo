import type { WhitelistMatchingRule } from '@/contracts/schemas';

/**
 * Tùy chọn cấu hình so khớp tên nhóm Zalo
 */
export interface MatchingOptions {
  /** Phân biệt chữ hoa/thường (mặc định: false) */
  caseSensitive?: boolean;
}

/**
 * Chuẩn hóa chuỗi văn bản trích xuất từ Zalo Web DOM:
 * 1. Trả về '' nếu chuỗi null / undefined / rỗng.
 * 2. Chuẩn hóa Unicode sang dạng chuẩn dựng sẵn NFC (khắc phục lỗi gõ tiếng Việt tổ hợp NFD).
 * 3. Thay thế khoảng trắng không ngắt &nbsp; (\u00A0), zero-width space (\u200B),
 *    zero-width no-break space (\uFEFF) thành khoảng trắng tiêu chuẩn \u0020.
 * 4. Gom nhiều khoảng trắng liên tiếp (\s+) thành một khoảng trắng đơn ' '.
 * 5. Cắt tỉa khoảng trắng ở hai đầu chuỗi (trim).
 *
 * @param input Chuỗi văn bản thô trích xuất từ DOM hoặc cấu hình whitelist
 * @returns Chuỗi văn bản đã được chuẩn hóa đồng nhất
 */
export function normalizeZaloText(input: string | null | undefined): string {
  if (!input) {
    return '';
  }

  return input
    .normalize('NFC')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\u00A0\u200B\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiểm tra so khớp tên nhóm giữa tên trích xuất từ DOM và tên trong Whitelist cấu hình.
 *
 * @param actualName Tên nhóm thực tế trích xuất từ DOM
 * @param targetName Tên nhóm mục tiêu cấu hình trong Whitelist
 * @param rule Quy tắc so khớp ('EXACT' hoặc 'CONTAINS')
 * @param options Tùy chọn cấu hình (ví dụ: caseSensitive)
 * @returns true nếu thỏa mãn quy tắc so khớp, ngược lại false
 */
export function isGroupNameMatching(
  actualName: string | null | undefined,
  targetName: string | null | undefined,
  rule: WhitelistMatchingRule = 'EXACT',
  options: MatchingOptions = {},
): boolean {
  const normActual = normalizeZaloText(actualName);
  const normTarget = normalizeZaloText(targetName);

  if (!normActual || !normTarget) {
    return false;
  }

  const { caseSensitive = false } = options;

  const a = caseSensitive ? normActual : normActual.toLowerCase();
  const b = caseSensitive ? normTarget : normTarget.toLowerCase();

  if (rule === 'EXACT') {
    return a === b;
  }

  if (rule === 'CONTAINS') {
    return a.includes(b);
  }

  return false;
}
