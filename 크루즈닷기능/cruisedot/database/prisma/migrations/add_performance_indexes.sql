-- 성능 최적화를 위한 인덱스 추가
-- 작성일: 2025-01-28
-- 100만 트래픽 대응을 위한 인덱스 추가

-- ============================================
-- 1. User 테이블: 고객 관리 쿼리 최적화
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_user_customer_status_source_created" 
ON "User"("customerStatus", "customerSource", "createdAt");

-- 전화번호 검색 최적화 (고객 관리에서 자주 사용)
CREATE INDEX IF NOT EXISTS "idx_user_phone" 
ON "User"("phone");

-- ============================================
-- 2. AffiliateLead 테이블: 어필리에이트 고객 조회 최적화
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_affiliate_lead_phone_status_created" 
ON "AffiliateLead"("customerPhone", "status", "createdAt");

-- 대리점장+판매원 조합 검색 (1만명 규모 대응)
CREATE INDEX IF NOT EXISTS "idx_affiliate_lead_manager_agent_status" 
ON "AffiliateLead"("managerId", "agentId", "status");

-- 최신순 정렬 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliate_lead_updated_at" 
ON "AffiliateLead"("updatedAt");

-- 생성일 기준 정렬 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliate_lead_created_at" 
ON "AffiliateLead"("createdAt");

-- 다음 액션 날짜 기준 정렬 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliate_lead_next_action_at" 
ON "AffiliateLead"("nextActionAt");

-- 최근 상담일 기준 정렬 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliate_lead_last_contacted_at" 
ON "AffiliateLead"("lastContactedAt");

-- ============================================
-- 3. AffiliateSale 테이블: 판매 조회 최적화
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_affiliate_sale_date_status_created" 
ON "AffiliateSale"("saleDate", "status", "createdAt");

-- 생성일 기준 정렬 최적화 (1만명 규모 대응)
CREATE INDEX IF NOT EXISTS "idx_affiliate_sale_created_at" 
ON "AffiliateSale"("createdAt");

-- Lead별 판매 조회 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliate_sale_lead_status" 
ON "AffiliateSale"("leadId", "status");

-- 상태별 최신순 조회 최적화
CREATE INDEX IF NOT EXISTS "idx_affiliate_sale_status_created_at" 
ON "AffiliateSale"("status", "createdAt");

-- ============================================
-- 4. CommissionLedger 테이블: 정산 대시보드 최적화
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_commission_ledger_settled_created" 
ON "CommissionLedger"("isSettled", "createdAt");

