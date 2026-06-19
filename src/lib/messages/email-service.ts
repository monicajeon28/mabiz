/**
 * Email 자동화 서비스 (SendGrid)
 * - PASONA Day 0-3 이메일 시퀀스
 * - HTML 템플릿 렌더링
 * - 오픈율/클릭율 추적
 * - SMTP 설정 지원
 */

import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { renderMessage } from '@/lib/message-template-engine';

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

interface EmailPayload {
  organizationId: string;
  contactId: string;
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateKey: string;
  lens?: string;
  abTestGroup?: string;
  trackingId?: string;
  scheduleAt?: Date;
}

interface SendEmailResponse {
  messageId: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  provider: 'SENDGRID' | 'SMTP' | 'NONE';
}

/**
 * 이메일 발송 (SendGrid 또는 SMTP 폴백)
 */
export async function sendEmail(
  payload: EmailPayload
): Promise<SendEmailResponse> {
  try {
    // OrgEmailConfig 조회
    const emailConfig = await prisma.orgEmailConfig.findUnique({
      where: { organizationId: payload.organizationId },
    });

    if (!emailConfig || !emailConfig.isActive) {
      logger.warn('[EmailService] Email config not found or inactive', {
        organizationId: payload.organizationId,
      });
      return {
        messageId: '',
        status: 'FAILED',
        provider: 'NONE',
      };
    }

    // SendGrid 우선, SMTP 폴백
    if (process.env.SENDGRID_API_KEY) {
      return await sendViaSendGrid(payload);
    } else {
      return await sendViaSMTP(payload, emailConfig);
    }
  } catch (error) {
    logger.error('[EmailService] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      organizationId: payload.organizationId,
    });

    return {
      messageId: '',
      status: 'FAILED',
      provider: 'NONE',
    };
  }
}

/**
 * SendGrid API를 통한 이메일 발송
 * https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
async function sendViaSendGrid(
  payload: EmailPayload
): Promise<SendEmailResponse> {
  try {
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      throw new Error('SENDGRID_API_KEY not configured');
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sendgridApiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: payload.recipientEmail }],
            custom_args: {
              tracking_id: payload.trackingId || '',
              lens: payload.lens || '',
              ab_test_group: payload.abTestGroup || '',
            },
          },
        ],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@mabiz-crm.io',
          name: 'mabiz CRM',
        },
        subject: payload.subject,
        content: [
          {
            type: 'text/html',
            value: payload.htmlContent,
          },
          ...(payload.textContent
            ? [{ type: 'text/plain', value: payload.textContent }]
            : []),
        ],
        tracking_settings: {
          click_tracking: {
            enable: true,
            enable_text: true,
          },
          open_tracking: {
            enable: true,
            substitute_tag: '[open_pixel]',
          },
        },
        send_at: payload.scheduleAt
          ? Math.floor(payload.scheduleAt.getTime() / 1000)
          : undefined,
      }),
    });

    if (response.status === 202) {
      // SendGrid는 202로 수락 상태 반환
      const messageId = `sgm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.log('[EmailService] Email sent via SendGrid', {
        organizationId: payload.organizationId,
        messageId,
        recipientEmail: payload.recipientEmail,
        templateKey: payload.templateKey,
      });

      return {
        messageId,
        status: payload.scheduleAt ? 'PENDING' : 'SENT',
        provider: 'SENDGRID',
      };
    } else {
      const errorData = await response.json();
      logger.error('[EmailService] SendGrid API error', {
        status: response.status,
        error: errorData.errors,
      });

      return {
        messageId: '',
        status: 'FAILED',
        provider: 'SENDGRID',
      };
    }
  } catch (error) {
    logger.error('[EmailService] SendGrid request failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * SMTP를 통한 이메일 발송 (Nodemailer)
 * NOTE: sendViaSMTP는 현재 미구현 상태입니다.
 * SENDGRID_API_KEY가 없을 때 이 경로에 도달하면 명시적 오류를 반환합니다.
 * 실제 SMTP 구현이 필요하다면 src/lib/email.ts의 sendEmail()을 활용하세요.
 */
async function sendViaSMTP(
  payload: EmailPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _emailConfig: any
): Promise<SendEmailResponse> {
  logger.error('[EmailService] SENDGRID_API_KEY 미설정 — 이메일 발송 불가. SENDGRID_API_KEY 환경변수를 설정하거나 SMTP 구현을 완성하세요.', {
    organizationId: payload.organizationId,
  });

  return {
    messageId: '',
    status: 'FAILED',
    provider: 'SMTP',
  };
}

/**
 * PASONA Day별 이메일 템플릿 (HTML)
 */
export function getPasonaEmailTemplate(
  day: 0 | 1 | 2 | 3,
  lens: string,
  contactName: string,
  vars: Record<string, string>
): { subject: string; html: string; text: string } {
  const baseTemplate = {
    subject: getPasonaEmailSubject(day, lens, contactName),
    html: getPasonaEmailHTML(day, lens, contactName, vars),
    text: getPasonaEmailText(day, lens, contactName, vars),
  };

  return baseTemplate;
}

