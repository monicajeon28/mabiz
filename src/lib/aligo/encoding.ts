/**
 * EUC-KR 인코딩 검증 및 변환 라이브러리
 *
 * Aligo API는 EUC-KR 인코딩을 요구하므로, 한글 메시지의 호환성을 검증하고
 * 지원되지 않는 문자를 감지 및 변환하는 유틸리티 제공.
 *
 * 지원 범위:
 * - 한글 (완성형: U+AC00~U+D7A3)
 * - 영문, 숫자, 기본 기호
 * - 공백, 탭, 개행
 *
 * 미지원 문자:
 * - 이모지 (U+1F300~U+1F9FF)
 * - 제어 문자 (U+0000~U+001F, U+007F)
 * - 특수 기호 (일부)
 */

import { logger } from '@/lib/logger';

/**
 * EUC-KR 인코딩 유효성 검증 결과
 */
export interface EncodingValidation {
  valid: boolean;
  issues: string[];
  unsupportedChars: Array<{
    char: string;
    codePoint: string;
    description: string;
  }>;
}

/**
 * 인코딩 문제 타입 분류
 */
export const ENCODING_ISSUE_TYPES = {
  EMOJI: 'emoji',
  CONTROL_CHAR: 'control_char',
  RTL_MARK: 'rtl_mark',
  VARIATION_SELECTOR: 'variation_selector',
  PRIVATE_USE: 'private_use',
  SURROGATE: 'surrogate',
  SPECIAL_SYMBOL: 'special_symbol',
  UNASSIGNED: 'unassigned',
} as const;

const SAFE_ASCII_RANGES = [{ min: 0x20, max: 0x7e }];
const KOREAN_JAMO_RANGES = [{ min: 0xac00, max: 0xd7a3 }];
const HANGUL_JAMO_RANGE = { min: 0x1100, max: 0x11ff };
const CJK_COMPATIBLE_RANGES = [
  { min: 0x4e00, max: 0x9fff },
  { min: 0x3400, max: 0x4dbf },
  { min: 0xf900, max: 0xfaff },
];
const UNSUPPORTED_RANGES = [
  { min: 0x1f300, max: 0x1f9ff },
  { min: 0xd800, max: 0xdfff },
];
const UNSUPPORTED_SPECIFIC_CHARS = new Set<number>([
  0x200b,
  0x200c,
  0x200d,
  0x200e,
  0x200f,
  0xfeff,
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e,
]);

function isInRange(codePoint: number, range: { min: number; max: number }): boolean {
  return codePoint >= range.min && codePoint <= range.max;
}

function isInRanges(
  codePoint: number,
  ranges: Array<{ min: number; max: number }>
): boolean {
  return ranges.some((range) => isInRange(codePoint, range));
}

function getCharacterDescription(
  codePoint: number,
  char: string
): { type: string; description: string } {
  if (codePoint >= 0x1f300 && codePoint <= 0x1f9ff) {
    return { type: ENCODING_ISSUE_TYPES.EMOJI, description: `emoji: ${char}` };
  }
  if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) {
    return {
      type: ENCODING_ISSUE_TYPES.CONTROL_CHAR,
      description: `control character: ${char} (U+${codePoint
        .toString(16)
        .toUpperCase()
        .padStart(4, '0')})`,
    };
  }
  return {
    type: ENCODING_ISSUE_TYPES.SPECIAL_SYMBOL,
    description: `special character: ${char} (U+${codePoint
      .toString(16)
      .toUpperCase()
      .padStart(4, '0')})`,
  };
}

/**
 * 문자가 EUC-KR에서 지원되는지 확인
 */
export function isSupportedInEucKr(char: string): boolean {
  if (!char || char.length === 0) return false;

  const codePoint = char.charCodeAt(0);

  // 제어 문자 및 DEL 거부
  if (codePoint < 0x20 || codePoint === 0x7f) return false;

  // Safe ASCII
  if (isInRanges(codePoint, SAFE_ASCII_RANGES)) return true;
  // 한글 (완성형)
  if (isInRanges(codePoint, KOREAN_JAMO_RANGES)) return true;
  // 한글 자모
  if (isInRange(codePoint, HANGUL_JAMO_RANGE)) return true;
  // CJK 호환
  if (isInRanges(codePoint, CJK_COMPATIBLE_RANGES)) {
    return !isInRange(codePoint, { min: 0x3400, max: 0x4dbf });
  }
  // 알려진 미지원 범위
  if (isInRanges(codePoint, UNSUPPORTED_RANGES)) return false;
  // 특정 미지원 문자
  if (UNSUPPORTED_SPECIFIC_CHARS.has(codePoint)) return false;
  // ASCII 범위 밖, 한글 범위 아닌 경우는 일반적으로 미지원
  if (codePoint > 0x7f && codePoint < 0xac00) return false;

  return true;
}

/**
 * EUC-KR 미지원 문자 감지
 *
 * @example
 * detectUnsupportedChars("안녕☺")
 * // ["☺"]
 */
