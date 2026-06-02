/**
 * GET /api/payslips
 * 급여명세서 조회 - Partner 급여 조회 (Partner 로그인 시)
 *
 * 쿼리 파라미터:
 * - page: 페이지 번호 (기본: 1)
 * - limit: 페이지당 항목 수 (기본: 20)
 * - status: 필터 (PENDING, APPROVED, SENT)
 * - yearMonth: 기간 필터 (YYYY-MM 형식)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 권한 확인: AGENT, OWNER, GLOBAL_ADMIN만 접근 가능
    if (ctx.role !== 'AGENT' && ctx.role !== 'OWNER' && ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'FORBIDDEN', message: '파트너 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const status = searchParams.get('status');
    const yearMonth = searchParams.get('yearMonth');

    const skip = (page - 1) * limit;

    // agentId 결정
    let agentIdFilter: number | undefined;
    if (ctx.role === 'GLOBAL_ADMIN') {
      // GLOBAL_ADMIN: 쿼리 파라미터로 agentId 지정 가능
      const agentIdParam = searchParams.get('agentId');
      if (agentIdParam) {
        agentIdFilter = parseInt(agentIdParam, 10);
      }
    } else if (ctx.role === 'AGENT' || ctx.role === 'OWNER') {
      // AGENT/OWNER: 자신의 급여만 조회
      if (!ctx.mallUser?.id) {
        return NextResponse.json(
          { ok: false, error: 'FORBIDDEN', message: '파트너 정보가 없습니다.' },
          { status: 403 }
        );
      }
      agentIdFilter = ctx.mallUser.id;
    }

    const where: any = {};
    if (agentIdFilter) where.agentId = agentIdFilter;
    if (status) where.status = status;
    if (yearMonth) where.yearMonth = yearMonth;

    const [payslips, total] = await Promise.all([
      prisma.affiliatePayslip.findMany({
        where,
        orderBy: { yearMonth: 'desc' },
        skip,
        take: limit,
      }),
      prisma.affiliatePayslip.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      payslips: payslips.map(p => ({
        id: p.id,
        agentId: p.agentId,
        yearMonth: p.yearMonth,
        baseCommission: Number(p.baseCommission),
        bonus: p.bonus ? Number(p.bonus) : null,
        deduction: p.deduction ? Number(p.deduction) : null,
        netAmount: Number(p.netAmount),
        status: p.status,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        note: p.note,
        agentDisplayName: p.agentDisplayName,
        agentMallUserId: p.agentMallUserId,
        createdAt: p.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    logger.error('[GET /api/payslips]', { err });
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
