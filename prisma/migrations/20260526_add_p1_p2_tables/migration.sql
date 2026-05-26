-- CreateTable "SmsLogEnhanced"
CREATE TABLE "SmsLogEnhanced" (
    "id" TEXT NOT NULL,
    "smsLogId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "variantId" TEXT,
    "contentHash" TEXT,
    "lensType" TEXT,
    "personaType" TEXT,
    "sentFrom" TEXT,
    "conversionAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsLogEnhanced_pkey" PRIMARY KEY ("id")
);

-- CreateTable "EmailLog"
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "campaignId" TEXT,
    "variantId" TEXT,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "bounceReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable "ContactKpi"
CREATE TABLE "ContactKpi" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cpa" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ltv" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable "CampaignStatistics"
CREATE TABLE "CampaignStatistics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cpa" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "roas" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "conversionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "clickRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable "DailyMetrics"
CREATE TABLE "DailyMetrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "smsSent" INTEGER NOT NULL DEFAULT 0,
    "smsOpened" INTEGER NOT NULL DEFAULT 0,
    "smsConverted" INTEGER NOT NULL DEFAULT 0,
    "emailSent" INTEGER NOT NULL DEFAULT 0,
    "emailOpened" INTEGER NOT NULL DEFAULT 0,
    "emailClicked" INTEGER NOT NULL DEFAULT 0,
    "emailConverted" INTEGER NOT NULL DEFAULT 0,
    "landingPageViews" INTEGER NOT NULL DEFAULT 0,
    "landingPageLeads" INTEGER NOT NULL DEFAULT 0,
    "callsMade" INTEGER NOT NULL DEFAULT 0,
    "callsConverted" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "roi" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable "PsychologyLensMetrics"
CREATE TABLE "PsychologyLensMetrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "lensType" TEXT NOT NULL,
    "lensName" TEXT NOT NULL,
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "convertedContacts" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "averageLtv" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "principlesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "monthYear" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PsychologyLensMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsLogEnhanced_smsLogId_key" ON "SmsLogEnhanced"("smsLogId");

-- CreateIndex
CREATE INDEX "SmsLogEnhanced_organizationId_sentAt_idx" ON "SmsLogEnhanced"("organizationId", "sentAt" DESC);

-- CreateIndex
CREATE INDEX "SmsLogEnhanced_campaignId_idx" ON "SmsLogEnhanced"("campaignId");

-- CreateIndex
CREATE INDEX "SmsLogEnhanced_variantId_idx" ON "SmsLogEnhanced"("variantId");

-- CreateIndex
CREATE INDEX "SmsLogEnhanced_lensType_idx" ON "SmsLogEnhanced"("lensType");

-- CreateIndex
CREATE INDEX "SmsLogEnhanced_contentHash_idx" ON "SmsLogEnhanced"("contentHash");

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_sentAt_idx" ON "EmailLog"("organizationId", "sentAt" DESC);

-- CreateIndex
CREATE INDEX "EmailLog_contactId_idx" ON "EmailLog"("contactId");

-- CreateIndex
CREATE INDEX "EmailLog_campaignId_idx" ON "EmailLog"("campaignId");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_openedAt_idx" ON "EmailLog"("openedAt");

-- CreateIndex
CREATE INDEX "EmailLog_clickedAt_idx" ON "EmailLog"("clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactKpi_contactId_key" ON "ContactKpi"("contactId");

-- CreateIndex
CREATE INDEX "ContactKpi_organizationId_idx" ON "ContactKpi"("organizationId");

-- CreateIndex
CREATE INDEX "ContactKpi_riskScore_idx" ON "ContactKpi"("riskScore" DESC);

-- CreateIndex
CREATE INDEX "ContactKpi_engagementScore_idx" ON "ContactKpi"("engagementScore");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignStatistics_campaignId_channel_key" ON "CampaignStatistics"("campaignId", "channel");

-- CreateIndex
CREATE INDEX "CampaignStatistics_organizationId_idx" ON "CampaignStatistics"("organizationId");

-- CreateIndex
CREATE INDEX "CampaignStatistics_campaignId_idx" ON "CampaignStatistics"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignStatistics_channel_idx" ON "CampaignStatistics"("channel");

-- CreateIndex
CREATE INDEX "CampaignStatistics_conversions_idx" ON "CampaignStatistics"("conversions" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetrics_organizationId_metricDate_key" ON "DailyMetrics"("organizationId", "metricDate");

-- CreateIndex
CREATE INDEX "DailyMetrics_organizationId_metricDate_idx" ON "DailyMetrics"("organizationId", "metricDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PsychologyLensMetrics_organizationId_lensType_monthYear_key" ON "PsychologyLensMetrics"("organizationId", "lensType", "monthYear");

-- CreateIndex
CREATE INDEX "PsychologyLensMetrics_organizationId_monthYear_idx" ON "PsychologyLensMetrics"("organizationId", "monthYear" DESC);

-- CreateIndex
CREATE INDEX "PsychologyLensMetrics_lensType_idx" ON "PsychologyLensMetrics"("lensType");

-- CreateIndex
CREATE INDEX "PsychologyLensMetrics_conversionRate_idx" ON "PsychologyLensMetrics"("conversionRate" DESC);

-- AddForeignKey
ALTER TABLE "ContactKpi" ADD CONSTRAINT "ContactKpi_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactKpi" ADD CONSTRAINT "ContactKpi_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMetrics" ADD CONSTRAINT "DailyMetrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "PsychologyLensMetrics" ADD CONSTRAINT "PsychologyLensMetrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE;
