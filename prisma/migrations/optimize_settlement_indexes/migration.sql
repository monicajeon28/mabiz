-- Settlement 및 CommissionLedger 인덱스 최적화
-- 1M 행 쿼리를 2초 이내로 응답하기 위한 복합 인덱스

-- CommissionLedger 최적화 (1M행 조회의 주요 병목)
CREATE INDEX IF NOT EXISTS idx_commission_ledger_profile_settled
  ON "CommissionLedger"("profileId", "isSettled" DESC)
  WHERE "isSettled" = true;

CREATE INDEX IF NOT EXISTS idx_commission_ledger_settlement_settled
  ON "CommissionLedger"("settlementId", "isSettled" DESC)
  WHERE "isSettled" = true;

-- MonthlySettlement 최적화
CREATE INDEX IF NOT EXISTS idx_monthly_settlement_period_status
  ON "MonthlySettlement"("periodStart" DESC, "periodEnd" DESC, "status");

CREATE INDEX IF NOT EXISTS idx_monthly_settlement_status
  ON "MonthlySettlement"("status")
  WHERE status IN ('DRAFT', 'APPROVED', 'LOCKED', 'PAID');

-- 복합 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_settlement_ledger_composite
  ON "CommissionLedger"(
    "profileId",
    "settlementId",
    "isSettled" DESC,
    "amount",
    "withholdingAmount"
  )
  WHERE "isSettled" = true;

-- 통계 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_commission_ledger_aggregate
  ON "CommissionLedger"("isSettled", "amount", "withholdingAmount");
