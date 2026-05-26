-- CreateTable CrmMarketingMessage
CREATE TABLE "CrmMarketingMessage" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "sentTime" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "psychologyLenses" TEXT[],
    "ctaUrl" TEXT,
    "ctaButtonText" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickTime" TIMESTAMP(3),
    "conversionTime" TIMESTAMP(3),
    "abTestGroup" TEXT,
    "expectedResponseRate" DOUBLE PRECISION,
    "actualResponseTime" INTEGER,
    "metadata" JSONB,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmMarketingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmMarketingMessage_contactId_idx" ON "CrmMarketingMessage"("contactId");

-- CreateIndex
CREATE INDEX "CrmMarketingMessage_organizationId_idx" ON "CrmMarketingMessage"("organizationId");

-- CreateIndex
CREATE INDEX "CrmMarketingMessage_templateId_idx" ON "CrmMarketingMessage"("templateId");

-- CreateIndex
CREATE INDEX "CrmMarketingMessage_segment_idx" ON "CrmMarketingMessage"("segment");

-- CreateIndex
CREATE INDEX "CrmMarketingMessage_status_idx" ON "CrmMarketingMessage"("status");

-- CreateIndex
CREATE INDEX "CrmMarketingMessage_scheduledTime_idx" ON "CrmMarketingMessage"("scheduledTime");

-- CreateIndex
CREATE INDEX "CrmMarketingMessage_organizationId_status_scheduledTime_idx" ON "CrmMarketingMessage"("organizationId", "status", "scheduledTime");

-- AddForeignKey
ALTER TABLE "CrmMarketingMessage" ADD CONSTRAINT "CrmMarketingMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmMarketingMessage" ADD CONSTRAINT "CrmMarketingMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
