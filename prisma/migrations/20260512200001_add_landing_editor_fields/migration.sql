-- Step 1: CrmLandingPage 에디터 고도화 필드 추가
-- 모두 nullable이므로 기존 데이터에 영향 없음

ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "description"       TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "category"          TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "pageGroup"         TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "buttonTitle"       TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "completionPageUrl" TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "headerScript"      TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "exposureTitle"     TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "exposureImage"     TEXT;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "infoCollection"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "editorMode"        TEXT NOT NULL DEFAULT 'html';
ALTER TABLE "CrmLandingPage" ADD COLUMN IF NOT EXISTS "formConfig"       JSONB;

-- Step 2: 랜딩페이지 이미지 중간 테이블
CREATE TABLE IF NOT EXISTS "CrmLandingPageImage" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
  "landingPageId"  TEXT NOT NULL,
  "imageAssetId"   TEXT NOT NULL,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "altText"        TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmLandingPageImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmLandingPageImage_landingPageId_fkey"
    FOREIGN KEY ("landingPageId") REFERENCES "CrmLandingPage"("id") ON DELETE CASCADE,
  CONSTRAINT "CrmLandingPageImage_imageAssetId_fkey"
    FOREIGN KEY ("imageAssetId") REFERENCES "ImageAsset"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmLandingPageImage_landingPageId_imageAssetId_key"
  ON "CrmLandingPageImage"("landingPageId", "imageAssetId");

CREATE INDEX IF NOT EXISTS "CrmLandingPageImage_landingPageId_sortOrder_idx"
  ON "CrmLandingPageImage"("landingPageId", "sortOrder");
