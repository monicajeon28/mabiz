-- Affiliate 배치 정산 성능 최적화 인덱스
-- 작성일: 2026-05-06
-- 목표: 배치 처리 13분 → 5분 이하로 단축 (upsert 최적화 + 인덱스 추가)

-- ============================================
-- 1. AffiliateSale: 월별 판매액 조회 최적화
-- ============================================
-- calculateMonthlyCommission에서 월별 판매액 조회 시 성능 개선
CREATE INDEX IF NOT EXISTS "idx_affiliateSale_createdAt_saleAmount"
ON "AffiliateSale"("createdAt" DESC, "saleAmount");

-- agentId별 판매액 조회 최적화 (향후 agentId 기반 정산)
CREATE INDEX IF NOT EXISTS "idx_affiliateSale_agentId_createdAt"
ON "AffiliateSale"("agentId", "createdAt" DESC);

-- 상태별 판매액 조회
CREATE INDEX IF NOT EXISTS "idx_affiliateSale_status_createdAt_saleAmount"
ON "AffiliateSale"("status", "createdAt" DESC, "saleAmount");

-- 환절된 판매 조회 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliateSale_refundedAt_saleAmount"
ON "AffiliateSale"("refundedAt", "saleAmount");

-- ============================================
-- 2. CommissionLedger: 정산 조회 최적화
-- ============================================
-- 어필리에이트별 미정산 수수료 조회
CREATE INDEX IF NOT EXISTS "idx_commissionLedger_profileId_isSettled_createdAt"
ON "CommissionLedger"("profileId", "isSettled", "createdAt" DESC);

-- 정산별 수수료 조회
CREATE INDEX IF NOT EXISTS "idx_commissionLedger_settlementId_createdAt"
ON "CommissionLedger"("settlementId", "createdAt");

-- ============================================
-- 3. Settlement: 정산 레코드 upsert 최적화
-- ============================================
-- upsert WHERE 절에 사용되는 복합 인덱스 (이미 존재: @@unique([affiliateId, month]))
-- 추가: 상태별 정산 조회
CREATE INDEX IF NOT EXISTS "idx_settlement_status_createdAt"
ON "Settlement"("status", "createdAt" DESC);

-- 월별 통계 조회 최적화
CREATE INDEX IF NOT EXISTS "idx_settlement_month_status"
ON "Settlement"("month", "status");
