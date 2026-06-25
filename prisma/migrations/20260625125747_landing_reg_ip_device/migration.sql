-- 랜딩 신청자 IP/기기/접속경로 추적 (2026-06-25). 멱등.
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CrmLandingRegistration' AND column_name='ipAddress') THEN
    ALTER TABLE "CrmLandingRegistration" ADD COLUMN "ipAddress" TEXT;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CrmLandingRegistration' AND column_name='userAgent') THEN
    ALTER TABLE "CrmLandingRegistration" ADD COLUMN "userAgent" TEXT;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CrmLandingRegistration' AND column_name='deviceType') THEN
    ALTER TABLE "CrmLandingRegistration" ADD COLUMN "deviceType" VARCHAR(20);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='CrmLandingRegistration' AND column_name='referer') THEN
    ALTER TABLE "CrmLandingRegistration" ADD COLUMN "referer" TEXT;
  END IF;
END $$;
