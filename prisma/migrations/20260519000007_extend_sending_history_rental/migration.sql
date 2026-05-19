-- 렌탈 발송 추적을 위한 SendingHistory 테이블 확장
-- Phase 4 Track 1: Delta SMS 3일 시퀀스 구현

-- Step 1: 신규 컬럼 추가
ALTER TABLE "SendingHistory"
ADD COLUMN "isRentalPurchase" BOOLEAN DEFAULT false,
ADD COLUMN "isDeltaSmsEligible" BOOLEAN DEFAULT false,
ADD COLUMN "deltaDay" INTEGER DEFAULT NULL,
ADD COLUMN "segmentVariation" VARCHAR(1) DEFAULT NULL;

-- Step 2: 인덱스 생성 (동시 생성으로 테이블 잠금 최소화)
CREATE INDEX CONCURRENTLY "idx_sendinghistory_isrentalpur" ON "SendingHistory"("isRentalPurchase");
CREATE INDEX CONCURRENTLY "idx_sendinghistory_isdeltasmselig" ON "SendingHistory"("isDeltaSmsEligible");
CREATE INDEX CONCURRENTLY "idx_sendinghistory_deltatemp" ON "SendingHistory"("isDeltaSmsEligible", "deltaDay");

-- Step 3: 기존 렌탈 캠페인 데이터 마이그레이션
-- (CrmMarketingCampaign 테이블에 category 필드가 있으면 사용, 없으면 title에서 '렌탈' 문자열 검색)
UPDATE "SendingHistory"
SET
  "isRentalPurchase" = true,
  "isDeltaSmsEligible" = true,
  "deltaDay" = 0,
  "segmentVariation" = 'A'
WHERE "campaignId" IN (
  SELECT id FROM "CrmMarketingCampaign"
  WHERE "title" ILIKE '%렌탈%' OR "title" ILIKE '%rental%'
)
AND "isRentalPurchase" = false;

-- Step 4: 세그먼트 변형 자동 설정 (Contact의 태그 기반)
-- TODO: Contact 테이블에 travelStyle 또는 유사 필드 추가 후 활성화
-- 현재는 기본값 'A' 유지, 추후 업그레이드 단계에서 로직 추가
