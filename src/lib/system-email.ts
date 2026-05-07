/**
 * src/lib/system-email.ts
 * 시스템 알림 전용 발신자 — 조직 SMTP와 완전히 분리
 *
 * 용도: 웹훅 수신 시 GLOBAL_ADMIN 알림, 파트너 계약 완료 알림
 * 발신: jmonica@cruisedot.co.kr (Gmail 앱 비밀번호)
 *
 * 환경변수:
 *   SYSTEM_SMTP_HOST  = smtp.gmail.com
 *   SYSTEM_SMTP_PORT  = 587
 *   SYSTEM_SMTP_USER  = jmonica@cruisedot.co.kr
 *   SYSTEM_SMTP_PASS  = Gmail 앱 비밀번호 (16자)
 *   GLOBAL_ADMIN_NOTIFY_EMAIL = jmonica@cruisedot.co.kr
 */
import { createTransport } from 'nodemailer';
import { logger } from '@/lib/logger';

interface SystemEmailParams {
  to:      string;
  subject: string;
  html:    string;
}

export async function sendSystemEmail(params: SystemEmailParams): Promise<boolean> {
  const host = process.env.SYSTEM_SMTP_HOST;
  const port = parseInt(process.env.SYSTEM_SMTP_PORT ?? '587');
  const user = process.env.SYSTEM_SMTP_USER;
  const pass = process.env.SYSTEM_SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn('[SystemEmail] SMTP 환경변수 미설정 — 발송 생략', {
      missing: [!host && 'SYSTEM_SMTP_HOST', !user && 'SYSTEM_SMTP_USER', !pass && 'SYSTEM_SMTP_PASS'].filter(Boolean),
    });
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
      from:    `"크루즈닷 CRM" <${user}>`,
      to:      params.to,
      subject: params.subject,
      html:    params.html,
    });

    logger.warn('[SystemEmail] 발송 성공', { to: params.to, subject: params.subject });
    return true;
  } catch (err) {
    logger.error('[SystemEmail] 발송 실패', { err, to: params.to });
    return false;
  }
}

/** GLOBAL_ADMIN 알림 — 환경변수에서 수신자 자동 결정 */
export async function notifyGlobalAdmin(subject: string, html: string): Promise<void> {
  const to = process.env.GLOBAL_ADMIN_NOTIFY_EMAIL;
  if (!to) {
    logger.warn('[SystemEmail] GLOBAL_ADMIN_NOTIFY_EMAIL 미설정');
    return;
  }
  await sendSystemEmail({ to, subject, html });
}
