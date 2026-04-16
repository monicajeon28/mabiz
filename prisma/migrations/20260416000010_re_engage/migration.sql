-- Contact: 재진입 추적 컬럼 추가 (WO-26)
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "reEngagedAt"   TIMESTAMPTZ;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "reEngageCount" INTEGER NOT NULL DEFAULT 0;

-- OrgSmsConfig: 재진입 메시지 커스터마이즈
ALTER TABLE "OrgSmsConfig" ADD COLUMN IF NOT EXISTS "reEngageMsg1" TEXT;
ALTER TABLE "OrgSmsConfig" ADD COLUMN IF NOT EXISTS "reEngageMsg2" TEXT;
