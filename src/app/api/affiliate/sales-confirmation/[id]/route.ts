import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId || !session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { status, approverNote, rejectionReason } = body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { ok: false, error: '유효한 status가 필요합니다. (APPROVED|REJECTED)' },
        { status: 400 }
      );
    }

    if (status === 'REJECTED' && !rejectionReason?.trim()) {
      return NextResponse.json(
        { ok: false, error: '거절 시에는 rejectionReason이 필수입니다.' },
        { status: 400 }
      );
    }

    const sale = await prisma.affiliateSale.findUnique({
      where: { id: params.id },
    });

    if (!sale) {
      return NextResponse.json(
        { ok: false, error: '판매 기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (sale.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    if (sale.status !== 'PENDING' && sale.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        {
          ok: false,
          error: `${sale.status} 상태에서는 승인/거절할 수 없습니다.`,
        },
        { status: 400 }
      );
    }

    const updatedSale = await prisma.affiliateSale.update({
      where: { id: params.id },
      data: {
        status,
        ...(status === 'APPROVED' && {
          updatedAt: new Date(),
        }),
        ...(status === 'REJECTED' && {
          cancelReason: rejectionReason,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    });

    logger.log('[sales-confirmation PATCH] 판매 상태 업데이트', {
      saleId: params.id,
      prevStatus: sale.status,
      newStatus: status,
      approverId: session.userId,
      ...(status === 'REJECTED' && { rejectionReason }),
    });

    return NextResponse.json({
      ok: true,
      data: updatedSale,
    });
  } catch (error: unknown) {
    logger.error('[sales-confirmation PATCH] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