function getPasonaEmailSubject(day: 0 | 1 | 2 | 3, lens: string, contactName?: string): string {
  const subjects: Record<number, Record<string, string>> = {
    0: {
      L6: '🚢 48시간 한정 크루즈 특가 안내',
      L10: '{{name}}님을 위한 특별 기회',
      default: '크루즈 여행 안내',
    },
    1: {
      L2: '크루즈 준비가 쉬워요! 📋',
      L3: '호텔과 크루즈의 진짜 차이점',
      default: '{{name}}님을 위한 특별 제안',
    },
    2: {
      L6: '마지막 48시간 ⏰ 특가 예약',
      L8: '{{name}}님을 위한 VIP 혜택',
      default: '오늘만의 특별 오퍼',
    },
    3: {
      L10: '{{name}}님, 결정할 시간입니다 🎯',
      L6: '마지막 기회! 내일 자정 마감',
      default: '최종 안내',
    },
  };

  const template = subjects[day]?.[lens] || subjects[day]?.['default'] || '안내';
  return template.replace('{{name}}', escapeHtml(contactName ?? ''));
}

function getPasonaEmailHTML(
  day: 0 | 1 | 2 | 3,
  lens: string,
  contactName: string,
  vars: Record<string, string>
): string {
  const greeting = `안녕하세요, ${escapeHtml(contactName)}님!`;

  const contents: Record<number, string> = {
    0: `
      <p>{{greeting}}</p>
      <h2>5월 특가 안내</h2>
      <p>크루즈 한 번 떠나고 싶지 않으세요?</p>
      <p><strong>특가: ¥{{price}}K → ¥{{discount}}K</strong></p>
      <p>(48시간 한정)</p>
      <a href="{{link}}" style="background: #007bff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">지금 예약하기</a>
    `,
    1: `
      <p>{{greeting}}</p>
      <h2>크루즈 준비 가이드</h2>
      <p>준비가 복잡할까 봐 걱정하신가요?</p>
      <p>저희가 처음부터 끝까지 가이드해드릴게요! 📋</p>
      <a href="{{link}}" style="background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">체크리스트 보기</a>
    `,
    2: `
      <p>{{greeting}}</p>
      <h2>{{name}}님을 위한 특별 혜택</h2>
      <p>{{offer}}</p>
      <p>지금 예약하면 추가 20% 할인!</p>
      <a href="{{link}}" style="background: #ffc107; color: black; padding: 10px 20px; border-radius: 5px; text-decoration: none;">지금 예약하기</a>
    `,
    3: `
      <p>{{greeting}}</p>
      <h2>마지막 기회! ⏰</h2>
      <p>내일 자정이 마감입니다.</p>
      <p>더 이상 미루지 마세요!</p>
      <a href="{{link}}" style="background: #dc3545; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">지금 예약하기</a>
    `,
  };

  let html = contents[day] || '';
  html = html.replace('{{greeting}}', greeting);
  html = html.replace('{{name}}', escapeHtml(contactName));

  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(`{{${key}}}`, escapeHtml(value));
  }

  // {{unsubscribe}} 플레이스홀더 폴백 처리 (수신거부 링크)
  html = html.replace('{{unsubscribe}}', vars['unsubscribe'] ?? '#');

  // 이메일 래퍼
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
        h2 { color: #007bff; }
        a { cursor: pointer; }
      </style>
    </head>
    <body>
      ${html}
      <hr>
      <p style="color: #999; font-size: 12px;">
        © 2026 mabiz CRM. All rights reserved.<br>
        <a href="{{unsubscribe}}" style="color: #999;">구독 해제</a>
      </p>
    </body>
    </html>
  `;
}

function getPasonaEmailText(
  day: 0 | 1 | 2 | 3,
  lens: string,
  contactName: string,
  vars: Record<string, string>
): string {
  const greeting = `안녕하세요, ${escapeHtml(contactName)}님!`;

  const texts: Record<number, string> = {
    0: `${greeting}\n\n5월 특가 안내\n크루즈 한 번 떠나고 싶지 않으세요?\n\n특가: ¥{{price}}K → ¥{{discount}}K\n(48시간 한정)\n\n지금 예약하기: {{link}}`,
    1: `${greeting}\n\n크루즈 준비 가이드\n준비가 복잡할까 봐 걱정하신가요?\n저희가 처음부터 끝까지 가이드해드릴게요!\n\n체크리스트: {{link}}`,
    2: `${greeting}\n\n{{name}}님을 위한 특별 혜택\n{{offer}}\n\n지금 예약하면 추가 20% 할인!\n\n예약하기: {{link}}`,
    3: `${greeting}\n\n마지막 기회!\n내일 자정이 마감입니다.\n더 이상 미루지 마세요!\n\n예약하기: {{link}}`,
  };

  let text = texts[day] || '';
  text = text.replace('{{name}}', escapeHtml(contactName));

  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(`{{${key}}}`, escapeHtml(value));
  }

  return text;
}

/**
 * Email 로그 기록 (SmsLog 재활용)
 */
export async function logEmailMessage(
  organizationId: string,
  contactId: string | undefined,
  recipientEmail: string,
  messageId: string,
  subject: string,
  status: 'PENDING' | 'SENT' | 'FAILED'
): Promise<void> {
  try {
    await prisma.smsLog.create({
      data: {
        organizationId,
        contactId: contactId || undefined,
        phone: recipientEmail, // 이메일도 같은 필드 사용
        contentPreview: subject.substring(0, 100),
        status,
        channel: 'EMAIL',
        msgId: messageId,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('[EmailService] Failed to log email', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 이메일 오픈율 추적 픽셀
 * SendGrid 자동 처리, 수동으로도 가능
 */
export function generateOpenTrackingPixel(trackingId: string): string {
  return `<img src="https://tracking.mabiz-crm.io/open/${trackingId}" width="1" height="1" alt="" style="display:none;">`;
}
