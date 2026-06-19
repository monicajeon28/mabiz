/**
 * 시스템 레벨 이메일 발송 (NODEMAILER_* 환경변수 사용)
 * 계약서 PDF 등 조직 SMTP 없이 발송해야 할 때 사용
 */
import { createTransport, type Transporter } from 'nodemailer';
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

/** 이메일 주소 형식 검증 */
function isValidEmail(addr: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
}

/** Lazy singleton transporter — SMTP 핸드셰이크를 최초 1회만 수행 */
let _transporter: Transporter | null = null;
let _transporterKey = '';

function getTransporter(): Transporter | null {
  const host = process.env.NODEMAILER_HOST;
  const port = parseInt(process.env.NODEMAILER_PORT ?? '587', 10);
  const user = process.env.NODEMAILER_USER;
  const pass = process.env.NODEMAILER_PASS;

  if (!host || !user || !pass) return null;

  const key = `${host}:${port}:${user}`;
  if (_transporter && _transporterKey === key) return _transporter;

  _transporter = createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  _transporterKey = key;
  return _transporter;
}

export async function sendSystemEmail(params: SystemEmailParams): Promise<boolean> {
  // 수신자 이메일 형식 검증
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const invalid = recipients.filter((addr) => !isValidEmail(addr));
  if (invalid.length > 0) {
    logger.error('[SystemEmail] 유효하지 않은 이메일 주소', { invalid: invalid.map((a) => a.slice(0, 5) + '***') });
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) {
    logger.error('[SystemEmail] NODEMAILER 환경변수 미설정');
    return false;
  }

  const from = process.env.NODEMAILER_FROM_EMAIL ?? process.env.NODEMAILER_USER;
  const name = process.env.NODEMAILER_FROM_NAME  ?? '마비즈스쿨';

  if (!from) {
    logger.error('[SystemEmail] NODEMAILER_FROM_EMAIL 또는 NODEMAILER_USER 미설정');
    return false;
  }

  try {
    await transporter.sendMail({
      from:        `"${name}" <${from}>`,
      to:          recipients.join(', '),
      subject:     params.subject,
      html:        params.html,
      attachments: params.attachments,
    });

    logger.log('[SystemEmail] 발송 성공', { to: params.to, subject: params.subject });
    return true;
  } catch (err) {
    logger.error('[SystemEmail] 발송 실패', {
      err: err instanceof Error ? err.message : String(err),
      to: Array.isArray(params.to)
        ? params.to.map((a: string) => a.slice(0, 3) + '***')
        : String(params.to).slice(0, 3) + '***',
    });
    return false;
  }
}

/** 회사 수신 이메일 (마비즈스쿨 원격평생교육원) — 환경변수 필수 */
export const COMPANY_EMAIL = process.env.NODEMAILER_FROM_EMAIL ?? '';

/** GLOBAL_ADMIN 알림 — 환경변수에서 수신자 자동 결정 */
export async function notifyGlobalAdmin(subject: string, html: string): Promise<void> {
  const to = process.env.GLOBAL_ADMIN_NOTIFY_EMAIL ?? process.env.ADMIN_EMAIL;
  if (!to) return;
  await sendSystemEmail({ to, subject, html });
}
