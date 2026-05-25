-- Menu #54: L1 렌즈 (가격 이의) 최적화 모델 생성

-- L1PriceObjectionAttempt: 가격 이의 대응 기록
CREATE TABLE "L1PriceObjectionAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "objectiveType" VARCHAR(50) NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "initialResponse" TEXT,
    "responseMethod" VARCHAR(50) NOT NULL,
    "smsVariant" VARCHAR(10) NOT NULL,
    "conversionResult" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    CONSTRAINT "L1PriceObjectionAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

-- L1PriceObjectionAttempt 인덱스
CREATE INDEX "L1PriceObjectionAttempt_organizationId_contactId_sentAt_idx" ON "L1PriceObjectionAttempt"("organizationId", "contactId", "sentAt");
CREATE INDEX "L1PriceObjectionAttempt_objectiveType_responseMethod_conversionResult_idx" ON "L1PriceObjectionAttempt"("objectiveType", "responseMethod", "conversionResult");

-- L1ABTestVariant: A/B 테스트 변형
CREATE TABLE "L1ABTestVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "objectiveType" VARCHAR(50) NOT NULL,
    "variantType" VARCHAR(10) NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "copyAngle" VARCHAR(100) NOT NULL,
    "psychologyLens" VARCHAR(50) NOT NULL,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalConverted" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseTime" INTEGER,
    "winningSince" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "L1ABTestVariant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

-- L1ABTestVariant 인덱스
CREATE UNIQUE INDEX "L1ABTestVariant_organizationId_objectiveType_variantType_key" ON "L1ABTestVariant"("organizationId", "objectiveType", "variantType");
CREATE INDEX "L1ABTestVariant_organizationId_conversionRate_idx" ON "L1ABTestVariant"("organizationId", "conversionRate" DESC);

-- L1OptimizationScore: Contact별 최적화 점수
CREATE TABLE "L1OptimizationScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreHistory" JSONB,
    "objectiveTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bestVariant" VARCHAR(10),
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "L1OptimizationScore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

-- L1OptimizationScore 인덱스
CREATE UNIQUE INDEX "L1OptimizationScore_organizationId_contactId_key" ON "L1OptimizationScore"("organizationId", "contactId");
CREATE INDEX "L1OptimizationScore_organizationId_currentScore_idx" ON "L1OptimizationScore"("organizationId", "currentScore" DESC);
