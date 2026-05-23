import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

export interface CabinRefundResult {
  success: boolean;
  bookedCount?: number;
  previousCount?: number;
  reason?: string;
}

/**
 * 환불 시 객실 재고 감소 처리
 * @param userId - GM 고객 ID (gmReservation.mainUserId)
 * @param organizationId - 테넌트 ID (복합키 검증용)
 * @param tx - Prisma 트랜잭션 클라이언트
 * @returns {success, bookedCount, previousCount, reason}
 */
export async function handleCabinInventoryRefund(
  userId: number,
  organizationId: string,
  tx: Prisma.TransactionClient
): Promise<CabinRefundResult> {
  if (!userId || !organizationId) {
    return {
      success: false,
      reason: 'userId 또는 organizationId 미제공',
    };
  }

  try {
    // ★ 1회 조인으로 최적화: gmReservation.trip 포함
    const reservation = await tx.gmReservation.findFirst({
      where: { mainUserId: userId },
      select: {
        cabinType: true,
        trip: {
          select: { productCode: true },
        },
      },
    });

    if (!reservation) {
      logger.warn('[CabinRefund] GmReservation 미발견', { userId });
      return {
        success: false,
        reason: 'GmReservation을 찾을 수 없음',
      };
    }

    if (!reservation.trip?.productCode) {
      logger.warn('[CabinRefund] Trip productCode 미발견', { userId });
      return {
        success: false,
        reason: 'Trip productCode를 찾을 수 없음',
      };
    }

    // CabinInventory 조회 (organizationId 검증 포함)
    const cabin = await tx.cabinInventory.findUnique({
      where: {
        organizationId_tripCode_cabinType: {
          organizationId,
          tripCode: reservation.trip.productCode,
          cabinType: reservation.cabinType,
        },
      },
    });

    if (!cabin) {
      logger.warn('[CabinRefund] CabinInventory 미발견', {
        organizationId,
        tripCode: reservation.trip.productCode,
        cabinType: reservation.cabinType,
      });
      return {
        success: false,
        reason: 'CabinInventory를 찾을 수 없음',
      };
    }

    // bookedCount가 0 이하면 감소할 수 없음
    if (cabin.bookedCount <= 0) {
      logger.warn('[CabinRefund] bookedCount 이미 0 이하', {
        cabinId: cabin.id,
        cabinType: cabin.cabinType,
        bookedCount: cabin.bookedCount,
      });
      return {
        success: false,
        reason: 'bookedCount가 이미 0 이하',
      };
    }

    const previousCount = cabin.bookedCount;
    const newBookedCount = previousCount - 1;
    // bookedCount < totalCount일 때만 AVAILABLE (SOLD_OUT 상태에서 복구)
    const newStatus = newBookedCount < cabin.totalCount ? 'AVAILABLE' : cabin.status;

    // 객실 재고 업데이트
    await tx.cabinInventory.update({
      where: { id: cabin.id },
      data: {
        bookedCount: newBookedCount,
        status: newStatus,
      },
    });

    logger.log('[CabinRefund] 객실 재고 감소 완료', {
      cabinId: cabin.id,
      cabinType: cabin.cabinType,
      tripCode: reservation.trip.productCode,
      previousCount,
      bookedCount: newBookedCount,
      status: newStatus,
    });

    return {
      success: true,
      bookedCount: newBookedCount,
      previousCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[CabinRefund] 처리 실패', { userId, organizationId, error: msg });
    return {
      success: false,
      reason: msg,
    };
  }
}
