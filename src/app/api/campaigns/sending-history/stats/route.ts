export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface StatsResponse {
  ok: boolean;
  stats?: {
    period: string;
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    retryScheduled: number;
    abandoned: number;
    successRate: string;
    failureRate: string;
    byChannel: {
      SMS?: { sent: number; failed: number; rate: string };
      EMAIL?: { sent: number; failed: number; rate: string };
    };
    topFailureReasons: Array<{ reason: string; count: number; percent: string }>;
  };
  error?: string;
}

/**
 * GET /api/campaigns/sending-history/stats
 * 발송 현황 통계 API
 *
 * @query campaignId - 캠페인 ID (필수)
 * @query period - 기간 (1d|7d|30d, 기본값: 7d)
 * @returns { ok: boolean, stats: {...} }
 */
export async function GET(req: Request): Promise<NextResponse<StatsResponse>> {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 쿼리 파라미터 파싱
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaignId');
    const period = (url.searchParams.get('period') || '7d') as '1d' | '7d' | '30d';

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: 'campaignId is required' },
        { status: 400 }
      );
    }

    // 유효한 기간값 검증
    if (!['1d', '7d', '30d'].includes(period)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid period. Use 1d, 7d, or 30d' },
        { status: 400 }
      );
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 날짜 범위 계산
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const now = new Date();
    const daysAgo = period === '1d' ? 1 : period === '7d' ? 7 : 30;
    const since = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const where = {
      organizationId: orgId,
      campaignId,
      createdAt: {
        gte: since,
        lte: now,
      },
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 상태별 count 집계
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const statusStats = await prisma.sendingHistory.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const statusMap = statusStats.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    const sent = statusMap['SENT'] || 0;
    const failed = statusMap['FAILED'] || 0;
    const skipped = statusMap['SKIPPED'] || 0;
    const retryScheduled = statusMap['RETRY_SCHEDULED'] || 0;
    const abandoned = statusMap['ABANDONED'] || 0;
    const total = sent + failed + skipped + retryScheduled + abandoned;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. 채널별 성공률 계산
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const channelStats = await prisma.sendingHistory.groupBy({
      by: ['channel', 'status'],
      where,
      _count: {
        id: true,
      },
    });

    const byChannel: Record<
      string,
      { sent: number; failed: number; rate: string }
    > = {};

    channelStats.forEach((stat) => {
      if (!byChannel[stat.channel]) {
        byChannel[stat.channel] = { sent: 0, failed: 0, rate: '0%' };
      }

      if (stat.status === 'SENT') {
        byChannel[stat.channel].sent += stat._count.id;
      } else if (stat.status === 'FAILED') {
        byChannel[stat.channel].failed += stat._count.id;
      }
    });

    // 성공률 계산
    Object.entries(byChannel).forEach(([channel, stats]) => {
      const total = stats.sent + stats.failed;
      const rate = total > 0 ? ((stats.sent / total) * 100).toFixed(2) : '0.00';
      byChannel[channel].rate = `${rate}%`;
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. 실패 사유별 top 5
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const failureReasons = await prisma.sendingHistory.groupBy({
      by: ['failureReason'],
      where: {
        ...where,
        failureReason: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    const topFailureReasons = failureReasons.map((reason) => {
      const count = reason._count.id;
      const percent =
        failed > 0 ? ((count / failed) * 100).toFixed(0) : '0';
      return {
        reason: reason.failureReason || 'UNKNOWN',
        count,
        percent: `${percent}%`,
      };
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6. 성공률/실패율 계산
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const successRate =
      total > 0 ? ((sent / total) * 100).toFixed(2) : '0.00';
    const failureRate =
      total > 0 ? ((failed / total) * 100).toFixed(2) : '0.00';

    logger.log('[GET /api/campaigns/sending-history/stats]', {
      orgId,
      campaignId,
      period,
      total,
      sent,
      failed,
    });

    return NextResponse.json({
      ok: true,
      stats: {
        period,
        total,
        sent,
        failed,
        skipped,
        retryScheduled,
        abandoned,
        successRate: `${successRate}%`,
        failureRate: `${failureRate}%`,
        byChannel,
        topFailureReasons,
      },
    });
  } catch (err) {
    logger.error('[GET /api/campaigns/sending-history/stats]', { err });
    return NextResponse.json(
      {
        ok: false,
        error: '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
