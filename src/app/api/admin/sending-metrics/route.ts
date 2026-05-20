export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';
import { addDays, startOfDay } from 'date-fns';
import { enforceRBAC } from '@/app/api/_middleware/enforce-rbac';

type Period = '1d' | '7d' | '30d';

function calculateSince(period: Period): Date {
  const now = new Date();
  switch (period) {
    case '1d': return addDays(now, -1);
    case '7d': return addDays(now, -7);
    case '30d': return addDays(now, -30);
    default: return addDays(now, -7);
  }
}

function getDaysInPeriod(period: Period): number {
  switch (period) {
    case '1d': return 1;
    case '7d': return 7;
    case '30d': return 30;
    default: return 7;
  }
}

/**
 * GET /api/admin/sending-metrics
 * ADMIN 전용 — 조직 전체 발송 성과 모니터링
 *
 * Query: period (1d|7d|30d, 기본 7d)
 *
 * 응답:
 * - summary: 전체 통계 (발송/실패/성공률)
 * - byChannel: 채널별 통계 (SMS/EMAIL)
 * - retryMetrics: 재시도 성공률
 * - failureAnalysis: 실패 원인 TOP 5
 * - dlqMetrics: 웹훅 DLQ 상태
 * - organizationBreakdown: 조직별 현황
 * - trends: 일일 추이 (발송/실패율)
 */
