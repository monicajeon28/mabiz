-- CrmLandingRegistration: metadata + funnelStarted + unique constraint 추가
ALTER TABLE "CrmLandingRegistration" ADD COLUMN IF NOT EXISTS "metadata"      JSONB;
ALTER TABLE "CrmLandingRegistration" ADD COLUMN IF NOT EXISTS "funnelStarted" BOOLEAN NOT NULL DEFAULT false;

-- 중복 등록 방지 unique constraint (race condition 방어)
CREATE UNIQUE INDEX IF NOT EXISTS "CrmLandingReg_landing_phone_key"
  ON "CrmLandingRegistration"("landingPageId", "phone");
