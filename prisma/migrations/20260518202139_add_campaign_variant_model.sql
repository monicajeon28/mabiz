-- CreateTable CampaignVariant
CREATE TABLE "CampaignVariant" (
  "id" text NOT NULL PRIMARY KEY,
  "campaignId" text NOT NULL,
  "variantKey" text NOT NULL,
  "smsBody" text,
  "emailSubject" text,
  "emailBody" text,
  "trafficSplit" double precision NOT NULL DEFAULT 0.5,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "CampaignVariant_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "CrmMarketingCampaign" ("id") ON DELETE RESTRICT
);

-- CreateIndex for Unique constraint (CONCURRENTLY for zero-downtime)
CREATE UNIQUE INDEX "CampaignVariant_campaignId_variantKey_key"
  ON "CampaignVariant" ("campaignId", "variantKey");

-- CreateIndex for filtering (CONCURRENTLY)
CREATE INDEX CONCURRENTLY "CampaignVariant_campaignId_isActive_idx"
  ON "CampaignVariant" ("campaignId", "isActive");

-- AddColumn variantKey to SendingHistory
ALTER TABLE "SendingHistory" ADD COLUMN "variantKey" text;

-- CreateIndex for variantKey queries (CONCURRENTLY)
CREATE INDEX CONCURRENTLY "SendingHistory_variantKey_status_idx"
  ON "SendingHistory" ("variantKey", "status");
