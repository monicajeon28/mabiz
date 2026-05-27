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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationId,
      segment,
      templateId,
      minLikelihood = 50,
      dryRun = false,
    } = body;

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

    // 세그먼트 기준 고객 조회
    const recipients = await prisma.contact.findMany({
      where: {
        organizationId,
        deletedAt: null,
        type: 'CUSTOMER',
        reactivationSegment: segment,
        reactivationLikelihood: { gte: minLikelihood },
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

    // Dry Run 모드
    if (dryRun) {
      const expectedRevenue = recipients.length * 366000 * 0.63; // 450명 * $366K * 63% 전환율
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

    // 캠프인 통계
    const expectedRevenue = recipients.length * 366000 * 0.63; // 450명 * $366K * 63% 전환율

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
