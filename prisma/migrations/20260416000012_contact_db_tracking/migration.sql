-- Contact: DB 전달 추적 컬럼 추가 (WO-28)
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "freeSalesId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "sourceOrgId" TEXT;
CREATE INDEX IF NOT EXISTS "Contact_freeSalesId_idx" ON "Contact"("freeSalesId");
