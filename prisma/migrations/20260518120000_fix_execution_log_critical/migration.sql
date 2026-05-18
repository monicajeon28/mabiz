-- migrate SQL
-- Purpose: Fix CRITICAL/HIGH issues from 10-lens review
-- Changes: ExecutionSourceType ENUM, FK CASCADE, nextRetryAt index, executeMonth CHECK, contentUrl validation note

-- 1. Create ExecutionSourceType ENUM
CREATE TYPE "ExecutionSourceType" AS ENUM ('FUNNEL_SEQUENCE', 'AUTOMATION_RULE');

-- 2. Create ExecutionFailureReason ENUM
CREATE TYPE "ExecutionFailureReason" AS ENUM ('QUOTA_EXCEEDED', 'INVALID_CONTACT', 'OPT_OUT', 'SYSTEM_ERROR', 'PROVIDER_ERROR');

-- 3. Create ExecutionStatus ENUM
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'RETRY_SCHEDULED', 'ABANDONED');

-- 4. Create ExecutionLog table with CRITICAL fixes
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceType" "ExecutionSourceType" NOT NULL,
    "executionYear" INTEGER NOT NULL,
    "executeMonth" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" "ExecutionFailureReason",
    "contentUrl" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionLog_executeMonth_format" CHECK ("executeMonth" ~ '^\d{4}-\d{2}$'),
    CONSTRAINT "ExecutionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

-- 5. Create indexes for query performance
CREATE INDEX "ExecutionLog_organizationId_idx" ON "ExecutionLog"("organizationId");
CREATE INDEX "ExecutionLog_contactId_idx" ON "ExecutionLog"("contactId");
CREATE INDEX "ExecutionLog_sourceId_idx" ON "ExecutionLog"("sourceId");
CREATE INDEX "ExecutionLog_sourceType_idx" ON "ExecutionLog"("sourceType");
CREATE INDEX "ExecutionLog_status_idx" ON "ExecutionLog"("status");
CREATE INDEX "ExecutionLog_executeMonth_idx" ON "ExecutionLog"("executeMonth");
CREATE INDEX "ExecutionLog_nextRetryAt_idx" ON "ExecutionLog"("nextRetryAt");
CREATE INDEX "ExecutionLog_createdAt_idx" ON "ExecutionLog"("createdAt");
CREATE INDEX "ExecutionLog_executionYear_executeMonth_idx" ON "ExecutionLog"("executionYear", "executeMonth");

-- NOTE: contentUrl validation (protocol check) must be performed at application level
-- Supported protocols: http://, https://, file:// (validate in service code)
