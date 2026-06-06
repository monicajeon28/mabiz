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

    // 승인 대상 판매 건 전체 조회 (커미션 계산용)
    const saleDetails = await prisma.affiliateSale.findMany({
      where: { id: { in: saleIds } },
      select: {
        id: true,
        organizationId: true,
        commissionAmount: true,
        commissionRate: true,
        saleAmount: true,
      },
    });

    // CommissionLedger 데이터 계산 (트랜잭션 전 준비)
    const ledgerData = saleDetails.map((sale) => {
      // commissionAmount/commissionRate가 null이면 0으로 처리해 NaN 저장 방지
      const commissionAmt =
        sale.commissionAmount != null && sale.commissionAmount > 0
          ? sale.commissionAmount
          : Math.round((sale.saleAmount * (sale.commissionRate ?? 0)) / 100);
      const withholdingAmt = Math.round(commissionAmt * 0.033); // 3.3% 원천징수
      return {
        saleId: sale.id,
        organizationId: sale.organizationId,
        entryType: 'COMMISSION_APPROVED',
        amount: commissionAmt,
        withholdingAmount: withholdingAmt,
        isSettled: false,
        notes: `일괄 승인 — approver: ${session.userId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    // 상태 업데이트 + CommissionLedger 생성을 단일 트랜잭션으로 묶어 원자성 보장
    // updateMany 성공 후 createMany 실패 시 APPROVED 상태지만 원장 없는 불일치 방지
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.affiliateSale.updateMany({
        where: { id: { in: saleIds } },
        data: {
          status: 'APPROVED',
          updatedAt: new Date(),
        },
      });

      if (ledgerData.length > 0) {
        await tx.commissionLedger.createMany({
          data: ledgerData,
          skipDuplicates: true,
        });
      }

      return updateResult;
    });

    logger.log('[sales-confirmation batch-approve] 일괄 승인 + CommissionLedger 생성', {
      approverId: session.userId,
      saleIds,
      updated: result.count,
      ledgerCreated: ledgerData.length,
    });

    return NextResponse.json({
      ok: true,
      updated: result.count,
      failed: ids.length - result.count,
      ledgerCreated: ledgerData.length,
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
