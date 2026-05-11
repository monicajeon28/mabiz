import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext, requireOrgId } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/payapp/payments
 * 결제 내역 목록 + 통계
 * 필터: status, search(이름/전화), month(YYYY-MM)
 * 페이지네이션: page, limit
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    const orgId = requireOrgId(ctx);
    const url = new URL(req.url);

    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const month  = url.searchParams.get('month'); // YYYY-MM
    const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit  = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20'));

    // Where 조건 구성
    const where: Record<string, unknown> = { organizationId: orgId };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause = where as any;
    const [payments, total] = await Promise.all([
      prisma.payAppPayment.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payAppPayment.count({ where: whereClause }),
    ]);

    // 통계 (조직 전체)
    const allPayments = await prisma.payAppPayment.findMany({
      where: { organizationId: orgId },
      select: { status: true, amount: true, refundAmount: true },
    });

    const stats = {
      totalPaid: 0,
      totalPaidCount: 0,
      totalRefunded: 0,
      totalRefundedCount: 0,
      totalPending: 0,
      totalPendingCount: 0,
    };

    for (const p of allPayments) {
      if (p.status === 'paid') {
        stats.totalPaid += p.amount;
        stats.totalPaidCount++;
      } else if (p.status === 'refunded' || p.status === 'partial_refunded') {
        stats.totalRefunded += p.refundAmount ?? 0;
        stats.totalRefundedCount++;
      } else if (p.status === 'pending' || p.status === 'waiting') {
        stats.totalPending += p.amount;
        stats.totalPendingCount++;
      }
    }

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
