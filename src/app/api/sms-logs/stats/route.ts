export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgIdOrNull } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/sms-logs/stats?days=30
 *
 * 발송 통계: 상태별 집계, 채널별 분석, 실패/차단 사유 TOP5, 일별 추이
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx);

    const { searchParams } = new URL(req.url);
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '30') || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where = { ...(orgId ? { organizationId: orgId } : {}), sentAt: { gte: since } };

    // 1. 상태별 집계 (병렬)
    const [byStatus, byChannel, byBlockReason, dailyRaw] = await Promise.all([
      prisma.smsLog.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.smsLog.groupBy({
        by: ['channel'],
        where,
        _count: { id: true },
      }),
      prisma.smsLog.groupBy({
        by: ['blockReason'],
        where: { ...where, status: 'BLOCKED' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // 일별 추이 (raw SQL — Prisma groupBy는 날짜 truncate 미지원)
      orgId
        ? prisma.$queryRaw<{ day: string; status: string; cnt: bigint }[]>`
            SELECT
              TO_CHAR("sentAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day,
              status,
              COUNT(*)::bigint AS cnt
            FROM "CrmSmsLog"
            WHERE "organizationId" = ${orgId}
              AND "sentAt" >= ${since}
            GROUP BY day, status
            ORDER BY day ASC
          `
        : prisma.$queryRaw<{ day: string; status: string; cnt: bigint }[]>`
            SELECT
              TO_CHAR("sentAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day,
              status,
              COUNT(*)::bigint AS cnt
            FROM "CrmSmsLog"
            WHERE "sentAt" >= ${since}
            GROUP BY day, status
            ORDER BY day ASC
          `,
    ]);

    // 상태별 수치
    const statusMap: Record<string, number> = {};
    for (const row of byStatus) statusMap[row.status] = row._count.id;
    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const sent = statusMap['SENT'] ?? 0;
    const failed = statusMap['FAILED'] ?? 0;
    const blocked = statusMap['BLOCKED'] ?? 0;
    const successRate = total > 0 ? Math.round((sent / total) * 1000) / 10 : 0;

    // 채널별
    const channelMap: Record<string, number> = {};
    for (const row of byChannel) channelMap[row.channel] = row._count.id;

    // 차단 사유
    const blockReasons = byBlockReason
      .filter((r) => r.blockReason)
      .map((r) => ({ reason: r.blockReason!, count: r._count.id }));

    // 일별 추이 → { date, sent, failed, blocked } 형태
    const dailyMap = new Map<string, { sent: number; failed: number; blocked: number }>();
    for (const row of dailyRaw) {
      const entry = dailyMap.get(row.day) ?? { sent: 0, failed: 0, blocked: 0 };
      if (row.status === 'SENT') entry.sent = Number(row.cnt);
      else if (row.status === 'FAILED') entry.failed = Number(row.cnt);
      else if (row.status === 'BLOCKED') entry.blocked = Number(row.cnt);
      dailyMap.set(row.day, entry);
    }
    const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }));

    logger.log('[GET /api/sms-logs/stats]', { orgId, days, total });

    return NextResponse.json({
      ok: true,
      stats: {
        total, sent, failed, blocked, successRate,
        byChannel: channelMap,
        blockReasons,
        daily,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ ok: false }, { status: 401 });
    logger.error('[GET /api/sms-logs/stats]', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
