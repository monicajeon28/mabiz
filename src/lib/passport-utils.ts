import { randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

// ── Base62 인코딩 (0-9, a-z, A-Z) ──────────────────────────

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function base62Encode(buffer: Buffer): string {
  let num = BigInt('0x' + buffer.toString('hex'));
  let result = '';
  const base = BigInt(62);

  if (num === BigInt(0)) return '0';

  while (num > 0) {
    result = BASE62_CHARS[Number(num % base)] + result;
    num = num / base;
  }

  return result;
}

function base62Decode(str: string): Buffer {
  let num = BigInt(0);
  const base = BigInt(62);

  for (let i = 0; i < str.length; i++) {
    const charIndex = BASE62_CHARS.indexOf(str[i]);
    if (charIndex === -1) throw new Error('Invalid base62 character');
    num = num * base + BigInt(charIndex);
  }

  const hex = num.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
  return Buffer.from(paddedHex, 'hex');
}

// ── 토큰 생성 ───────────────────────────────────────────────

/** 24바이트(48자 hex) 랜덤 토큰 생성 */
export function generatePassportToken(): string {
  return randomBytes(24).toString('hex');
}

// ── 링크 빌더 ───────────────────────────────────────────────

/** 여권 제출 링크 생성 (hex → base62 단축) */
export function buildPassportLink(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  let shortToken = token;
  try {
    if (/^[0-9a-f]+$/.test(token) && (token.length === 32 || token.length === 48)) {
      const buffer = Buffer.from(token, 'hex');
      shortToken = base62Encode(buffer);
    }
  } catch (error) {
    logger.warn('[buildPassportLink] Failed to encode token:', error as Record<string, unknown>);
  }
  return `${baseUrl.replace(/\/$/, '')}/passport/${shortToken}`;
}

// ── 토큰 디코딩 ─────────────────────────────────────────────

/** base62 / hex 토큰을 원래 hex 토큰으로 복원 */
export function decodePassportToken(shortToken: string): string {
  // 이미 hex 형식인 경우
  if (/^[0-9a-f]+$/.test(shortToken)) {
    if (shortToken.length >= 48) {
      return shortToken.substring(0, 48);
    }
    if (shortToken.length === 32 || shortToken.length === 48) {
      return shortToken;
    }
  }

  // base62 형식인 경우 디코딩 시도
  try {
    if (
      !/^[0-9a-f]+$/.test(shortToken) &&
      shortToken.length < 48 &&
      /^[A-Za-z0-9]+$/.test(shortToken)
    ) {
      const buffer = base62Decode(shortToken);
      const decodedHex = buffer.toString('hex');
      if (decodedHex.length <= 32) {
        return decodedHex.padStart(32, '0');
      } else if (decodedHex.length <= 48) {
        return decodedHex.padStart(48, '0');
      } else {
        return decodedHex.substring(0, 48);
      }
    }
  } catch (error) {
    logger.warn('[decodePassportToken] Failed to decode token:', error as Record<string, unknown>);
  }
  return shortToken;
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
 */
export function normalizePhoneForSms(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11 && /^01[016789]/.test(digits)) return digits;
  if (digits.length === 10 && digits.startsWith('10')) return `0${digits}`;
  return null;
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
