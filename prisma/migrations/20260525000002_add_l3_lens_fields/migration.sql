-- L3 렌즈: 차별성 미인지형 고객 필드 추가 (Menu #49)

-- Contact 테이블에 L3 렌즈 필드 추가
ALTER TABLE "Contact"
ADD COLUMN IF NOT EXISTS "competitorMentioned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "competitorNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "lastCompetitorMentionAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "lastCompetitorName" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "differentiationScore" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "hotelExperienceLevel" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "preparationFrameworkLevel" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "differentiationResponseSent" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "lastDifferentiationResponseAt" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "comparisonDocumentId" TEXT,
ADD COLUMN IF NOT EXISTS "differentiationSequenceStartedAt" TIMESTAMP;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_contact_competitor_mentioned" ON "Contact"("organizationId", "competitorMentioned");
CREATE INDEX IF NOT EXISTS "idx_contact_differentiation_score" ON "Contact"("organizationId", "differentiationScore");
CREATE INDEX IF NOT EXISTS "idx_contact_last_competitor_mention" ON "Contact"("organizationId", "lastCompetitorMentionAt");
