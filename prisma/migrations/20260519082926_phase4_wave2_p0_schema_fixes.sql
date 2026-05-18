-- Phase 4 Wave 2: Schema P0 Fixes
-- P0 #1: SendingHistory onDelete consistency (onDelete: SetNull → Restrict)
-- P0 #2: Float → Decimal for financial precision in CampaignCost
-- P0 #3: Organization FK already exists, confirmed in relation

-- ============================================================================
-- P0 #1: Fix SendingHistory campaign relationship
-- ============================================================================
-- Change onDelete from SetNull to Restrict
-- This prevents accidental data loss when deleting a campaign that has associated SendingHistory records

ALTER TABLE SendingHistory
DROP FOREIGN KEY SendingHistory_campaignId_fkey;

ALTER TABLE SendingHistory
ADD CONSTRAINT SendingHistory_campaignId_fkey
  FOREIGN KEY (campaignId) REFERENCES CrmMarketingCampaign(id) ON DELETE RESTRICT;

-- ============================================================================
-- P0 #2: Convert Float to Decimal for financial precision
-- ============================================================================
-- CampaignCost: SMS/Email costs must use Decimal for accurate financial calculations

ALTER TABLE CampaignCost
MODIFY COLUMN smsRateCurrent DECIMAL(10, 2) NOT NULL DEFAULT 0.01;

ALTER TABLE CampaignCost
MODIFY COLUMN smsCostTotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE CampaignCost
MODIFY COLUMN emailRateCurrent DECIMAL(10, 4) NOT NULL DEFAULT 0.001;

ALTER TABLE CampaignCost
MODIFY COLUMN emailCostTotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE CampaignCost
MODIFY COLUMN costPerSuccess DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE CampaignCost
MODIFY COLUMN estimatedRevenue DECIMAL(15, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE CampaignCost
MODIFY COLUMN estimatedRoi DECIMAL(7, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE CampaignCost
MODIFY COLUMN actualCostTotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- ============================================================================
-- P0 #3: Organization FK already confirmed in CampaignCost relation
-- ============================================================================
-- CampaignCost already has proper FK constraints:
-- - campaign        CrmMarketingCampaign @relation(..., onDelete: Cascade) ✓
-- - organization    Organization @relation(..., onDelete: Cascade) ✓
-- No additional changes needed.
