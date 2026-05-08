export const dynamic = 'force-dynamic';

// POST /api/admin/affiliate/settlements/[settlementId]/confirm
// MonthlySettlement: DRAFT → CONFIRMED + 해당 AffiliateSale CONFIRMED → LOCKED

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  try {
    const { isAdmin, user: adminUser } = await checkAdminAuth();
    if (!isAdmin || !adminUser) {
      return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { settlementId } = await params;
    const settlementIdNum = parseInt(settlementId, 10);
    if (isNaN(settlementIdNum) || settlementIdNum <= 0) {
      return NextResponse.json({ ok: false, error: '잘못된 정산 ID입니다.' }, { status: 400 });
    }

    // 정산 존재 여부 사전 확인 (404 응답용)
    const existCheck = await prisma.monthlySettlement.findUnique({
      where: { id: settlementIdNum },
      select: { id: true },
    });
    if (!existCheck) {
      return NextResponse.json({ ok: false, error: '정산 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date();

    // [TOCTOU 방지] 상태 검증과 업데이트를 원자적으로 처리
    // where 조건에 status: 'DRAFT'를 포함해 동시 요청 시 한 건만 성공
    await prisma.$transaction(async (tx) => {
      const updated = await tx.monthlySettlement.updateMany({
        where: { id: settlementIdNum, status: 'DRAFT' },
        data: {
          status: 'CONFIRMED',
          approvedById: adminUser.id,
          approvedAt: now,
          updatedAt: now,
        },
      });

      if (updated.count === 0) {
        // 이미 다른 요청이 상태를 변경했거나 DRAFT가 아님
        const current = await tx.monthlySettlement.findUnique({
          where: { id: settlementIdNum },
          select: { status: true },
        });
        throw Object.assign(new Error('STATUS_CONFLICT'), {
          currentStatus: current?.status ?? 'UNKNOWN',
        });
      }

      // 2. CommissionLedger로 연결된 AffiliateSale 중 CONFIRMED → LOCKED
      const linkedSaleRows = await tx.commissionLedger.findMany({
        where: { settlementId: settlementIdNum },
        select: { saleId: true },
        distinct: ['saleId'],
      });

      const saleIds = linkedSaleRows
        .map((r) => r.saleId)
        .filter((id): id is number => id !== null);

      if (saleIds.length > 0) {
        await tx.affiliateSale.updateMany({
          where: { id: { in: saleIds }, status: 'CONFIRMED' },
          data: { status: 'LOCKED' },
        });
      }

      // 3. AdminActionLog 기록
      await tx.adminActionLog.create({
        data: {
          adminId: adminUser.id,
          action: 'SETTLEMENT_CONFIRMED',
          details: {
            settlementId: settlementIdNum,
            affectedSaleCount: saleIds.length,
            confirmedAt: now.toISOString(),
          },
        },
      });

      // 4. SettlementEvent 기록
      await tx.settlementEvent.create({
        data: {
          settlementId: settlementIdNum,
          userId: adminUser.id,
          eventType: 'CONFIRMED',
          description: '관리자가 정산을 확정했습니다.',
          metadata: {
            affectedSaleCount: saleIds.length,
            confirmedAt: now.toISOString(),
          },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      message: '정산이 확정되었습니다.',
      data: {
        settlementId: settlementIdNum,
        status: 'CONFIRMED',
        confirmedAt: now.toISOString(),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error instanceof Error ? error.message : String(error)) === 'STATUS_CONFLICT') {
      const statusError = error as Error & { currentStatus?: string };
      return NextResponse.json(
        {
          ok: false,
          error: `DRAFT 상태의 정산만 확정할 수 있습니다. 현재 상태: ${statusError.currentStatus ?? '알 수 없음'}`,
        },
        { status: 409 }
      );
    }
    logger.error('[Settlement Confirm API] POST error:', error);
    return NextResponse.json({ ok: false, error: '정산 확정 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
