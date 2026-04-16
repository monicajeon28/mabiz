-- Contact: 태그 배열 컬럼 추가 (WO-25C)
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS "Contact_tags_idx" ON "Contact" USING GIN("tags");
