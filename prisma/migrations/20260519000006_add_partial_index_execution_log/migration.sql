-- Phase 3-α: ExecutionLog 성능 최적화
-- 부분 인덱스: Campaign 필터링 성능 + Cron 스캔 성능 개선
-- 참고: CREATE INDEX CONCURRENTLY 사용으로 배포 중 테이블 락 없음

-- 1. 캠페인 필터링 성능 (sourceType='CAMPAIGN' 조회 가속)
-- 사용처: today-stats API, campaign metrics, campaign-specific queries
CREATE INDEX CONCURRENTLY "idx_execution_campaign_partial" ON "ExecutionLog"("organizationId", "status", "scheduledAt")
WHERE "sourceType" = 'CAMPAIGN';

-- 2. Cron 스캔 최적화 (PENDING 상태 조회)
-- 사용처: executePendingCampaigns() 재시도 검색
CREATE INDEX CONCURRENTLY "idx_execution_retry_partial" ON "ExecutionLog"("organizationId", "nextRetryAt", "status")
WHERE "status" = 'RETRY_SCHEDULED' AND "nextRetryAt" IS NOT NULL;

-- 3. Contact 추적성 (contactId + executeMonth)
-- 사용처: Contact별 발송 이력 분석
CREATE INDEX CONCURRENTLY "idx_execution_contact_monthly" ON "ExecutionLog"("contactId", "executeMonth", "status");
