-- Add organizationId to MonthlySettlement for P0-SEC-001 Tenant Isolation
-- Migration: 20260601000001_add_monthly_settlement_org_isolation

-- 1. Add organizationId column to MonthlySettlement
ALTER TABLE "MonthlySettlement"
ADD COLUMN "organizationId" TEXT;

-- 2. Set default organizationId for existing records (to default org)
-- First, check if there's a 'default' organization; if not use the first one
UPDATE "MonthlySettlement"
SET "organizationId" = (
  SELECT id FROM "Organization"
  WHERE slug = 'default'
  LIMIT 1
)
WHERE "organizationId" IS NULL;

-- 3. If no default org found, set to any org (for data consistency)
UPDATE "MonthlySettlement"
SET "organizationId" = (
  SELECT id FROM "Organization"
  LIMIT 1
)
WHERE "organizationId" IS NULL;

-- 4. Make organizationId NOT NULL
ALTER TABLE "MonthlySettlement"
ALTER COLUMN "organizationId" SET NOT NULL;

-- 5. Add foreign key constraint to Organization
ALTER TABLE "MonthlySettlement"
ADD CONSTRAINT "MonthlySettlement_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id") ON DELETE CASCADE;

-- 6. Drop existing unique constraint on periodStart, periodEnd (if exists)
ALTER TABLE "MonthlySettlement"
DROP CONSTRAINT IF EXISTS "MonthlySettlement_periodStart_periodEnd_key";

-- 7. Create composite unique constraint with organizationId
CREATE UNIQUE INDEX "MonthlySettlement_periodStart_periodEnd_organizationId_key"
ON "MonthlySettlement"("periodStart", "periodEnd", "organizationId");

-- 8. Create index for organizationId + status queries
CREATE INDEX "idx_monthly_settlement_org_status"
ON "MonthlySettlement"("organizationId", "status");

-- 9. Update existing indexes
DROP INDEX IF EXISTS "MonthlySettlement_periodStart_periodEnd_idx";
CREATE INDEX "idx_monthly_settlement_period"
ON "MonthlySettlement"("periodStart", "periodEnd");

-- 10. Statistics update for query planner
ANALYZE "MonthlySettlement";
