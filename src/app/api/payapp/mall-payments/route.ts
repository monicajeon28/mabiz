import { NextResponse } from 'next/server';
import { Prisma, PaymentStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

/**
 * GET /api/payapp/mall-payments
 * 크루즈닷몰(웰컴페이먼츠 B2C) 결제 내역 조회 — 읽기 전용
 * Payment 테이블은 크루즈닷몰 공유 DB이므로 절대 수정하지 않음
 */
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    // 크루즈닷몰 결제 내역은 관리자만 접근 가능
    if (ctx.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json({ ok: false, message: '관리자만 접근 가능합니다.' }, { status: 403 });
    }
    const url = new URL(req.url);

    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');
    const page   = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
    const limit  = Math.min(50, parseInt(url.searchParams.get('limit') ?? '20'));

    const VALID_STATUSES: PaymentStatus[] = ['pending', 'paid', 'completed', 'failed', 'cancelled', 'refunded', 'partial_refunded', 'refund_pending', 'pending_vbank'];
    const where: Prisma.PaymentWhereInput = {};
    if (status && VALID_STATUSES.includes(status as PaymentStatus)) {
      where.status = status as PaymentStatus;
    }
    if (search) {
      where.OR = [
        { buyerName: { contains: search } },
        { buyerTel: { contains: search } },
        { productName: { contains: search } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({ ok: true, payments, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('[MallPayments] 조회 실패', { err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
