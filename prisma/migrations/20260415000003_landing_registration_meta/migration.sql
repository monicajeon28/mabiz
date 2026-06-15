-- CrmLandingRegistration: metadata + funnelStarted + unique constraint 추가
-- 테이블이 존재하는 경우에만 처리
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'CrmLandingRegistration') THEN
    ALTER TABLE "CrmLandingRegistration" ADD COLUMN IF NOT EXISTS "metadata"      JSONB;
    ALTER TABLE "CrmLandingRegistration" ADD COLUMN IF NOT EXISTS "funnelStarted" BOOLEAN NOT NULL DEFAULT false;

    -- 중복 등록 방지 unique constraint (race condition 방어)
    CREATE UNIQUE INDEX IF NOT EXISTS "CrmLandingReg_landing_phone_key"
      ON "CrmLandingRegistration"("landingPageId", "phone");
  END IF;
END $$;
