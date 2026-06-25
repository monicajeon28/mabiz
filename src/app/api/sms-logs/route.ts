export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/rbac';
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
    const ctx = await getAuthContext();

    // P0-4: 마케터는 문자 기록 조회 불가
    if (ctx.role === 'FREE_SALES') {
      return NextResponse.json(
        { ok: false, message: '문자 기록 조회 권한이 없습니다' },
        { status: 403 }
      );
    }

    let orgId: string;
    if (ctx.organizationId) {
      orgId = ctx.organizationId;
    } else if (ctx.role === 'GLOBAL_ADMIN') {
      const firstOrg = await prisma.organization.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' },  // ★ 결정론적 순서 보장
      });
      if (!firstOrg) return NextResponse.json({ ok: true, logs: [], summary: { total: 0, sent: 0, failed: 0, blocked: 0 } });
      orgId = firstOrg.id;
    } else {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId') ?? undefined;
    const status    = searchParams.get('status')    ?? undefined;
    const channel   = searchParams.get('channel')   ?? undefined;
    const days      = Math.min(Number(searchParams.get('days')  ?? 30), 90);
    const take      = Math.min(Number(searchParams.get('take')  ?? 50), 100);
    const page      = Math.max(Number(searchParams.get('page')  ?? 1), 1);
    const skip      = (page - 1) * take;

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    // P0-4: 역할별 필터링 로직
    // GLOBAL_ADMIN: 모든 조직 기록
    // OWNER: 자신 조직의 모든 기록
    // AGENT: 자신이 발송한 기록만
    const baseWhere: Record<string, unknown> = {
      organizationId: orgId,
      ...(contactId ? { contactId } : {}),
      ...(status    ? { status }    : {}),
      ...(channel   ? { channel }   : {}),
      sentAt: { gte: since },
    };

    // AGENT는 자신이 발송한 기록만 조회 가능
    if (ctx.role === 'AGENT') {
      baseWhere.createdBy = ctx.userId;
    }
    // OWNER와 GLOBAL_ADMIN은 전체 조회 가능

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where: baseWhere,
        orderBy: { sentAt: 'desc' },
        skip,
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
      prisma.smsLog.count({ where: baseWhere }),
    ]);

    // 요약 통계 (필터 동일하게 적용)
    const stats = await prisma.smsLog.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true },
    });

    const summary = {
      total,
      sent:    stats.find(s => s.status === 'SENT')?._count.status    ?? 0,
      failed:  stats.find(s => s.status === 'FAILED')?._count.status  ?? 0,
      blocked: stats.find(s => s.status === 'BLOCKED')?._count.status ?? 0,
    };

    logger.log('[SmsLog] 조회', { orgId, role: ctx.role, total, page, pageSize: take, days });

    return NextResponse.json({
      ok: true,
      logs,
      summary,
      page,
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('organizationId')) {
      return NextResponse.json({ ok: false, message: '인증 필요' }, { status: 401 });
    }
    logger.error('[SmsLog] 조회 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
