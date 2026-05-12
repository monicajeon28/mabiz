-- CrmLandingShare 테이블 재생성 (org 기반 공유 v2)
-- 기존 테이블 삭제 후 새 구조로 생성 (데이터 없음 확인)

DROP TABLE IF EXISTS "CrmLandingShare";

CREATE TABLE "CrmLandingShare" (
  "id"              TEXT          NOT NULL,
  "landingPageId"   TEXT          NOT NULL,
  "sharedToOrgId"   TEXT          NOT NULL,
  "sharedByUserId"  TEXT          NOT NULL,
  "sharedByOrgId"   TEXT          NOT NULL,
  "sharedByName"    TEXT          NOT NULL,
  "isGlobal"        BOOLEAN       NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmLandingShare_pkey" PRIMARY KEY ("id")
);

-- FK
ALTER TABLE "CrmLandingShare"
  ADD CONSTRAINT "CrmLandingShare_landingPageId_fkey"
  FOREIGN KEY ("landingPageId")
  REFERENCES "CrmLandingPage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique
CREATE UNIQUE INDEX "CrmLandingShare_landingPageId_sharedToOrgId_key"
  ON "CrmLandingShare"("landingPageId", "sharedToOrgId");

-- Indexes
CREATE INDEX "CrmLandingShare_sharedToOrgId_idx" ON "CrmLandingShare"("sharedToOrgId");
CREATE INDEX "CrmLandingShare_sharedByOrgId_idx" ON "CrmLandingShare"("sharedByOrgId");
