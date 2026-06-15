-- Phase 5: Russell Brunson 심리학 기반 계약 수정요청 시스템
-- 거래 재협상 및 고객 재참여 자동화

-- ContractModificationRequest 테이블 생성
CREATE TABLE "ContractModificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "requestedByType" TEXT NOT NULL DEFAULT 'AGENT',
    "requestedByName" TEXT,
    "requestedByEmail" TEXT,
    "fieldModifications" JSONB NOT NULL,
    "additionalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "approvedByUserId" TEXT,
    "responseMessage" TEXT,
    "alternativeProposal" JSONB,
    "respondedAt" TIMESTAMP(3),
    "responseIpAddress" TEXT,
    "complexityScore" INTEGER NOT NULL DEFAULT 0,
    "mediation5Steps" JSONB,
    "dealRiskFlag" BOOLEAN NOT NULL DEFAULT false,
    "dealRiskReason" TEXT,
    "dealRiskSuggestedAction" TEXT,
    "lensApplied" TEXT[] DEFAULT ARRAY['L2', 'L6', 'L7', 'L10'],
    "lensDetectionDetails" JSONB,
    "familyMentionDetected" BOOLEAN NOT NULL DEFAULT false,
    "familySuggestion" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "alternativeExpiresAt" TIMESTAMP(3),
    "urgencyMessageGenerated" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "auditLog" JSONB,
    "smsDay0ResendTriggered" BOOLEAN NOT NULL DEFAULT false,
    "contactLensUpdated" BOOLEAN NOT NULL DEFAULT false,
    "riskScoreUpdated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ContractModificationRequest_contractId_fkey"
        FOREIGN KEY ("contractId") REFERENCES "ContractInstance"("id") ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX "ContractModificationRequest_contractId_idx" ON "ContractModificationRequest"("contractId");
CREATE INDEX "ContractModificationRequest_status_idx" ON "ContractModificationRequest"("status");
CREATE INDEX "ContractModificationRequest_expiresAt_idx" ON "ContractModificationRequest"("expiresAt");
CREATE INDEX "ContractModificationRequest_requestedByUserId_idx" ON "ContractModificationRequest"("requestedByUserId");
CREATE INDEX "ContractModificationRequest_approvedByUserId_idx" ON "ContractModificationRequest"("approvedByUserId");
CREATE INDEX "ContractModificationRequest_requestedAt_idx" ON "ContractModificationRequest"("requestedAt");
CREATE INDEX "ContractModificationRequest_contractId_status_expiresAt_idx"
    ON "ContractModificationRequest"("contractId", "status", "expiresAt");
