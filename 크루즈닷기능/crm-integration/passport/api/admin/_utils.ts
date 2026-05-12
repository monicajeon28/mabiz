import { getSessionUser } from '@/lib/auth';

export interface AdminUser {
  id: number;
  name: string | null;
  role: string;
}

export async function requireAdminUser(): Promise<AdminUser | null> {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      console.log('[PassportRequest] No session user found');
      return null;
    }

    if (sessionUser.role !== 'admin') {
      console.log('[PassportRequest] User is not admin:', { userId: sessionUser.id, role: sessionUser.role });
      return null;
    }

    return {
      id: sessionUser.id,
      name: sessionUser.name,
      role: sessionUser.role || 'user',
    };
  } catch (error: any) {
    console.error('[PassportRequest] Admin auth error:', error);
    console.error('[PassportRequest] Auth error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return null;
  }
}

export const DEFAULT_PASSPORT_TEMPLATE_BODY = `[여권 발급 안내] 여행 준비를 완벽하게 도와드릴게요!\n\n{고객명}님, 안녕하세요.\n예약하신 {상품명} 일정({출발일} 출발)을 위해 필요한 여권 정보를 자동으로 수집하고 확인해드리고 있어요.\n\n지금 바로 진행해 주세요.\n1. 아래 링크를 눌러 여권 정보를 입력해 주세요.\n2. 제출 즉시 암호화된 자동 검증으로 담당 컨시어지가 확인합니다.\n3. 처리 상태와 추가 안내는 문자로 안내해 드릴게요.\n\n고객님의 정보는 전 과정에서 안전하게 암호화되어 저장됩니다.\n\n예상 확인 시간: 접수 후 최대 24시간 내\n\n감사합니다.\n크루즈 가이드 고객지원팀 드림\n\n- 여권 정보 제출하기: {링크}`;

// Base62 인코딩 (0-9, a-z, A-Z)
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
  
  // Buffer로 변환
  const hex = num.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
  return Buffer.from(paddedHex, 'hex');
}

export function buildPassportLink(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  // 토큰이 hex 형식이면 base62로 인코딩
  let shortToken = token;
  try {
    // hex 형식인지 확인 (32자 = 16바이트 hex, 또는 48자 = 24바이트 hex)
    // 64자 이상은 잘못된 형식이므로 인코딩하지 않음
    if (/^[0-9a-f]+$/.test(token) && (token.length === 32 || token.length === 48)) {
      const buffer = Buffer.from(token, 'hex');
      shortToken = base62Encode(buffer);
    }
  } catch (error) {
    // 인코딩 실패 시 원본 토큰 사용
    console.warn('[buildPassportLink] Failed to encode token:', error);
  }
  return `${baseUrl.replace(/\/$/, '')}/passport/${shortToken}`;
}

// 토큰 디코딩 함수 (API에서 사용)
export function decodePassportToken(shortToken: string): string {
  // 이미 hex 형식인 경우 (32자, 48자, 또는 64자 - 기존 잘못된 형식도 지원)
  if (/^[0-9a-f]+$/.test(shortToken)) {
    // 64자 이상은 앞 48자만 사용 (기존 24바이트 토큰)
    if (shortToken.length >= 48) {
      return shortToken.substring(0, 48);
    }
    // 32자 또는 48자는 그대로 사용
    if (shortToken.length === 32 || shortToken.length === 48) {
      return shortToken;
    }
  }
  
  // base62 형식인 경우 디코딩 시도
  try {
    // base62 형식인지 확인 (짧고 다양한 문자 포함, 대문자 포함)
    // hex 형식이 아니고, 48자 미만이며, 영숫자로만 구성된 경우 base62로 간주
    if (!/^[0-9a-f]+$/.test(shortToken) && shortToken.length < 48 && /^[A-Za-z0-9]+$/.test(shortToken)) {
      const buffer = base62Decode(shortToken);
      const decodedHex = buffer.toString('hex');
      // 디코딩된 hex가 16바이트(32자) 또는 24바이트(48자)인 경우 사용
      // 패딩 처리: 16바이트 = 32자, 24바이트 = 48자
      if (decodedHex.length <= 32) {
        // 32자 이하인 경우 앞에 0을 패딩하여 32자로 맞춤
        return decodedHex.padStart(32, '0');
      } else if (decodedHex.length <= 48) {
        // 48자 이하인 경우 앞에 0을 패딩하여 48자로 맞춤
        return decodedHex.padStart(48, '0');
      } else {
        // 48자 초과인 경우 앞 48자만 사용
        return decodedHex.substring(0, 48);
      }
    }
  } catch (error) {
    // 디코딩 실패 시 원본 토큰 반환
    console.warn('[decodePassportToken] Failed to decode token:', error);
  }
  return shortToken;
}

// 토큰 생성 함수
export function generatePassportToken(): string {
  // 24바이트(48자 hex) 랜덤 토큰 생성
  const crypto = require('crypto');
  return crypto.randomBytes(24).toString('hex');
}

// 비동기 버전 (userId, tripId 받아서 DB에 저장 후 토큰 반환)
export async function generatePassportTokenAsync(userId: number, tripId: number): Promise<string> {
  const prisma = (await import('@/lib/prisma')).default;
  const token = generatePassportToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3); // 3일 유효

  // 기존 submission 확인
  let submission = await prisma.passportSubmission.findFirst({
    where: {
      userId: userId,
      tripId: tripId,
      tokenExpiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!submission) {
    submission = await prisma.passportSubmission.create({
      data: {
        userId: userId,
        tripId: tripId,
        token: token,
        tokenExpiresAt: expiresAt,
        status: 'PENDING',
      },
    });
  }

  return submission.token;
}

export function fillTemplate(
  template: string,
  replacements: Record<string, string | null | undefined>
) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = replacements[key.trim()];
    if (value === undefined || value === null || value === '') {
      return match;
    }
    return value;
  });
}

export function sanitizeLegacyTemplateBody(body: string | null | undefined): string {
  if (!body) return '';

  let sanitized = body;

  sanitized = sanitized.replace(/✅\s*지금 바로 진행해 주세요/g, '지금 바로 진행해 주세요.');
  sanitized = sanitized.replace(/🔐\s*고객님의 정보는 전 과정에서 안전하게 암호화되어 저장됩니다\./g, '고객님의 정보는 전 과정에서 안전하게 암호화되어 저장됩니다.');
  sanitized = sanitized.replace(/⏱️\s*예상 확인 시간: 접수 후 최대 24시간 내/g, '예상 확인 시간: 접수 후 최대 24시간 내');
  sanitized = sanitized.replace(/▶\s*여권 정보 제출하기:/g, '- 여권 정보 제출하기:');

  // Trim redundant spaces caused by replacement
  sanitized = sanitized.replace(/[ ]{2,}/g, ' ');

  return sanitized;
}
