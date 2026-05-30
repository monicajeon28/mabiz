import { randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

// ── Base62 인코딩 (0-9, a-z, A-Z) ──────────────────────────
// 심리학: 짧은 URL(base62)이 사용자에게 "안전하고 간단해 보임"
// 48자 hex → 32-33자 base62 (URL 단축 30% = 신뢰감 ↑)
// UX: 모바일에서 QR코드 스캔 용이, 수동 입력 시 복사 오류 최소화

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE62_INDEX_MAP = new Map<string, number>(
  Array.from(BASE62_CHARS).map((char, index) => [char, index])
);

/**
 * Base62 인코딩 with enhanced error handling
 * @throws Error if encoding fails (에러 처리: caller에서 캡처)
 */
function base62Encode(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty buffer cannot be encoded');
  }

  try {
    let num = BigInt('0x' + buffer.toString('hex'));
    let result = '';
    const base = BigInt(62);

    if (num === BigInt(0)) return '0';

    while (num > 0) {
      result = BASE62_CHARS[Number(num % base)] + result;
      num = num / base;
    }

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Base62 encoding failed: ${msg}`);
  }
}

/**
 * Base62 디코딩 with detailed error context for debugging
 * @throws Error with detailed context if decoding fails
 */
function base62Decode(str: string): Buffer {
  if (!str || str.length === 0) {
    throw new Error('Empty string cannot be decoded');
  }

  try {
    let num = BigInt(0);
    const base = BigInt(62);

    for (let i = 0; i < str.length; i++) {
      const charIndex = BASE62_INDEX_MAP.get(str[i]);
      if (charIndex === undefined) {
        throw new Error(
          `Invalid character '${str[i]}' at position ${i}/${str.length}. Valid: 0-9,a-z,A-Z. Input: ${str.slice(Math.max(0, i - 3), i + 4)}`
        );
      }
      num = num * base + BigInt(charIndex);
    }

    const hex = num.toString(16);
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
    return Buffer.from(paddedHex, 'hex');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid character')) {
      throw error; // Re-throw detailed error
    }
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Base62 decoding failed: ${msg}`);
  }
}

// ── 토큰 생성 ───────────────────────────────────────────────

/** 24바이트(48자 hex) 랜덤 토큰 생성 */
export function generatePassportToken(): string {
  return randomBytes(24).toString('hex');
}

// ── 링크 빌더 ───────────────────────────────────────────────

/**
 * 여권 제출 링크 생성 (hex → base62 단축)
 * - 정상: 48자 hex → 32-33자 base62 (단축 30%)
 * - UX: 짧은 URL = 모바일 QR코드 고밀도↓, 안전해 보임
 * - 신뢰: 간단한 URL 패턴 → 피싱 아님, 공식 임
 * - 에러: 명확한 로깅 + 원본 hex 사용 (fallback 보장)
 * @returns 항상 유효한 URL 문자열 (인코딩 실패해도 서비스 안 멈춤)
 */
export function buildPassportLink(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  let shortToken = token;
  let encodingAttempted = false;
  let encodingSuccess = false;

  // Step 1: 입력값 검증
  if (!token || typeof token !== 'string') {
    logger.error('[buildPassportLink] Invalid token type', {
      type: typeof token,
      value: token,
    });
    return `${baseUrl.replace(/\/$/, '')}/passport/${String(token)}`;
  }

  if (token.length < 10) {
    logger.warn('[buildPassportLink] Token too short for encoding', {
      length: token.length,
      minRequired: 10,
    });
    return `${baseUrl.replace(/\/$/, '')}/passport/${token}`;
  }

  // Step 2: Base62 인코딩 시도
  try {
    // 32자(128bit) 또는 48자(192bit) hex만 인코딩
    if (/^[0-9a-f]+$/.test(token) && (token.length === 32 || token.length === 48)) {
      encodingAttempted = true;
      const buffer = Buffer.from(token, 'hex');
      const encoded = base62Encode(buffer);
      shortToken = encoded;
      encodingSuccess = true;

      logger.debug('[buildPassportLink] Token encoded successfully', {
        original: {
          length: token.length,
          format: token.length === 32 ? '128-bit' : '192-bit',
        },
        encoded: {
          length: encoded.length,
          format: 'base62',
        },
        saved: token.length - encoded.length,
        compression: `${Math.round(((token.length - encoded.length) / token.length) * 100)}%`,
      });
    } else {
      // 이미 base62 형식일 수 있음 — 그냥 사용
      logger.debug('[buildPassportLink] Token format not matching hex pattern, using as-is', {
        length: token.length,
        isValidHex: /^[0-9a-f]+$/.test(token),
        expectedLengths: [32, 48],
      });
    }
  } catch (error) {
    // 인코딩 실패 — fallback 적용
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn('[buildPassportLink] Encoding failed, falling back to original hex', {
      error: errorMsg,
      tokenLength: token.length,
      attemptedFormat: token.length === 32 || token.length === 48 ? 'hex' : 'unknown',
      fallback: 'original token used',
    });
    // shortToken은 이미 원본값
    encodingSuccess = false;
  }

  const link = `${baseUrl.replace(/\/$/, '')}/passport/${shortToken}`;

  // Step 3: QR코드 최적화 경고 (모바일 호환성)
  if (link.length > 200) {
    logger.warn('[buildPassportLink] URL exceeds 200 chars (QR density may be high)', {
      length: link.length,
      suggestion: 'Consider shorter baseUrl',
      qrDensityLevel: link.length > 250 ? 'HIGH' : 'MEDIUM',
    });
  }

  // Step 4: 최종 결과 요약
  if (encodingAttempted) {
    logger.info('[buildPassportLink] Encoding result', {
      success: encodingSuccess,
      finalUrl: {
        length: link.length,
        format: encodingSuccess ? 'base62' : 'hex fallback',
      },
    });
  }

  return link;
}

