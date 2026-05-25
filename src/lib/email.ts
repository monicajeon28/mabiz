import { logger } from "@/lib/logger";
import { createTransport } from "nodemailer";
import { encrypt, decrypt } from "@/lib/crypto";

if (!process.env.EMAIL_ENCRYPT_KEY || process.env.EMAIL_ENCRYPT_KEY.length < 32) {
  if (process.env.NODE_ENV === 'production') logger.error("[FATAL] EMAIL_ENCRYPT_KEY 미설정 — 조직 SMTP 불동작");
}

export function encryptSmtpPassword(plain: string): string {
  return encrypt(plain, "EMAIL_ENCRYPT_KEY");
}

export function decryptSmtpPassword(encrypted: string): string {
  return decrypt(encrypted, "EMAIL_ENCRYPT_KEY");
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

// ─── 이메일 로그 기록 (Redis 큐 기반, fire-and-forget) ──────────

async function recordEmailLog(params: {
  organizationId: string;
  contactId?: string;
  to: string;
  subject: string;
  status: "SENT" | "FAILED" | "BLOCKED";
  blockReason?: string;
  channel: string;
}) {
  const { addEmailLog } = await import("@/lib/email-queue");

  try {
    await addEmailLog({
      organizationId: params.organizationId,
      contactId:      params.contactId ?? null,
      email:          params.to,
      subject:        params.subject,
      status:         params.status,
      blockReason:    params.blockReason ?? null,
      channel:        params.channel,
    });
  } catch (err) {
    logger.error("[Email] EmailLog 큐 추가 실패", { err });
  }
}

// ─── 퍼널용 이메일 발송 (sendSms와 동일한 응답 인터페이스) ─────────

interface FunnelEmailResponse {
  result_code: number;  // 1=성공, 음수=실패
  message: string;
}

/**
 * 퍼널 Cron / 예약 발송에서 호출하는 이메일 발송
 * - sendSms()와 동일한 result_code 구조 (1=성공)
 * - 조직 SMTP 설정 자동 조회
 * - EmailLog 자동 기록 (fire-and-forget)
 */
export async function sendFunnelEmail(params: {
  organizationId: string;
  contactId?: string;
  to: string;
  subject: string;
  html: string;
  channel?: string;
}): Promise<FunnelEmailResponse> {
  const { organizationId, contactId, to, subject, html, channel = "FUNNEL" } = params;

  if (!to || !to.includes("@")) {
    logger.warn("[Email/Funnel] 유효하지 않은 이메일", { to: to?.slice(0, 5) + "***" });
    recordEmailLog({ organizationId, contactId, to, subject, status: "BLOCKED", blockReason: "NO_EMAIL", channel });
    return { result_code: -96, message: "유효하지 않은 이메일" };
  }

  const config = await getOrgEmailConfig(organizationId);
  if (!config?.isActive) {
    logger.warn("[Email/Funnel] 이메일 설정 미완료", { organizationId });
    recordEmailLog({ organizationId, contactId, to, subject, status: "BLOCKED", blockReason: "NO_CONFIG", channel });
    return { result_code: -97, message: "이메일 설정 미완료" };
  }

  const ok = await sendEmail({
    smtpHost:         config.smtpHost,
    smtpPort:         config.smtpPort,
    smtpUser:         config.smtpUser,
    smtpPassEncrypted: config.smtpPassEncrypted,
    senderName:       config.senderName,
    senderEmail:      config.senderEmail,
    to,
    subject,
    html,
  });

  recordEmailLog({ organizationId, contactId, to, subject, status: ok ? "SENT" : "FAILED", channel });

  return ok
    ? { result_code: 1, message: "발송 성공" }
    : { result_code: -1, message: "발송 실패" };
}
