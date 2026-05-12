-- Add yearMonth column for monthly sales aggregation optimization
-- This enables efficient queries like: WHERE yearMonth = '2026-04'
-- Instead of: WHERE EXTRACT(YEAR FROM createdAt) = 2026 AND EXTRACT(MONTH FROM createdAt) = 4
-- which would require full table scans

ALTER TABLE "AffiliateSale"
ADD COLUMN "yearMonth" CHAR(7);

-- Add indexes for monthly aggregation queries
-- Format: YYYY-MM (e.g., '2026-04')
CREATE INDEX "AffiliateSale_agentId_yearMonth_idx" ON "AffiliateSale"("agentId", "yearMonth");
CREATE INDEX "AffiliateSale_managerId_yearMonth_idx" ON "AffiliateSale"("managerId", "yearMonth");

-- Create migration trigger to auto-populate yearMonth
-- This assumes createdAt is set when AffiliateSale is created
-- For existing records, run: UPDATE "AffiliateSale" SET "yearMonth" = TO_CHAR("createdAt", 'YYYY-MM') WHERE "yearMonth" IS NULL;

-- Note: If you need to backfill existing records, run this separately:
-- UPDATE "AffiliateSale" SET "yearMonth" = TO_CHAR("createdAt", 'YYYY-MM') WHERE "yearMonth" IS NULL;
