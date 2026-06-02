-- CrmLandingPage에 shortlink 필드 추가 (유니크 + 인덱스)
ALTER TABLE "CrmLandingPage" ADD COLUMN "shortlink" TEXT;

-- shortlink에 대한 UNIQUE 제약 추가
ALTER TABLE "CrmLandingPage" ADD CONSTRAINT "CrmLandingPage_shortlink_key" UNIQUE ("shortlink");

-- shortlink 조회 성능을 위한 인덱스 추가
CREATE INDEX "idx_crm_landing_page_shortlink" ON "CrmLandingPage"("shortlink");
