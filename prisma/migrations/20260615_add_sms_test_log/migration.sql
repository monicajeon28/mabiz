-- CreateTable SmsTestLog
CREATE TABLE "SmsTestLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "variables" JSONB,
  "lens" TEXT,
  "day" INTEGER,
  "sentAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmsTestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsTestLog_organizationId_createdAt_idx" ON "SmsTestLog"("organizationId" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SmsTestLog_userId_createdAt_idx" ON "SmsTestLog"("userId" DESC, "createdAt" DESC);

-- CreateTable SmsPreviewLog
CREATE TABLE "SmsPreviewLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "variables" JSONB,
  "lens" TEXT,
  "day" INTEGER,
  "feedback" TEXT,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmsPreviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsPreviewLog_organizationId_approved_createdAt_idx" ON "SmsPreviewLog"("organizationId" DESC, "approved" DESC, "createdAt" DESC);
