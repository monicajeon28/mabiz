export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/sms-logs
 * 발송 내역 조회 (내 조직만 — IDOR 방지)
 *
 * query:
 *   contactId?: string  — 특정 고객 필터
 *   status?:    string  — SENT | FAILED | BLOCKED
 *   days?:      number  — 최근 N일 (기본 30일, 최대 90)
 *   take?:      number  — 페이지 크기 (기본 50, 최대 100)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx   = await getAuthContext();
    const orgId = requireOrgId(ctx);

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId') ?? undefined;
    const status    = searchParams.get('status')    ?? undefined;
    const days      = Math.min(Number(searchParams.get('days')  ?? 30), 90);
    const take      = Math.min(Number(searchParams.get('take')  ?? 50), 100);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where: {
          organizationId: orgId,          // ← 조직 필터 강제 (IDOR 방지)
          ...(contactId ? { contactId } : {}),
          ...(status    ? { status }    : {}),
          sentAt: { gte: since },
        },
        orderBy: { sentAt: 'desc' },
        take,
        select: {
          id:             true,
          phone:          true,    // 이미 마스킹됨
          contentPreview: true,
          status:         true,
          blockReason:    true,
          resultCode:     true,
          channel:        true,
          sentAt:         true,
        },
      }),
      prisma.smsLog.count({
        where: {
          organizationId: orgId,
          ...(contactId ? { contactId } : {}),
          ...(status    ? { status }    : {}),
          sentAt: { gte: since },
        },
      }),
    ]);

    // 요약 통계
    const stats = await prisma.smsLog.groupBy({
      by: ['status'],
      where: { organizationId: orgId, sentAt: { gte: since } },
      _count: { status: true },
    });

    const summary = {
      total,
      sent:    stats.find(s => s.status === 'SENT')?._count.status    ?? 0,
      failed:  stats.find(s => s.status === 'FAILED')?._count.status  ?? 0,
      blocked: stats.find(s => s.status === 'BLOCKED')?._count.status ?? 0,
    };

    logger.log('[SmsLog] 조회', { orgId, total, days });

    return NextResponse.json({ ok: true, logs, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('organizationId')) {
      return NextResponse.json({ ok: false, message: '인증 필요' }, { status: 401 });
    }
    logger.error('[SmsLog] 조회 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
