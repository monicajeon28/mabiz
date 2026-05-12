-- Rename ProductInquiry table to CruiseProductInquiry
ALTER TABLE "ProductInquiry" RENAME TO "CruiseProductInquiry";

-- Drop existing indexes on the renamed table
DROP INDEX IF EXISTS "ProductInquiry_createdAt_idx";
DROP INDEX IF EXISTS "ProductInquiry_productCode_idx";
DROP INDEX IF EXISTS "ProductInquiry_status_idx";
DROP INDEX IF EXISTS "ProductInquiry_userId_idx";
DROP INDEX IF EXISTS "ProductInquiry_agentId_idx";
DROP INDEX IF EXISTS "ProductInquiry_agentId_status_createdAt_idx";
DROP INDEX IF EXISTS "ProductInquiry_createdByAdminId_idx";
DROP INDEX IF EXISTS "ProductInquiry_createdByProfileId_idx";
DROP INDEX IF EXISTS "ProductInquiry_managerId_idx";
DROP INDEX IF EXISTS "ProductInquiry_managerId_status_createdAt_idx";

-- Add new columns for affiliate tracking
ALTER TABLE "CruiseProductInquiry" ADD COLUMN "email" TEXT;
ALTER TABLE "CruiseProductInquiry" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "CruiseProductInquiry" ADD COLUMN "affiliateCode" TEXT;
ALTER TABLE "CruiseProductInquiry" ADD COLUMN "metadata" JSONB;

-- Make existing non-nullable columns nullable where needed
ALTER TABLE "CruiseProductInquiry" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "CruiseProductInquiry" ALTER COLUMN "phone" DROP NOT NULL;

-- Create new indexes for CruiseProductInquiry
CREATE INDEX "CruiseProductInquiry_productCode_idx" ON "CruiseProductInquiry"("productCode");
CREATE INDEX "CruiseProductInquiry_organizationId_idx" ON "CruiseProductInquiry"("organizationId");
CREATE INDEX "CruiseProductInquiry_affiliateCode_idx" ON "CruiseProductInquiry"("affiliateCode");
CREATE INDEX "CruiseProductInquiry_createdAt_idx" ON "CruiseProductInquiry"("createdAt");
CREATE INDEX "CruiseProductInquiry_organizationId_createdAt_idx" ON "CruiseProductInquiry"("organizationId", "createdAt");
CREATE INDEX "CruiseProductInquiry_userId_idx" ON "CruiseProductInquiry"("userId");
CREATE INDEX "CruiseProductInquiry_agentId_idx" ON "CruiseProductInquiry"("agentId");
CREATE INDEX "CruiseProductInquiry_agentId_status_createdAt_idx" ON "CruiseProductInquiry"("agentId", "status", "createdAt");
CREATE INDEX "CruiseProductInquiry_createdByAdminId_idx" ON "CruiseProductInquiry"("createdByAdminId");
CREATE INDEX "CruiseProductInquiry_createdByProfileId_idx" ON "CruiseProductInquiry"("createdByProfileId");
CREATE INDEX "CruiseProductInquiry_managerId_idx" ON "CruiseProductInquiry"("managerId");
CREATE INDEX "CruiseProductInquiry_managerId_status_createdAt_idx" ON "CruiseProductInquiry"("managerId", "status", "createdAt");
CREATE INDEX "CruiseProductInquiry_status_idx" ON "CruiseProductInquiry"("status");
