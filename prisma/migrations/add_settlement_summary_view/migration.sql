-- CreateView for settlement_summary (성능 최적화)
-- 1M 행 <2초 조회를 위한 Materialized View

CREATE OR REPLACE VIEW settlement_summary AS
SELECT
  ms.id                       AS settlement_id,
  ms."periodStart",
  ms."periodEnd",
  ms.status,
  ms."targetRole",
  ms."approvedAt",
  ms."approvedBy",
  ms."lockedAt",
  ms."paymentDate",
  COUNT(cl.id)::integer       AS ledger_count,
  COALESCE(SUM(cl.amount), 0)::bigint AS total_commission,
  COALESCE(SUM(cl."withholdingAmount"), 0)::bigint AS total_withholding,
  COALESCE(
    SUM(cl.amount) - SUM(cl."withholdingAmount"),
    0
  )::bigint AS net_payout,
  ms."createdAt",
  ms."exportUrl"
FROM "MonthlySettlement" ms
LEFT JOIN "CommissionLedger" cl
  ON cl."settlementId" = ms.id
  AND cl."isSettled" = true
GROUP BY
  ms.id,
  ms."periodStart",
  ms."periodEnd",
  ms.status,
  ms."targetRole",
  ms."approvedAt",
  ms."approvedBy",
  ms."lockedAt",
  ms."paymentDate",
  ms."createdAt",
  ms."exportUrl"
ORDER BY ms."periodStart" DESC;

-- 인덱스 (View 조회 성능)
CREATE INDEX IF NOT EXISTS idx_settlement_summary_period
  ON settlement_summary("periodStart" DESC, "periodEnd" DESC);

CREATE INDEX IF NOT EXISTS idx_settlement_summary_status
  ON settlement_summary(status)
  WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlement_summary_target_role
  ON settlement_summary("targetRole")
  WHERE "targetRole" IS NOT NULL;
