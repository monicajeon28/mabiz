import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  try {
    const session = await getSession();
    if (!session?.userId || !session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 역할 검증: OWNER, GLOBAL_ADMIN만 판매 승인/거절 가능
    if (!['OWNER', 'GLOBAL_ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { ok: false, error: '판매 승인/거절은 관리자만 가능합니다.' },
        { status: 403 }
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

    // 존재 여부 + 조직 권한 사전 확인 (404 vs 403 구분용)
    const existing = await prisma.affiliateSale.findUnique({
      where: { id: resolvedParams.id },
      select: { organizationId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: '판매 기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (existing.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // updateMany with status condition: TOCTOU 방지 (동시 승인/거절 충돌)
    // findUnique 후 update 사이에 다른 관리자가 먼저 처리했으면 count=0 반환
    const updateResult = await prisma.affiliateSale.updateMany({
      where: {
        id: resolvedParams.id,
        organizationId: session.organizationId,
        status: { in: ['PENDING', 'PENDING_APPROVAL'] },
      },
      data: {
        status,
        updatedAt: new Date(),
        ...(status === 'REJECTED' && {
          cancelReason: rejectionReason,
          cancelledAt: new Date(),
        }),
      },
    });

    if (updateResult.count === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `이미 처리되었거나 승인 가능 상태가 아닙니다. (현재 상태: ${existing.status})`,
        },
        { status: 409 }
      );
    }

    const updatedSale = await prisma.affiliateSale.findUnique({
      where: { id: resolvedParams.id },
    });

    logger.log('[sales-confirmation PATCH] 판매 상태 업데이트', {
      saleId: resolvedParams.id,
      prevStatus: existing.status,
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