export async function GET(req: NextRequest) {
  // ────────────────────────────────────────────────────────
  // RBAC: GLOBAL_ADMIN 전용 엔드포인트
  // ────────────────────────────────────────────────────────
  const rbacCheck = enforceRBAC(req, {
    allowedRoles: ['GLOBAL_ADMIN'],
    errorMessage: '관리자만 접근 가능합니다.',
  });
  if (rbacCheck !== true) return rbacCheck;

  try {
    const ctx = await getAuthContext();

    // 관리자 권한 검증 (GLOBAL_ADMIN 또는 ADMIN)
    if (!['GLOBAL_ADMIN', 'ADMIN'].includes(ctx.role)) {
      return NextResponse.json(
        { ok: false, message: '관리자만 접근 가능합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') ?? '7d') as Period;

    // 기간 계산
    const since = calculateSince(period);
    const until = new Date();
    const daysInPeriod = getDaysInPeriod(period);

    // 1. Summary 쿼리 (전체 통계)
    const statusGroups = await prisma.sendingHistory.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since, lte: until } },
      _count: true,
    });

    const statusMap = new Map<string, number>();
    for (const group of statusGroups) {
      statusMap.set(group.status as string, group._count);
    }

    const totalSent = statusMap.get('SENT') ?? 0;
    const totalFailed = (statusMap.get('FAILED') ?? 0) + (statusMap.get('ABANDONED') ?? 0);
    const totalSkipped = statusMap.get('SKIPPED') ?? 0;
    const totalAbandoned = statusMap.get('ABANDONED') ?? 0;
    const totalProcessed = totalSent + totalFailed + totalSkipped;

    const successRate = totalProcessed > 0
      ? ((totalSent / totalProcessed) * 100).toFixed(2)
      : '0.00';
    const failureRate = totalProcessed > 0
      ? ((totalFailed / totalProcessed) * 100).toFixed(2)
      : '0.00';

    // 2. By Channel 쿼리
    const channelStats = await prisma.sendingHistory.groupBy({
      by: ['channel', 'status'],
      where: { createdAt: { gte: since, lte: until } },
      _count: true,
    });

    const byChannel: Record<string, any> = {};
    for (const stat of channelStats) {
      const channel = stat.channel as string;
      if (!byChannel[channel]) {
        byChannel[channel] = {
          sent: 0,
          failed: 0,
          skipped: 0,
          successRate: '0.00%',
        };
      }

      const status = stat.status as string;
      if (status === 'SENT') {
        byChannel[channel].sent += stat._count;
      } else if (['FAILED', 'ABANDONED'].includes(status)) {
        byChannel[channel].failed += stat._count;
      } else if (status === 'SKIPPED') {
        byChannel[channel].skipped += stat._count;
      }
    }

    // 채널별 성공률 계산
    for (const [channel, data] of Object.entries(byChannel)) {
      const total = data.sent + data.failed + data.skipped;
      data.successRate = total > 0
        ? ((data.sent / total) * 100).toFixed(2) + '%'
        : '0.00%';
    }

    // 3. Retry Metrics
    const retriedMessages = await prisma.sendingHistory.findMany({
      where: {
        createdAt: { gte: since, lte: until },
        retryCount: { gt: 0 },
      },
      select: { id: true, status: true, retryCount: true },
    });

    const retrySuccess = retriedMessages.filter(m => m.status === 'SENT').length;
    const totalRetried = retriedMessages.length;
    const totalRetryCount = retriedMessages.reduce((sum, m) => sum + m.retryCount, 0);

    const retrySuccessRate = totalRetried > 0
      ? ((retrySuccess / totalRetried) * 100).toFixed(2)
      : '0.00';
    const avgRetries = totalRetried > 0
      ? (totalRetryCount / totalRetried).toFixed(2)
      : '0.00';

    // 4. Failure Analysis (TOP 5)
    const failureReasons = await prisma.sendingHistory.groupBy({
      by: ['failureReason'],
      where: {
        createdAt: { gte: since, lte: until },
        status: { in: ['FAILED', 'ABANDONED'] },
      },
      _count: true,
    });

    const topReasons = failureReasons
      .filter(r => r.failureReason !== null)
      .sort((a, b) => b._count - a._count)
      .slice(0, 5)
      .map(r => ({
        reason: (r.failureReason as string) ?? 'UNKNOWN',
        count: r._count,
        percent: totalFailed > 0
          ? ((r._count / totalFailed) * 100).toFixed(0) + '%'
          : '0%',
      }));

    // 5. DLQ Metrics
    const dlqItems = await prisma.mabizSyncDLQ.findMany({
      where: {
        createdAt: { gte: since, lte: until },
        resolvedAt: null,
      },
      select: { id: true, webhookType: true },
    });

    const pendingDLQ = dlqItems.length;
    const dlqFailureRate = totalProcessed > 0
      ? ((pendingDLQ / totalProcessed) * 100).toFixed(3) + '%'
      : '0%';

    const dlqBySource = new Map<string, number>();
    for (const item of dlqItems) {
      dlqBySource.set(
        item.webhookType,
        (dlqBySource.get(item.webhookType) ?? 0) + 1
      );
    }

    const topDLQSources = Array.from(dlqBySource.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }));

    // 6. Organization Breakdown
    const orgStats = await prisma.sendingHistory.groupBy({
      by: ['organizationId', 'status'],
      where: { createdAt: { gte: since, lte: until } },
      _count: true,
    });

    const orgMap = new Map<string, { sent: number; failed: number; skipped: number }>();
    for (const stat of orgStats) {
      const orgId = stat.organizationId;
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, { sent: 0, failed: 0, skipped: 0 });
      }

      const data = orgMap.get(orgId)!;
      const status = stat.status as string;
      if (status === 'SENT') {
        data.sent += stat._count;
      } else if (['FAILED', 'ABANDONED'].includes(status)) {
        data.failed += stat._count;
      } else if (status === 'SKIPPED') {
        data.skipped += stat._count;
      }
    }

    // 조직 정보 batch 조회
    const orgIds = Array.from(orgMap.keys());
    const organizations = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });

    const orgNameMap = new Map(organizations.map(o => [o.id, o.name]));

    const organizationBreakdown = orgIds.map(orgId => {
      const data = orgMap.get(orgId)!;
      const total = data.sent + data.failed + data.skipped;
      const successRate = total > 0
        ? ((data.sent / total) * 100).toFixed(2) + '%'
        : '0%';

      return {
        organizationId: orgId,
        organizationName: orgNameMap.get(orgId) ?? 'Unknown',
        sent: data.sent,
        failed: data.failed,
        successRate,
      };
    }).sort((a, b) => {
      const rateA = parseFloat(a.successRate);
      const rateB = parseFloat(b.successRate);
      return rateA - rateB;
    });

    // 7. Trends (일별 추이)
    const dailyTrends = new Map<string, { sent: number; failed: number }>();

    for (let i = 0; i < daysInPeriod; i++) {
      const dayStart = startOfDay(addDays(since, i));
      const dayEnd = addDays(dayStart, 1);
      const dateStr = dayStart.toISOString().split('T')[0];

      dailyTrends.set(dateStr, { sent: 0, failed: 0 });

      const dayStats = await prisma.sendingHistory.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: dayStart, lt: dayEnd },
        },
        _count: true,
      });

      const data = dailyTrends.get(dateStr)!;
      for (const stat of dayStats) {
        const status = stat.status as string;
        if (status === 'SENT') {
          data.sent += stat._count;
        } else if (['FAILED', 'ABANDONED'].includes(status)) {
          data.failed += stat._count;
        }
      }
    }

    const dailySent = Array.from(dailyTrends.entries()).map(([date, data]) => ({
      date,
      count: data.sent,
    }));

    const dailyFailureRate = Array.from(dailyTrends.entries()).map(([date, data]) => ({
      date,
      rate: (data.sent + data.failed) > 0
        ? ((data.failed / (data.sent + data.failed)) * 100).toFixed(2) + '%'
        : '0%',
    }));

    logger.log('[GET /api/admin/sending-metrics]', {
      period,
      totalProcessed,
      successRate,
      organizations: organizationBreakdown.length,
    });

    return NextResponse.json({
      ok: true,
      metrics: {
        period,
        dateRange: {
          from: since.toISOString().split('T')[0],
          to: until.toISOString().split('T')[0],
        },
        summary: {
          totalSent,
          totalFailed,
          totalSkipped,
          totalAbandoned,
          successRate: successRate + '%',
          failureRate: failureRate + '%',
        },
        byChannel,
        retryMetrics: {
          totalRetried,
          retrySuccess,
          retryFailed: totalRetried - retrySuccess,
          retrySuccessRate: retrySuccessRate + '%',
          avgRetries: parseFloat(avgRetries),
        },
        failureAnalysis: {
          topReasons,
        },
        dlqMetrics: {
          pendingDLQ,
          dlqFailureRate,
          topDLQSources,
        },
        organizationBreakdown,
        trends: {
          dailySent,
          dailyFailureRate,
        },
      },
    });

  } catch (err) {
    logger.error('[GET /api/admin/sending-metrics] Error:', err as object);
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
