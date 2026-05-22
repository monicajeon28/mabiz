-- CreateTable SyncDeadLetterQueue
CREATE TABLE "SyncDeadLetterQueue" (
    "id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL DEFAULT 'NEON_TO_SUPABASE',
    "operationType" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncDeadLetterQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncDeadLetterQueue_status_idx" ON "SyncDeadLetterQueue"("status");

-- CreateIndex
CREATE INDEX "SyncDeadLetterQueue_nextRetryAt_idx" ON "SyncDeadLetterQueue"("nextRetryAt");

-- CreateIndex
CREATE INDEX "SyncDeadLetterQueue_createdAt_idx" ON "SyncDeadLetterQueue"("createdAt");
