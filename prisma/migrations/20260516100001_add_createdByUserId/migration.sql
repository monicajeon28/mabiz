-- Add createdByUserId to CrmLandingPage
ALTER TABLE "CrmLandingPage" ADD COLUMN "createdByUserId" TEXT;

-- Add index for affiliate sales tracking
CREATE INDEX "CrmLandingPage_org_creator_date_idx" ON "CrmLandingPage"("organizationId", "createdByUserId", "createdAt");

-- Add createdByUserId to CrmPayAppPayment
ALTER TABLE "CrmPayAppPayment" ADD COLUMN "createdByUserId" TEXT;

-- Add index for affiliate sales tracking
CREATE INDEX "CrmPayAppPayment_org_creator_date_idx" ON "CrmPayAppPayment"("organizationId", "createdByUserId", "createdAt");
