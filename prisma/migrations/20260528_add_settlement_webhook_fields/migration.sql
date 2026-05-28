-- AlterTable Partner: Add Settlement Webhook fields
-- Purpose: Partner Tier auto-evaluation, Churn detection, Settlement notifications
-- Status: Phase 6 - Settlement Webhook Infrastructure

ALTER TABLE "Partner" ADD COLUMN "totalEarnings" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Partner" ADD COLUMN "lastSettlementAt" TIMESTAMP(3);
ALTER TABLE "Partner" ADD COLUMN "tier" VARCHAR(255) NOT NULL DEFAULT 'Bronze';
ALTER TABLE "Partner" ADD COLUMN "churnRiskFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Partner" ADD COLUMN "churnRiskDetectedAt" TIMESTAMP(3);

-- Add indexes for frequently queried fields
CREATE INDEX "Partner_tier_idx" ON "Partner"("tier");
CREATE INDEX "Partner_churnRiskFlag_idx" ON "Partner"("churnRiskFlag");

-- CreateTable SettlementLedger
CREATE TABLE "SettlementLedger" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "settlementId" TEXT NOT NULL,
    "status" VARCHAR(255) NOT NULL DEFAULT 'DRAFT',
    "totalCommission" BIGINT NOT NULL DEFAULT 0,
    "totalWithholding" BIGINT NOT NULL DEFAULT 0,
    "netAmount" BIGINT NOT NULL DEFAULT 0,
    "previousMonthRevenue" BIGINT,
    "churnDetected" BOOLEAN NOT NULL DEFAULT false,
    "smsNotificationSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex SettlementLedger
CREATE UNIQUE INDEX "SettlementLedger_settlementId_key" ON "SettlementLedger"("settlementId");
CREATE UNIQUE INDEX "SettlementLedger_partnerId_period_key" ON "SettlementLedger"("partnerId", "period");
CREATE INDEX "SettlementLedger_partnerId_period_idx" ON "SettlementLedger"("partnerId", "period");
CREATE INDEX "SettlementLedger_status_idx" ON "SettlementLedger"("status");
CREATE INDEX "SettlementLedger_churnDetected_idx" ON "SettlementLedger"("churnDetected");

-- AddForeignKey SettlementLedger
ALTER TABLE "SettlementLedger" ADD CONSTRAINT "SettlementLedger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
