import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * 암호화 키 해석. SMS_ENCRYPT_KEY가 별도로 설정되지 않은 환경에서는
 * EMAIL_ENCRYPT_KEY로 폴백한다(운영자 선택: 이메일용 키를 문자 암호화에 공용).
 * dev/prod가 같은 DB를 공유하므로 모든 환경이 동일 키로 귀결되어 복호화 일관성이 유지된다.
 * encrypt/decrypt 모두 이 해석기를 거쳐 같은 키를 쓰므로 라운드트립이 보장된다.
 */
function resolveEncryptKey(keyEnvVar: string): string {
  let rawKey = process.env[keyEnvVar];
  if ((!rawKey || rawKey.length < 32) && keyEnvVar === "SMS_ENCRYPT_KEY") {
    rawKey = process.env.EMAIL_ENCRYPT_KEY;
  }
  if (!rawKey || rawKey.length < 32) {
    throw new Error(`${keyEnvVar} required (>=32 chars)`);
  }
  return rawKey;
}

export function encrypt(plain: string, keyEnvVar: string): string {
  const rawKey = resolveEncryptKey(keyEnvVar);
  const key = Buffer.from(rawKey.substring(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(encryptedStr: string, keyEnvVar: string): string {
  const rawKey = resolveEncryptKey(keyEnvVar);
  const parts = encryptedStr.split(":");
  const ivHex = parts[0];
  const encHex = parts[1];
  if (!ivHex || !encHex) {
    throw new Error("[crypto] 암호화된 데이터 형식이 올바르지 않습니다.");
  }
  const key = Buffer.from(rawKey.substring(0, 32));
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
