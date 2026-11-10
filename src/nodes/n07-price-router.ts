import type { EntityBundle, PriceRouteRule } from '@/contracts/schemas';
import { logger } from '@/utils/logger';

export const DEFAULT_PRICE_RULES: PriceRouteRule[] = [
  {
    id: 'rule_under_3b',
    label: 'Dưới 3 Tỷ',
    minPrice: 0,
    maxPrice: 3,
    targetGroupIds: ['conv-target-under-2b'],
  },
  {
    id: 'rule_3b_5b',
    label: '3 - 5 Tỷ',
    minPrice: 3,
    maxPrice: 5,
    targetGroupIds: ['conv-target-2b-5b'],
  },
  {
    id: 'rule_5b_10b',
    label: '5 - 10 Tỷ',
    minPrice: 5,
    maxPrice: 10,
    targetGroupIds: ['conv-target-2b-5b'],
  },
  {
    id: 'rule_over_10b',
    label: 'Trên 10 Tỷ',
    minPrice: 10,
    maxPrice: null,
    targetGroupIds: ['conv-target-2b-5b'],
  },
];

/**
 * Bóc tách số điện thoại từ văn bản, giải mã các ký tự thay thế tương đồng lách luật:
 * - 'O', 'o' -> '0'
 * - 'I', 'l' -> '1'
 * - Xóa dấu chấm, gạch ngang, dấu gạch chéo và khoảng trắng giữa các chữ số.
 * Trả về chuỗi 10 chữ số chuẩn hóa (VD: '0901234567') hoặc null nếu không tìm thấy.
 */
export function extractPhoneNumber(text?: string | null): string | null {
  if (!text) return null;

  // Bước 1: Thay thế các ký tự lách luật tương đồng
  const decoded = text.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');

  // Bước 2: Tìm các cụm số có chứa dấu phân cách (dấu chấm, gạch ngang, khoảng trắng)
  const candidateMatches = decoded.match(/(?:0|\+84)[0-9\s.-]{8,15}[0-9]/g);
  if (!candidateMatches) return null;

  for (const candidate of candidateMatches) {
    // Làm sạch toàn bộ ký tự không phải số
    let digits = candidate.replace(/\D/g, '');
    if (digits.startsWith('84')) {
      digits = `0${digits.substring(2)}`;
    }

    // Kiểm tra định dạng số điện thoại di động Việt Nam chuẩn 10 số bắt đầu bằng đầu 0
    if (/^0[35789]\d{8}$/.test(digits) || /^0\d{9}$/.test(digits)) {
      return digits;
    }
  }

  return null;
}

/**
 * Bóc tách khoảng giá từ văn bản tiếng Việt và quy đổi ra đơn vị Tỷ (Billion VND).
 * Ví dụ:
 * - '3.8 tỷ', '3,8 ty' -> 3.8
 * - '4 tỷ 5' -> 4.5
 * - '850 triệu', '850tr' -> 0.85
 */
export function extractPriceInBillion(text?: string | null): number | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Mẫu 1: Dạng "3 tỷ 5", "4 tỷ 2"
  const tyLeMatch = lower.match(/(\d+)\s*(?:tỷ|ty|ti)\s*(\d+)/);
  if (tyLeMatch?.[1] && tyLeMatch[2]) {
    const whole = Number.parseInt(tyLeMatch[1], 10);
    const decimal = Number.parseInt(tyLeMatch[2], 10);
    return Number.parseFloat(`${whole}.${decimal}`);
  }

  // Mẫu 2: Dạng "3.8 tỷ", "12.5 ty", "4 tỷ"
  const tyMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:tỷ|ty|ti|b\b)/);
  if (tyMatch?.[1]) {
    const numStr = tyMatch[1].replace(',', '.');
    const val = Number.parseFloat(numStr);
    if (!Number.isNaN(val)) return val;
  }

  // Mẫu 3: Dạng "850 triệu", "900tr", "500 trieu"
  const trMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:triệu|trieu|tr\b)/);
  if (trMatch?.[1]) {
    const numStr = trMatch[1].replace(',', '.');
    const val = Number.parseFloat(numStr);
    if (!Number.isNaN(val)) {
      return Number.parseFloat((val / 1000).toFixed(4));
    }
  }

  return null;
}

/**
 * Biên tập lại nội dung văn bản: Thay thế hoặc che giấu số điện thoại nguồn của người gửi.
 */
export function editMessageText(rawText: string, replacementPhone?: string): string {
  const phone = extractPhoneNumber(rawText);
  if (!phone) return rawText;

  // Nếu có số điện thoại thay thế của Solo Operator
  if (replacementPhone) {
    // Tìm cụm xuất hiện SĐT (kể cả lách luật) và thay thế
    return rawText.replace(
      /(?:lh|liên hệ|sđt|hotline|chính chủ)[:\s]*[Oo0-9\s.-]{9,15}/gi,
      `Liên hệ chính chủ: ${replacementPhone}`,
    );
  }

  return rawText;
}

export interface RoutedBundleResult {
  targetGroupIds: string[];
  detectedPrice: number | null;
  extractedPhone: string | null;
  editedText: string;
}

export class PriceRouter {
  /**
   * Định tuyến gói tin EntityBundle tới tối đa <= 2 nhóm con đích phù hợp dựa trên ma trận khoảng giá.
   */
  routeBundle(
    bundle: EntityBundle,
    rules: PriceRouteRule[] = DEFAULT_PRICE_RULES,
    replacementPhone?: string,
  ): RoutedBundleResult {
    const rawText = bundle.rawCombinedText;
    const extractedPhone = extractPhoneNumber(rawText);
    const detectedPrice = extractPriceInBillion(rawText);
    const editedText = editMessageText(rawText, replacementPhone);

    const matchedTargetGroups = new Set<string>();

    if (detectedPrice !== null) {
      for (const rule of rules) {
        const isMinSatisfied = detectedPrice >= rule.minPrice;
        const isMaxSatisfied =
          rule.maxPrice === null || rule.maxPrice === undefined || detectedPrice < rule.maxPrice;

        if (isMinSatisfied && isMaxSatisfied) {
          for (const targetId of rule.targetGroupIds) {
            matchedTargetGroups.add(targetId);
            if (matchedTargetGroups.size >= 2) break;
          }
        }
        if (matchedTargetGroups.size >= 2) break;
      }
    }

    // Giới hạn tối đa <= 2 nhóm con đích theo đặc tả kiến trúc
    const targetGroupIds = Array.from(matchedTargetGroups).slice(0, 2);

    logger.info(
      'PRICE_ROUTER',
      'N07',
      `Định tuyến giá: ${detectedPrice ?? 'N/A'} tỷ -> [${targetGroupIds.join(', ')}]`,
      {
        groupId: bundle.sourceGroupId,
        phone: extractedPhone || undefined,
      },
    );

    return {
      targetGroupIds,
      detectedPrice,
      extractedPhone,
      editedText,
    };
  }
}

export const priceRouter = new PriceRouter();
