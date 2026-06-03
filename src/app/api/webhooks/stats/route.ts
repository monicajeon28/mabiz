import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getMabizSession();
    if (!session?.organizationId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const daysParam = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '7', 10)));
    const sinceDate = new Date(Date.now() - daysParam * 86400000);

    const [events, logs, queue] = await Promise.all([
      prisma.webhookEvent.findMany({
        where: {
          organizationId: session.organizationId,
          createdAt: { gte: sinceDate },
        },
        select: { status: true, webhookType: true, executionTimeMs: true },
      }),

      prisma.webhookLog.findMany({
        where: {
          webhookEvent: {
            organizationId: session.organizationId,
            createdAt: { gte: sinceDate },
          },
        },
        select: { status: true, durationMs: true },
      }),

      prisma.retryQueue.findMany({
        where: {
          webhookEvent: {
            organizationId: session.organizationId,
          },
        },
        select: { status: true },
      }),
    ]);

    const summary = {
      total: events.length,
      completed: events.filter(e => e.status === 'COMPLETED').length,
      failed: events.filter(e => e.status === 'FAILED').length,
      pending: events.filter(e => e.status === 'PENDING').length,
    };

    const byType: Record<string, any> = {};
    for (const event of events) {
      if (!byType[event.webhookType]) {
        byType[event.webhookType] = { total: 0, completed: 0, failed: 0 };
      }
      byType[event.webhookType].total++;
      if (event.status === 'COMPLETED') byType[event.webhookType].completed++;
      if (event.status === 'FAILED') byType[event.webhookType].failed++;
    }

    const avgDurationMs =
      logs.length > 0
        ? logs.reduce((sum, log) => sum + (log.durationMs || 0), 0) / logs.length
        : 0;

    const maxDurationMs = logs.length > 0 ? Math.max(...logs.map(l => l.durationMs || 0)) : 0;

    const retryQueueStats = {
      queued: queue.filter(q => q.status === 'QUEUED').length,
      processing: queue.filter(q => q.status === 'PROCESSING').length,
      completed: queue.filter(q => q.status === 'COMPLETED').length,
      deadLettered: queue.filter(q => q.status === 'DEAD_LETTER').length,
    };

    const successRate =
      summary.total > 0 ? ((summary.completed / summary.total) * 100).toFixed(2) : 'N/A';

    return NextResponse.json({
      ok: true,
      data: {
        period: { days: daysParam, since: sinceDate.toISOString() },
        summary,
        byType,
        performance: {
          avgDurationMs: parseFloat(avgDurationMs.toFixed(2)),
          maxDurationMs,
          successRate: parseFloat(String(successRate)),
        },
        retryQueue: retryQueueStats,
      },
    });
  } catch (error) {
    logger.error('[Webhooks/Stats] Error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
