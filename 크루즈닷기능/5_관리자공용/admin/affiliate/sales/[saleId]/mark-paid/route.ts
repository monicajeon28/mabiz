export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { mergeMetadata } from '@/lib/utils/json-parsers';

const PAYABLE_STATUSES = ['CONFIRMED', 'APPROVED'];
const PROTECTED_STATUSES = ['PAID', 'PAYOUT_SCHEDULED', 'REFUNDED'];

/**
 * POST /api/admin/affiliate/sales/[saleId]/mark-paid
 * 어필리에이트 판매 CONFIRMED/APPROVED → PAID 전환 (수당 지급완료 처리)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || !['admin', 'superadmin'].includes(user.role ?? '')) {
      return NextResponse.json({ ok: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { saleId: saleIdStr } = await params;
    const saleId = parseInt(saleIdStr);
    if (isNaN(saleId) || saleId <= 0) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 판매 ID입니다.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const paymentReference: string | null = body.paymentReference || null;
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

    if (isNaN(paidAt.getTime())) {
      return NextResponse.json({ ok: false, message: '유효하지 않은 지급 일시입니다.' }, { status: 400 });
    }

    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: { id: true, status: true, saleAmount: true, productCode: true, metadata: true },
    });

    if (!sale) {
      return NextResponse.json({ ok: false, message: '판매를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (PROTECTED_STATUSES.includes(sale.status)) {
      return NextResponse.json(
        { ok: false, message: `이미 처리된 판매입니다. (현재 상태: ${sale.status})` },
        { status: 409 }
      );
    }

    if (!PAYABLE_STATUSES.includes(sale.status)) {
      return NextResponse.json(
        { ok: false, message: `지급 처리 불가능한 상태입니다. (현재 상태: ${sale.status}, 가능: ${PAYABLE_STATUSES.join(', ')})` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // TOCTOU 방지: 상태가 여전히 PAYABLE인 경우에만 업데이트
      const toctouResult = await tx.affiliateSale.updateMany({
        where: {
          id: saleId,
          status: { in: PAYABLE_STATUSES },
        },
        data: {
          status: 'PAID',
        },
      });

      if (toctouResult.count === 0) {
        throw new Error('ALREADY_PROCESSED');
      }

      // metadata 별도 업데이트 (updateMany는 json spread 미지원)
      await tx.affiliateSale.update({
        where: { id: saleId },
        data: {
          metadata: mergeMetadata(sale.metadata, {
            paidAt: paidAt.toISOString(),
            paidByAdminId: user.id,
            ...(paymentReference && { paymentReference }),
          }),
        },
      });

      // isSettled 동기화: 이 판매의 CommissionLedger 엔트리를 모두 settled 처리
      await tx.commissionLedger.updateMany({
        where: { saleId, isSettled: false },
        data: { isSettled: true },
      });

      return await tx.affiliateSale.findUnique({
        where: { id: saleId },
        select: { id: true, status: true, saleAmount: true, productCode: true },
      });
    });

    return NextResponse.json({
      ok: true,
      message: '수당 지급완료 처리되었습니다.',
      sale: {
        id: result?.id,
        status: result?.status,
        saleAmount: result?.saleAmount,
        productCode: result?.productCode,
        paidAt: paidAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_PROCESSED') {
      return NextResponse.json({ ok: false, message: '이미 처리된 판매입니다.' }, { status: 409 });
    }
    logger.error('[Mark Paid API] Error:', error);
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