export function detectUnsupportedChars(message: string): string[] {
  const unsupported = new Set<string>();
  for (const char of message) {
    if (!isSupportedInEucKr(char)) unsupported.add(char);
  }
  return Array.from(unsupported);
}

/**
 * 한글 메시지 EUC-KR 검증
 *
 * @example
 * validateKoreanMessage("안녕하세요☺")
 * // {
 * //   valid: false,
 * //   issues: ["Found unsupported character: ☺ (U+263A, emoji)"],
 * //   unsupportedChars: [{char: "☺", codePoint: "U+263A", description: "emoji: ☺"}]
 * // }
 */
export function validateKoreanMessage(message: string): EncodingValidation {
  const issues: string[] = [];
  const unsupportedChars: EncodingValidation['unsupportedChars'] = [];

  if (!message || typeof message !== 'string') {
    return {
      valid: false,
      issues: ['Message is empty or not a string'],
      unsupportedChars: [],
    };
  }

  const seenChars = new Set<string>();
  for (const char of message) {
    if (seenChars.has(char)) continue;
    seenChars.add(char);

    if (!isSupportedInEucKr(char)) {
      const codePoint = char.charCodeAt(0);
      const { type, description } = getCharacterDescription(codePoint, char);
      issues.push(
        `Found unsupported character: ${char} (U+${codePoint
          .toString(16)
          .toUpperCase()
          .padStart(4, '0')}, ${type})`
      );
      unsupportedChars.push({
        char,
        codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
        description,
      });
    }
  }

  return { valid: issues.length === 0, issues, unsupportedChars };
}

/**
 * EUC-KR 미지원 문자 제거 또는 치환
 *
 * @example
 * sanitizeForEucKr("안녕하세요☺", "?")
 * // "안녕하세요?"
 */
export function sanitizeForEucKr(message: string, replacement: string = '?'): string {
  if (!message || typeof message !== 'string') return '';

  let result = '';
  for (const char of message) {
    if (isSupportedInEucKr(char)) {
      result += char;
    } else {
      result += replacement;
    }
  }
  return result;
}

/**
 * 메시지가 EUC-KR로 인코딩 가능한지 확인
 */
export function canEncodeToEucKr(message: string): boolean {
  return validateKoreanMessage(message).valid;
}

/**
 * 메시지 길이 (EUC-KR 바이트 수 기준)
 *
 * 근사값 계산:
 * - ASCII: 1 바이트
 * - 한글: 2 바이트
 */
export function estimateEucKrByteLength(message: string): number {
  if (!message) return 0;

  let bytes = 0;
  for (const char of message) {
    const codePoint = char.charCodeAt(0);

    if (codePoint >= 0x00 && codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint >= 0xac00 && codePoint <= 0xd7a3) {
      bytes += 2;
    } else if (codePoint >= 0x4e00 && codePoint <= 0x9fff) {
      bytes += 2;
    } else if (isSupportedInEucKr(char)) {
      bytes += 2;
    } else {
      bytes += 1;
    }
  }
  return bytes;
}

/**
 * SMS 메시지 타입 자동 분류
 *
 * - SMS: 최대 90자 (1건)
 * - LMS: 최대 2,000자 (1건)
 * - 초과: 분할 발송
 */
export function calculateMessageType(message: string): {
  type: 'SMS' | 'LMS';
  parts: number;
  description: string;
} {
  const length = message.length;

  if (length <= 90) {
    return {
      type: 'SMS',
      parts: 1,
      description: `SMS (${length}/90 characters)`,
    };
  } else if (length <= 2000) {
    return {
      type: 'LMS',
      parts: 1,
      description: `LMS (${length}/2000 characters)`,
    };
  } else {
    const parts = Math.ceil(length / 80);
    return {
      type: 'SMS',
      parts,
      description: `${parts}x SMS (분할 발송, ${length} characters total)`,
    };
  }
}

/**
 * 디버그용: 메시지 상세 분석 출력
 */
export function analyzeMessage(message: string): void {
  const validation = validateKoreanMessage(message);
  const bytesEstimate = estimateEucKrByteLength(message);
  const msgType = calculateMessageType(message);

  logger.info('=== Message Analysis ===');
  logger.info(`Length: ${message.length} characters`);
  logger.info(`EUC-KR bytes (estimated): ${bytesEstimate} bytes`);
  logger.info(`Message type: ${msgType.description}`);
  logger.info(`Valid for EUC-KR: ${validation.valid}`);

  if (!validation.valid) {
    logger.warn(`Found ${validation.issues.length} issues:`);
    validation.issues.forEach((issue) => {
      logger.warn(`  - ${issue}`);
    });
  }
}

/**
 * 배치 검증: 여러 메시지 검증
 */
export function validateMessageBatch(
  messages: string[]
): Array<EncodingValidation & { message: string }> {
  return messages.map((message) => ({
    message,
    ...validateKoreanMessage(message),
  }));
}

/**
 * 배치 정제: 여러 메시지 정제
 */
export function sanitizeMessageBatch(
  messages: string[],
  replacement: string = '?'
): string[] {
  return messages.map((message) => sanitizeForEucKr(message, replacement));
}
