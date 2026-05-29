import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Loop 5: SMS 성과 추적 API
 *
 * GET /api/loop5/sms-stats?organizationId=xxx&segment=A&days=7
 *
 * 응답:
 * {
 *   totalSent: number,
 *   totalDelivered: number,
 *   totalFailed: number,
 *   successRate: number,
 *
 *   byDay: {
 *     0: { sent, delivered, failed, rate },
 *     1: { sent, delivered, failed, rate },
 *     2: { sent, delivered, failed, rate },
 *     3: { sent, delivered, failed, rate }
 *   },
 *
 *   bySegment: {
 *     A: { sent, delivered, rate },
 *     B: { ... },
 *     ...
 *   },
 *
 *   responseRate: number,
 *   conversionRate: number
 * }
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const segment = searchParams.get('segment') as 'A' | 'B' | 'C' | 'D' | 'E' | null;
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam) : 7;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    logger.log('[Loop5 SMS Stats] 조회', {
      organizationId,
      segment,
      days,
    });

    // 기본 통계
    const whereClause = {
      organizationId,
      createdAt: { gte: startDate },
      ...(segment && { segment }),
    };

    const [sent, delivered, failed, bounced, clicked] = await Promise.all([
      prisma.partnerSmsLog.count({
        where: { ...whereClause, status: 'SENT' },
      }),
      prisma.partnerSmsLog.count({
        where: {
          ...whereClause,
          status: { in: ['SENT', 'CLICKED'] },
        },
      }),
      prisma.partnerSmsLog.count({
        where: { ...whereClause, status: 'FAILED' },
      }),
      prisma.partnerSmsLog.count({
        where: { ...whereClause, status: 'BOUNCED' },
      }),
      prisma.partnerSmsLog.count({
        where: { ...whereClause, status: 'CLICKED' },
      }),
    ]);

    const totalSent = sent;
    const totalDelivered = delivered;
    const totalFailed = failed;
    const total = totalSent + totalFailed + bounced;
    const successRate = total > 0 ? (totalSent / total) * 100 : 0;
    const responseRate = totalSent > 0 ? (clicked / totalSent) * 100 : 0;

    // Day별 통계
    const dayStats = await Promise.all(
      ['day0', 'day1', 'day2', 'day3'].map(async (day) => {
        const [daySent, dayDelivered, dayFailed] = await Promise.all([
          prisma.partnerSmsLog.count({
            where: { ...whereClause, day, status: 'SENT' },
          }),
          prisma.partnerSmsLog.count({
            where: {
              ...whereClause,
              day,
              status: { in: ['SENT', 'CLICKED'] },
            },
          }),
          prisma.partnerSmsLog.count({
            where: { ...whereClause, day, status: 'FAILED' },
          }),
        ]);

        const dayTotal = daySent + dayFailed;
        const dayRate = dayTotal > 0 ? (daySent / dayTotal) * 100 : 0;

        return {
          sent: daySent,
          delivered: dayDelivered,
          failed: dayFailed,
          rate: parseFloat(dayRate.toFixed(1)),
        };
      })
    );

    // Segment별 통계
    const bySegment: Record<'A' | 'B' | 'C' | 'D' | 'E', any> = {
      A: { sent: 0, delivered: 0, rate: 0 },
      B: { sent: 0, delivered: 0, rate: 0 },
      C: { sent: 0, delivered: 0, rate: 0 },
      D: { sent: 0, delivered: 0, rate: 0 },
      E: { sent: 0, delivered: 0, rate: 0 },
    };

    await Promise.all(
      (['A', 'B', 'C', 'D', 'E'] as const).map(async (seg) => {
        const segSent = await prisma.partnerSmsLog.count({
          where: {
            organizationId,
            createdAt: { gte: startDate },
            segment: seg,
            status: 'SENT',
          },
        });

        const segDelivered = await prisma.partnerSmsLog.count({
          where: {
            organizationId,
            createdAt: { gte: startDate },
            segment: seg,
            status: { in: ['SENT', 'CLICKED'] },
          },
        });

        const segFailed = await prisma.partnerSmsLog.count({
          where: {
            organizationId,
            createdAt: { gte: startDate },
            segment: seg,
            status: 'FAILED',
          },
        });

        const segTotal = segSent + segFailed;
        const segRate = segTotal > 0 ? (segSent / segTotal) * 100 : 0;

        bySegment[seg] = {
          sent: segSent,
          delivered: segDelivered,
          rate: parseFloat(segRate.toFixed(1)),
        };
      })
    );

    // 성과 메트릭
    const totalClicks = await prisma.partnerSmsLog.count({
      where: { ...whereClause, clickedAt: { not: null } },
    });

    const conversionRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;

    const result = {
      organizationId,
      period: {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        days,
      },
      totalSent,
      totalDelivered,
      totalFailed,
      successRate: parseFloat(successRate.toFixed(1)),
      byDay: {
        0: dayStats[0],
        1: dayStats[1],
        2: dayStats[2],
        3: dayStats[3],
      },
      bySegment,
      responseRate: parseFloat(responseRate.toFixed(1)),
      conversionRate: parseFloat(conversionRate.toFixed(1)),
      totalClicks,
    };

    logger.log('[Loop5 SMS Stats] 조회 완료', {
      organizationId,
      totalSent,
      successRate: result.successRate,
    });

    return NextResponse.json({
      ok: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('[Loop5 SMS Stats] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
