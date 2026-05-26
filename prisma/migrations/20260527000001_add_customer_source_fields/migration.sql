-- P0-6: Add customer source classification fields
ALTER TABLE "Contact" ADD COLUMN "sourceType" VARCHAR(30);
ALTER TABLE "Contact" ADD COLUMN "sourceId" VARCHAR(50);
ALTER TABLE "Contact" ADD COLUMN "signupMethod" VARCHAR(20);
ALTER TABLE "Contact" ADD COLUMN "affiliateLinkId" VARCHAR(50);
ALTER TABLE "Contact" ADD COLUMN "affiliateManagerId" VARCHAR(50);
ALTER TABLE "Contact" ADD COLUMN "affiliateAgentId" VARCHAR(50);
ALTER TABLE "Contact" ADD COLUMN "inquiryProductCode" VARCHAR(50);

-- Add indexes
CREATE INDEX "idx_contact_org_source_type" ON "Contact"("organizationId", "sourceType");
CREATE INDEX "idx_contact_org_source_id" ON "Contact"("organizationId", "sourceId");
CREATE INDEX "idx_contact_affiliate_link_id" ON "Contact"("affiliateLinkId");
CREATE INDEX "idx_contact_affiliate_manager_id" ON "Contact"("affiliateManagerId");
CREATE INDEX "idx_contact_affiliate_agent_id" ON "Contact"("affiliateAgentId");
CREATE INDEX "idx_contact_signup_method" ON "Contact"("signupMethod");
