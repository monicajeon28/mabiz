-- Phase 1: Russell Brunson 8가지 형식 + SMS 자동화 (2026-06-15)

-- AlterTable: CrmLandingPage에 pageFormat, ctaType, imageFieldConfig 추가
ALTER TABLE "CrmLandingPage"
ADD COLUMN "pageFormat" VARCHAR(30) NOT NULL DEFAULT 'hybrid',
ADD COLUMN "ctaType" VARCHAR(20) NOT NULL DEFAULT 'default',
ADD COLUMN "imageFieldConfig" JSONB;

-- CreateIndex: Russell Brunson 형식 필터링 성능
CREATE INDEX "idx_crm_landing_page_org_format" ON "CrmLandingPage"("organizationId", "pageFormat");

-- CreateTable: CrmLandingPageSms (SMS 시퀀스 저장)
CREATE TABLE "CrmLandingPageSms" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLandingPageSms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for CrmLandingPageSms
CREATE INDEX "idx_crm_landing_page_sms_page_day" ON "CrmLandingPageSms"("pageId", "day");
CREATE INDEX "idx_crm_landing_page_sms_status" ON "CrmLandingPageSms"("status");

-- AddForeignKey
ALTER TABLE "CrmLandingPageSms" ADD CONSTRAINT "CrmLandingPageSms_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "CrmLandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
