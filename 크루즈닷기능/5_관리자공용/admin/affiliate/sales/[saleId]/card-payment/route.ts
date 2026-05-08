export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/[saleId]/card-payment/route.ts
// 카드 계산 완료 처리 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST: 카드 계산 완료 처리
 * body: { receiptProcess: boolean } - 현금영수증 처리도 함께 할지 여부
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    const { saleId: saleIdStr } = await params;
    const saleId = Number(saleIdStr);
    if (!saleId || Number.isNaN(saleId)) {
      return NextResponse.json({ ok: false, message: 'Invalid sale ID' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const receiptProcess = body?.receiptProcess === true; // 현금영수증 처리도 함께 할지 여부

    // 판매 건 조회
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
    });

    if (!sale) {
      return NextResponse.json({ ok: false, message: '판매 건을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 카드 계산 완료 업데이트 (현금영수증 처리도 함께 할 경우)
    const updateData: any = {
      cardPaymentStatus: 'COMPLETED',
      metadata: {
        ...((sale.metadata as any) || {}),
        cardPaymentProcessedBy: sessionUser.id,
        cardPaymentProcessedAt: new Date().toISOString(),
      },
    };

    if (receiptProcess) {
      updateData.receiptStatus = 'COMPLETED';
      updateData.receiptProcessedAt = new Date();
      updateData.metadata = {
        ...updateData.metadata,
        receiptProcessedBy: sessionUser.id,
        receiptProcessedAt: new Date().toISOString(),
      };
    }

    const updatedSale = await prisma.affiliateSale.update({
      where: { id: saleId },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      sale: {
        ...updatedSale,
        receiptProcessedAt: updatedSale.receiptProcessedAt?.toISOString() || null,
        saleDate: updatedSale.saleDate?.toISOString() || null,
        createdAt: updatedSale.createdAt.toISOString(),
        updatedAt: updatedSale.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    const { saleId: saleIdStr } = await params;
    console.error(`POST /api/admin/affiliate/sales/${saleIdStr}/card-payment error:`, error);
    return NextResponse.json(
      { ok: false, message: error.message || '카드 계산 완료 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
