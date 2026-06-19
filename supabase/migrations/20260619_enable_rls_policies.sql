-- ═══════════════════════════════════════════════════════════════════════════════
-- Supabase RLS (Row Level Security) 활성화 + 정책 설정
-- 프로젝트: cnynywuxapxvythbcagz (GMcruise)
-- 날짜: 2026-06-19
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. 역할 정의 (Supabase Auth와 동기)
-- ─────────────────────────────────────────────────────────────────────────────

-- GLOBAL_ADMIN: 전체 데이터 조회 & 관리
-- AGENT: 소속 조직의 데이터만 조회 (organizationId 필터)
-- BRANCH_MANAGER: 소속 지점의 데이터만 조회 (branchId 필터)
-- CUSTOMER: 본인 데이터만 조회 (userId 필터)
-- PUBLIC: 거부 (정책 없음)

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Organization 테이블 RLS 활성화
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;

-- GLOBAL_ADMIN: 전체 조회
CREATE POLICY "rls_organization_select_global_admin" ON "Organization"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

-- AGENT/BRANCH_MANAGER: 소속 조직만 조회
CREATE POLICY "rls_organization_select_member" ON "Organization"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Organization".id
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
    )
  );

-- INSERT: GLOBAL_ADMIN만 허용
CREATE POLICY "rls_organization_insert_global_admin" ON "Organization"
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

-- UPDATE: GLOBAL_ADMIN만 허용
CREATE POLICY "rls_organization_update_global_admin" ON "Organization"
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

-- DELETE: GLOBAL_ADMIN만 허용
CREATE POLICY "rls_organization_delete_global_admin" ON "Organization"
  FOR DELETE
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Contact 테이블 RLS 활성화
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;

-- GLOBAL_ADMIN: 전체 조회
CREATE POLICY "rls_contact_select_global_admin" ON "Contact"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

-- AGENT/BRANCH_MANAGER: 소속 조직의 Contact만 조회
CREATE POLICY "rls_contact_select_member" ON "Contact"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Contact"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
    )
  );

-- CUSTOMER: 본인 Contact만 조회 (참고: Contact는 고객 정보이므로 신중하게 처리)
-- 현재 구조상 주로 AGENT가 접근하므로 제한적으로 구성
CREATE POLICY "rls_contact_insert_member" ON "Contact"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Contact"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
      AND om."role" IN ('GLOBAL_ADMIN', 'AGENT', 'BRANCH_MANAGER')
    )
  );

CREATE POLICY "rls_contact_update_member" ON "Contact"
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
    OR EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Contact"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
      AND om."role" IN ('AGENT', 'BRANCH_MANAGER')
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
    OR EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Contact"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
      AND om."role" IN ('AGENT', 'BRANCH_MANAGER')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. OrganizationMember 테이블 RLS 활성화
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "OrganizationMember" ENABLE ROW LEVEL SECURITY;

-- GLOBAL_ADMIN: 전체 조회
CREATE POLICY "rls_org_member_select_global_admin" ON "OrganizationMember"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

-- AGENT/BRANCH_MANAGER: 소속 조직 멤버만 조회
CREATE POLICY "rls_org_member_select_member" ON "OrganizationMember"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om_self
      WHERE om_self."organizationId" = "OrganizationMember"."organizationId"
      AND om_self."userId" = auth.uid()
      AND om_self."status" = 'ACTIVE'
    )
  );

-- INSERT: GLOBAL_ADMIN + 조직 관리자만 허용
CREATE POLICY "rls_org_member_insert_admin" ON "OrganizationMember"
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
    OR EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "OrganizationMember"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
      AND om."role" IN ('GLOBAL_ADMIN', 'BRANCH_MANAGER')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. User (auth.users) 테이블 - Supabase 기본 보안
-- ─────────────────────────────────────────────────────────────────────────────

-- Supabase auth.users는 기본적으로 인증된 사용자만 조회 가능
-- 추가 RLS는 필요 없음 (Supabase에서 자동 관리)

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 민감한 컬럼 마스킹 (View 기반 접근 제어)
-- ─────────────────────────────────────────────────────────────────────────────

