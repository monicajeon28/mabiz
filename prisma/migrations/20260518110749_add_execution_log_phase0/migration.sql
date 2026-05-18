-- CreateEnum ExecutionFailureReason
CREATE TYPE "ExecutionFailureReason" AS ENUM ('QUOTA_EXCEEDED', 'INVALID_CONTACT', 'OPT_OUT', 'SYSTEM_ERROR', 'PROVIDER_ERROR');

-- CreateEnum ExecutionStatus
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'RETRY_SCHEDULED', 'ABANDONED');

-- CreateTable ExecutionLog
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "executeMonth" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "contentUrl" TEXT,
    "failureReason" "ExecutionFailureReason",
    "failureUserMsg" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex ExecutionLog_sourceType_sourceId_contactId_executeMonth_key
CREATE UNIQUE INDEX "ExecutionLog_sourceType_sourceId_contactId_executeMonth_key" ON "ExecutionLog"("sourceType", "sourceId", "contactId", "executeMonth");

-- CreateIndex ExecutionLog_organizationId_status_scheduledAt_idx
CREATE INDEX "ExecutionLog_organizationId_status_scheduledAt_idx" ON "ExecutionLog"("organizationId", "status", "scheduledAt");

-- CreateIndex ExecutionLog_status_idx
CREATE INDEX "ExecutionLog_status_idx" ON "ExecutionLog"("status");

-- CreateIndex ExecutionLog_contactId_idx
CREATE INDEX "ExecutionLog_contactId_idx" ON "ExecutionLog"("contactId");

-- CreateIndex ExecutionLog_sourceId_idx
CREATE INDEX "ExecutionLog_sourceId_idx" ON "ExecutionLog"("sourceId");
