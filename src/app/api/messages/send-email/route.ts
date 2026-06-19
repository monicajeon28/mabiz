import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { resolveUserEmailConfig } from '@/lib/email-resolver';
import { sendEmailWithConfig } from '@/lib/email';

interface EmailSendRequest {
  email: string;
  subject: string;
  content: string;
  htmlContent?: string;
}

interface EmailSendResponse {
  ok: boolean;
  message: string;
  msgId?: string;
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body: EmailSendRequest = await req.json();
    const { email, subject, content, htmlContent } = body;

    if (!email || !subject || !content) {
      return NextResponse.json(
        { ok: false, message: '필수 필드 누락' },
        { status: 400 }
      );
    }

    // 이메일 검증 (기본 정규식)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 이메일 주소' },
        { status: 400 }
      );
    }

    // 수신 거부 여부 확인 (이메일 기반)
    const contactRecord = await prisma.contact.findFirst({
      where: { email, organizationId: orgId },
      select: { id: true, optOutAt: true },
    });
    if (contactRecord?.optOutAt) {
      logger.warn('[email/send] 수신 거부 연락처', { email, orgId });
      return NextResponse.json(
        { ok: false, message: '수신 거부 등록된 연락처입니다' },
        { status: 400 }
      );
    }

    // 발신 계정 해석: 개인(UserEmailConfig) > 그룹(GroupEmailConfig) > 조직(OrgEmailConfig) > 환경변수
    // SMS와 동일한 계층 구조
    const config = await resolveUserEmailConfig(orgId, { userId: ctx.userId });
    if (!config) {
      logger.error('[email/send] 이메일 설정 없음', { orgId, userId: ctx.userId });
      return NextResponse.json(
        { ok: false, message: '이메일 발신 계정이 설정되지 않았습니다. 설정 > 이메일에서 SMTP를 연결해 주세요.' },
        { status: 500 }
      );
    }

    // HTML 콘텐츠 기본값: 마크다운 스타일의 문자를 간단한 HTML로 변환
    const finalHtml = htmlContent || `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
          h2 { color: #007bff; }
          a { cursor: pointer; }
          p { margin: 10px 0; }
        </style>
      </head>
      <body>
        <p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #999; font-size: 12px;">
          © 2026 mabiz CRM. All rights reserved.
        </p>
      </body>
      </html>
    `;

    // Nodemailer를 통한 직접 발송
    // ResolvedEmailConfig는 'source' 필드를 가지지만 DirectEmailConfig는 그렇지 않음
    // 타입 호환성을 위해 구조적 호환성만 검증
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
      to: email,
      subject,
      html: finalHtml,
    });

    if (!ok) {
      logger.error('[email/send] 이메일 발송 실패', { email, subject });
      return NextResponse.json(
        { ok: false, message: '발송 실패' },
        { status: 500 }
      );
    }

    // 발송 이력 저장 (AdminMessage) — fire-and-forget로 처리하되 await 추가
    try {
      await prisma.adminMessage.create({
        data: {
          organizationId: orgId,
          adminId: ctx.userId,
          messageType: 'email',
          channel: 'MANUAL',
          content: subject,
          totalSent: 1,
          successCount: 1,
        },
      });
    } catch (err) {
      logger.error('[email/send] 이력 저장 실패', { err });
    }

    logger.log('[email/send] 완료', { email, subject, orgId });
    const response: EmailSendResponse = {
      ok: true,
      message: '발송 완료',
      msgId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    return NextResponse.json(response);
  } catch (err) {
    logger.error('[email/send]', {
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