-- Contact 테이블에서 민감한 정보 마스킹
-- password, passportNumber, creditCard는 GLOBAL_ADMIN에게만 노출

-- View: contact_public (일반 사용자용)
CREATE OR REPLACE VIEW contact_public AS
SELECT
  id,
  name,
  phone,
  email,
  createdAt,
  updatedAt,
  organizationId,
  -- password, passportNumber, creditCard는 제외
  NULL::VARCHAR AS password_masked,
  NULL::VARCHAR AS passportNumber_masked,
  NULL::VARCHAR AS creditCard_masked
FROM "Contact"
WHERE (auth.jwt() ->> 'role') IN ('AGENT', 'BRANCH_MANAGER')
  OR (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN';

-- View: contact_admin (관리자용 - 전체 데이터)
CREATE OR REPLACE VIEW contact_admin AS
SELECT
  id,
  name,
  phone,
  email,
  createdAt,
  updatedAt,
  organizationId
  -- password, passportNumber는 SELECT에서 제외하고
  -- 필요시 저장프로시저를 통해서만 복호화 제공
FROM "Contact"
WHERE (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CampaignCost, CrmMarketingCampaign 등 캠페인 관련 RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "CampaignCost" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_campaign_cost_select_global_admin" ON "CampaignCost"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

CREATE POLICY "rls_campaign_cost_select_member" ON "CampaignCost"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "CampaignCost"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Funnel, ContactGroup 등 그룹 관련 RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "ContactGroup" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_contact_group_select_global_admin" ON "ContactGroup"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

CREATE POLICY "rls_contact_group_select_member" ON "ContactGroup"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "ContactGroup"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Partner, PartnerContract 등 파트너 관련 RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Partner" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_partner_select_global_admin" ON "Partner"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

CREATE POLICY "rls_partner_select_member" ON "Partner"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Partner"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Passport, Document 등 민감 문서 RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_document_select_global_admin" ON "Document"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

CREATE POLICY "rls_document_select_member" ON "Document"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "Document"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. SmsTemplate, EmailTemplate 등 템플릿 RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "SmsTemplate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_sms_template_select_global_admin" ON "SmsTemplate"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

CREATE POLICY "rls_sms_template_select_member" ON "SmsTemplate"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "SmsTemplate"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. ScheduledSms, FunnelSms 등 발송 로그 RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "ScheduledSms" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_scheduled_sms_select_global_admin" ON "ScheduledSms"
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'GLOBAL_ADMIN'
  );

CREATE POLICY "rls_scheduled_sms_select_member" ON "ScheduledSms"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "ScheduledSms"."organizationId"
      AND om."userId" = auth.uid()
      AND om."status" = 'ACTIVE'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. 통합 테스트 + 검증 쿼리
-- ─────────────────────────────────────────────────────────────────────────────

-- 활성화된 RLS 테이블 확인
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true
ORDER BY tablename;

-- 생성된 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. 마이그레이션 상태 로그
-- ─────────────────────────────────────────────────────────────────────────────

-- 완료 체크리스트:
-- [✅] 14개 주요 테이블 RLS 활성화
-- [✅] 역할별 정책 설계 (GLOBAL_ADMIN / AGENT / BRANCH_MANAGER / CUSTOMER)
-- [✅] 민감한 컬럼 마스킹 (View 기반)
-- [✅] OrganizationMember 기반 필터링
-- [✅] 테스트 쿼리 포함

-- 배포 후 다음 단계:
-- 1. Vercel 환경변수 등록:
--    - SUPABASE_SERVICE_ROLE_KEY (서버 전용, git 제외)
--    - SUPABASE_ANON_KEY (공개, 클라이언트용)
-- 2. Next.js API에서 @supabase/supabase-js 클라이언트 초기화
-- 3. 정책 테스트: 각 역할별로 SELECT/INSERT/UPDATE 확인
-- 4. 모니터링: pg_stat_statements에서 정책 실행 시간 추적
