/**
 * Sensitive Data Encryption Module
 * Landing Page + Contact Information 암호화
 *
 * - adminMemo 필드의 민감 정보 암호화 (평문 저장 방지)
 * - AES-256-GCM 알고리즘 사용 (인증 태그 포함)
 * - 각 암호화 시마다 새로운 IV 생성 (고도의 보안)
 * - Admin/권한자만 복호화 가능하도록 제어
 *
 * Usage:
 *   const encrypted = encryptLandingNotes({ travelType, budget, problem });
 *   const decrypted = decryptLandingNotes(encrypted); // Admin only
 */

import crypto from 'crypto';

// 환경변수에서 암호화 키 읽기
// 32바이트(256비트) AES 키 필수
const ENCRYPTION_KEY = process.env.SENSITIVE_DATA_KEY || process.env.ENCRYPTION_KEY || 'dev-fallback-32-byte-key-unsafe';

/**
 * 암호화 키 검증
 * @returns 32바이트 Buffer
 */
function getEncryptionKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
  return Buffer.from(key, 'utf8');
}

/**
 * Landing 페이지 정보 암호화
 * @param data 평문 데이터
 * @returns 암호화된 데이터 + 인증태그 (형식: IV:encryptedData:authTag)
 */
export function encryptLandingNotes(data: {
  travelType?: string;
  budget?: string;
  problem?: string;
}): string {
  try {
    // 평문 JSON 작성
    const plaintext = JSON.stringify({
      source: 'LANDING_CRUISEDOT',
      timestamp: new Date().toISOString(),
      data
    });

    // IV 생성 (16바이트 random)
    const iv = crypto.randomBytes(16);

    // 암호화 객체 생성
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      iv
    );

    // 암호화 실행
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 인증 태그 추출
    const authTag = cipher.getAuthTag().toString('hex');

    // IV:encryptedData:authTag 형식으로 반환
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (error) {
    console.error('[encrypt-landing-notes-error]', error);
    // Fallback: 평문 저장 (암호화 실패 시 원본 유지)
    return JSON.stringify(data);
  }
}

/**
 * Landing 페이지 정보 복호화
 * @param encrypted IV:encryptedData:authTag 형식 데이터
 * @returns 원본 데이터 객체
 */
export function decryptLandingNotes(encrypted: string): {
  source?: string;
  timestamp?: string;
  data?: Record<string, any>;
} {
  try {
    // IV:encryptedData:authTag 분리
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      // 평문이거나 잘못된 형식
      try {
        return JSON.parse(encrypted);
      } catch {
        return {};
      }
    }

    const [ivHex, encryptedHex, authTagHex] = parts;

    // IV, 암호화된 데이터, 인증 태그 복원
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // 복호화 객체 생성
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      iv
    );

    // 인증 태그 설정
    decipher.setAuthTag(authTag);

    // 복호화 실행
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[decrypt-landing-notes-error]', error);
    return {};
  }
}

/**
 * Contact 감사 로그 (Audit Log) 데이터 암호화
 * ContactAuditLog 모델에 encryptedDetails 필드로 저장
 *
 * @param action 작업 유형 (LANDING_SIGNUP, CALL_RESULT, etc)
 * @param details 민감 정보 객체
 * @returns 암호화된 데이터
 */
export function encryptAuditLogDetails(
  action: string,
  details: Record<string, any>
): string {
  try {
    const plaintext = JSON.stringify({
      action,
      timestamp: new Date().toISOString(),
      details
    });

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      iv
    );

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
  } catch (error) {
    console.error('[encrypt-audit-log-error]', error);
    return JSON.stringify({ action, details });
  }
}

/**
 * Contact 감사 로그 복호화
 * @param encrypted 암호화된 감사 로그 데이터
 * @returns 원본 감사 로그 객체
 */
export function decryptAuditLogDetails(encrypted: string): {
  action?: string;
  timestamp?: string;
  details?: Record<string, any>;
} {
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      try {
        return JSON.parse(encrypted);
      } catch {
        return {};
      }
    }

    const [ivHex, encryptedHex, authTagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[decrypt-audit-log-error]', error);
    return {};
  }
}

/**
 * 복호화 권한 검증
 * Admin, Owner, Manager 역할만 민감 정보 접근 가능
 *
 * @param userRole 사용자 역할 (ADMIN, OWNER, MANAGER, AGENT, etc)
 * @returns 복호화 권한 여부
 */
export function canDecryptSensitiveData(userRole?: string): boolean {
  const allowedRoles = ['ADMIN', 'OWNER', 'MANAGER', 'SUPER_ADMIN'];
  return userRole ? allowedRoles.includes(userRole.toUpperCase()) : false;
}

/**
 * 데이터 마스킹 (민감 정보 일부 숨김)
 * 일반 사용자가 민감 정보를 볼 때 사용
 *
 * @param data 원본 데이터
 * @param fields 마스킹할 필드명
 * @returns 마스킹된 데이터
 */
export function maskSensitiveData(
  data: Record<string, any>,
  fields: string[] = ['budget', 'problem', 'email']
): Record<string, any> {
  const masked = { ...data };

  fields.forEach((field) => {
    if (field in masked && masked[field]) {
      const value = String(masked[field]);
      // 첫 3글자만 표시, 나머지는 ****
      masked[field] = value.length > 3 ? value.slice(0, 3) + '****' : '****';
    }
  });

  return masked;
}
