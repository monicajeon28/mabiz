-- Partner.externalProfileId: GMcruise AffiliateProfile.id 연결 브릿지
-- commission-calculator.ts에서 WHERE externalProfileId = :profileId 쿼리 사용
-- 이 SQL을 Neon DB에 직접 실행하거나 scripts/apply-missing-schema.mjs에 추가

ALTER TABLE "Partner"
  ADD COLUMN IF NOT EXISTS "externalProfileId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Partner_externalProfileId_key"
  ON "Partner"("externalProfileId")
  WHERE "externalProfileId" IS NOT NULL;
