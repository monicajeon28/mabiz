import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMabizSession } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { startOfDay, endOfDay } from 'date-fns';
import { ExecutionStatus } from '@prisma/client';

/**
 * GET /api/marketing/campaigns/today-stats
 * 오늘 캠페인 발송 현황 조회
 * - 예정: 오늘 sendAt 시간인 DRAFT/SCHEDULED 캠페인
 * - 진행중: 현재 발송 중인 캠페인 (sentCount < totalCount)
 * - 완료: 오늘 발송 완료한 캠페인 (sentCount >= totalCount 또는 COMPLETED)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json({ ok: false, message: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const baseWhere = {
      sendAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    };

    // GLOBAL_ADMIN: 모든 캠페인 조회
    // OWNER/AGENT: 소속 조직 캠페인만 조회
    const campaignWhere = ctx.role === 'GLOBAL_ADMIN'
      ? baseWhere
      : { ...baseWhere, organizationId: ctx.organizationId ?? undefined };

    const logWhere = ctx.role === 'GLOBAL_ADMIN'
      ? {
          scheduledAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        }
      : {
          organizationId: ctx.organizationId ?? undefined,
          scheduledAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        };

    // 1. 오늘 예약된 캠페인 중 아직 발송 대기 중인 것
    const scheduledToday = await prisma.crmMarketingCampaign.count({
      where: {
        ...campaignWhere,
        status: { in: ['DRAFT'] },
      },
    });

    // 2. 발송 진행 중 (ExecutionLog에서 일부는 SENT, 일부는 PENDING)
    // 캠페인별로 totalCount와 sentCount를 비교
    const campaigns = await prisma.crmMarketingCampaign.findMany({
      where: {
        ...campaignWhere,
        status: { in: ['SENDING'] },
      },
      select: {
        id: true,
        totalCount: true,
        sentCount: true,
      },
    });

    const inProgress = campaigns.filter(
      c => c.sentCount > 0 && c.sentCount < c.totalCount
    ).length;

    // 3. 오늘 완료한 캠페인 — status: SENT 기준으로 정확히 계산
    const completedToday = await prisma.crmMarketingCampaign.count({
      where: {
        ...campaignWhere,
        status: 'SENT',
      },
    });

    // 더 정확한 완료 통계를 위해 ExecutionLog에서 SENT 건수
    const completedExecutions = await prisma.executionLog.count({
      where: {
        ...logWhere,
        status: ExecutionStatus.SENT,
      },
    });

    // 전체 예정된 발송건 중 완료된 비율로 계산
    const totalExecutionLogsToday = await prisma.executionLog.count({
      where: logWhere,
    });

    return NextResponse.json({
      ok: true,
      scheduledToday,
      inProgress,
      completedToday,
      // 추가 통계 (운영용)
      totalExecutedToday: completedExecutions,
      totalPendingToday: totalExecutionLogsToday - completedExecutions,
    });
  } catch (err) {
    logger.error('[GET /api/marketing/campaigns/today-stats]', { err });
    return NextResponse.json({ ok: false, message: '통계 조회 실패' }, { status: 500 });
  }
}
