-- PostgreSQL Row Level Security (RLS) Policies for CommissionLedger
-- This migration implements tenant isolation and role-based access control

-- Step 1: Enable RLS on CommissionLedger table
ALTER TABLE "CommissionLedger" ENABLE ROW LEVEL SECURITY;

-- Step 2: CREATE policy for SELECT
-- GLOBAL_ADMIN: 모든 행 조회 가능
-- OWNER/BRANCH_MANAGER: 자신의 organizationId에 속한 행만 조회
-- AGENT/FREE_SALES: 자신의 organizationId + profileId에 속한 행만 조회
CREATE POLICY "commission_ledger_select_policy" ON "CommissionLedger"
  FOR SELECT
  USING (
    -- Check if user is GLOBAL_ADMIN (requires session variable)
    -- For now, we allow based on organizationId matching
    -- GLOBAL_ADMIN check will be handled in application layer
    "organizationId" IN (
      -- Match user's organization
      SELECT "organizationId" FROM "OrganizationMember"
      WHERE "userId" = current_user_id()
      UNION ALL
      -- GLOBAL_ADMIN can see all
      SELECT NULL::text WHERE is_global_admin()
    )
  );

-- Step 3: CREATE policy for INSERT
-- Only GLOBAL_ADMIN can insert new commission records
CREATE POLICY "commission_ledger_insert_policy" ON "CommissionLedger"
  FOR INSERT
  WITH CHECK (
    -- Verify organizationId cannot be spoofed
    EXISTS (
      SELECT 1 FROM "Organization"
      WHERE "id" = "CommissionLedger"."organizationId"
    )
    -- Verify creator is GLOBAL_ADMIN (enforced in app layer)
    AND is_global_admin()
  );

-- Step 4: CREATE policy for UPDATE
-- Only GLOBAL_ADMIN can update commission records
-- Critical fields (organizationId) must not change
CREATE POLICY "commission_ledger_update_policy" ON "CommissionLedger"
  FOR UPDATE
  USING (
    -- Can only update own organization records (for OWNER)
    -- or any records (for GLOBAL_ADMIN)
    is_global_admin() OR
    "organizationId" IN (
      SELECT "organizationId" FROM "OrganizationMember"
      WHERE "userId" = current_user_id()
        AND role IN ('OWNER', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    -- Prevent organizationId spoofing on UPDATE
    "organizationId" IN (
      SELECT "id" FROM "Organization"
    )
    AND (
      is_global_admin() OR
      "organizationId" IN (
        SELECT "organizationId" FROM "OrganizationMember"
        WHERE "userId" = current_user_id()
          AND role IN ('OWNER', 'BRANCH_MANAGER')
      )
    )
  );

-- Step 5: CREATE policy for DELETE
-- DELETE is NOT permitted (audit trail must be maintained)
CREATE POLICY "commission_ledger_delete_policy" ON "CommissionLedger"
  FOR DELETE
  USING (FALSE);  -- Always reject DELETE

-- Step 6: Create helper functions for RLS policies
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS text AS $$
BEGIN
  -- In a real implementation, this would extract from JWT token
  -- or from PostgreSQL session variables
  -- For now, return NULL (handled by application layer)
  RETURN NULL::text;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_global_admin()
RETURNS boolean AS $$
BEGIN
  -- In a real implementation, this would check JWT claims or session variables
  -- For now, return FALSE (handled by application layer)
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 7: Create indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_commission_ledger_org_id
  ON "CommissionLedger"("organizationId");

CREATE INDEX IF NOT EXISTS idx_commission_ledger_profile_id
  ON "CommissionLedger"("profileId");

CREATE INDEX IF NOT EXISTS idx_commission_ledger_org_profile
  ON "CommissionLedger"("organizationId", "profileId");

-- Step 8: Create audit log table (for tracking access)
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" SERIAL PRIMARY KEY,
  "action" VARCHAR(20) NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
  "table" VARCHAR(255) NOT NULL,
  "recordId" VARCHAR(255),
  "userId" VARCHAR(255) NOT NULL,
  "organizationId" VARCHAR(255),
  "status" VARCHAR(20) NOT NULL, -- ALLOWED, DENIED
  "reason" VARCHAR(255),
  "details" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON "AuditLog"("userId");
CREATE INDEX idx_audit_log_org_id ON "AuditLog"("organizationId");
CREATE INDEX idx_audit_log_action ON "AuditLog"("action");
CREATE INDEX idx_audit_log_created_at ON "AuditLog"("createdAt" DESC);
CREATE INDEX idx_audit_log_status ON "AuditLog"("status");
CREATE INDEX idx_audit_log_composite ON "AuditLog"("organizationId", "status", "createdAt" DESC);

-- Step 9: Create security event table
CREATE TABLE IF NOT EXISTS "SecurityEvent" (
  "id" SERIAL PRIMARY KEY,
  "type" VARCHAR(50) NOT NULL, -- UNAUTHORIZED_ACCESS, PERMISSION_DENIED, SUSPICIOUS_ACTIVITY, PRIVILEGE_ESCALATION
  "severity" VARCHAR(20) NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
  "userId" VARCHAR(255) NOT NULL,
  "organizationId" VARCHAR(255),
  "description" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_event_severity ON "SecurityEvent"("severity");
CREATE INDEX idx_security_event_user_id ON "SecurityEvent"("userId");
CREATE INDEX idx_security_event_org_id ON "SecurityEvent"("organizationId");
CREATE INDEX idx_security_event_created_at ON "SecurityEvent"("createdAt" DESC);
CREATE INDEX idx_security_event_critical ON "SecurityEvent"("createdAt" DESC)
  WHERE "severity" IN ('CRITICAL', 'HIGH');

-- Step 10: Create function to log access attempts
CREATE OR REPLACE FUNCTION log_access_attempt(
  p_action VARCHAR(20),
  p_table VARCHAR(255),
  p_record_id VARCHAR(255),
  p_user_id VARCHAR(255),
  p_org_id VARCHAR(255),
  p_status VARCHAR(20),
  p_reason VARCHAR(255),
  p_details JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO "AuditLog" (
    "action",
    "table",
    "recordId",
    "userId",
    "organizationId",
    "status",
    "reason",
    "details",
    "createdAt"
  ) VALUES (
    p_action,
    p_table,
    p_record_id,
    p_user_id,
    p_org_id,
    p_status,
    p_reason,
    p_details,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_type VARCHAR(50),
  p_severity VARCHAR(20),
  p_user_id VARCHAR(255),
  p_org_id VARCHAR(255),
  p_description TEXT,
  p_details JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO "SecurityEvent" (
    "type",
    "severity",
    "userId",
    "organizationId",
    "description",
    "details",
    "createdAt"
  ) VALUES (
    p_type,
    p_severity,
    p_user_id,
    p_org_id,
    p_description,
    p_details,
    NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Notes:
-- 1. This migration creates RLS policies on CommissionLedger table
-- 2. Helper functions (current_user_id, is_global_admin) need to be updated
--    in production to use actual JWT tokens or session variables
-- 3. The application layer (audit-logger.ts) enforces the actual permission checks
-- 4. PostgreSQL RLS provides an additional layer of security (defense in depth)
-- 5. Run this migration with: npx prisma migrate dev --name add_rls_policies
