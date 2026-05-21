-- CreateTable MabizSyncDLQ
CREATE TABLE "MabizSyncDLQ" (
    "id" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "failureReason" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncType" VARCHAR(50),
    "webhookUrl" TEXT,

    CONSTRAINT "MabizSyncDLQ_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MabizSyncDLQ_resolvedAt_nextRetryAt_idx" ON "MabizSyncDLQ"("resolvedAt", "nextRetryAt");

-- CreateIndex
CREATE INDEX "MabizSyncDLQ_webhookType_idx" ON "MabizSyncDLQ"("webhookType");

-- CreateIndex
CREATE INDEX "MabizSyncDLQ_nextRetryAt_idx" ON "MabizSyncDLQ"("nextRetryAt");

-- CreateIndex
CREATE INDEX "MabizSyncDLQ_resolvedAt_idx" ON "MabizSyncDLQ"("resolvedAt");

-- CreateIndex
CREATE INDEX "MabizSyncDLQ_retryCount_nextRetryAt_idx" ON "MabizSyncDLQ"("retryCount", "nextRetryAt");

-- CreateIndex
CREATE INDEX "MabizSyncDLQ_syncType_idx" ON "MabizSyncDLQ"("syncType");
