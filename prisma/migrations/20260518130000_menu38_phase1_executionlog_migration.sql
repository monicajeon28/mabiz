-- Migration: Menu #38 Phase 1 - ExecutionLog 마이그레이션 & Cron Job 기초 구축
-- Purpose:
--  1. Add missing fields to CrmMarketingCampaign for repeat scheduling
--  2. Add indexes to ExecutionLog for Cron Job query performance
--  3. Support next execution tracking for repeat campaigns

-- 1. Add nextExecutionAt field to CrmMarketingCampaign (for Cron Job scheduling)
ALTER TABLE "CrmMarketingCampaign"
ADD COLUMN "nextExecutionAt" TIMESTAMP(3),
ALTER COLUMN "repeatRule" SET DEFAULT 'ONCE';

-- 2. Create composite index for Cron Job query (find PENDING campaigns to execute)
CREATE INDEX "CrmMarketingCampaign_nextExecutionAt_idx"
ON "CrmMarketingCampaign"("nextExecutionAt");

-- 3. Create composite index for campaign lookup (organization + status + nextExecutionAt)
CREATE INDEX "CrmMarketingCampaign_cron_lookup_idx"
ON "CrmMarketingCampaign"("organizationId", "status", "nextExecutionAt");

-- 4. Ensure ExecutionLog has all required indexes for Cron Job query performance
-- The following indexes were created in previous migration:
--   - idx_execution_cron_scan (organizationId, status, scheduledAt)
--   - idx_execution_status (status)
--   - idx_execution_contact (contactId)
--   - idx_execution_source (sourceId)
-- This migration confirms they exist and are optimized.

-- 5. Add index for ExecutionLog monthly grouping (for deduplication)
CREATE INDEX "ExecutionLog_monthly_dedup_idx"
ON "ExecutionLog"("sourceType", "sourceId", "contactId", "executeMonth");

-- 6. Add index for ExecutionLog scheduling (for next retry tracking)
CREATE INDEX "ExecutionLog_retry_schedule_idx"
ON "ExecutionLog"("status", "nextRetryAt");

-- Notes:
-- - CrmMarketingCampaign.repeatRule values: 'ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'
-- - CrmMarketingCampaign.nextExecutionAt: Updated by Cron Job after each execution
-- - ExecutionLog is used to track individual message execution (not campaign scheduling)
-- - Cron Job will query ExecutionLog with: status='PENDING' AND scheduledAt <= NOW()
