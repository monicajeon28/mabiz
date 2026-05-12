-- 성능 최적화를 위한 인덱스 추가
-- 작성일: 2025-01-28
-- 1만명 규모 대응을 위한 인덱스 추가

-- AffiliateLead 인덱스
CREATE INDEX IF NOT EXISTS "AffiliateLead_managerId_agentId_status_idx" ON "AffiliateLead"("managerId", "agentId", "status");
CREATE INDEX IF NOT EXISTS "AffiliateLead_updatedAt_idx" ON "AffiliateLead"("updatedAt");
CREATE INDEX IF NOT EXISTS "AffiliateLead_createdAt_idx" ON "AffiliateLead"("createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateLead_nextActionAt_idx" ON "AffiliateLead"("nextActionAt");
CREATE INDEX IF NOT EXISTS "AffiliateLead_lastContactedAt_idx" ON "AffiliateLead"("lastContactedAt");
CREATE INDEX IF NOT EXISTS "AffiliateLead_managerId_createdAt_idx" ON "AffiliateLead"("managerId", "createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateLead_agentId_createdAt_idx" ON "AffiliateLead"("agentId", "createdAt");

-- AffiliateSale 인덱스
CREATE INDEX IF NOT EXISTS "AffiliateSale_createdAt_idx" ON "AffiliateSale"("createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateSale_leadId_status_idx" ON "AffiliateSale"("leadId", "status");
CREATE INDEX IF NOT EXISTS "AffiliateSale_status_createdAt_idx" ON "AffiliateSale"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateSale_managerId_createdAt_idx" ON "AffiliateSale"("managerId", "createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateSale_agentId_createdAt_idx" ON "AffiliateSale"("agentId", "createdAt");

-- User 인덱스
CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone");
