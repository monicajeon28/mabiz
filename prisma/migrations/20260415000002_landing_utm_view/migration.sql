-- CrmLandingRegistration에 UTM 컬럼 추가
ALTER TABLE "CrmLandingRegistration" ADD COLUMN IF NOT EXISTS "utmMedium"   TEXT;
ALTER TABLE "CrmLandingRegistration" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
CREATE INDEX IF NOT EXISTS "CrmLandingReg_utm_idx" ON "CrmLandingRegistration"("utmSource", "utmMedium");
