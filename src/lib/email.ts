import { logger } from "@/lib/logger";
import { createTransport } from "nodemailer";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPT_KEY = process.env.EMAIL_ENCRYPT_KEY ?? "mabiz-default-32char-key!!!!!!!";

// SMTP 비밀번호 암호화
export function encryptSmtpPassword(plain: string): string {
  const iv = randomBytes(16);
  const key = Buffer.from(ENCRYPT_KEY.substring(0, 32));
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

// SMTP 비밀번호 복호화
export function decryptSmtpPassword(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = Buffer.from(ENCRYPT_KEY.substring(0, 32));
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

interface SendEmailParams {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassEncrypted: string;
  senderName: string;
  senderEmail: string;
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const {
    smtpHost, smtpPort, smtpUser, smtpPassEncrypted,
    senderName, senderEmail, to, subject, html,
  } = params;

  try {
    const pass = decryptSmtpPassword(smtpPassEncrypted);
    const transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass },
    });

    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to,
      subject,
      html,
    });

    logger.log("[Email] 발송 성공", { to, subject });
    return true;
  } catch (err) {
    logger.error("[Email] 발송 실패", { err, to });
    return false;
  }
}

// 조직의 이메일 설정 조회
export async function getOrgEmailConfig(organizationId: string) {
  const { default: prisma } = await import("@/lib/prisma");
  return prisma.orgEmailConfig.findUnique({ where: { organizationId } });
}
