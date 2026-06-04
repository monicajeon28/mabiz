/**
 * 시스템 레벨 이메일 발송 (NODEMAILER_* 환경변수 사용)
 * 계약서 PDF 등 조직 SMTP 없이 발송해야 할 때 사용
 */
import { createTransport } from 'nodemailer';
import { logger } from '@/lib/logger';

interface SystemEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content:  Buffer;
    contentType: string;
  }>;
}

export async function sendSystemEmail(params: SystemEmailParams): Promise<boolean> {
  const host  = process.env.NODEMAILER_HOST;
  const port  = parseInt(process.env.NODEMAILER_PORT ?? '587', 10);
  const user  = process.env.NODEMAILER_USER;
  const pass  = process.env.NODEMAILER_PASS;
  const from  = process.env.NODEMAILER_FROM_EMAIL ?? user;
  const name  = process.env.NODEMAILER_FROM_NAME  ?? '마비즈스쿨';

  if (!host || !user || !pass) {
    logger.error('[SystemEmail] NODEMAILER 환경변수 미설정');
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

/** 회사 수신 이메일 (마비즈스쿨 원격평생교육원) */
export const COMPANY_EMAIL = process.env.NODEMAILER_FROM_EMAIL ?? 'hyeseon28@gmail.com';

/** GLOBAL_ADMIN 알림 — 환경변수에서 수신자 자동 결정 */
export async function notifyGlobalAdmin(subject: string, html: string): Promise<void> {
  const to = process.env.GLOBAL_ADMIN_NOTIFY_EMAIL ?? process.env.ADMIN_EMAIL;
  if (!to) return;
  await sendSystemEmail({ to, subject, html });
}
