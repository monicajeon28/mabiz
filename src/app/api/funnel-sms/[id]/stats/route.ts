export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/funnel-sms/[id]/stats — 이 퍼널문자로 예약된 ScheduledSms 발송 상태 집계
//
// channel = `FUNNEL_SMS:${funnelSmsId}:${messageId}` 규칙으로 startsWith 필터링.
// 반환: { pending, sent, failed, blocked } (대시보드 상태 카드용)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgId(ctx);
    const { id } = await params;

    // IDOR 방어: 소속 조직 소유 확인
    const existing = await prisma.funnelSms.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: '퍼널문자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const stats = await prisma.scheduledSms.groupBy({
      by: ['status'],
      where: {
        organizationId: orgId,
        channel: { startsWith: `FUNNEL_SMS:${id}:` },
      },
      _count: { _all: true },
    });

    const countFor = (predicate: (status: string) => boolean) =>
      stats
        .filter((s) => predicate(s.status))
        .reduce((sum, s) => sum + s._count._all, 0);

    const result = {
      ok: true,
      pending: countFor((s) => s === 'PENDING'),
      sent: countFor((s) => s === 'SENT'),
      failed: countFor((s) => s === 'FAILED'),
      blocked: countFor((s) => s.includes('BLOCKED')),
    };

    return NextResponse.json(result);
  } catch (err) {
    logger.error('[GET /api/funnel-sms/[id]/stats]', { err });
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
