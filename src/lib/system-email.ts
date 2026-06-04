/**
 * 시스템 레벨 이메일 발송
 * 우선순위: SYSTEM_SMTP_* → NODEMAILER_* 폴백
 * 발신: jmonica@cruisedot.co.kr (SYSTEM_SMTP_USER 설정 시)
 */
import { createTransport } from 'nodemailer';
import { logger } from '@/lib/logger';

interface SystemEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename:    string;
    content:     Buffer;
    contentType: string;
  }>;
}

export async function sendSystemEmail(params: SystemEmailParams): Promise<boolean> {
  // SYSTEM_SMTP_* 우선, NODEMAILER_* 폴백
  const host = process.env.SYSTEM_SMTP_HOST  || process.env.NODEMAILER_HOST;
  const port = parseInt(process.env.SYSTEM_SMTP_PORT || process.env.NODEMAILER_PORT || '587', 10);
  const user = process.env.SYSTEM_SMTP_USER  || process.env.NODEMAILER_USER;
  const pass = process.env.SYSTEM_SMTP_PASS  || process.env.NODEMAILER_PASS;
  const from = process.env.SYSTEM_SMTP_USER  || process.env.NODEMAILER_FROM_EMAIL || user;
  const name = process.env.SYSTEM_SMTP_NAME  || process.env.NODEMAILER_FROM_NAME  || '마비즈스쿨';

  if (!host || !user || !pass) {
    logger.error('[SystemEmail] SMTP 환경변수 미설정 (SYSTEM_SMTP_* 또는 NODEMAILER_*)');
    return false;
  }

  try {
    const transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from:        `"${name}" <${from}>`,
      to:          Array.isArray(params.to) ? params.to.join(', ') : params.to,
      subject:     params.subject,
      html:        params.html,
      attachments: params.attachments,
    });

    logger.log('[SystemEmail] 발송 성공', { to: params.to, subject: params.subject });
    return true;
  } catch (err) {
    logger.error('[SystemEmail] 발송 실패', { err, to: params.to });
    return false;
  }
}

/** 회사 수신 이메일 */
export const COMPANY_EMAIL = process.env.ADMIN_EMAIL ?? 'jmonica@cruisedot.co.kr';

/** GLOBAL_ADMIN 알림 */
export async function notifyGlobalAdmin(subject: string, html: string): Promise<void> {
  const to = process.env.GLOBAL_ADMIN_NOTIFY_EMAIL ?? process.env.ADMIN_EMAIL;
  if (!to) return;
  await sendSystemEmail({ to, subject, html });
}