// ── 토큰 디코딩 ─────────────────────────────────────────────

/**
 * Base62 / Hex 토큰을 원래 hex 토큰으로 복원 (정규화)
 * - 입력: base62 (32-33자) 또는 hex (32-48자) 또는 모바일에서 복사한 텍스트 등
 * - 출력: 항상 48자 hex (정규화) 또는 디코딩 실패 시 원본 반환
 * - UX: 사용자가 수동 입력한 토큰도 자동 복구 시도 (공백/줄바꿈 제거)
 * - 에러 처리: 명확한 로그 → 디버깅 + 개선 가능
 * - 심리학: "계속 진행" 가능하게 → 사용자 신뢰 ↑ (즉시 오류 표시 대신 로그/백엔드에서 검증)
 */
export function decodePassportToken(shortToken: string): string {
  // Step 1: 기본 입력 검증
  if (!shortToken || typeof shortToken !== 'string') {
    logger.error('[decodePassportToken] Invalid token type or empty', {
      type: typeof shortToken,
      value: shortToken,
    });
    return String(shortToken || '');
  }

  // Step 2: 사용자 입력 정규화 (공백/줄바꿈/특수문자 정리)
  let normalizedToken = shortToken.trim();
  const originalInput = shortToken;

  // 모바일 복사 시 발생할 수 있는 공백/줄바꿈 제거
  normalizedToken = normalizedToken.replace(/[\s\n\r]+/g, '');

  if (normalizedToken !== originalInput) {
    logger.debug('[decodePassportToken] Token normalized (whitespace removed)', {
      original: originalInput.length,
      normalized: normalizedToken.length,
      removedChars: originalInput.length - normalizedToken.length,
    });
  }

  // Step 3: 길이 검증
  if (normalizedToken.length < 10 || normalizedToken.length > 512) {
    logger.warn('[decodePassportToken] Token length out of valid range', {
      length: normalizedToken.length,
      validRange: '10-512',
      hint: normalizedToken.length < 10 ? 'too short' : 'too long',
    });
    return normalizedToken; // 원본 반환 (뒷단에서 검증)
  }

  // Case 1: 유효한 hex 형식 (0-9a-f만 포함)
  if (/^[0-9a-f]+$/.test(normalizedToken)) {
    if (normalizedToken.length === 32 || normalizedToken.length === 48) {
      logger.debug('[decodePassportToken] Token is valid hex format', {
        length: normalizedToken.length,
        type: normalizedToken.length === 32 ? '128-bit' : '192-bit',
      });
      // 정규화: 항상 48자로 (leading zero 패딩)
      return normalizedToken.padStart(48, '0');
    }

    // hex 형식이지만 비정상 길이
    if (normalizedToken.length < 32) {
      logger.info('[decodePassportToken] Hex token too short, padding to 48 chars', {
        original: normalizedToken.length,
        padded: 48,
      });
      return normalizedToken.padStart(48, '0');
    }

    if (normalizedToken.length > 48) {
      logger.info('[decodePassportToken] Hex token too long, truncating to 48 chars', {
        original: normalizedToken.length,
        truncated: 48,
      });
      return normalizedToken.substring(0, 48);
    }
  }

  // Case 2: Base62 형식으로 보이는 경우 (0-9a-zA-Z, hex가 아님)
  if (!/^[0-9a-f]+$/.test(normalizedToken) && /^[A-Za-z0-9]+$/.test(normalizedToken)) {
    try {
      logger.debug('[decodePassportToken] Attempting base62 decode', {
        input: normalizedToken,
        length: normalizedToken.length,
      });

      const buffer = base62Decode(normalizedToken);
      const decodedHex = buffer.toString('hex');

      // 정규화: 항상 48자로 (leading zero 손실 복원)
      const normalized = decodedHex.padStart(48, '0').substring(0, 48);

      logger.info('[decodePassportToken] Base62 decode successful', {
        input: {
          length: normalizedToken.length,
          format: 'base62',
        },
        output: {
          length: normalized.length,
          format: 'hex-48',
        },
        compression: `${Math.round(((normalizedToken.length - normalized.length) / normalizedToken.length) * -100)}% expansion`,
      });

      return normalized;
    } catch (decodeError) {
      // base62 디코딩 실패 — 상세 로그 (디버깅용)
      const errorMsg = decodeError instanceof Error ? decodeError.message : String(decodeError);
      const errorStack = decodeError instanceof Error ? decodeError.stack : undefined;

      logger.warn('[decodePassportToken] Base62 decode failed, returning original', {
        error: errorMsg,
        stack: errorStack ? errorStack.split('\n').slice(0, 3).join(' | ') : undefined,
        input: {
          value: normalizedToken,
          length: normalizedToken.length,
          firstChar: normalizedToken.charAt(0),
          lastChar: normalizedToken.charAt(normalizedToken.length - 1),
          hasSpecialChars: !/^[A-Za-z0-9]+$/.test(normalizedToken),
        },
        suggestion: 'Token may be corrupted or invalid format',
      });

      // fallback: 원본 반환 (뒷단 DB 쿼리에서 Not Found로 처리됨)
      return normalizedToken;
    }
  }

  // Case 3: 위 규칙에 맞지 않음 (특수문자 포함, 대문자 A-Z, 또는 혼합)
  logger.warn('[decodePassportToken] Token format not recognized', {
    input: normalizedToken,
    length: normalizedToken.length,
    format: {
      isHexLowercase: /^[0-9a-f]+$/.test(normalizedToken),
      isAlphanumeric: /^[A-Za-z0-9]+$/.test(normalizedToken),
      hasUppercase: /[A-Z]/.test(normalizedToken),
      hasSpecialChars: !/^[A-Za-z0-9]+$/.test(normalizedToken),
    },
    suggestion: 'Token may be invalid or corrupted',
  });

  return normalizedToken; // 원본 반환 (뒷단에서 검증)
}

