export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendSms } from '@/lib/aligo';
import { sendEmail } from '@/lib/email';

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/campaigns/sending-history/[id]/resend
 * 실패한 메시지를 수동으로 재전송합니다.
 *
 * @param id SendingHistory ID
 * @returns { ok: boolean, sending?: SendingHistory, message: string, error?: string }
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: sendingId } = await params;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. SendingHistory 조회 (Contact, Campaign 포함)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const sending = await prisma.sendingHistory.findFirst({
      where: {
        id: sendingId,
        organizationId: orgId, // ✅ IDOR 방지
      },
      include: {
        campaign: {
          select: {
            id: true,
            organizationId: true,
            title: true,
            sendSms: true,
            smsBody: true,
            sendEmail: true,
            emailSubject: true,
            emailBody: true,
          },
        },
      },
    });

    // Contact 정보 조회 (optOutAt 확인용)
    const contact = sending ? await prisma.contact.findUnique({
      where: { id: sending.contactId },
      select: { id: true, name: true, phone: true, email: true, optOutAt: true },
    }) : null;

    if (!sending) {
      logger.warn('[PATCH /api/campaigns/sending-history/[id]/resend] SendingHistory not found', { sendingId, orgId });
      return NextResponse.json(
        { ok: false, error: 'SendingHistory를 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 권한 검증 (organizationId 재확인)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (sending.campaign.organizationId !== orgId) {
      logger.warn('[PATCH /api/campaigns/sending-history/[id]/resend] Unauthorized access attempt', {
        sendingId,
        reqOrgId: orgId,
        campaignOrgId: sending.campaign.organizationId
      });
      return NextResponse.json(
        { ok: false, error: '권한이 없습니다.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 발송 가능 상태 검증
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 이미 SENT 상태인 경우 재전송 불필요 (응답만 반환)
    if (sending.status === 'SENT') {
      logger.log('[PATCH /api/campaigns/sending-history/[id]/resend] Already sent', { sendingId });
      return NextResponse.json({
        ok: true,
        sending: {
          id: sending.id,
          status: sending.status,
          channel: sending.channel,
          sentAt: sending.sentAt,
          retryCount: sending.retryCount,
        },
        message: '이미 발송 완료된 메시지입니다.',
      });
    }

    // 재발송 가능한 상태: FAILED, ABANDONED, RETRY_SCHEDULED
    const resendableStatuses = ['FAILED', 'ABANDONED', 'RETRY_SCHEDULED'];
    if (!resendableStatuses.includes(sending.status)) {
      logger.warn('[PATCH /api/campaigns/sending-history/[id]/resend] Non-resendable status', {
        sendingId,
        status: sending.status
      });
      return NextResponse.json(
        {
          ok: false,
          error: `${sending.status} 상태에서는 재전송할 수 없습니다.`,
          code: 'INVALID_STATE'
        },
        { status: 400 }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. 연락처 유효성 검증
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (contact?.optOutAt) {
      logger.warn('[PATCH /api/campaigns/sending-history/[id]/resend] Contact opted out', {
        sendingId,
        contactId: contact.id
      });
      return NextResponse.json(
        {
          ok: false,
          error: '수신거부 고객입니다.',
          code: 'OPT_OUT'
        },
        { status: 400 }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. 발송 설정 조회
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let smsResult: { success: boolean; error?: string } | null = null;
    let emailResult: { success: boolean; error?: string } | null = null;

    // SMS 발송
    if (sending.campaign.sendSms && sending.phone) {
      try {
        const smsConfig = await prisma.orgSmsConfig.findUnique({
          where: { organizationId: orgId },
        });

        if (!smsConfig || !smsConfig.isActive) {
          smsResult = { success: false, error: 'SMS 설정이 없거나 비활성 상태입니다.' };
        } else {
          const aligoResponse = await sendSms({
            config: {
              key: smsConfig.aligoKey,
              userId: smsConfig.aligoUserId,
              sender: smsConfig.senderPhone,
            },
            receiver: sending.phone,
            msg: sending.campaign.smsBody || '',
            channel: 'FUNNEL', // SendSmsParams에서 요구하는 타입
            organizationId: orgId,
            contactId: sending.contactId,
          });

          smsResult = {
            success: aligoResponse.result_code === 1,
            error: aligoResponse.result_code === 1 ? undefined : aligoResponse.message,
          };
        }
      } catch (err) {
        logger.error('[PATCH /api/campaigns/sending-history/[id]/resend] SMS error', { err, sendingId });
        smsResult = { success: false, error: '알리고 API 오류' };
      }
    }

    // Email 발송
    if (sending.campaign.sendEmail && sending.email) {
      try {
        const emailConfig = await prisma.orgEmailConfig.findUnique({
          where: { organizationId: orgId },
        });

        if (!emailConfig || !emailConfig.isActive) {
          emailResult = { success: false, error: '이메일 설정이 없거나 비활성 상태입니다.' };
        } else {
          const success = await sendEmail({
            smtpHost: emailConfig.smtpHost,
            smtpPort: emailConfig.smtpPort,
            smtpUser: emailConfig.smtpUser,
            smtpPassEncrypted: emailConfig.smtpPassEncrypted,
            senderName: emailConfig.senderName,
            senderEmail: emailConfig.senderEmail,
            to: sending.email,
            subject: sending.campaign.emailSubject || '제목 없음',
            html: sending.campaign.emailBody || '<p>본문 없음</p>',
          });

          emailResult = {
            success,
            error: success ? undefined : '이메일 발송 실패',
          };
        }
      } catch (err) {
        logger.error('[PATCH /api/campaigns/sending-history/[id]/resend] Email error', { err, sendingId });
        emailResult = { success: false, error: '이메일 발송 오류' };
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6. 발송 결과 판정
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SMS, Email 중 하나라도 성공하면 전체 성공으로 간주
    const smsSuccess = smsResult?.success ?? false;
    const emailSuccess = emailResult?.success ?? false;
    const overallSuccess = smsSuccess || emailSuccess;

    logger.log('[PATCH /api/campaigns/sending-history/[id]/resend] Resend result', {
      sendingId,
      smsSuccess,
      emailSuccess,
      overallSuccess,
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 7. DB 상태 업데이트
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const updated = await prisma.sendingHistory.update({
      where: { id: sendingId },
      data: {
        status: overallSuccess ? 'SENT' : 'FAILED',
        sentAt: overallSuccess ? new Date() : null,
        retryCount: 0, // 수동 재전송은 카운트 초기화
        failureReason: overallSuccess ? null : 'SYSTEM_ERROR',
        failureUserMsg: overallSuccess ? null : '수동 재전송 실패',
        failureMessage: overallSuccess
          ? null
          : JSON.stringify({
              smsError: smsResult?.error,
              emailError: emailResult?.error
            }),
        // 채널별 상태 업데이트
        smsStatus: sending.campaign.sendSms
          ? (smsSuccess ? 'SENT' : 'DELIVERY_FAIL')
          : sending.smsStatus,
        smsSentAt: sending.campaign.sendSms && smsSuccess
          ? new Date()
          : sending.smsSentAt,
        emailStatus: sending.campaign.sendEmail
          ? (emailSuccess ? 'SENT' : 'BOUNCE')
          : sending.emailStatus,
        emailSentAt: sending.campaign.sendEmail && emailSuccess
          ? new Date()
          : sending.emailSentAt,
      },
      select: {
        id: true,
        status: true,
        channel: true,
        sentAt: true,
        retryCount: true,
        smsStatus: true,
        emailStatus: true,
        failureReason: true,
        failureUserMsg: true,
      },
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 8. 응답
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const message = overallSuccess
      ? '메시지가 성공적으로 전송되었습니다.'
      : '전송에 실패했습니다. 다시 시도해주세요.';

    return NextResponse.json({
      ok: overallSuccess,
      sending: updated,
      message,
    });
  } catch (err) {
    logger.error('[PATCH /api/campaigns/sending-history/[id]/resend] Unexpected error', { err });
    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
        code: 'SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}
