import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId || !session?.organizationId) {
      return NextResponse.json(
        { ok: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: '유효한 ids 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    // 조직 권한 확인 및 유효한 ID 필터링
    const sales = await prisma.affiliateSale.findMany({
      where: {
        id: { in: ids },
        organizationId: session.organizationId,
        status: { in: ['PENDING', 'PENDING_APPROVAL'] },
      },
      select: { id: true, status: true },
    });

    if (sales.length === 0) {
      return NextResponse.json(
        { ok: false, error: '승인 가능한 항목이 없습니다.' },
        { status: 400 }
      );
    }

    const saleIds = sales.map((s) => s.id);

    // 일괄 업데이트
    const result = await prisma.affiliateSale.updateMany({
      where: { id: { in: saleIds } },
      data: {
        status: 'APPROVED',
        updatedAt: new Date(),
      },
    });

    logger.log('[sales-confirmation batch-approve] 일괄 승인', {
      approverId: session.userId,
      saleIds,
      updated: result.count,
    });

    return NextResponse.json({
      ok: true,
      updated: result.count,
      failed: ids.length - result.count,
    });
  } catch (error: unknown) {
    logger.error('[sales-confirmation batch-approve] 오류', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
