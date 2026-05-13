import crypto from 'crypto';
import { createHmac } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for IV
const AUTH_TAG_LENGTH = 16; // 16 bytes for authentication tag

// Lazy-load encryption key (only loaded when encryption functions are called)
let ENCRYPTION_KEY: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY;

  const key = process.env.CONTACT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('CONTACT_ENCRYPTION_KEY environment variable is required');
  }

  // Base64에서 Buffer로 변환 (32바이트 확인)
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error(`CONTACT_ENCRYPTION_KEY must be exactly 32 bytes, got ${buf.length}`);
  }

  ENCRYPTION_KEY = buf;
  return ENCRYPTION_KEY;
}

/**
 * AES-256-GCM으로 텍스트 암호화
 * 반환: base64(iv + authTag + ciphertext) 형식
 */
export function encryptContactField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'binary');
  encrypted += cipher.final('binary');

  const authTag = cipher.getAuthTag();

  // 형식: iv(16) + authTag(16) + ciphertext
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'binary'),
  ]);

  return combined.toString('base64');
}

/**
 * AES-256-GCM으로 암호화된 텍스트 복호화
 * 입력: base64(iv + authTag + ciphertext) 형식
 */
export function decryptContactField(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encrypted, 'base64');

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted data length');
    }

    const iv = combined.slice(0, IV_LENGTH);
    const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt contact field: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 전화번호를 해시하여 쿼리 가능하게 (HMAC-SHA256 사용)
 * 같은 전화번호는 항상 같은 해시값을 생성
 */
export function hashPhoneForQuery(phone: string): string {
  const key = getEncryptionKey();
  return createHmac('sha256', key)
    .update(phone)
    .digest('hex');
}

/**
 * 여러 연락처 필드를 한번에 암호화 (배치 연산 최적화)
 */
export function encryptContactFields(data: {
  phone?: string;
  email?: string;
  name?: string;
}): {
  phoneEncrypted?: string;
  phoneHash?: string;
  emailEncrypted?: string;
  nameEncrypted?: string;
} {
  const result: any = {};

  if (data.phone) {
    result.phoneEncrypted = encryptContactField(data.phone);
    result.phoneHash = hashPhoneForQuery(data.phone);
  }

  if (data.email) {
    result.emailEncrypted = encryptContactField(data.email);
  }

  if (data.name) {
    result.nameEncrypted = encryptContactField(data.name);
  }

  return result;
}

/**
 * 암호화된 연락처 필드를 복호화 (조회 용)
 */
export function decryptContactFields(data: {
  phoneEncrypted?: string | null;
  emailEncrypted?: string | null;
  nameEncrypted?: string | null;
}): {
  phone?: string;
  email?: string;
  name?: string;
} {
  const result: any = {};

  if (data.phoneEncrypted) {
    try {
      result.phone = decryptContactField(data.phoneEncrypted);
    } catch (err) {
      // 복호화 실패 시 null로 반환 (데이터 손상)
      result.phone = null;
    }
  }

  if (data.emailEncrypted) {
    try {
      result.email = decryptContactField(data.emailEncrypted);
    } catch (err) {
      result.email = null;
    }
  }

  if (data.nameEncrypted) {
    try {
      result.name = decryptContactField(data.nameEncrypted);
    } catch (err) {
      result.name = null;
    }
  }

  return result;
}