// ── 템플릿 유틸 ─────────────────────────────────────────────

export const DEFAULT_PASSPORT_TEMPLATE_BODY = `{고객명}님, 크루즈닷 {상품명} 여행을 위해 여권 정보를 입력해주세요: {링크}`;

// 링크만 전송 모드용 메시지 (SMS 비용 무관, 복사용)
export const LINK_ONLY_PASSPORT_MESSAGE = `[여권 발급 안내] 여행 준비를 완벽하게 도와드릴게요!

{고객명}님, 안녕하세요.
예약하신 {상품명} 일정({출발일} 출발)을 위해 필요한 여권 정보를 자동으로 수집하고 확인해드리고 있어요.

지금 바로 진행해 주세요.
1. 아래 링크를 눌러 여권 정보를 입력해 주세요.
2. 제출 즉시 암호화된 자동 검증으로 담당 컨시어지가 확인합니다.
3. 처리 상태와 추가 안내는 문자로 안내해 드릴게요.

고객님의 정보는 전 과정에서 안전하게 암호화되어 저장됩니다.

예상 확인 시간: 접수 후 최대 24시간 내

감사합니다.
크루즈 가이드 고객지원팀 드림

- 여권 정보 제출하기: {링크}`;

/** 템플릿 변수 치환 */
export function fillTemplate(
  template: string,
  replacements: Record<string, string | null | undefined>,
) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = replacements[key.trim()];
    if (value === undefined || value === null || value === '') {
      return match;
    }
    return value;
  });
}

