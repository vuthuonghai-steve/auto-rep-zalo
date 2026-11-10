/**
 * Chuẩn hóa văn bản trước khi băm:
 * Loại bỏ toàn bộ emoji, ký tự xuống dòng thừa, khoảng trắng kép và chuyển về chữ thường.
 */
export function normalizeTextForHash(text: string): string {
  if (!text) return '';

  return (
    text
      // Loại bỏ emoji
      .replace(/\p{Extended_Pictographic}/gu, '')
      // Chuyển ký tự xuống dòng thành khoảng trắng đơn
      .replace(/[\r\n\t]+/g, ' ')
      // Chuẩn hóa khoảng trắng kép
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

/**
 * Băm chuỗi văn bản theo thuật toán SHA-256 sử dụng chuẩn Web Crypto API (crypto.subtle.digest).
 * Trả về chuỗi hex 64 ký tự.
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  let hashBuffer: ArrayBuffer;
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    hashBuffer = await crypto.subtle.digest('SHA-256', data);
  } else {
    // Fallback cho môi trường Node không có Web Crypto API toàn cục
    const nodeCrypto = await import('node:crypto');
    const hash = nodeCrypto.createHash('sha256').update(data);
    return hash.digest('hex');
  }

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
