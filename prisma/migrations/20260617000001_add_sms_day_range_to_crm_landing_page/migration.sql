-- Add smsDayRange column to CrmLandingPage
-- SMS 자동화 범위 설정 필드 추가 (예: "0-3" | null)

ALTER TABLE "CrmLandingPage"
ADD COLUMN "smsDayRange" TEXT;
