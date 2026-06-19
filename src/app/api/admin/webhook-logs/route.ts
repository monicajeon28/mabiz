import { NextRequest, NextResponse } from 'next/server';
import { getMabizSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/webhook-logs
 * 웹훅 수신 이력 + DLQ 현황 조회 (GLOBAL_ADMIN 전용)
 *
 * Query params:
 * - type: webhook 타입 필터
 * - status: SUCCESS|FAILED (ProcessedWebhookEvent)
 * - dlqStatus: PENDING|PROCESSING|RESOLVED|FAILED (MabizSyncDLQ)
 * - tab: "events" | "dlq" (기본값: "events")
 * - page: 1-based (기본값: 1)
 * - limit: 1-100 (기본값: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getMabizSession();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const tab = sp.get('tab') || 'events';
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(sp.get('limit') || '20', 10) || 20);
    const skip = (page - 1) * limit;
    const typeFilter = sp.get('type') || undefined;

    if (tab === 'dlq') {
      const dlqStatus = sp.get('dlqStatus') || undefined;

      const where = {
        ...(typeFilter ? { webhookType: typeFilter } : {}),
        ...(dlqStatus ? { status: dlqStatus } : {}),
      };

      const [rows, total, summary] = await Promise.all([
        prisma.mabizSyncDLQ.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            webhookType: true,
            failureReason: true,
            status: true,
            retryCount: true,
            maxRetries: true,
            nextRetryAt: true,
            resolvedAt: true,
            createdAt: true,
            format: true,
          },
        }),
        prisma.mabizSyncDLQ.count({ where }),
        prisma.mabizSyncDLQ.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
      ]);

      const statusCounts = Object.fromEntries(
        summary.map((s) => [s.status, s._count.id])
      );

      return NextResponse.json({
        ok: true,
        tab: 'dlq',
        data: rows,
        summary: {
          pending: statusCounts['PENDING'] ?? 0,
          processing: statusCounts['PROCESSING'] ?? 0,
          resolved: statusCounts['RESOLVED'] ?? 0,
          failed: statusCounts['FAILED'] ?? 0,
        },
        pagination: { total, page, pageSize: limit, totalPages: Math.ceil(total / limit) },
      });
    }

    // tab === 'events' (ProcessedWebhookEvent)
    const statusFilter = sp.get('status') || undefined;

    const where = {
      ...(typeFilter ? { webhookType: typeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [rows, total, typeSummary] = await Promise.all([
      prisma.processedWebhookEvent.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          eventId: true,
          webhookType: true,
          status: true,
          errorMessage: true,
          processedAt: true,
        },
      }),
      prisma.processedWebhookEvent.count({ where }),
      prisma.processedWebhookEvent.groupBy({
        by: ['webhookType', 'status'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    const successCount = typeSummary
      .filter((s) => s.status === 'SUCCESS')
      .reduce((acc, s) => acc + s._count.id, 0);
    const failedCount = typeSummary
      .filter((s) => s.status !== 'SUCCESS')
      .reduce((acc, s) => acc + s._count.id, 0);

    logger.log('[GET /api/admin/webhook-logs]', { tab, page, total, typeFilter, statusFilter });

    return NextResponse.json({
      ok: true,
      tab: 'events',
      data: rows,
      summary: { successCount, failedCount, total: successCount + failedCount },
      typeSummary: typeSummary.map((s) => ({
        webhookType: s.webhookType,
        status: s.status,
        count: s._count.id,
      })),
      pagination: { total, page, pageSize: limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('[GET /api/admin/webhook-logs]', { err });
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
