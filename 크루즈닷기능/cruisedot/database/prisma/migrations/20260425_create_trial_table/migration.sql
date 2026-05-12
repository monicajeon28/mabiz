-- CreateTable Trial
CREATE TABLE "Trial" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "consentedAt" TIMESTAMP(3),
  "consentVersion" TEXT DEFAULT '1.0',
  "dataDeletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Trial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Trial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- CreateTable TrialAuditLog
CREATE TABLE "TrialAuditLog" (
  "id" SERIAL NOT NULL,
  "trialId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "previousState" JSONB,
  "newState" JSONB,
  "performedBy" INTEGER,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrialAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrialAuditLog_trialId_fkey" FOREIGN KEY ("trialId") REFERENCES "Trial"("id") ON DELETE CASCADE
);

-- CreateIndex Trial.userId
CREATE UNIQUE INDEX "Trial_userId_key" ON "Trial"("userId");

-- CreateIndex Trial.code
CREATE UNIQUE INDEX "Trial_code_key" ON "Trial"("code");

-- CreateIndex Trial.status_expiresAt
CREATE INDEX "Trial_status_expiresAt_idx" ON "Trial"("status", "expiresAt");

-- CreateIndex Trial.startedAt
CREATE INDEX "Trial_startedAt_idx" ON "Trial"("startedAt");

-- CreateIndex TrialAuditLog.trialId_performedAt
CREATE INDEX "TrialAuditLog_trialId_performedAt_idx" ON "TrialAuditLog"("trialId", "performedAt");

-- CreateIndex TrialAuditLog.action_performedAt
CREATE INDEX "TrialAuditLog_action_performedAt_idx" ON "TrialAuditLog"("action", "performedAt");

-- AddColumn User.trial (이미 생성됨)
