/**
 * 결제 데이터 암호화 유틸 (P0-7)
 *
 * 민감 정보(buyerEmail, buyerTel)를 AES-256-GCM으로 암호화
 * 형식: iv:encrypted:authTag (모두 hex 문자열)
 *
 * 요구사항:
 * 1. process.env.PAYMENT_ENCRYPTION_KEY (32바이트 hex)
 * 2. 암호화: AES-256-GCM
 * 3. IV: 랜덤 16바이트
 * 4. AuthTag: 검증용 16바이트 태그
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * 암호화 키 검증 (초기화 시 1회)
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.PAYMENT_ENCRYPTION_KEY;

  if (!keyEnv) {
    throw new Error(
      'PAYMENT_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. ' +
        '32바이트 hex 문자열을 설정하세요.'
    );
  }

  // 32바이트 = 256비트 (AES-256)
  if (keyEnv.length !== 64) {
    // hex: 1바이트 = 2글자
    throw new Error(
      `PAYMENT_ENCRYPTION_KEY는 64글자(32바이트)여야 합니다. ` +
        `현재: ${keyEnv.length}글자`
    );
  }

  try {
    return Buffer.from(keyEnv, 'hex');
  } catch (error) {
    throw new Error(
      'PAYMENT_ENCRYPTION_KEY는 유효한 hex 문자열이어야 합니다'
    );
  }
}

/**
 * 평문 암호화
 *
 * @param plaintext 암호화할 평문 (예: "user@example.com" 또는 "010-1234-5678")
 * @returns "iv:encrypted:authTag" 형식의 hex 문자열
 * @throws 암호화 키가 없거나 유효하지 않은 경우
 *
 * @example
 * const encrypted = encryptPII("user@example.com");
 * // "a1b2c3d4...:e5f6g7h8...:i9j0k1l2..."
 */
export function encryptPII(plaintext: string): string {
  const key = getEncryptionKey();

  // [Step 1] IV 생성 (16바이트 = 128비트)
  const iv = randomBytes(16);

  // [Step 2] Cipher 생성 (AES-256-GCM)
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  // [Step 3] 암호화
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // [Step 4] AuthTag 추출 (검증용)
  const authTag = cipher.getAuthTag();

  // [Step 5] 포맷: "iv:encrypted:authTag" (모두 hex)
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * 암호화된 텍스트 복호화
 *
 * @param ciphertext "iv:encrypted:authTag" 형식의 hex 문자열
 * @returns 원본 평문
 * @throws 형식이 잘못되었거나 복호화에 실패한 경우 (위변조 감지)
 *
 * @example
 * const encrypted = encryptPII("user@example.com");
 * const decrypted = decryptPII(encrypted);
 * // "user@example.com"
 *
 * @example
 * // 위변조 감지
 * const tampered = encrypted.replace('a', 'b');
 * decryptPII(tampered); // Error: Unsupported state or unable to authenticate data
 */
export function decryptPII(ciphertext: string): string {
  const key = getEncryptionKey();

  // [Step 1] 포맷 검증
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error(
      '암호화된 데이터 형식이 잘못되었습니다. ' +
        '"iv:encrypted:authTag" 형식이어야 합니다.'
    );
  }

  const [ivHex, encryptedHex, authTagHex] = parts;

  // [Step 2] 각 부분을 Buffer로 변환
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // [Step 3] Decipher 생성 (AES-256-GCM)
    const decipher = createDecipheriv('aes-256-gcm', key, iv);

    // [Step 4] AuthTag 설정 (검증)
    decipher.setAuthTag(authTag);

    // [Step 5] 복호화
    const decrypted =
      decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // GCM 인증 실패 또는 hex 변환 실패
    if (
      error instanceof Error &&
      error.message.includes('Unsupported state or unable to authenticate data')
    ) {
      throw new Error(
        '암호화된 데이터가 위변조되었거나 잘못된 키로 복호화되었습니다.'
      );
    }
    throw new Error(`복호화 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 암호화 함수 타입 정의 (선택 사항)
 */
export type PaymentEncryptionFunctions = {
  encryptPII: typeof encryptPII;
  decryptPII: typeof decryptPII;
};
