export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/[id]/delta
 * Delta SMS 3일 시퀀스 설정 및 통계 조회
 *
 * @param id - 캠페인 ID
 * @returns {
 *   ok: boolean,
 *   campaignId: string,
 *   deltaCampaignConfigId?: string,
 *   triggerType?: string,
 *   schedule: [{day, time, message, charCount, type}, ...],
 *   stats: {totalSent, totalSuccess, totalFailure, successRate, lastExecutedAt},
 *   isConfigured: boolean
 * }
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const { id: campaignId } = await params;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 캠페인 존재 여부 및 IDOR 확인
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const campaign = await prisma.crmMarketingCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId: orgId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '캠페인을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. DeltaCampaignConfig 조회
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const deltaConfig = await prisma.deltaCampaignConfig.findFirst({
      where: {
        campaignId: campaignId,
        organizationId: orgId,
      },
      select: {
        id: true,
        triggerType: true,
        day0Message: true,
        day1Message: true,
        day2Message: true,
        day3Message: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 메시지 길이 계산 헬퍼 (SMS=90, LMS=45 기준)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const getMessageType = (text: string): 'SMS' | 'LMS' => {
      // 한글/일반 텍스트: 90자까지 SMS, 초과시 LMS
      // 이모지·특수문자: 50자 기준
      const charCount = text.length;
      return charCount <= 90 ? 'SMS' : 'LMS';
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. Schedule 배열 구성 (Day 0-3)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const scheduleData = [
      {
        day: 0,
        time: '09:00',
        message: deltaConfig?.day0Message || '',
        charCount: deltaConfig?.day0Message?.length || 0,
        type: deltaConfig?.day0Message ? getMessageType(deltaConfig.day0Message) : 'SMS',
      },
      {
        day: 1,
        time: '09:00',
        message: deltaConfig?.day1Message || '',
        charCount: deltaConfig?.day1Message?.length || 0,
        type: deltaConfig?.day1Message ? getMessageType(deltaConfig.day1Message) : 'SMS',
      },
      {
        day: 2,
        time: '09:00',
        message: deltaConfig?.day2Message || '',
        charCount: deltaConfig?.day2Message?.length || 0,
        type: deltaConfig?.day2Message ? getMessageType(deltaConfig.day2Message) : 'SMS',
      },
      ...(deltaConfig?.day3Message
        ? [
            {
              day: 3,
              time: '09:00',
              message: deltaConfig.day3Message,
              charCount: deltaConfig.day3Message.length,
              type: getMessageType(deltaConfig.day3Message),
            },
          ]
        : []),
    ];

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. SendingHistory 통계 집계
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const statsRaw = await prisma.sendingHistory.groupBy({
      by: ['status'],
      where: {
        campaignId: campaignId,
        isDeltaSmsEligible: true,
        deltaDay: { in: [0, 1, 2, 3] },
      },
      _count: { id: true },
    });

    // 통계 계산
    const totalSent = statsRaw.reduce((sum, s) => sum + s._count.id, 0);
    const totalSuccess = statsRaw
      .filter((s) => s.status === 'SENT' || s.status === 'DELIVERED')
      .reduce((sum, s) => sum + s._count.id, 0);
    const totalFailure = statsRaw
      .filter((s) => s.status === 'FAILED')
      .reduce((sum, s) => sum + s._count.id, 0);
    const successRate = totalSent > 0 ? ((totalSuccess / totalSent) * 100).toFixed(2) : '0.00';

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6. lastExecutedAt 조회 (CampaignCost의 updatedAt 또는 최신 SendingHistory)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const latestSendingHistory = await prisma.sendingHistory.findFirst({
      where: {
        campaignId: campaignId,
        isDeltaSmsEligible: true,
        deltaDay: { in: [0, 1, 2, 3] },
      },
      select: {
        sentAt: true,
      },
      orderBy: { sentAt: 'desc' },
      take: 1,
    });

    const lastExecutedAt = latestSendingHistory?.sentAt || deltaConfig?.updatedAt || null;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 7. 응답 구성
    // P0 2: organizationId 포함 (클라이언트에서 IDOR 재검증 가능)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    return NextResponse.json({
      ok: true,
      campaignId: campaignId,
      organizationId: campaign.organizationId,
      deltaCampaignConfigId: deltaConfig?.id,
      triggerType: deltaConfig?.triggerType,
      schedule: scheduleData,
      stats: {
        totalSent,
        totalSuccess,
        totalFailure,
        successRate: parseFloat(successRate),
        lastExecutedAt,
      },
      isConfigured: !!deltaConfig?.isActive,
    });
  } catch (error) {
    logger.error('[GET /api/campaigns/[id]/delta]', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
