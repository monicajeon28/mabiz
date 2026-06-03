import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

/**
 * GET /api/affiliate/partner-alert/stats
 * 파트너 Alert SMS 통계 조회
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const days = Math.max(1, parseInt(searchParams.get('days') || '7', 10));

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    // 일일 통계 — DATE_TRUNC 집계 (createdAt 타임스탬프 그대로 groupBy 방지)
    type DailyStatRow = { date: string; cnt: bigint };
    const dailyStatRows = await prisma.$queryRaw<DailyStatRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS date,
        COUNT(*)::bigint AS cnt
      FROM "PartnerSmsLog"
      WHERE "organizationId" = ${session.organizationId}
        AND "createdAt" >= ${fromDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY 1
    `;
    const dailyStats = dailyStatRows.map((r) => ({ date: r.date, count: Number(r.cnt) }));

    // 상태별 통계
    const [sent, failed, pending, clicked, bounced] = await Promise.all([
      prisma.partnerSmsLog.count({
        where: {
          organizationId: session.organizationId,
          status: 'SENT',
          createdAt: { gte: fromDate },
        },
      }),
      prisma.partnerSmsLog.count({
        where: {
          organizationId: session.organizationId,
          status: 'FAILED',
          createdAt: { gte: fromDate },
        },
      }),
      prisma.partnerSmsLog.count({
        where: {
          organizationId: session.organizationId,
          status: 'PENDING',
          createdAt: { gte: fromDate },
        },
      }),
      prisma.partnerSmsLog.count({
        where: {
          organizationId: session.organizationId,
          status: 'CLICKED',
          createdAt: { gte: fromDate },
        },
      }),
      prisma.partnerSmsLog.count({
        where: {
          organizationId: session.organizationId,
          status: 'BOUNCED',
          createdAt: { gte: fromDate },
        },
      }),
    ]);

    const total = sent + failed + pending;
    const successRate = total > 0 ? ((sent / total) * 100).toFixed(1) : '0';
    const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0';

    // 위험도별 발송 수
    const byRiskLevel = await prisma.partnerSmsLog.groupBy({
      by: ['riskLevel'],
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: fromDate },
      },
      _count: {
        id: true,
      },
    });

    // Day별 발송 수
    const byDay = await prisma.partnerSmsLog.groupBy({
      by: ['day'],
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: fromDate },
      },
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      ok: true,
      summary: {
        total,
        sent,
        failed,
        pending,
        clicked,
        bounced,
        successRate: parseFloat(successRate),
        clickRate: parseFloat(clickRate),
      },
      dailyStats,
      byRiskLevel: byRiskLevel.map((item) => ({
        riskLevel: item.riskLevel,
        count: item._count.id,
      })),
      byDay: byDay.map((item) => ({
        day: item.day,
        count: item._count.id,
      })),
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        days,
      },
    });
  } catch (error: unknown) {
    logger.error('[partner-alert stats] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
