-- Migration: Menu #38 Phase 2 - SendingHistory 모델 확장 & DB 업그레이드
-- Purpose:
--   1. SendingHistory 테이블에 캠페인 추적 필드 추가
--   2. 재시도 로직 지원 (retryCount, maxRetries, nextRetryAt)
--   3. 채널별 상태 추적 (emailStatus, smsStatus, 각각의 시간)
--   4. 상호작용 추적 (linkClickedAt, registeredAt, landingPageViewId)
--   5. 메타정보 지원 (metadata JSON)
--   6. CrmMarketingCampaign 통계 필드 추가
--   7. 최적화된 인덱싱 (재시도 스캔, 캠페인 상태 집계)

-- 1. SendingHistory 테이블 확장 (새 필드 추가)
ALTER TABLE "SendingHistory"
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "nextRetryAt" TIMESTAMP(3),
ADD COLUMN "failureMessage" TEXT,
ADD COLUMN "emailStatus" TEXT,
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "emailOpenedAt" TIMESTAMP(3),
ADD COLUMN "smsStatus" TEXT,
ADD COLUMN "smsSentAt" TIMESTAMP(3),
ADD COLUMN "linkClickedAt" TIMESTAMP(3),
ADD COLUMN "registeredAt" TIMESTAMP(3),
ADD COLUMN "landingPageViewId" TEXT,
ADD COLUMN "metadata" JSONB;

-- 2. SendingHistory에 campaignId 외래키 제약조건 추가
ALTER TABLE "SendingHistory"
ADD CONSTRAINT "SendingHistory_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "CrmMarketingCampaign"("id") ON DELETE SET NULL;

-- 3. 인덱스 생성: 재시도 스캔 (Cron Job 쿼리 최적화)
CREATE INDEX CONCURRENTLY "idx_sending_history_retry_scan"
ON "SendingHistory"("status", "nextRetryAt")
WHERE "status" IN ('PENDING', 'RETRY_SCHEDULED')
AND "nextRetryAt" IS NOT NULL;

-- 4. 인덱스 생성: 캠페인별 상태 통계
CREATE INDEX CONCURRENTLY "idx_sending_history_campaign_status"
ON "SendingHistory"("campaignId", "status")
WHERE "campaignId" IS NOT NULL;

-- 5. 인덱스 생성: 고객별 캠페인 발송 이력
CREATE INDEX CONCURRENTLY "idx_sending_history_contact_campaign"
ON "SendingHistory"("contactId", "campaignId")
WHERE "campaignId" IS NOT NULL;

-- 6. 인덱스 생성: 조직별 시간대별 조회 (최신순)
CREATE INDEX CONCURRENTLY "idx_sending_history_org_time"
ON "SendingHistory"("organizationId", "createdAt" DESC);

-- 7. 인덱스 생성: 상태별 재시도 필요 여부
CREATE INDEX CONCURRENTLY "idx_sending_history_status_retry"
ON "SendingHistory"("status", "retryCount")
WHERE "retryCount" < "maxRetries";

-- 8. Unique 제약조건: 중복 방지 (캠페인 + 고객)
-- 주의: 기존 데이터가 있으면 충돌할 수 있으므로 필터링된 unique 사용
ALTER TABLE "SendingHistory"
ADD CONSTRAINT "unique_sending_history_campaign_contact"
UNIQUE ("campaignId", "contactId")
WHERE "campaignId" IS NOT NULL;

-- 9. CrmMarketingCampaign 테이블에 통계 필드 추가
ALTER TABLE "CrmMarketingCampaign"
ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "registeredCount" INTEGER NOT NULL DEFAULT 0;

-- 10. 기존 인덱스 확인 (ExecutionLog에서 CrmMarketingCampaign으로 통계 이관 시)
-- CrmMarketingCampaign 통계 업데이트용 뷰 생성 가능
-- (Phase 3에서 구현 예정)

-- Notes:
-- - SendingStatus: PENDING, SENT, FAILED, SKIPPED, RETRY_SCHEDULED, ABANDONED
-- - SendingFailureReason: INVALID_EMAIL, INVALID_PHONE, OPT_OUT, QUOTA_EXCEEDED, SYSTEM_ERROR, PROVIDER_ERROR, NETWORK_ERROR, BOUNCE
-- - Cron Job 쿼리: SELECT * FROM "SendingHistory" WHERE "status" IN ('PENDING', 'RETRY_SCHEDULED') AND "nextRetryAt" <= NOW() ORDER BY "nextRetryAt"
-- - 캠페인 통계 집계: SELECT "campaignId", COUNT(*), COUNT(CASE WHEN "status"='SENT'), ... FROM "SendingHistory" GROUP BY "campaignId"
