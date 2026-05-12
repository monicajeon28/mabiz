import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { calculateMonthlyCommission } from '@/lib/affiliate/commission-calculator';
import { getExchangeRate } from '@/lib/affiliate/exchange-rate';

/**
 * 월별 정산 계산 엔진
 *
 * 1. 해당 월의 모든 판매액 합계
 * 2. 어필리에이트 티어에 따른 수수료 계산
 * 3. 환불/취소 처리
 * 4. 정산 기록 생성 또는 업데이트
 */

interface SettlementCalculation {
  affiliateId: number;
  month: string; // YYYY-MM
  totalSales: number;
  totalCommission: number;
  settlementAmount: number;
  tier: string;
  rate: number;
  exchangeRate: number;
  affiliateName: string;
  email: string;
}

/**
 * 특정 어필리에이트의 월별 정산 계산
 *
 * @param affiliateId 어필리에이트 ID
 * @param year 연도
 * @param month 월 (1-12)
 * @returns 정산 계산 결과
 */
export async function calculateMonthlySettlement(
  affiliateId: number,
  year: number,
  month: number
): Promise<SettlementCalculation | null> {
  try {
    // 1. 어필리에이트 정보 조회
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
      select: {
        displayName: true,
        contactEmail: true,
      },
    });

    if (!affiliate) {
      logger.warn('[Settlement] Affiliate not found', { affiliateId });
      return null;
    }

    // 2. 환율 조회 (실시간 API + 1시간 캐싱)
    const exchangeRate = await getExchangeRate();

    // 3. 월별 수수료 계산 (환율 포함)
    const result = await calculateMonthlyCommission(affiliateId, year, month, exchangeRate);

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    return {
      affiliateId,
      month: monthStr,
      totalSales: result.totalSales,
      totalCommission: result.totalCommission,
      settlementAmount: result.settlementAmount,
      tier: result.tier,
      rate: result.rate,
      exchangeRate,
      affiliateName: affiliate.displayName || '어필리에이트',
      email: affiliate.contactEmail || '',
    };
  } catch (error) {
    logger.error('[Settlement] Calculation failed', {
      affiliateId,
      year,
      month,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * 정산 명세서 생성
 *
 * @param affiliateId 어필리에이트 ID
 * @param year 연도
 * @param month 월 (1-12)
 * @returns 생성된 정산 기록
 */
export async function generateSettlementReport(
  affiliateId: number,
  year: number,
  month: number
) {
  try {
    const calculation = await calculateMonthlySettlement(affiliateId, year, month);

    if (!calculation) {
      logger.warn('[Settlement] Calculation failed', { affiliateId, year, month });
      return null;
    }

    // 기존 정산 기록 확인
    const existing = await prisma.settlement.findUnique({
      where: {
        affiliateId_month: {
          affiliateId,
          month: calculation.month,
        },
      },
    });

    let settlement;

    if (existing) {
      // 업데이트 (재계산)
      settlement = await prisma.settlement.update({
        where: {
          affiliateId_month: {
            affiliateId,
            month: calculation.month,
          },
        },
        data: {
          totalSales: calculation.totalSales,
          totalCommission: calculation.totalCommission,
          paidAmount: calculation.totalCommission, // 기본값: 수수료 전액
        },
      });

      logger.info('[Settlement] Report updated', {
        affiliateId,
        month: calculation.month,
      });
    } else {
      // 신규 생성
      settlement = await prisma.settlement.create({
        data: {
          affiliateId,
          month: calculation.month,
          totalSales: calculation.totalSales,
          totalCommission: calculation.totalCommission,
          paidAmount: calculation.totalCommission,
          status: 'PENDING',
        },
      });

      logger.info('[Settlement] Report created', {
        affiliateId,
        month: calculation.month,
      });
    }

    return settlement;
  } catch (error) {
    logger.error('[Settlement] Report generation failed', {
      affiliateId,
      year,
      month,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

/**
 * 지급 스케줄 설정
 *
 * @param affiliateId 어필리에이트 ID
 * @param amount 지급 금액
 * @param paymentDate 지급 예정일
 */
export async function schedulePayment(
  affiliateId: number,
  amount: number,
  paymentDate: Date
): Promise<boolean> {
  try {
    // 유효성 검증
    if (amount <= 0) {
      logger.warn('[Settlement] Invalid payment amount', { affiliateId, amount });
      return false;
    }

    if (paymentDate < new Date()) {
      logger.warn('[Settlement] Invalid payment date', {
        affiliateId,
        paymentDate,
      });
      return false;
    }

    // 다음 지급일 업데이트
    await prisma.affiliateProfile.update({
      where: { id: affiliateId },
      data: {
        nextPaymentDate: paymentDate,
      },
    });

    logger.info('[Settlement] Payment scheduled', {
      affiliateId,
      amount,
      paymentDate,
    });

    return true;
  } catch (error) {
    logger.error('[Settlement] Payment scheduling failed', {
      affiliateId,
      error: error instanceof Error ? error.message : String(error),
    });

    return false;
  }
}

/**
 * 월별 배치 정산 (모든 어필리에이트)
 * - Cron job에서 매월 1일에 실행
 * - N+1 쿼리 완전 제거: groupBy + 메모리 맵 최적화
 * - Before: 200+ 쿼리 (1 affiliate + 1 exchangeRate + 100 calculateMonthlyCommission + 100 upsert)
 * - After: ~104 쿼리 (1 affiliate + 1 exchangeRate + 1 groupBy + 1 refundMap + 100 upsert)
 *
 * @param year 연도
 * @param month 월 (1-12)
 * @returns 처리된 정산 건수
 */
export async function batchSettleAffiliates(
  year: number,
  month: number
): Promise<number> {
  const startTime = Date.now();
  try {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const monthStart = new Date(`${monthStr}-01T00:00:00Z`);
    const monthEnd = month === 12
      ? new Date(`${year + 1}-01-01T00:00:00Z`)
      : new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00Z`);

    // 1. 모든 활성화된 어필리에이트 배치 조회 (1회 쿼리)
    const affiliates = await prisma.affiliateProfile.findMany({
      where: {
        isActive: true,
        status: { not: 'REJECTED' },
      },
      select: {
        id: true,
        displayName: true,
        contactEmail: true,
        type: true,
      },
    });

    logger.info('[Settlement] Batch process started', {
      year,
      month,
      affiliateCount: affiliates.length,
    });

    if (affiliates.length === 0) {
      logger.info('[Settlement] No active affiliates to process', { year, month });
      return 0;
    }

    // 2. 환율 1회만 조회
    const exchangeRate = await getExchangeRate();

    // 3. 커미션 레이트 (메모리에 저장)
    const commissionRates: Record<string, number> = {
      '신입': 10,
      '주니어': 12,
      '시니어': 15,
      '전문가': 18,
    };

    // ✅ 4. 한 번에 모든 판매액 데이터 조회 (groupBy 최적화 - 1회 쿼리)
    const salesStats = await prisma.affiliateSale.groupBy({
      by: ['affiliateId'],
      where: {
        saleDate: { gte: monthStart, lte: monthEnd },
        status: 'CONFIRMED',
      },
      _sum: { saleAmount: true },
      _count: true,
    });

    // ✅ 5. affiliateId → 판매액 매핑 (메모리 O(1) 접근)
    const salesMap = new Map<number, { totalSales: number; count: number }>();
    salesStats.forEach(stat => {
      if (stat.affiliateId !== null && stat._sum.saleAmount !== null) {
        salesMap.set(stat.affiliateId, {
          totalSales: stat._sum.saleAmount,
          count: stat._count,
        });
      }
    });

    // ✅ 6. 환절된 판매액 조회 (1회 쿼리)
    const refundedSales = await prisma.affiliateSale.findMany({
      where: {
        affiliateId: { in: affiliates.map(a => a.id) },
        refundedAt: { not: null },
        saleDate: { gte: monthStart, lte: monthEnd },
      },
      select: {
        affiliateId: true,
        saleAmount: true,
      },
    });

    // ✅ 7. affiliateId → 환절액 매핑
    const refundMap = new Map<number, number>();
    refundedSales.forEach(sale => {
      if (sale.affiliateId !== null) {
        const current = refundMap.get(sale.affiliateId) || 0;
        refundMap.set(sale.affiliateId, current + sale.saleAmount);
      }
    });

    let processedCount = 0;
    const SETTLEMENT_FEE = 1000;

    // ✅ 8. 루프: 메모리에서만 계산 (쿼리 0회, upsert만 1회/어필리에이트)
    for (const affiliate of affiliates) {
      try {
        const sales = salesMap.get(affiliate.id) || { totalSales: 0, count: 0 };
        const refunded = refundMap.get(affiliate.id) || 0;

        // 실제 정산액 = 판매액 - 환절액 (음수 방지)
        const actualSalesAmount = Math.max(0, sales.totalSales - refunded);

        // 커미션 계산
        const rate = commissionRates[affiliate.type] || 10;
        const totalCommission = Math.floor((actualSalesAmount * rate) / 100);

        // 환율 적용 + 정산 수수료 차감
        const commissionInKRW = totalCommission * exchangeRate;
        const settlementAmount = Math.max(0, Math.floor(commissionInKRW - SETTLEMENT_FEE));

        // ✅ upsert (쿼리 1회/어필리에이트)
        await prisma.settlement.upsert({
          where: {
            affiliateId_month: {
              affiliateId: affiliate.id,
              month: monthStr,
            },
          },
          update: {
            totalSales: actualSalesAmount,
            totalCommission,
            settlementAmount,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
          create: {
            affiliateId: affiliate.id,
            month: monthStr,
            totalSales: actualSalesAmount,
            totalCommission,
            settlementAmount,
            status: 'PENDING',
          },
        });

        processedCount++;

        logger.debug('[Settlement] Processed affiliate', {
          affiliateId: affiliate.id,
          displayName: affiliate.displayName,
          totalSales: actualSalesAmount,
          commission: totalCommission,
          refunded,
        });
      } catch (error: any) {
        logger.error('[Settlement] Individual settlement failed', {
          affiliateId: affiliate.id,
          affiliateName: affiliate.displayName,
          error: error instanceof Error ? error.message : String(error),
        });
        // 개별 실패해도 계속 처리
      }
    }

    const duration = Date.now() - startTime;
    logger.info('[Settlement] Batch process completed', {
      year,
      month,
      processedCount,
      total: affiliates.length,
      duration: `${duration}ms`,
      optimization: 'groupBy + 메모리맵 최적화: 200+ → ~104 쿼리로 48% 개선',
    });

    return processedCount;
  } catch (error) {
    logger.error('[Settlement] Batch process failed', {
      year,
      month,
      error: error instanceof Error ? error.message : String(error),
    });

    return 0;
  }
}

/**
 * 정산 상태 변경 (PENDING → COMPLETED)
 *
 * @param settlementId 정산 ID
 * @param paidAt 지급 시각 (기본값: 현재)
 */
export async function markSettlementAsPaid(
  settlementId: number,
  paidAt?: Date
): Promise<boolean> {
  try {
    await prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'COMPLETED',
        paidAt: paidAt || new Date(),
      },
    });

    logger.info('[Settlement] Marked as paid', {
      settlementId,
      paidAt: paidAt || new Date(),
    });

    return true;
  } catch (error) {
    logger.error('[Settlement] Mark as paid failed', {
      settlementId,
      error: error instanceof Error ? error.message : String(error),
    });

    return false;
  }
}

/**
 * 월별 통계 조회
 *
 * @param year 연도
 * @param month 월 (1-12)
 */
export async function getMonthlyStats(year: number, month: number) {
  try {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const [totalAffiliates, totalSales, totalCommission, paidCount] = await Promise.all([
      prisma.settlement.findMany({
        where: { month: monthStr },
      }).then(s => s.length),
      prisma.settlement.aggregate({
        where: { month: monthStr },
        _sum: { totalSales: true },
      }),
      prisma.settlement.aggregate({
        where: { month: monthStr },
        _sum: { totalCommission: true },
      }),
      prisma.settlement.count({
        where: { month: monthStr, status: 'COMPLETED' },
      }),
    ]);

    return {
      month: monthStr,
      totalAffiliates,
      totalSales: totalSales._sum.totalSales || 0,
      totalCommission: totalCommission._sum.totalCommission || 0,
      paidCount,
      pendingCount: totalAffiliates - paidCount,
    };
  } catch (error) {
    logger.error('[Settlement] Stats retrieval failed', {
      year,
      month,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}
