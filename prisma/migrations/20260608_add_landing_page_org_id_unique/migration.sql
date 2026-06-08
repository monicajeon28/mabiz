-- Add composite unique constraint for CrmLandingPage (IDOR security fix)
-- Ensures that a landing page ID is unique only within its organization
ALTER TABLE "CrmLandingPage" ADD CONSTRAINT "CrmLandingPage_organizationId_id_unique" UNIQUE ("organizationId", "id");

-- Add composite unique constraint for B2BLandingPage (IDOR security fix)
-- Ensures that a landing page ID is unique only within its organization
ALTER TABLE "CrmB2BLandingPage" ADD CONSTRAINT "CrmB2BLandingPage_organizationId_id_unique" UNIQUE ("organizationId", "id");
