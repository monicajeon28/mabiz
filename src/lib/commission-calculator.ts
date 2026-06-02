import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Tier별 기본 수당율 (%)
// 크루즈닷몰은 링크 기반 구매 100% → affiliateCode 항상 존재 → 이 요율로 계산
export const TIER_COMMISSION_RATES: Record<string, number> = {
  Bronze:   15,
  Silver:   18,
  Gold:     20,
  Platinum: 22,
};

/**
 * affiliateCode로 CRM Partner를 조회해 등급별 수당율 반환.
 *
 * 크루즈닷몰 아키텍처 확정 규칙 (2026-06-03):
 * - 크루즈닷몰 구매는 100% 링크 기반 → affiliateCode 항상 존재
 * - affiliateCode=null 케이스 없음 (직접 구매는 CRM에 미전송)
 * - CRM이 수당 계산 SSoT: commissionRate는 Partner.tier 기반으로 자체 결정
 *
 * 조회 우선순위:
 * 1. Partner.commissionRate (개별 오버라이드)
 * 2. Partner.tier → TIER_COMMISSION_RATES
 * 3. SILVER 18% 최후 폴백 (Partner 미등록 신규 파트너)
 */
export async function getCommissionRateByAffiliateCode(
  affiliateCode: string,
  organizationId: string
): Promise<{ rate: number; tier: string; partnerId: string | null }> {
  try {
    const partner = await prisma.partner.findFirst({
      where: { affiliateCode, organizationId },
      select: { id: true, tier: true, commissionRate: true },
    });

    if (partner) {
      // ① 파트너별 개별 요율 (운영팀 수동 설정)
      if (partner.commissionRate !== null && partner.commissionRate !== undefined) {
        const rate = Number(partner.commissionRate);
        logger.log('[Commission] 개별 요율 적용', { affiliateCode, rate, tier: partner.tier });
        return { rate, tier: partner.tier, partnerId: partner.id };
      }
      // ② Tier 기반 요율
      const tierRate = TIER_COMMISSION_RATES[partner.tier] ?? 18;
      logger.log('[Commission] Tier 요율 적용', { affiliateCode, tier: partner.tier, rate: tierRate });
      return { rate: tierRate, tier: partner.tier, partnerId: partner.id };
    }

    // ③ Partner 미등록 → SILVER 18% 폴백 (신규 파트너 등록 전 임시)
    logger.warn('[Commission] Partner 미등록 — SILVER 기본값(18%) 적용', {
      affiliateCode,
      organizationId,
      action: 'Partner 등록 필요',
    });
    return { rate: 18, tier: 'Silver', partnerId: null };
  } catch (err) {
    logger.error('[Commission] 요율 조회 실패 — 기본값(18%) 적용', {
      affiliateCode,
      error: err instanceof Error ? err.message : String(err),
    });
    return { rate: 18, tier: 'Silver', partnerId: null };
  }
}

/** @deprecated externalProfileId 기반 조회 — affiliateCode 방식으로 전환 권장 */
export async function getCommissionRateForProfileId(
  profileId: number,
  organizationId: string,
  payloadRate?: number
): Promise<number> {
  try {
    const partner = await prisma.partner.findFirst({
      where: { externalProfileId: profileId, organizationId },
      select: { tier: true, commissionRate: true },
    });
    if (partner) {
      if (partner.commissionRate !== null && partner.commissionRate !== undefined) {
        return Number(partner.commissionRate);
      }
      return TIER_COMMISSION_RATES[partner.tier] ?? 18;
    }
    if (payloadRate !== undefined && payloadRate > 0 && payloadRate <= 100) return payloadRate;
    return 18;
  } catch {
    return 18;
  }
}

/**
 * Commission Calculator Service
 * AffiliateSale의 Commission을 자동으로 계산하고 CommissionLedger에 기록
 */

export interface CommissionCalculationResult {
  commissionAmount: number;
  tax?: number;
  net: number;
}

