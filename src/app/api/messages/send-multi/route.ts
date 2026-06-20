import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { normalizePhone } from '@/lib/import-utils';
import { logger } from '@/lib/logger';
import { resolveUserSmsConfig, sendSms } from '@/lib/aligo';
import { resolveUserEmailConfig } from '@/lib/email-resolver';
import { sendEmailWithConfig } from '@/lib/email';

/** 멀티채널 발송 요청 */
interface MultiChannelSendRequest {
  /** 받는 사람 전화번호 또는 이메일 (채널별 선택) */
  recipient: string;
  /** 발송할 채널 배열 */
  channels: ('sms' | 'email' | 'kakao')[];
  /** SMS 메시지 내용 */
  smsMessage?: string;
  /** 이메일 제목 */
  emailSubject?: string;
  /** 이메일 본문 */
  emailBody?: string;
  /** 카카오 알림톡 템플릿 코드 */
  kakaoTplCode?: string;
  /** 카카오 알림톡 제목 */
  kakaoSubject?: string;
  /** 카카오 알림톡 메시지 내용 */
  kakaoMessage?: string;
}

/** 채널별 발송 결과 */
interface ChannelResult {
  channel: 'sms' | 'email' | 'kakao';
  ok: boolean;
  message: string;
  msgId?: string;
}

/** 멀티채널 발송 응답 */
interface MultiChannelSendResponse {
  ok: boolean;
  message: string;
  results: ChannelResult[];
  successCount: number;
  failureCount: number;
}

/**
 * POST /api/messages/send-multi
 *
 * 멀티채널 동시 발송 엔드포인트
 *
 * 예시:
 * {
 *   "recipient": "010-1234-5678",
 *   "channels": ["sms", "email", "kakao"],
 *   "smsMessage": "환영합니다!",
 *   "emailSubject": "가입 환영",
 *   "emailBody": "어서오세요...",
 *   "kakaoSubject": "알림",
 *   "kakaoMessage": "연락처를 등록하셨습니다."
 * }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    if (!orgId) {
      logger.error('[send-multi] 조직 정보 없음', { userId: ctx?.userId });
      return NextResponse.json(
        { ok: false, message: '조직 정보 없음' },
        { status: 403 }
      );
    }

    const body: MultiChannelSendRequest = await req.json();
    const { recipient, channels = [] } = body;

    if (!recipient || channels.length === 0) {
      return NextResponse.json(
        { ok: false, message: '수신자와 채널 선택 필수' },
        { status: 400 }
      );
    }

    const results: ChannelResult[] = [];

    // SMS 발송
    if (channels.includes('sms')) {
      const smsResult = await sendSmsChannel(ctx.userId, orgId, recipient, body.smsMessage);
      results.push(smsResult);
    }

    // 이메일 발송
    if (channels.includes('email')) {
      const emailResult = await sendEmailChannel(ctx.userId, orgId, recipient, body.emailSubject, body.emailBody);
      results.push(emailResult);
    }

    // 카카오톡 발송
    if (channels.includes('kakao')) {
      const kakaoResult = await sendKakaoChannel(ctx.userId, orgId, recipient, body.kakaoTplCode, body.kakaoSubject, body.kakaoMessage);
      results.push(kakaoResult);
    }

    const successCount = results.filter((r) => r.ok).length;
    const failureCount = results.filter((r) => !r.ok).length;

    logger.log('[send-multi] 완료', {
      recipient,
      channels,
      successCount,
      failureCount,
      orgId,
    });

    const response: MultiChannelSendResponse = {
      ok: successCount > 0,
      message: `${successCount}개 채널 발송 완료${failureCount > 0 ? `, ${failureCount}개 실패` : ''}`,
      results,
      successCount,
      failureCount,
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error('[send-multi]', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { ok: false, message: '서버 오류' },
      { status: 500 }
    );
  }
}

/**
 * SMS 채널 발송 (비동기 병렬 처리용)
 */
