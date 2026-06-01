-- Phase 1: Add organizationId column to CommissionLedger
ALTER TABLE "CommissionLedger"
ADD COLUMN "organizationId" TEXT;

-- Phase 2: Make saleId nullable (change from NOT NULL to nullable)
ALTER TABLE "CommissionLedger"
ALTER COLUMN "saleId" DROP NOT NULL;

-- Phase 3: Change saleId type from integer to text (String)
ALTER TABLE "CommissionLedger"
ALTER COLUMN "saleId" TYPE TEXT;

-- Phase 4: Add NOT NULL constraint to organizationId after data migration
-- First, we need to fill organizationId by joining with AffiliateSale
UPDATE "CommissionLedger" cl
SET "organizationId" = (
  SELECT af."organizationId"
  FROM "CrmAffiliateSale" af
  WHERE af.id::text = cl."saleId"
)
WHERE cl."saleId" IS NOT NULL;

-- Phase 5: For entries without saleId (settlement-based), assign a default organization
-- In production, use the appropriate organization ID
UPDATE "CommissionLedger"
SET "organizationId" = (SELECT id FROM "Organization" ORDER BY "createdAt" LIMIT 1)
WHERE "organizationId" IS NULL;

-- Phase 6: Add NOT NULL constraint
ALTER TABLE "CommissionLedger"
ALTER COLUMN "organizationId" SET NOT NULL;

-- Phase 7: Add Foreign Key constraint
ALTER TABLE "CommissionLedger"
ADD CONSTRAINT "CommissionLedger_organizationId_fkey"
FOREIGN KEY ("organizationId")
REFERENCES "Organization"("id")
ON DELETE CASCADE;

-- Phase 8: Add unique constraint for (saleId, organizationId) - only when saleId is NOT NULL
CREATE UNIQUE INDEX "uq_commission_sale_org"
ON "CommissionLedger"("saleId", "organizationId")
WHERE "saleId" IS NOT NULL;

-- Phase 9: Add new composite index for performance (organization + settlement status + date)
CREATE INDEX "idx_commission_org_settled_date"
ON "CommissionLedger"("organizationId", "isSettled", "createdAt" DESC);

-- Phase 10: Drop old indexes that are now redundant (if they exist)
DROP INDEX IF EXISTS "CommissionLedger_profileId_isSettled_idx";

-- Phase 11: Verify data integrity
SELECT
  COUNT(*) as total,
  COUNT(DISTINCT "organizationId") as unique_orgs,
  COUNT(CASE WHEN "organizationId" IS NULL THEN 1 END) as null_orgs,
  COUNT(CASE WHEN "saleId" IS NULL THEN 1 END) as null_sales
FROM "CommissionLedger";
