-- Contact: 리드 스코어 컬럼 추가 (WO-25B)
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "leadScore" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Contact_leadScore_idx" ON "Contact"("leadScore");
