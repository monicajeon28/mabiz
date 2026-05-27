-- CreateTable: WebhookEvent
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "webhookType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processingStartAt" TIMESTAMP(3),
    "processingEndAt" TIMESTAMP(3),
    "executionTimeMs" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
CREATE INDEX "WebhookEvent_organizationId_status_createdAt_idx" ON "WebhookEvent"("organizationId", "status", "createdAt");
CREATE INDEX "WebhookEvent_organizationId_webhookType_createdAt_idx" ON "WebhookEvent"("organizationId", "webhookType", "createdAt");
CREATE INDEX "idx_webhook_retry_partial" ON "WebhookEvent"("organizationId", "nextRetryAt", "status");
CREATE INDEX "WebhookEvent_eventId_idx" ON "WebhookEvent"("eventId");

-- CreateTable: WebhookLog
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "handlerName" TEXT NOT NULL,
    "errorMessage" TEXT,
    "responseBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookLog_webhookEventId_attemptNumber_idx" ON "WebhookLog"("webhookEventId", "attemptNumber");
CREATE INDEX "WebhookLog_webhookEventId_status_idx" ON "WebhookLog"("webhookEventId", "status");
CREATE INDEX "WebhookLog_status_createdAt_idx" ON "WebhookLog"("status", "createdAt");

-- CreateTable: RetryQueue
CREATE TABLE "RetryQueue" (
    "id" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "backoffFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "baseDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetryQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetryQueue_webhookEventId_key" ON "RetryQueue"("webhookEventId");
CREATE INDEX "RetryQueue_status_scheduledFor_priority_idx" ON "RetryQueue"("status", "scheduledFor", "priority");
CREATE INDEX "RetryQueue_lockedBy_lockedUntil_idx" ON "RetryQueue"("lockedBy", "lockedUntil");
CREATE INDEX "RetryQueue_priority_scheduledFor_idx" ON "RetryQueue"("priority", "scheduledFor");

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetryQueue" ADD CONSTRAINT "RetryQueue_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
