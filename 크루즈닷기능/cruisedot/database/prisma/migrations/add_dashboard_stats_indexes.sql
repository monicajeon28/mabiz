-- 대시보드 통계 쿼리 최적화를 위한 인덱스 추가
-- 작성일: 2025-01-28
-- 대리점장 대시보드 통계 조회 성능 개선

-- ============================================
-- AffiliateLead 테이블: 대시보드 통계 쿼리 최적화
-- ============================================
-- managerId와 createdAt을 함께 사용하는 쿼리 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliate_lead_manager_created" 
ON "AffiliateLead"("managerId", "createdAt");

-- agentId와 createdAt을 함께 사용하는 쿼리 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliate_lead_agent_created" 
ON "AffiliateLead"("agentId", "createdAt");

-- ============================================
-- AffiliateSale 테이블: 대시보드 통계 쿼리 최적화
-- ============================================
-- managerId와 createdAt을 함께 사용하는 쿼리 최적화 (이미 saleDate 인덱스는 있음)
CREATE INDEX IF NOT EXISTS "idx_affiliate_sale_manager_created" 
ON "AffiliateSale"("managerId", "createdAt");

-- agentId와 createdAt을 함께 사용하는 쿼리 최적화 (이미 saleDate 인덱스는 있음)
CREATE INDEX IF NOT EXISTS "idx_affiliate_sale_agent_created" 
ON "AffiliateSale"("agentId", "createdAt");


