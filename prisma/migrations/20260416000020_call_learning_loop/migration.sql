-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "personaType" TEXT,
    "rawTextMasked" TEXT NOT NULL,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "durationSec" INTEGER,
    "analysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCallAnalysis" (
    "id" TEXT NOT NULL,
    "callLogId" TEXT NOT NULL,
    "personaDetected" TEXT NOT NULL,
    "personaConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scores" JSONB NOT NULL,
    "keyPhrases" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "objectionTypes" JSONB NOT NULL,
    "goldValueScore" DOUBLE PRECISION,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptPattern" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "personaType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "objectionType" TEXT,
    "patternText" TEXT NOT NULL,
    "exampleCall" TEXT,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiCallAnalysis_callLogId_key" ON "AiCallAnalysis"("callLogId");

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallAnalysis" ADD CONSTRAINT "AiCallAnalysis_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "AiCallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptPattern" ADD CONSTRAINT "ScriptPattern_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
