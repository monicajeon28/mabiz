-- Menu #38 Phase 4 Track 2 Wave 1 — Agent δ
-- CampaignCost 모델 마이그레이션

-- CreateTable CampaignCost
CREATE TABLE "CampaignCost" (
  "id" text NOT NULL PRIMARY KEY,
  "campaignId" text NOT NULL,
  "organizationId" text NOT NULL,

  -- SMS 발송 비용
  "smsSent" integer NOT NULL DEFAULT 0,
  "smsRateCurrent" double precision NOT NULL DEFAULT 0.01,
  "smsCostTotal" double precision NOT NULL DEFAULT 0,

  -- 이메일 발송 비용
  "emailSent" integer NOT NULL DEFAULT 0,
  "emailRateCurrent" double precision NOT NULL DEFAULT 0.001,
  "emailCostTotal" double precision NOT NULL DEFAULT 0,

  -- 성공/실패 분석
  "successCount" integer NOT NULL DEFAULT 0,
  "failureCount" integer NOT NULL DEFAULT 0,
  "costPerSuccess" double precision NOT NULL DEFAULT 0,

  -- ROI
  "estimatedRevenue" double precision NOT NULL DEFAULT 0,
  "estimatedRoi" double precision NOT NULL DEFAULT 0,

  -- 메타데이터
  "actualCostTotal" double precision NOT NULL DEFAULT 0,
  "calculatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,

  CONSTRAINT "CampaignCost_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "CrmMarketingCampaign" ("id") ON DELETE CASCADE,
  CONSTRAINT "CampaignCost_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

-- CreateIndex Unique constraint
CREATE UNIQUE INDEX "CampaignCost_campaignId_key"
  ON "CampaignCost" ("campaignId");

-- CreateIndex Unique constraint for campaign + org
CREATE UNIQUE INDEX "CampaignCost_campaignId_organizationId_key"
  ON "CampaignCost" ("campaignId", "organizationId");

-- CreateIndex for organization queries
CREATE INDEX "CampaignCost_organizationId_createdAt_idx"
  ON "CampaignCost" ("organizationId", "createdAt" DESC);
