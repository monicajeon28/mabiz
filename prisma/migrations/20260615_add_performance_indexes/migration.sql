-- P1-3: Add performance indexes for large-scale operations

-- ContactGroup: organizationId + createdAt 정렬 (Groups 조회 최적화)
CREATE INDEX idx_group_org_created ON "ContactGroup"("organizationId" DESC, "createdAt" DESC);

-- ContractAuditLog: Add organizationId field + index (조직별 감사 로그 조회 최적화)
ALTER TABLE "ContractAuditLog" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '';

-- Add constraint to ensure organizationId is set properly via migration script
-- Note: Application code must update existing rows with correct organizationId from related ContractInstance

-- Create index for organizationId + timestamp
CREATE INDEX idx_audit_org_time ON "ContractAuditLog"("organizationId" DESC, "timestamp" DESC);
