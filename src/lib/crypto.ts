import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export function encrypt(plain: string, keyEnvVar: string): string {
  const rawKey = process.env[keyEnvVar];
  if (!rawKey || rawKey.length < 32) {
    throw new Error('EMAIL_ENCRYPT_KEY required');
  }
  const key = Buffer.from(rawKey.substring(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(encryptedStr: string, keyEnvVar: string): string {
  const rawKey = process.env[keyEnvVar];
  if (!rawKey || rawKey.length < 32) {
    throw new Error('EMAIL_ENCRYPT_KEY required');
  }
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
