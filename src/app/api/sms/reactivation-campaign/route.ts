/**
 * POST /api/sms/reactivation-campaign
 *
 * 부재중 고객 SMS 캠페인 발송
 *
 * Request Body:
 * {
 *   organizationId: string (필수)
 *   segment: "3-6m" | "6-12m" | "1y+" (필수)
 *   templateId: string (optional) - 사용할 SMS 템플릿 ID
 *   minLikelihood: number (기본값: 50) - 최소 재활성화 확률
 *   dryRun: boolean (기본값: false) - true일 경우 실제 발송하지 않음
 * }
 *
 * Response:
 * {
 *   campaignId: string
 *   segment: string
 *   totalRecipients: number
 *   sentCount: number
 *   skippedCount: number
 *   expectedRevenue: number
 *   timestamp: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getReactivationTemplate } from '@/lib/sms/reactivation-templates';
import { logger } from '@/lib/logger';
import { sendSms, getOrgSmsConfig } from '@/lib/aligo';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { checkRateLimitAsync } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);

    const body = await request.json();
    const {
      organizationId,
      segment,
      templateId,
      minLikelihood,
      dryRun,
    } = body;

    // 입력값 검증: minLikelihood는 0-100 범위의 숫자, dryRun은 엄격한 boolean
    const safeMinLikelihood = Math.max(0, Math.min(100, Number(minLikelihood) || 50));
    const safeDryRun = dryRun === true;

    // 조직 소속 검증
    if (organizationId !== orgId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // 레이트 리밋: 조직당 분당 1회
    const rl = await checkRateLimitAsync(`sms_reactivation:${orgId}`, 1, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    // 필수 필드 검증
    if (!organizationId || !segment) {
      return NextResponse.json(
        { error: 'organizationId and segment are required' },
        { status: 400 },
      );
    }

    if (!['3-6m', '6-12m', '1y+'].includes(segment)) {
      return NextResponse.json(
        { error: 'Invalid segment. Must be 3-6m, 6-12m, or 1y+' },
        { status: 400 },
      );
    }

    // 조직 검증
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // 세그먼트 기준 고객 조회 (수신거부 고객 제외 — 정보통신망법)
    const recipients = await prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        optOutAt: null,
        type: 'CUSTOMER',
        reactivationSegment: segment,
        reactivationLikelihood: { gte: safeMinLikelihood },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        reactivationLikelihood: true,
      },
    });

    // SMS 템플릿 선택 (기본: segment별 템플릿)
    const template = templateId
      ? await prisma.smsTemplate.findUnique({ where: { id: templateId } })
      : getReactivationTemplate(segment);

    if (!template) {
      return NextResponse.json(
        { error: 'SMS template not found' },
        { status: 404 },
      );
    }

    // 예상 수익 계산용 상수 (크루즈 평균 객단가 × 재활성화 전환율)
    const AVG_REVENUE_PER_CUSTOMER = 366_000; // 원 (평균 크루즈 상품 객단가)
    const REACTIVATION_CONVERSION_RATE = 0.63;  // 63% 재활성화 전환율

    // Dry Run 모드
    if (safeDryRun) {
      const expectedRevenue = recipients.length * AVG_REVENUE_PER_CUSTOMER * REACTIVATION_CONVERSION_RATE;
      return NextResponse.json(
        {
          campaignId: `CAMPAIGN-${Date.now()}`,
          segment,
          totalRecipients: recipients.length,
          sentCount: 0,
          skippedCount: 0,
          expectedRevenue: Math.round(expectedRevenue),
          timestamp: new Date().toISOString(),
          note: 'DRY RUN - No SMS sent',
        },
        { status: 200 },
      );
    }

    // 실제 캠페인 생성
    const campaignId = `CAMPAIGN-${Date.now()}`;
    let sentCount = 0;
    let skippedCount = 0;

    // OrgSmsConfig 조회 (배치 외부에서 1회만)
    const smsConfigRecord = await getOrgSmsConfig(organizationId);
    const aligoConfig = smsConfigRecord?.isActive
      ? { key: smsConfigRecord.aligoKey, userId: smsConfigRecord.aligoUserId, sender: smsConfigRecord.senderPhone }
      : null;

    // 수신자 수 한도 검증 (리소스 남용 방지)
    const MAX_RECIPIENTS = 500;
    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `최대 ${MAX_RECIPIENTS}명까지 한 번에 발송 가능합니다` },
        { status: 400 },
      );
    }

    // 배치 처리로 SMS 실제 발송 (50건씩)
    const batchSize = 50;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (recipient) => {
          const personalizedMessage = template.content
            .replace('{name}', recipient.name || '고객님')
            .replace('{segment}', segment)
            .replace('{likelihood}', `${recipient.reactivationLikelihood}%`);

          let smsStatus: 'SENT' | 'FAILED' | 'PENDING' = 'PENDING';
          let msgId: string | null = null;
          let resultCode: string | null = null;

          if (aligoConfig) {
            const aligoResult = await sendSms({
              config: aligoConfig,
              receiver: recipient.phone!,
              msg: personalizedMessage,
              msgType: personalizedMessage.length > 90 ? 'LMS' : 'SMS',
              organizationId,
              contactId: recipient.id,
              channel: 'FUNNEL',
            });
            smsStatus = aligoResult.result_code === 1 ? 'SENT' : 'FAILED';
            msgId = aligoResult.msg_id ?? null;
            resultCode = String(aligoResult.result_code);
          }

          return prisma.smsLog.create({
            data: {
              organizationId,
              contactId: recipient.id,
              phone: recipient.phone!,
              contentPreview: personalizedMessage.substring(0, 100),
              status: smsStatus,
              channel: 'REACTIVATION',
              msgId,
              resultCode,
            },
          });
        }),
      );

      sentCount += results.filter((r) => r.status === 'fulfilled' && (r.value as { status: string }).status === 'SENT').length;
      skippedCount += results.filter((r) => r.status === 'rejected').length;

      logger.info('[Reactivation Campaign] Batch progress', {
        batch: Math.floor(i / batchSize) + 1,
        sent: sentCount,
        skipped: skippedCount,
      });
    }

    // 캠페인 통계
    const expectedRevenue = recipients.length * AVG_REVENUE_PER_CUSTOMER * REACTIVATION_CONVERSION_RATE;

    return NextResponse.json(
      {
        campaignId,
        segment,
        totalRecipients: recipients.length,
        sentCount,
        skippedCount,
        expectedRevenue: Math.round(expectedRevenue),
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error('[POST /api/sms/reactivation-campaign]', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create reactivation campaign' },
      { status: 500 },
    );
  }
}