async function sendSmsChannel(
  userId: string,
  orgId: string,
  recipient: string,
  message?: string
): Promise<ChannelResult> {
  try {
    if (!message) {
      return {
        channel: 'sms',
        ok: false,
        message: '메시지 내용 누락',
      };
    }

    const normalizedPhone = normalizePhone(recipient);
    if (!normalizedPhone) {
      return {
        channel: 'sms',
        ok: false,
        message: '유효하지 않은 전화번호',
      };
    }

    // 수신 거부 여부 확인
    const contactRecord = await prisma.contact.findFirst({
      where: { phone: normalizedPhone, organizationId: orgId },
      select: { id: true, optOutAt: true },
    });

    if (contactRecord?.optOutAt) {
      logger.warn('[send-multi/sms] 수신 거부 연락처', { phone: normalizedPhone, orgId });
      return {
        channel: 'sms',
        ok: false,
        message: '수신 거부 등록된 연락처',
      };
    }

    // 발신 계정 해석
    const config = await resolveUserSmsConfig(orgId, userId);
    if (!config) {
      logger.error('[send-multi/sms] 알리고 설정 없음', { orgId, userId });
      return {
        channel: 'sms',
        ok: false,
        message: 'SMS 발신 계정 미설정',
      };
    }

    // SMS 발송
    const data = await sendSms({
      config,
      receiver: normalizedPhone,
      msg: message,
      organizationId: orgId,
      contactId: contactRecord?.id,
      channel: 'MANUAL',
    });

    const code = Number(data.result_code);

    if (code === -99) {
      return {
        channel: 'sms',
        ok: false,
        message: '수신 거부 등록 연락처',
      };
    }

    if (code === -98) {
      return {
        channel: 'sms',
        ok: false,
        message: '야간(21~08시) 발송 불가',
      };
    }

    if (code !== 1) {
      logger.error('[send-multi/sms] Aligo 전송 실패', {
        code: data.result_code,
        message: data.message,
      });
      return {
        channel: 'sms',
        ok: false,
        message: '발송 실패',
      };
    }

    // 이력 저장
    try {
      await prisma.adminMessage.create({
        data: {
          organizationId: orgId,
          adminId: userId,
          messageType: 'sms',
          channel: 'MULTI_SEND',
          content: message,
          totalSent: 1,
          successCount: 1,
        },
      });
    } catch (err) {
      logger.error('[send-multi/sms] 이력 저장 실패', { err });
    }

    return {
      channel: 'sms',
      ok: true,
      message: '발송 완료',
      msgId: data.msg_id,
    };
  } catch (err) {
    logger.error('[send-multi/sms]', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      channel: 'sms',
      ok: false,
      message: '서버 오류',
    };
  }
}

/**
 * 이메일 채널 발송 (비동기 병렬 처리용)
 */
