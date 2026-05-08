export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/[saleId]/receipt/route.ts
// 현금영수증 처리 API

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST: 현금영수증 처리 완료
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

    // 판매 건 조회
    const sale = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      include: {
        AffiliateLead: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ ok: false, message: '판매 건을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 현금영수증 처리 완료 업데이트
    const updatedSale = await prisma.affiliateSale.update({
      where: { id: saleId },
      data: {
        receiptStatus: 'COMPLETED',
        receiptProcessedAt: new Date(),
        metadata: {
          ...((sale.metadata as any) || {}),
          receiptProcessedBy: sessionUser.id,
          receiptProcessedAt: new Date().toISOString(),
        },
      },
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
    console.error(`POST /api/admin/affiliate/sales/${saleIdStr}/receipt error:`, error);
    return NextResponse.json(
      { ok: false, message: error.message || '현금영수증 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
