/**
 * 여권번호 AES-256 암호화 시스템
 * - 환경변수: PASSPORT_ENCRYPTION_KEY (32바이트 = 256bit)
 * - 초기화벡터: 16바이트 랜덤 (암호화마다 새로 생성)
 * - DB저장: encrypted + iv (모두 base64로 인코딩)
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

// 환경변수에서 암호화 키 로드 (32바이트 = 256bit)
function getEncryptionKey(): Buffer {
  const key = process.env.PASSPORT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PASSPORT_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다');
  }

  // key가 hex 문자열이면 Buffer로 변환, 아니면 UTF-8로 변환
  if (key.length === 64) {
    // 64자 = 32바이트 hex
    return Buffer.from(key, 'hex');
  } else if (key.length === 44) {
    // 44자 = 32바이트 base64
    return Buffer.from(key, 'base64');
  } else {
    throw new Error(`PASSPORT_ENCRYPTION_KEY는 32바이트여야 합니다 (현재: ${key.length/2}바이트)`);
  }
}

/**
 * 여권번호 암호화
 * @param passportNumber - 암호화할 여권번호 (평문)
 * @returns { encryptedData: string, iv: string } base64 인코딩된 값
 */
export function encryptPassport(passportNumber: string): { encryptedData: string; iv: string } {
  try {
    const key = getEncryptionKey();

    // 초기화벡터(IV) 랜덤 생성 (16바이트)
    const iv = crypto.randomBytes(16);

    // AES-256-CBC 암호화
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(passportNumber, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    // 결과를 base64로 인코딩하여 DB에 저장하기 쉽게 함
    return {
      encryptedData: Buffer.from(encrypted, 'hex').toString('base64'),
      iv: iv.toString('base64'),
    };
  } catch (error) {
    logger.error('[passport-encryption] 암호화/복호화 실패', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * 여권번호 복호화
 * @param encryptedData - base64 인코딩된 암호화 데이터
 * @param iv - base64 인코딩된 초기화벡터
 * @returns 원래 여권번호 (평문)
 */
export function decryptPassport(encryptedData: string, iv: string): string {
  try {
    const key = getEncryptionKey();

    // base64에서 버퍼로 변환
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    // AES-256-CBC 복호화
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuffer);
    let decrypted = decipher.update(encryptedBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf-8');
  } catch (error) {
    logger.error('[passport-encryption] 암호화/복호화 실패', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * 여권번호 마스킹 (UI 표시용)
 * 예: "M12345678" → "****5678"
 * @param passportNumber - 마스킹할 여권번호
 * @returns 마스킹된 여권번호
 */
export function maskPassport(passportNumber: string): string {
  if (!passportNumber || passportNumber.length < 4) {
    return '****';
  }
  const lastFour = passportNumber.slice(-4);
  return `****${lastFour}`;
}

/**
 * 암호화 키 생성 (개발/테스트용)
 * 실제 배포에서는 다음 명령으로 키 생성:
 * node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * @returns 32바이트 hex 문자열
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 암호화 키 검증
 * @returns 키가 올바르게 설정되어 있는지 여부
 */
export function validateEncryptionKey(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