async function sendEmailChannel(
  userId: string,
  orgId: string,
  recipient: string,
  subject?: string,
  body?: string
): Promise<ChannelResult> {
  try {
    if (!subject || !body) {
      return {
        channel: 'email',
        ok: false,
        message: '제목/본문 누락',
      };
    }

    // 이메일 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      return {
        channel: 'email',
        ok: false,
        message: '유효하지 않은 이메일 주소',
      };
    }

    // 수신 거부 여부 확인
    const contactRecord = await prisma.contact.findFirst({
      where: { email: recipient, organizationId: orgId },
      select: { id: true, optOutAt: true },
    });

    if (contactRecord?.optOutAt) {
      logger.warn('[send-multi/email] 수신 거부 연락처', { email: recipient, orgId });
      return {
        channel: 'email',
        ok: false,
        message: '수신 거부 등록된 연락처',
      };
    }

    // 발신 계정 해석
    const config = await resolveUserEmailConfig(orgId, { userId });
    if (!config) {
      logger.error('[send-multi/email] 이메일 설정 없음', { orgId, userId });
      return {
        channel: 'email',
        ok: false,
        message: '이메일 발신 계정 미설정',
      };
    }

    // HTML 콘텐츠 생성
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
          h2 { color: #007bff; }
          p { margin: 10px 0; }
        </style>
      </head>
      <body>
        <p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #999; font-size: 12px;">
          © 2026 mabiz CRM. All rights reserved.
        </p>
      </body>
      </html>
    `;

    // 이메일 발송
    const emailConfig = {
      senderName: config.senderName,
      senderEmail: config.senderEmail,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUsername: config.smtpUsername,
      smtpPassword: config.smtpPassword,
      smtpSecure: config.smtpSecure,
    };

    const ok = await sendEmailWithConfig({
      config: emailConfig,
      to: recipient,
      subject,
      html: htmlContent,
    });

    if (!ok) {
      logger.error('[send-multi/email] 발송 실패', { recipient, subject });
      return {
        channel: 'email',
        ok: false,
        message: '발송 실패',
      };
    }

    // 이력 저장
    try {
      await prisma.adminMessage.create({
        data: {
          organizationId: orgId,
          adminId: userId,
          messageType: 'email',
          channel: 'MULTI_SEND',
          content: subject,
          totalSent: 1,
          successCount: 1,
        },
      });
    } catch (err) {
      logger.error('[send-multi/email] 이력 저장 실패', { err });
    }

    return {
      channel: 'email',
      ok: true,
      message: '발송 완료',
      msgId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  } catch (err) {
    logger.error('[send-multi/email]', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      channel: 'email',
      ok: false,
      message: '서버 오류',
    };
  }
}

/**
 * 카카오톡 채널 발송 (비동기 병렬 처리용)
 */
async function sendKakaoChannel(
  userId: string,
  orgId: string,
  recipient: string,
  tplCode?: string,
  subject?: string,
  message?: string
): Promise<ChannelResult> {
  try {
    if (!message) {
      return {
        channel: 'kakao',
        ok: false,
        message: '메시지 내용 누락',
      };
    }

    const normalizedPhone = normalizePhone(recipient);
    if (!normalizedPhone) {
      return {
        channel: 'kakao',
        ok: false,
        message: '유효하지 않은 전화번호',
      };
    }

    const kakaoTplCode = tplCode || process.env.ALIGO_KAKAO_TPL_CODE || 'EXAM';
    const kakaoSubject = subject || process.env.ALIGO_KAKAO_SUBJECT || '알림';

    // Aligo 환경변수 확인
    const aligoKey = process.env.ALIGO_API_KEY;
    const aligoUserId = process.env.ALIGO_USER_ID;
    const aligoKakaoSenderKey = process.env.ALIGO_KAKAO_SENDER_KEY;

    if (!aligoKey || !aligoUserId || !aligoKakaoSenderKey) {
      logger.error('[send-multi/kakao] 필수 환경변수 누락', {
        hasKey: !!aligoKey,
        hasUserId: !!aligoUserId,
        hasSenderKey: !!aligoKakaoSenderKey,
      });
      return {
        channel: 'kakao',
        ok: false,
        message: '카카오톡 서비스 설정 오류',
      };
    }

    // Aligo API 호출
    const res = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      body: new URLSearchParams({
        key: aligoKey,
        user_id: aligoUserId,
        senderkey: aligoKakaoSenderKey,
        tpl_code: kakaoTplCode,
        receiver: normalizedPhone,
        subject: kakaoSubject,
        message,
        failover: 'true', // SMS 폴백
      }),
    });

    interface AligoKakaoResponse {
      result_code: string;
      message?: string;
      msg_id?: string;
    }

    const data: AligoKakaoResponse = await res.json();

    if (data.result_code !== '1') {
      logger.error('[send-multi/kakao] Aligo 전송 실패', {
        code: data.result_code,
        message: data.message,
      });
      return {
        channel: 'kakao',
        ok: false,
        message: '발송 실패',
      };
    }

    // 이력 저장
    try {
      await prisma.adminMessage.create({
        data: {
          organizationId: orgId,
          adminId: userId,
          messageType: 'kakao',
          channel: 'MULTI_SEND',
          content: message,
          totalSent: 1,
          successCount: 1,
        },
      });
    } catch (err) {
      logger.error('[send-multi/kakao] 이력 저장 실패', { err });
    }

    return {
      channel: 'kakao',
      ok: true,
      message: '발송 완료',
      msgId: data.msg_id,
    };
  } catch (err) {
    logger.error('[send-multi/kakao]', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      channel: 'kakao',
      ok: false,
      message: '서버 오류',
    };
  }
}

/**
 * HTML 특수문자 이스케이프 (XSS 방지)
 */
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
