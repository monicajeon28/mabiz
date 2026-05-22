-- CreateTable SyncDeadLetterQueue (IF NOT EXISTS — 이미 생성된 경우 스킵)
CREATE TABLE IF NOT EXISTS "SyncDeadLetterQueue" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncDeadLetterQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS — 중복 방지)
CREATE INDEX IF NOT EXISTS "SyncDeadLetterQueue_status_idx" ON "SyncDeadLetterQueue"("status");
CREATE INDEX IF NOT EXISTS "SyncDeadLetterQueue_nextRetryAt_idx" ON "SyncDeadLetterQueue"("nextRetryAt");
CREATE INDEX IF NOT EXISTS "SyncDeadLetterQueue_createdAt_idx" ON "SyncDeadLetterQueue"("createdAt");
