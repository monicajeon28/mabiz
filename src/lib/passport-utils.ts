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

export const DEFAULT_PASSPORT_TEMPLATE_BODY = `{고객명}님, 여권 정보를 입력해주세요: {링크}`;

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
