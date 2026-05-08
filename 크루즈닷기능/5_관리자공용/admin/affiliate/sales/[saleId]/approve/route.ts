export const dynamic = 'force-dynamic';

// app/api/admin/affiliate/sales/[saleId]/approve/route.ts
// 판매 확정 승인 API

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdminAuth } from '@/lib/auth';
import { validateCsrfToken, getCsrfErrorResponse } from '@/lib/utils/csrfValidation';
import { syncSaleCommissionLedgers } from '@/lib/affiliate/commission-ledger';
import { notifySaleApproved } from '@/lib/affiliate/sales-notification';

/**
 * POST: 판매 확정 승인
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
) {
  try {
    // 1. CSRF 검증
    const csrfValidation = validateCsrfToken(req);
    if (!csrfValidation.valid) {
      return getCsrfErrorResponse(csrfValidation.error || '잘못된 요청입니다.');
    }

    // 2. 관리자 권한 + 세션 만료 확인
    const { isAdmin, user: admin } = await checkAdminAuth();
    if (!isAdmin || !admin) {
      return NextResponse.json(
        { ok: false, error: '관리자 권한이 필요합니다' },
        { status: 403 }
      );
    }

    // 3. 판매 ID 확인
    const { saleId: saleIdStr } = await params;
    const saleId = parseInt(saleIdStr);
    if (isNaN(saleId)) {
      return NextResponse.json(
        { ok: false, error: '올바른 판매 ID가 아닙니다' },
        { status: 400 }
      );
    }

    // 4. 판매 존재 여부 + 여권/PNR 완료 여부 확인 + metadata 사전 조회 (트랜잭션 내 재조회 방지)
    const saleExists = await prisma.affiliateSale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        metadata: true,
        Reservation: {
          select: { id: true, passportStatus: true, pnrStatus: true },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });

    if (!saleExists) {
      return NextResponse.json(
        { ok: false, error: '판매를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 여권/PNR 완료 여부 확인 — 예약 없으면 통과 (구형 데이터 하위호환)
    const reservation = saleExists.Reservation[0];
    if (reservation) {
      if (reservation.passportStatus !== 'COMPLETED') {
        return NextResponse.json(
          { ok: false, error: '여권 확인이 완료되지 않았습니다. 여권 상태를 COMPLETED로 변경 후 승인하세요.', code: 'PASSPORT_NOT_COMPLETED' },
          { status: 422 }
        );
      }
      if (reservation.pnrStatus !== 'COMPLETED') {
        return NextResponse.json(
          { ok: false, error: 'PNR 확인이 완료되지 않았습니다. PNR 상태를 COMPLETED로 변경 후 승인하세요.', code: 'PNR_NOT_COMPLETED' },
          { status: 422 }
        );
      }
    }

    // 4. 판매 승인 처리 (낙관적 락으로 동시성 보호)
    // 승인 가능 상태: PENDING_APPROVAL (판매원 확정 신청 후) 또는 CONFIRMED (직접 승인)
    // updateMany + WHERE status IN ['PENDING_APPROVAL','CONFIRMED']: 다른 트랜잭션이 먼저 변경하면 count=0 → 충돌 감지
    const result = await prisma.$transaction(async (tx) => {
      // 낙관적 락: status가 PENDING_APPROVAL 또는 CONFIRMED인 경우에만 APPROVED로 원자적 전이
      const lockResult = await tx.affiliateSale.updateMany({
        where: { id: saleId, status: { in: ['PENDING_APPROVAL', 'CONFIRMED'] } },
        data: {
          status: 'APPROVED',
          approvedById: admin.id,
          approvedAt: new Date(),
          confirmedAt: new Date(),
        },
      });

      if (lockResult.count === 0) {
        // 다른 요청이 먼저 처리했거나 이미 승인 완료된 상태 (PENDING_APPROVAL/CONFIRMED 아님)
        throw Object.assign(new Error('이미 처리된 판매이거나 승인 가능한 상태(PENDING_APPROVAL/CONFIRMED)가 아닙니다'), { code: 'CONCURRENT_APPROVAL' });
      }

      // 낙관적 락 성공 → 트랜잭션 진입 전 사전 조회한 metadata 재사용
      const currentMetadata = saleExists.metadata as any;
      const commissionProcessed = currentMetadata?.commissionProcessed || false;

      const updatedSale = { id: saleId, status: 'APPROVED' };

      // 5. 수당 중복 지급 방지: 이미 처리되었으면 스킵
      let commissionBreakdown: { branchCommission: number; salesCommission: number; overrideCommission: number; netRevenue: number } | null = null;
      if (!commissionProcessed) {
        try {
          const ledgerResult = await syncSaleCommissionLedgers(saleId, {
            includeHq: true,
            regenerate: false,
          }, tx);

          commissionBreakdown = ledgerResult.breakdown;

          // commissionProcessed 플래그 업데이트
          await tx.affiliateSale.update({
            where: { id: saleId },
            data: {
              metadata: {
                ...currentMetadata,
                commissionProcessed: true,
                commissionProcessedAt: new Date().toISOString(),
              },
            },
          });

          logger.log(`[Approve Sale] 수당 계산 완료: Sale #${saleId}`);
        } catch (commissionError: unknown) {
          const errMsg = commissionError instanceof Error ? commissionError.message : String(commissionError);
          logger.error(`[Approve Sale] 수당 계산 오류: Sale #${saleId}`, { error: errMsg });
          // 실패 사실을 metadata에 기록 → 어드민이 나중에 감지 가능
          await tx.affiliateSale.update({
            where: { id: saleId },
            data: {
              metadata: {
                ...currentMetadata,
                commissionError: true,
                commissionErrorMessage: errMsg,
                commissionErrorAt: new Date().toISOString(),
              },
            },
          }).catch(() => {}); // metadata 업데이트 실패는 무시 (승인은 완료)
        }
      } else {
        logger.log(`[Approve Sale] Commission already processed for sale ${saleId}, skipping`);
      }

      return { updatedSale, commissionBreakdown };
    });

    const { updatedSale, commissionBreakdown } = result;

    // 6. 알림 전송
    try {
      await notifySaleApproved(saleId);
      logger.log(`[Approve Sale] 알림 전송 완료: Sale #${saleId}`);
    } catch (notificationError: any) {
      logger.error(`[Approve Sale] 알림 전송 오류: Sale #${saleId}`, { error: notificationError instanceof Error ? notificationError.message : String(notificationError) });
      // 알림 실패해도 승인은 완료
    }

    const commissionSummary = commissionBreakdown
      ? {
          branchCommission: commissionBreakdown.branchCommission ?? 0,
          salesCommission: commissionBreakdown.salesCommission ?? 0,
          overrideCommission: commissionBreakdown.overrideCommission ?? 0,
          total:
            (commissionBreakdown.branchCommission ?? 0) +
            (commissionBreakdown.salesCommission ?? 0) +
            (commissionBreakdown.overrideCommission ?? 0),
        }
      : null;

    return NextResponse.json({
      ok: true,
      message: '판매가 승인되었습니다',
      sale: {
        id: updatedSale.id,
        status: updatedSale.status,
      },
      commissionSummary,
    });
  } catch (error: any) {
    if (error?.code === 'CONCURRENT_APPROVAL') {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    logger.error('[Approve Sale] Error:', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { ok: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
