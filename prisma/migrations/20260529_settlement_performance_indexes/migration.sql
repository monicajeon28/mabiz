-- Settlement Analyzer Performance Optimization - Loop 6-A
-- Migration: 20260529_settlement_performance_indexes
-- Purpose: Add 3 composite indexes to optimize 1M+ row queries for <2s performance

-- 1. Index for Partner + Settled Status + Date (Partner Details query)
-- Usage: GET /api/settlements/partner/:id
-- Expected speedup: 5-10s → 100-200ms (-97%)
CREATE INDEX CONCURRENTLY idx_commission_ledger_partner_settled_date
ON "CommissionLedger"("profileId", "isSettled", "createdAt" DESC)
INCLUDE ("amount", "withholdingAmount", "settlementId");

-- 2. Index for Settlement Period + Status (Monthly Summary)
-- Usage: GET /api/settlements/summary - status distribution query
-- Expected speedup: 3s → 150ms (-95%)
CREATE INDEX CONCURRENTLY idx_settlement_period_status_ledger
ON "MonthlySettlement"("periodStart" DESC, "status")
INCLUDE ("id", "approvedAt", "paymentDate");

-- 3. Partial Index for Settled Records Only (Materialized View + Summary)
-- Usage: Historical data analysis (settled=true is most common query)
-- Expected speedup: 2-3s → 80ms for settled records (-96%)
CREATE INDEX CONCURRENTLY idx_commission_ledger_settled_only
ON "CommissionLedger"("profileId", "createdAt" DESC)
WHERE "isSettled" = true
INCLUDE ("amount", "withholdingAmount", "settlementId");

-- Statistics update for query planner
ANALYZE "CommissionLedger";
ANALYZE "MonthlySettlement";
