-- CreateTable: CrmLandingView — IP 해시 기반 24h 조회 중복 방지
CREATE TABLE "CrmLandingView" (
  "id"            TEXT NOT NULL,
  "landingPageId" TEXT NOT NULL,
  "ipHash"        TEXT NOT NULL,
  "viewedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CrmLandingView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmLandingView_landingPageId_ipHash_key"
  ON "CrmLandingView"("landingPageId","ipHash");

CREATE INDEX "CrmLandingView_viewedAt_idx"
  ON "CrmLandingView"("viewedAt");
