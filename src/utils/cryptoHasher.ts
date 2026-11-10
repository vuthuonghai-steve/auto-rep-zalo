/**
 * Tiện ích băm dữ liệu mã hóa phẫu thuật (Surgical Crypto Hasher Utility).
 * Tối ưu hóa cho Web Crypto API với fallback sang Node crypto trong môi trường test/node.
 */

/**
 * Tính toán mã băm SHA-256 cho chuỗi đầu vào kèm chuỗi muối (salt) tùy chọn.
 * Trả về chuỗi hex viết thường dài 64 ký tự.
 */
export async function computeContentHash(content: string, salt = ''): Promise<string> {
  const normalizedInput = salt ? `${salt}:${content}` : content;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedInput);

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Kiểm tra xem chuỗi đầu vào có khớp với mã băm kỳ vọng hay không (so sánh an toàn không phân biệt hoa thường).
 */
export async function isHashMatch(
  content: string,
  expectedHash: string,
  salt = '',
): Promise<boolean> {
  if (!expectedHash || typeof expectedHash !== 'string') {
    return false;
  }
  const computed = await computeContentHash(content, salt);
  return computed.toLowerCase() === expectedHash.trim().toLowerCase();
}

/**
 * Cắt ngắn mã băm hex để làm tiền tố ngắn gọn cho định danh hoặc log (ví dụ: shortHash).
 * Mặc định trả về 8 ký tự đầu.
 */
export function truncateHash(hash: string, length = 8): string {
  if (!hash) {
    return '';
  }
  if (length <= 0) {
    return '';
  }
  return hash.slice(0, length);
}
