-- AlterTable
ALTER TABLE "BotGuideAnswer" DROP COLUMN IF EXISTS "salesTone",
DROP COLUMN IF EXISTS "keywords",
ADD COLUMN "category" VARCHAR(255) NOT NULL DEFAULT '기타',
ADD COLUMN "type" VARCHAR(255) NOT NULL DEFAULT '상담기록',
ADD COLUMN "salesTone" JSONB NOT NULL DEFAULT '{"primary":"neutral","secondary":[],"confidence":0}',
ADD COLUMN "keywords" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "isActive" SET DEFAULT true,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "BotGuideAnswer_isActive_category_idx" ON "BotGuideAnswer"("isActive", "category");

-- CreateIndex
CREATE INDEX "BotGuideAnswer_category_updatedAt_idx" ON "BotGuideAnswer"("category", "updatedAt");

-- CreateIndex
CREATE INDEX "BotGuideAnswer_key_isActive_idx" ON "BotGuideAnswer"("key", "isActive");
