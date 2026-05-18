-- P1 개선: Campaign 목록 조회 성능 최적화
-- createdAt DESC 정렬이 필요한 경우를 위한 인덱스 추가

CREATE INDEX "idx_campaign_org_created_desc" ON "CrmMarketingCampaign"("organizationId" DESC, "createdAt" DESC);
