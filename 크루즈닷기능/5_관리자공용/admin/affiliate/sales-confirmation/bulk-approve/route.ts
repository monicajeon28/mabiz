export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales-confirmation/bulk-approve/route.ts
// 판매 확정 일괄 승인 API

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

const MAX_BULK_APPROVE = 50;

/**
 * POST: AffiliateSale 일괄 승인
 * body: { saleIds: number[] }
 * 응답: { ok: true, approved: number, failed: number }
 */
export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || !['admin', 'superadmin'].includes(sessionUser.role ?? '')) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const body = await req.json() as { saleIds?: unknown };
    const { saleIds } = body;

    if (!Array.isArray(saleIds) || saleIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'saleIds 배열이 필요합니다.' }, { status: 400 });
    }

    if (saleIds.length > MAX_BULK_APPROVE) {
      return NextResponse.json(
        { ok: false, error: `최대 ${MAX_BULK_APPROVE}건까지 일괄 승인할 수 있습니다.` },
        { status: 400 }
      );
    }

    const validSaleIds = saleIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0);
    if (validSaleIds.length !== saleIds.length) {
      return NextResponse.json({ ok: false, error: 'saleIds는 양의 정수 배열이어야 합니다.' }, { status: 400 });
    }

    // 대상 AffiliateSale 조회
    const sales = await prisma.affiliateSale.findMany({
      where: { id: { in: validSaleIds } },
      select: { id: true, status: true },
    });

    const salesMap = new Map(sales.map(s => [s.id, s]));

    let approved = 0;
    let failed = 0;
    const failedIds: number[] = [];
    const approvedIds: number[] = [];

    for (const saleId of validSaleIds) {
      const sale = salesMap.get(saleId);
      if (!sale) {
        failed++;
        failedIds.push(saleId);
        continue;
      }
      if (sale.status !== 'PENDING_APPROVAL') {
        failed++;
        failedIds.push(saleId);
        continue;
      }
      approvedIds.push(saleId);
    }

    // 승인 가능한 건 트랜잭션으로 일괄 처리
    if (approvedIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.affiliateSale.updateMany({
          where: {
            id: { in: approvedIds },
            status: 'PENDING_APPROVAL', // TOCTOU 방지
          },
          data: {
            status: 'APPROVED',
            updatedAt: new Date(),
          },
        });
      });
      approved = approvedIds.length;
    }

    logger.debug('[Bulk Approve] 일괄 승인 처리 완료', {
      requested: validSaleIds.length,
      approved,
      failed,
      failedIds,
      adminId: sessionUser.id,
    });

    return NextResponse.json({ ok: true, approved, failed });
  } catch (error: unknown) {
    logger.error('[Bulk Approve] 오류', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ ok: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
