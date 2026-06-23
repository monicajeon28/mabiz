-- Phase 1: Partner Funnel Wizard - FunnelSms 신규 필드 (10개)
ALTER TABLE "FunnelSms" ADD COLUMN "lensType" VARCHAR(3),
ADD COLUMN "visibility" VARCHAR(10) NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN "createdByRole" VARCHAR(20),
ADD COLUMN "sharedWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "versionNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "parentFunnelId" TEXT,
ADD COLUMN "metadata" JSONB;

-- Phase 1: Partner Funnel Wizard - FunnelSms 인덱스 (3개)
CREATE INDEX "idx_funnel_sms_org_lens_visibility" ON "FunnelSms"("organizationId", "lensType", "visibility");
CREATE INDEX "idx_funnel_sms_org_creator_time" ON "FunnelSms"("organizationId", "createdByUserId", "createdAt" DESC);
CREATE INDEX "idx_funnel_sms_org_risk" ON "FunnelSms"("organizationId", "riskScore");

-- Phase 1: Partner Funnel Wizard - FunnelEmail 신규 필드 (10개)
ALTER TABLE "FunnelEmail" ADD COLUMN "lensType" VARCHAR(3),
ADD COLUMN "visibility" VARCHAR(10) NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN "createdByRole" VARCHAR(20),
ADD COLUMN "sharedWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "versionNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "parentFunnelId" TEXT,
ADD COLUMN "metadata" JSONB;

-- Phase 1: Partner Funnel Wizard - FunnelEmail 인덱스 (3개)
CREATE INDEX "idx_funnel_email_org_lens_visibility" ON "FunnelEmail"("organizationId", "lensType", "visibility");
CREATE INDEX "idx_funnel_email_org_creator_time" ON "FunnelEmail"("organizationId", "createdByUserId", "createdAt" DESC);
CREATE INDEX "idx_funnel_email_org_risk" ON "FunnelEmail"("organizationId", "riskScore");
