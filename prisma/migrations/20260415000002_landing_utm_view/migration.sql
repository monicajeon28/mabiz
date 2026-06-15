-- CrmLandingRegistration에 UTM 컬럼 추가
-- 테이블이 존재하는 경우에만 처리
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CrmLandingRegistration') THEN
    ALTER TABLE "CrmLandingRegistration" ADD COLUMN IF NOT EXISTS "utmMedium"   TEXT;
    ALTER TABLE "CrmLandingRegistration" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
    CREATE INDEX IF NOT EXISTS "CrmLandingReg_utm_idx" ON "CrmLandingRegistration"("utmSource", "utmMedium");
  END IF;
END $$;
