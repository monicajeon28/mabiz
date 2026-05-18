-- AlterEnum ExecutionFailureReason: 5개 → 8개로 확장
-- Menu #25(자동화) + Menu #38(캠페인) 통합을 위해 SendingFailureReason과 동일하게 확장
ALTER TYPE "ExecutionFailureReason" ADD VALUE 'INVALID_EMAIL';
ALTER TYPE "ExecutionFailureReason" ADD VALUE 'INVALID_PHONE';
ALTER TYPE "ExecutionFailureReason" ADD VALUE 'NETWORK_ERROR';
ALTER TYPE "ExecutionFailureReason" ADD VALUE 'BOUNCE';

-- AlterTable ExecutionLog: 캠페인 발송 지원 + 상호작용 추적
ALTER TABLE "ExecutionLog" ADD COLUMN "campaignId" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "messageId" TEXT,
ADD COLUMN "emailOpenedAt" TIMESTAMP(3),
ADD COLUMN "linkClickedAt" TIMESTAMP(3),
ADD COLUMN "registeredAt" TIMESTAMP(3),
ADD COLUMN "landingPageViewId" TEXT;

-- AddForeignKey ExecutionLog.campaignId -> CrmMarketingCampaign.id
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmMarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: 캠페인 통계 쿼리 성능 (group by status, channel)
CREATE INDEX "idx_execution_campaign_stats" ON "ExecutionLog"("organizationId", "sourceType", "status", "createdAt");

-- CreateIndex: 캠페인별 조회 성능
CREATE INDEX "idx_execution_campaign" ON "ExecutionLog"("campaignId");
