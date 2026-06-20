import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext, resolveOrgIdOrNull } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/payapp/payments
 * 랜딩페이지 결제 내역 목록 + 통계
 * 필터: status, search(이름/전화), month(YYYY-MM)
 * RBAC: GLOBAL_ADMIN=전체, OWNER=본인조직, AGENT=본인이 만든 결제만
 * 페이지네이션: page, limit
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = resolveOrgIdOrNull(ctx); // GLOBAL_ADMIN → null (전체 조직), 그 외 → orgId (없으면 에러)
    const url = new URL(req.url);

    const VALID_STATUSES = ['paid', 'pending', 'waiting', 'refunded', 'partial_refunded', 'cancelled'];
    const statusParam = url.searchParams.get('status');
    const status = statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : null;
    const search = url.searchParams.get('search');
    const month  = url.searchParams.get('month'); // YYYY-MM
    const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit  = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20'));

    // Where 조건 구성
    const where: Record<string, unknown> = {};
    if (orgId) where.organizationId = orgId;
    // AGENT: 본인이 생성한 결제만 조회 (다른 판매원 결제 노출 방지)
    if (ctx.role === 'AGENT') where.createdByUserId = ctx.userId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { productName: { contains: search } },
      ];
    }
    if (month) {
      const [y, m] = month.split('-').map(Number);
      where.createdAt = {
        gte: new Date(y, m - 1, 1),
        lt:  new Date(y, m, 1),
      };
    }

    // 결제 목록 + 전체 수
    const whereClause = where as Prisma.PayAppPaymentWhereInput;
    const [payments, total] = await Promise.all([
      prisma.payAppPayment.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payAppPayment.count({ where: whereClause }),
    ]);

    // 통계 (DB 레벨 집계 — 메모리 효율, AGENT 필터 동일 적용)
    const orgFilter = orgId ? { organizationId: orgId } : {};
    const agentFilter = ctx.role === 'AGENT' ? { createdByUserId: ctx.userId } : {};
    const statsBase = { ...orgFilter, ...agentFilter };
    const [paidAgg, refundAgg, pendingAgg] = await Promise.all([
      prisma.payAppPayment.aggregate({
        where: { ...statsBase, status: 'paid' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payAppPayment.aggregate({
        where: { ...statsBase, status: { in: ['refunded', 'partial_refunded'] } },
        _sum: { refundAmount: true },
        _count: true,
      }),
      prisma.payAppPayment.aggregate({
        where: { ...statsBase, status: { in: ['pending', 'waiting'] } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const stats = {
      totalPaid: paidAgg._sum.amount ?? 0,
      totalPaidCount: paidAgg._count,
      totalRefunded: refundAgg._sum.refundAmount ?? 0,
      totalRefundedCount: refundAgg._count,
      totalPending: pendingAgg._sum.amount ?? 0,
      totalPendingCount: pendingAgg._count,
    };

    return NextResponse.json({
      ok: true,
      payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (err) {
    logger.error('[PayApp/Payments] 목록 조회 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
