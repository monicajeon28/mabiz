/**
 * PII (Personally Identifiable Information) 암호화 유틸리티
 * - AES-256-GCM 기반 대칭 암호화
 * - IV (Initialization Vector) + Salt 기반
 * - Passport 패턴 참고
 *
 * 대상 필드 (Phase 2에서 마이그레이션):
 * - Contact.phone
 * - Contact.email
 * - Contact.address
 *
 * 사용 패턴 (Phase 2):
 * const encrypted = encryptPII(data, salt);
 * const decrypted = decryptPII(encrypted, salt);
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16; // bytes
const IV_LENGTH = 16; // bytes
const TAG_LENGTH = 16; // bytes (GCM 인증 태그)
const KEY_LENGTH = 32; // bytes (256 bits)

/**
 * 마스터 암호화 키 생성 (환경변수 기반)
 * ENCRYPTION_MASTER_KEY: 64자 hex 문자열 (32 bytes)
 */
function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_MASTER_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_MASTER_KEY 환경변수 미설정');
  }

  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY는 64자 hex 문자열이어야 함 (32 bytes)');
  }

  try {
    return Buffer.from(keyHex, 'hex');
  } catch (err) {
    throw new Error('ENCRYPTION_MASTER_KEY는 유효한 hex 문자열이어야 함');
  }
}

/**
 * PBKDF2를 이용한 파생 키 생성
 * @param password 마스터 키 또는 비밀번호
 * @param salt Salt (없으면 새로 생성)
 * @returns { key, salt }
 */
export function deriveKey(
  password: string | Buffer,
  salt?: Buffer
): { key: Buffer; salt: Buffer } {
  const passwordBuf = typeof password === 'string' ? Buffer.from(password, 'utf8') : password;

  const newSalt = salt || crypto.randomBytes(SALT_LENGTH);

  // PBKDF2: SHA-256, 100,000 iterations
  const key = crypto.pbkdf2Sync(passwordBuf, newSalt, 100000, KEY_LENGTH, 'sha256');

  return { key, salt: newSalt };
}

/**
 * PII 데이터 암호화
 * @param data 평문 데이터 (string 또는 object)
 * @param salt Optional: 파생 키 생성용 salt
 * @returns 암호화된 데이터 (hex 문자열)
 *
 * 형식: [salt(32)][iv(32)][tag(32)][ciphertext(variable)]
 * 모두 hex로 인코딩하여 단일 hex 문자열로 반환
 */
export function encryptPII(data: string | Record<string, unknown>, salt?: Buffer): string {
  try {
    const masterKey = getMasterKey();

    // 파생 키 생성
    const { key, salt: usedSalt } = deriveKey(masterKey, salt);

    // 평문 준비
    const plaintext =
      typeof data === 'string' ? data : JSON.stringify(data);

    // IV 생성 (각 암호화마다 새로운 IV)
    const iv = crypto.randomBytes(IV_LENGTH);

    // 암호화
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // 결과 조합: salt + iv + tag + ciphertext (모두 hex)
    const result = Buffer.concat([usedSalt, iv, tag, encrypted]).toString('hex');

    logger.debug(`[encryptPII] 암호화 완료: ${data && typeof data === 'string' ? data.substring(0, 10) : '***'}...`);

    return result;
  } catch (err) {
    logger.error('[encryptPII]', err);
    throw new Error(`PII 암호화 실패: ${err instanceof Error ? err.message : ''}`);
  }
}

/**
 * PII 데이터 복호화
 * @param encrypted 암호화된 hex 문자열
 * @param salt Optional: 파생 키 생성용 salt (암호화 시 사용한 것과 동일)
 * @returns 평문 (string)
 */
export function decryptPII(encrypted: string, salt?: Buffer): string {
  try {
    const masterKey = getMasterKey();

    // hex 문자열을 Buffer로 변환
    const encryptedBuf = Buffer.from(encrypted, 'hex');

    // 구성 요소 추출
    const extractedSalt = encryptedBuf.subarray(0, SALT_LENGTH);
    const iv = encryptedBuf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = encryptedBuf.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const ciphertext = encryptedBuf.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // 파생 키 생성 (암호화 시 사용한 salt 사용)
    const usedSalt = salt || extractedSalt;
    const { key } = deriveKey(masterKey, usedSalt);

    // 복호화
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    logger.debug(`[decryptPII] 복호화 완료`);

    return plaintext;
  } catch (err) {
    logger.error('[decryptPII]', err);
    throw new Error(`PII 복호화 실패: ${err instanceof Error ? err.message : ''}`);
  }
}

/**
 * Contact의 PII 필드 암호화 (마이그레이션용)
 * Phase 2에서 사용할 헬퍼 함수
 *
 * @param data Contact 객체
 * @param fields 암호화할 필드 목록 (기본: phone, email)
 * @returns 암호화된 필드가 포함된 객체
 */
export function encryptContactPII(
  data: Record<string, unknown>,
  fields: string[] = ['phone', 'email']
): Record<string, unknown> {
  const encrypted = { ...data };

  for (const field of fields) {
    const value = encrypted[field];
    if (value && typeof value === 'string') {
      try {
        encrypted[`${field}Encrypted`] = encryptPII(value);
      } catch (err) {
        logger.error(`[encryptContactPII] 필드 암호화 실패: ${field}`, err);
        throw err;
      }
    }
  }

  return encrypted;
}

/**
 * Contact의 PII 필드 복호화
 * @param data Contact 객체 (암호화된 필드 포함)
 * @param fields 복호화할 필드 목록 (기본: phone, email)
 * @returns 복호화된 필드가 포함된 객체
 */
export function decryptContactPII(
  data: Record<string, unknown>,
  fields: string[] = ['phone', 'email']
): Record<string, unknown> {
  const decrypted = { ...data };

  for (const field of fields) {
    const encryptedValue = decrypted[`${field}Encrypted`];
    if (encryptedValue && typeof encryptedValue === 'string') {
      try {
        decrypted[field] = decryptPII(encryptedValue);
      } catch (err) {
        logger.error(`[decryptContactPII] 필드 복호화 실패: ${field}`, err);
        throw err;
      }
    }
  }

  return decrypted;
}

/**
 * 테스트용 헬퍼 함수
 * 환경변수 없이 임시 마스터 키로 암호화/복호화
 */
export function testEncryptDecrypt(data: string): { encrypted: string; decrypted: string } {
  try {
    // 임시 마스터 키 (테스트용)
    const tempKey = crypto.randomBytes(KEY_LENGTH).toString('hex');
    process.env.ENCRYPTION_MASTER_KEY = tempKey;

    const encrypted = encryptPII(data);
    const decrypted = decryptPII(encrypted);

    // 환경변수 정리
    delete process.env.ENCRYPTION_MASTER_KEY;

    return { encrypted, decrypted };
  } catch (err) {
    delete process.env.ENCRYPTION_MASTER_KEY;
    throw err;
  }
}