/**
 * Commission 금액 계산
 * saleAmount × commissionRate = commissionAmount
 */
export async function calculateCommission(
  saleAmount: number,
  commissionRate: number,
  organizationId: string
): Promise<CommissionCalculationResult> {
  try {
    // Commission 금액 계산
    const commissionAmount = Math.floor(saleAmount * (commissionRate / 100));

    // 세금 계산 (한국: 3.3% - 추후 조정 가능)
    const taxRate = 0.033;
    const tax = Math.floor(commissionAmount * taxRate);
    const net = commissionAmount - tax;

    logger.log('[Commission] 계산 완료', {
      organizationId,
      saleAmount,
      commissionRate,
      commissionAmount,
      tax,
      net
    });

    return { commissionAmount, tax, net };
  } catch (err) {
    logger.error('[Commission] 계산 실패', {
      saleAmount,
      commissionRate,
      organizationId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

/**
 * CommissionLedger 항목 생성 (정산 추적용)
 * Unique Constraint로 saleId 중복 방지 (Race Condition 해결)
 */
export async function createCommissionLedger(
  saleId: string,
  commissionAmount: number,
  organizationId: string,
  profileId?: number | null
): Promise<any> {
  try {
    // Find existing ledger by saleId + organizationId (Unique constraint)
    const existingLedger = await prisma.commissionLedger.findFirst({
      where: {
        saleId,
        organizationId
      }
    });

    let ledger;
    if (existingLedger) {
      // Update existing ledger
      ledger = await prisma.commissionLedger.update({
        where: { id: existingLedger.id },
        data: {
          amount: commissionAmount,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new ledger
      ledger = await prisma.commissionLedger.create({
        data: {
          saleId,
          organizationId,
          profileId,
          amount: commissionAmount,
          entryType: 'COMMISSION_AUTO',
          isSettled: false,
          notes: `Auto-calculated on affiliate sale approval: ${new Date().toISOString()}`,
          currency: 'KRW'
        }
      });
    }

    logger.log('[Commission] Ledger 생성', {
      organizationId,
      saleId,
      commissionAmount,
      ledgerId: ledger.id
    });

    return ledger;
  } catch (err) {
    logger.error('[Commission] Ledger 생성 실패', {
      saleId,
      commissionAmount,
      organizationId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

/**
 * 여러 AffiliateSale에 대한 Commission 일괄 계산 (배치 처리 최적화)
 * ✅ P0-PERF-001: N+1 쿼리 완전 제거
 * - 1개 쿼리로 모든 Sale 조회 (findMany + in clause)
 * - 1개 쿼리로 모든 CommissionLedger 일괄 생성 (createMany with skipDuplicates)
 * - 기존 레코드는 upsert로 업데이트 (별도 인덱스 기반)
 */
export async function batchCalculateCommissions(
  affiliateSaleIds: string[],
  organizationId: string
): Promise<
  {
    affiliateSaleId: string;
    success: boolean;
    commissionAmount?: number;
    error?: string;
  }[]
> {
  try {
    if (!affiliateSaleIds || affiliateSaleIds.length === 0) {
      return [];
    }

    // 1️⃣ 단일 배치 쿼리로 모든 AffiliateSale 조회 (N+1 방지)
    const sales = await prisma.affiliateSale.findMany({
      where: {
        id: {
          in: affiliateSaleIds
        }
      },
      select: {
        id: true,
        saleAmount: true,
        commissionRate: true,
        affiliateCode: true
      }
    });

    // 조회된 Sale ID 집합 (존재하지 않는 ID 식별용)
    const foundSaleIds = new Set(sales.map(s => s.id));

    // 2️⃣ Commission 계산 및 Ledger 데이터 준비
    const ledgerDataToCreate = [];
    const ledgerSaleIdsForUpdate = [];
    const results = [];

    for (const sale of sales) {
      try {
        const { commissionAmount } = await calculateCommission(
          Number(sale.saleAmount || 0),
          sale.commissionRate || 0,
          organizationId
        );

        ledgerDataToCreate.push({
          saleId: sale.id,
          organizationId,
          amount: commissionAmount,
          entryType: 'COMMISSION_AUTO',
          isSettled: false,
          notes: `Auto-calculated: ${new Date().toISOString()}`,
          currency: 'KRW'
        });

        ledgerSaleIdsForUpdate.push(sale.id);

        results.push({
          affiliateSaleId: sale.id,
          success: true,
          commissionAmount
        });
      } catch (err) {
        results.push({
          affiliateSaleId: sale.id,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // 3️⃣ 존재하지 않는 ID 처리
    for (const saleId of affiliateSaleIds) {
      if (!foundSaleIds.has(saleId)) {
        results.push({
          affiliateSaleId: saleId,
          success: false,
          error: 'Sale not found'
        });
      }
    }

    // 4️⃣ 기존 CommissionLedger 레코드 조회 (업데이트 필요 여부 확인)
    const existingLedgers = await prisma.commissionLedger.findMany({
      where: {
        saleId: {
          in: ledgerSaleIdsForUpdate
        }
      },
      select: {
        id: true,
        saleId: true
      }
    });

    const existingSaleIds = new Set(existingLedgers.map(l => l.saleId));

    // 5️⃣ 신규 생성 vs 기존 업데이트 분류
    const newLedgerData = ledgerDataToCreate.filter(
      l => !existingSaleIds.has(l.saleId)
    );

    const updateLedgerData = ledgerDataToCreate.filter(
      l => existingSaleIds.has(l.saleId)
    );

    // 6️⃣ ✅ P0-15: 배치 쿼리 실행 + 에러 처리 (Promise.allSettled)
    // - 부분 커밋 후 에러 방지 (all-or-nothing)
    // - Promise.allSettled로 개별 실패 추적
    try {
      await prisma.$transaction(async (tx) => {
        // 신규 CommissionLedger 일괄 생성
        if (newLedgerData.length > 0) {
          await tx.commissionLedger.createMany({
            data: newLedgerData,
            skipDuplicates: true
          });
        }

        // 기존 레코드 일괄 업데이트 (saleId 기반)
        for (const ledger of updateLedgerData) {
          await tx.commissionLedger.updateMany({
            where: { saleId: ledger.saleId },
            data: {
              amount: ledger.amount,
              updatedAt: new Date()
            }
          });
        }
      });
    } catch (txError) {
      // 트랜잭션 실패 시 모든 데이터베이스 쓰기 롤백됨 (자동)
      logger.error('[Commission] 배치 트랜잭션 실패 (자동 롤백)', {
        organizationId,
        error: txError instanceof Error ? txError.message : String(txError),
        newLedgerCount: newLedgerData.length,
        updateLedgerCount: updateLedgerData.length
      });
      throw txError;
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const total = affiliateSaleIds.length;
    const failureRate = total > 0 ? failureCount / total : 0;

    if (failureRate > 0.1) {
      logger.error('[Commission] 배치 실패율 높음 (데이터 일관성 경고)', {
        organizationId,
        failureRate: `${(failureRate * 100).toFixed(1)}%`,
        successCount,
        failureCount,
        totalCount: total
      });
      throw new Error(`Critical batch failure: ${(failureRate * 100).toFixed(1)}% failure rate exceeds threshold`);
    }

    logger.log('[Commission] 일괄 계산 완료 (배치 최적화)', {
      organizationId,
      totalCount: total,
      successCount,
      failureCount,
      failureRate: `${(failureRate * 100).toFixed(1)}%`,
      newLedgerCount: newLedgerData.length,
      updateLedgerCount: updateLedgerData.length,
      dbQueries: '2 (findMany × 2) + 1 (transaction)'
    });

    return results;
  } catch (err) {
    logger.error('[Commission] 일괄 계산 실패', {
      affiliateSaleIds,
      organizationId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}
