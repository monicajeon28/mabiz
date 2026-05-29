/**
 * GET /api/admin/sms/stats
 * SMS 발송 통계 조회 API
 *
 * 기능:
 * - 일일 발송/배송 현황
 * - 채널별 성공률
 * - 시간대별 발송 추이
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    // 관리자 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    }

    const member = await prisma.organizationMember.findFirst({
      where: { email: session.user.email, isActive: true },
      select: { organizationId: true, role: true },
    });

    if (!member?.organizationId || member.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 });
    }

    // user 변수를 member로 통일
    const user = member;

    // 쿼리 파라미터
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'daily'; // daily, weekly, monthly
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. 전체 통계
    const [total, sent, delivered, failed, nightBlocked] = await Promise.all([
      prisma.scheduledSms.count({
        where: {
          organizationId: user.organizationId,
          createdAt: { gte: startDate },
        },
      }),
      prisma.scheduledSms.count({
        where: {
          organizationId: user.organizationId,
          status: 'SENT',
          createdAt: { gte: startDate },
        },
      }),
      prisma.scheduledSms.count({
        where: {
          organizationId: user.organizationId,
          status: 'DELIVERED',
          createdAt: { gte: startDate },
        },
      }),
      prisma.scheduledSms.count({
        where: {
          organizationId: user.organizationId,
          status: 'FAILED',
          createdAt: { gte: startDate },
        },
      }),
      prisma.scheduledSms.count({
        where: {
          organizationId: user.organizationId,
          status: 'NIGHT_BLOCKED',
          createdAt: { gte: startDate },
        },
      }),
    ]);

    // 2. 채널별 통계
    const byChannel = await prisma.scheduledSms.groupBy({
      by: ['channel'],
      where: {
        organizationId: user.organizationId,
        createdAt: { gte: startDate },
      },
      _count: {
        id: true,
      },
      _sum: {
        sentCount: true,
        failedCount: true,
      },
    });

    // 3. 시간대별 발송 추이
    const hourlyTrend: Record<number, { total: number; sent: number; failed: number }> = {};
    for (let hour = 0; hour < 24; hour++) {
      hourlyTrend[hour] = { total: 0, sent: 0, failed: 0 };
    }

    const hourlyData = await prisma.scheduledSms.findMany({
      where: {
        organizationId: user.organizationId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        status: true,
      },
    });

    hourlyData.forEach(item => {
      const hour = item.createdAt.getHours();
      hourlyTrend[hour].total++;
      if (item.status === 'SENT' || item.status === 'DELIVERED') {
        hourlyTrend[hour].sent++;
      } else if (item.status === 'FAILED') {
        hourlyTrend[hour].failed++;
      }
    });

    // 4. 실패 원인 분석
    const failureReasons = await prisma.scheduledSms.groupBy({
      by: ['failureReason'],
      where: {
        organizationId: user.organizationId,
        status: 'FAILED',
        createdAt: { gte: startDate },
      },
      _count: {
        id: true,
      },
    });

    // 5. 재시도 통계
    const retryStats = await prisma.scheduledSms.findMany({
      where: {
        organizationId: user.organizationId,
        createdAt: { gte: startDate },
        failedCount: { gt: 0 },
      },
      select: { failedCount: true },
    });

    const retryBreakdown: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    retryStats.forEach(item => {
      const count = Math.min(item.failedCount || 0, 3);
      retryBreakdown[count]++;
    });

    // 결과 계산
    const totalCount = total || 1; // 0으로 나누기 방지
    const successRate = ((sent + delivered) / totalCount) * 100;
    const deliveryRate = (delivered / (sent || 1)) * 100;
    const failureRate = (failed / totalCount) * 100;

    logger.log('[SMSStats] 통계 조회', {
      organizationId: user.organizationId,
      period,
      totalCount,
      successRate,
    });

    return NextResponse.json({
      ok: true,
      data: {
        period,
        dateRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
        summary: {
          total: totalCount,
          sent,
          delivered,
          failed,
          nightBlocked,
          pending: totalCount - sent - delivered - failed - nightBlocked,
        },
        rates: {
          successRate: parseFloat(successRate.toFixed(1)),
          deliveryRate: parseFloat(deliveryRate.toFixed(1)),
          failureRate: parseFloat(failureRate.toFixed(1)),
        },
        byChannel: byChannel.map(item => ({
          channel: item.channel,
          total: item._count.id,
          sent: item._sum.sentCount || 0,
          failed: item._sum.failedCount || 0,
        })),
        hourlyTrend: Object.entries(hourlyTrend).map(([hour, data]) => ({
          hour: parseInt(hour),
          total: data.total,
          sent: data.sent,
          failed: data.failed,
          rate: data.total > 0 ? parseFloat(((data.sent / data.total) * 100).toFixed(1)) : 0,
        })),
        failureReasons: failureReasons
          .map(item => ({
            reason: item.failureReason || 'Unknown',
            count: item._count.id,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        retryStats: {
          totalRetries: retryStats.length,
          breakdown: retryBreakdown,
          avgRetries: retryStats.length > 0
            ? (retryStats.reduce((sum, item) => sum + (item.failedCount || 0), 0) / retryStats.length).toFixed(2)
            : '0',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[SMSStats] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: '통계 조회 실패',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