/**
 * 한국 휴대전화 번호 정규화 — SMS 발송 가능 여부 검증 포함
 * - 010/011/016/017/018/019 로 시작하는 11자리만 유효
 * - 앞 0이 누락된 10자리 (10으로 시작) → 0 prefix 복원
 * - 02/031 등 지역번호, 12자리 이상 이상 번호 → null (발송 불가)
 * - UX: 사용자가 입력한 형식(하이픈, 공백) 자동 제거
 */
export function normalizePhoneForSms(phone: string | null): string | null {
  if (!phone) return null;

  // 입력값 정규화: 공백/하이픈/괄호 제거
  const sanitized = String(phone).trim();
  const digits = sanitized.replace(/[^0-9]/g, '');

  if (!digits) return null;

  // 유효한 패턴 검증
  if (digits.length === 11 && /^01[016789]/.test(digits)) {
    logger.debug('[normalizePhoneForSms] Valid mobile number', { length: 11, prefix: digits.substring(0, 3) });
    return digits;
  }

  // 앞 0 누락된 경우 복원
  if (digits.length === 10 && digits.startsWith('10')) {
    const restored = `0${digits}`;
    logger.debug('[normalizePhoneForSms] Restored missing leading 0', { original: digits, restored });
    return restored;
  }

  // 유효하지 않은 번호
  logger.warn('[normalizePhoneForSms] Invalid phone number', {
    original: sanitized,
    digits: digits.length,
    prefix: digits.substring(0, 3),
    reason: digits.length !== 11 && digits.length !== 10 ? 'length mismatch' : 'invalid prefix',
  });
  return null;
}

/**
 * 사용자 입력 토큰을 정리하고 검증하는 헬퍼
 * - 공백/탭/줄바꿈 제거
 * - 개행 후 붙여넣기된 텍스트 복구
 * - 길이 검증
 * @returns { valid: boolean, cleaned: string, error?: string }
 */
export function sanitizeAndValidateTokenInput(
  rawInput: string | null | undefined
): { valid: boolean; cleaned: string; error?: string } {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      valid: false,
      cleaned: '',
      error: '토큰이 입력되지 않았습니다.',
    };
  }

  // Step 1: 기본 정리 (공백/개행 제거)
  let cleaned = rawInput.trim().replace(/[\s\n\r]+/g, '');

  // Step 2: 길이 검증
  if (cleaned.length < 10) {
    return {
      valid: false,
      cleaned,
      error: `토큰이 너무 짧습니다 (최소 10자, 입력: ${cleaned.length}자)`,
    };
  }

  if (cleaned.length > 512) {
    return {
      valid: false,
      cleaned,
      error: `토큰이 너무 깁니다 (최대 512자, 입력: ${cleaned.length}자)`,
    };
  }

  // Step 3: 형식 검증 (알파벳 + 숫자만 허용)
  if (!/^[A-Za-z0-9]+$/.test(cleaned)) {
    const invalidChars = cleaned.replace(/[A-Za-z0-9]/g, '').split('').join(', ');
    return {
      valid: false,
      cleaned,
      error: `토큰에 유효하지 않은 문자가 포함되어 있습니다: ${invalidChars}`,
    };
  }

  logger.debug('[sanitizeAndValidateTokenInput] Token validated', {
    inputLength: rawInput.length,
    cleanedLength: cleaned.length,
    format: /^[0-9a-f]+$/.test(cleaned)
      ? 'hex'
      : /^[A-Za-z0-9]+$/.test(cleaned)
        ? 'base62'
        : 'unknown',
  });

  return { valid: true, cleaned };
}

/** 레거시 이모지 템플릿 → 텍스트 전환 */
export function sanitizeLegacyTemplateBody(body: string | null | undefined): string {
  if (!body) return '';

  let sanitized = body;
  sanitized = sanitized.replace(/✅\s*지금 바로 진행해 주세요/g, '지금 바로 진행해 주세요.');
  sanitized = sanitized.replace(
    /🔐\s*고객님의 정보는 전 과정에서 안전하게 암호화되어 저장됩니다\./g,
    '고객님의 정보는 전 과정에서 안전하게 암호화되어 저장됩니다.',
  );
  sanitized = sanitized.replace(
    /⏱️\s*예상 확인 시간: 접수 후 최대 24시간 내/g,
    '예상 확인 시간: 접수 후 최대 24시간 내',
  );
  sanitized = sanitized.replace(/▶\s*여권 정보 제출하기:/g, '- 여권 정보 제출하기:');
  sanitized = sanitized.replace(/[ ]{2,}/g, ' ');

  return sanitized;
}
