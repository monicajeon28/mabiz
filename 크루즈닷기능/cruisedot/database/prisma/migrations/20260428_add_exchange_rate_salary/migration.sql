-- A-4: ExchangeRate + Salary 테이블 추가
-- 목적: 어필리에이트 급여 정산 시 환율 고정 (정산 중 환율 변동 방지)
-- 롤백: DROP TABLE "Salary"; DROP TABLE "ExchangeRate";

BEGIN;

-- ExchangeRate: 월별 환율 고정 테이블
CREATE TABLE "ExchangeRate" (
  "id"        SERIAL PRIMARY KEY,
  "month"     INTEGER NOT NULL,         -- 1~12
  "year"      INTEGER NOT NULL,         -- 2026
  "value"     DECIMAL(10, 4) NOT NULL,  -- 1200.5000
  "source"    TEXT NOT NULL DEFAULT 'BOK',
  "lockedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ExchangeRate_month_year_key" UNIQUE ("month", "year")
);

CREATE INDEX "ExchangeRate_year_month_idx" ON "ExchangeRate"("year", "month");

-- Salary: 어필리에이트 급여 정산 테이블
CREATE TABLE "Salary" (
  "id"               SERIAL PRIMARY KEY,
  "affiliateId"      INTEGER NOT NULL,
  "month"            INTEGER NOT NULL,
  "year"             INTEGER NOT NULL,
  "baseSalesAmount"  BIGINT NOT NULL,
  "refundAmount"     BIGINT NOT NULL DEFAULT 0,
  "exchangeRateId"   INTEGER NOT NULL,
  "commissionRate"   DECIMAL(5, 4) NOT NULL,  -- 0.0330 = 3.3%
  "settlementAmount" BIGINT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|APPROVED|PAID|SETTLED|REFUND_PENDING|ROLLED_BACK
  "paidAt"           TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt"        TIMESTAMPTZ,
  CONSTRAINT "Salary_affiliateId_month_year_key" UNIQUE ("affiliateId", "month", "year"),
  CONSTRAINT "fk_salary_exchange_rate" FOREIGN KEY ("exchangeRateId") REFERENCES "ExchangeRate"("id"),
  CONSTRAINT "fk_salary_affiliate" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("id")
);

CREATE INDEX "Salary_status_createdAt_idx" ON "Salary"("status", "createdAt");
CREATE INDEX "Salary_affiliateId_status_idx" ON "Salary"("affiliateId", "status");
CREATE INDEX "Salary_deletedAt_idx" ON "Salary"("deletedAt");

COMMIT;
