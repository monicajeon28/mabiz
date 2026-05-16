export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext } from '@/lib/passport-auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/partner/dashboard/b2c/confirm
 * 수당 최종 승인 (GLOBAL_ADMIN만)
 *
 * Body: { saleId: string }
 * 처리: AffiliateSale.status = 'COMPLETED', paidAt = now()
 */
export async function POST(req: Request) {
  try {
    const ctx = await requirePartnerContext();
    if (!ctx) return NextResponse.json({ ok: false, error: '인증이 필요합니다' }, { status: 403 });

    // GLOBAL_ADMIN 권한 확인
    if (ctx.sessionUser.role !== 'admin') {
      return NextResponse.json({ ok: false, error: '관리자만 접근 가능합니다' }, { status: 403 });
    }

    const body = await req.json();
    const { saleId } = body;

    if (!saleId || typeof saleId !== 'string') {
      return NextResponse.json({ ok: false, error: 'saleId 필수' }, { status: 400 });
    }

    // AffiliateSale 조회
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
    });

    if (!sale) {
      return NextResponse.json({ ok: false, error: '해당 수당을 찾을 수 없습니다' }, { status: 404 });
    }

    // 상태 업데이트: COMPLETED + paidAt
    const updated = await prisma.affiliateSale.update({
      where: { id: saleId },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
      },
    });

    logger.info('[b2c/confirm] 수당 승인 완료', {
      saleId,
      orderId: sale.orderId,
      amount: sale.saleAmount,
      commission: sale.commissionAmount,
    });

    return NextResponse.json({ ok: true, data: { id: updated.id, status: updated.status } });
  } catch (error) {
    const err = error as Record<string, unknown>;
    logger.error('[b2c/confirm] 오류', { message: err.message });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
