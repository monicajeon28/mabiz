export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendSms, resolveUserSmsConfig } from '@/lib/aligo';

type SMSVariant = 'family' | 'medical' | 'timing';

type Day0SMSRequest = {
  contactId: string;
  groupId: string;
  variant?: SMSVariant;
};

const SMS_MESSAGES: Record<SMSVariant, string> = {
  family: `멤버십 신청 완료! 👨‍👩‍👧‍👦

함께라서 더 강해져요.
당신과 가족의 특별한 시간을 우리가 100% 준비하겠습니다.

의료진도 24시간 대기 중입니다. 💙`,

  medical: `멤버십 신청 완료! 🏥

의료진이 24시간 지원합니다.
당신의 건강과 안전이 우리의 최우선입니다.

내일부터 변화를 느낄 거예요. ✨`,

  timing: `멤버십 신청 완료! 🎉

이번이 최고의 타이밍이었어요.
내일부터 시작되는 당신의 새로운 경험을 기대하세요.

우리가 모든 준비를 마쳤습니다. 🚀`,
};

/**
 * POST /api/sms/send-day0-emotional-finish - Day 0 감정적 마무리 SMS (L10 + L7/L9)
 *
 * 목적: 신청 직후 감정적 commitment 강화 → 취소율 감소 (-3% 이상)
 *
 * 심리학 기제:
 * 1. 옥시토신 유발 (따뜻함/신뢰): "함께" / "당신의 신뢰" / "가족"
 * 2. 도파민 유발 (기대감/보상): "내일부터 변화" / "100% 준비" / "새로운 경험"
 * 3. 신뢰 강화 (권위성/확신): "의료진 24시간" / "최고 타이밍" / "모든 준비"
 *
 * 3가지 변형:
 * - family: L7 동반자설득 강조
 * - medical: L9 의료신뢰 강조
 * - timing: L6 손실회피 강조
 *
 * A/B 테스트:
 * - 각 변형별 클릭율, 취소율, 만족도 추적
 * - 효과가 가장 큰 변형을 반복 사용
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const body = (await req.json()) as Day0SMSRequest;
    const { contactId, groupId, variant = 'family' } = body;

    // 입력값 검증
    if (!contactId || !groupId) {
      return NextResponse.json(
        { ok: false, message: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // Contact 조회
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      select: { id: true, name: true, phone: true, email: true },
    });

    if (!contact) {
      return NextResponse.json(
        { ok: false, message: 'Contact를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Group 조회
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId: orgId },
      select: { id: true, name: true },
    });

    if (!group) {
      return NextResponse.json(
        { ok: false, message: 'Group을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 전화번호 체크
    const phoneNumber = contact.phone;
    if (!phoneNumber) {
      logger.warn('[Day0SMS] 전화번호 없음 - SMS 발송 불가', { contactId });
      return NextResponse.json({
        ok: true,
        message: '전화번호가 없어 SMS 발송을 건너뛰었습니다.',
        skipped: true,
      });
    }

    // SMS 메시지 선택
    const message = SMS_MESSAGES[variant];

    // SMS 실제 발송 (Aligo)
    const smsConfig = await resolveUserSmsConfig(orgId, String(ctx.userId));
    let smsStatus: 'SENT' | 'FAILED' | 'SCHEDULED' = 'SCHEDULED';
    let aligoMsgId = `day0-${variant}-${Date.now()}`;

    if (smsConfig) {
      const aligoResult = await sendSms({
        config: smsConfig,
        receiver: phoneNumber,
        msg: message,
        msgType: message.length > 90 ? 'LMS' : 'SMS',
        organizationId: orgId,
        contactId,
        channel: 'FUNNEL',
      });
      smsStatus = aligoResult.result_code === 1 ? 'SENT' : 'FAILED';
      if (aligoResult.msg_id) aligoMsgId = aligoResult.msg_id;
      logger.info('[Day0SMS] Aligo 발송 결과', { result_code: aligoResult.result_code, variant });
    } else {
      logger.warn('[Day0SMS] SMS 설정 없음 — SCHEDULED 상태로 기록', { orgId });
    }

    const smsLog = await prisma.smsLog.create({
      data: {
        organizationId: orgId,
        contactId,
        phone: phoneNumber,
        contentPreview: message.substring(0, 100),
        status: smsStatus,
        channel: 'DAY0_EMOTIONAL',
        blockReason: null,
        resultCode: null,
        msgId: aligoMsgId,
      },
    });

    // Contact에 태그 추가 (Day 0 SMS 발송 기록)
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        tags: {
          push: `day0-sms-${variant}`,
        },
      },
    });

    logger.info('[Day0SMS] 감정적 마무리 SMS 발송 예약', {
      contactId,
      groupId,
      variant,
      smsLogId: smsLog.id,
    });

    return NextResponse.json({
      ok: true,
      message: `Day 0 감정적 마무리 SMS (${variant}) 발송 예약 완료`,
      smsLogId: smsLog.id,
      variant,
    });
  } catch (err) {
    logger.error('[Day0SMS] SMS 발송 실패', { err });
    return NextResponse.json(
      { ok: false, message: 'SMS 발송 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
