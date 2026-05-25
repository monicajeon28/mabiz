-- CRM 테스트 데이터 초기화 및 설정 스크립트
-- 마지막 업데이트: 2026-05-25
-- 용도: 테스트 사용자, 조직, 고객 데이터 생성

-- ============================================================================
-- Phase 1: 기존 테스트 데이터 정리
-- ============================================================================

-- 테스트 사용자 기존 데이터 삭제
DELETE FROM "MabizSession"
WHERE organizationId IN (
  SELECT id FROM "Organization"
  WHERE slug = 'test-organization' OR slug = 'test-org-2'
);

DELETE FROM "OrganizationMember"
WHERE email LIKE '%@mabiz.test';

DELETE FROM "GlobalAdmin"
WHERE displayName LIKE '%Test%' OR phone LIKE '010-0000%';

DELETE FROM "Contact"
WHERE organizationId IN (
  SELECT id FROM "Organization"
  WHERE slug = 'test-organization' OR slug = 'test-org-2'
);

DELETE FROM "Organization"
WHERE slug = 'test-organization' OR slug = 'test-org-2';


-- ============================================================================
-- Phase 2: 조직 생성 (2개)
-- ============================================================================

-- 조직 1: Test Organization (기본 테스트 조직)
INSERT INTO "Organization" (id, name, slug, plan, status, createdAt, updatedAt)
VALUES (
  'org-test-001',
  'Test Organization',
  'test-organization',
  'FREE',
  'ACTIVE',
  NOW(),
  NOW()
);

-- 조직 2: Test Organization 2 (조직 격리 테스트용)
INSERT INTO "Organization" (id, name, slug, plan, status, createdAt, updatedAt)
VALUES (
  'org-test-002',
  'Test Organization 2',
  'test-org-2',
  'FREE',
  'ACTIVE',
  NOW(),
  NOW()
);


-- ============================================================================
-- Phase 3: 전역 관리자 생성
-- ============================================================================

INSERT INTO "GlobalAdmin" (
  id,
  displayName,
  phone,
  userId,
  createdAt,
  updatedAt
)
VALUES (
  'admin-global-001',
  'Global Admin',
  '010-0000-0001',
  'admin-user-001',
  NOW(),
  NOW()
);


-- ============================================================================
-- Phase 4: 테스트 조직의 멤버 생성 (4명)
-- ============================================================================

-- Admin 역할 (관리자) - admin@mabiz.test
INSERT INTO "OrganizationMember" (
  id,
  organizationId,
  userId,
  phone,
  role,
  displayName,
  isActive,
  email,
  createdAt,
  updatedAt
)
VALUES (
  'mem-admin-001',
  'org-test-001',
  'admin-user-001',
  '010-1000-0001',
  'ADMIN',
  'Admin User',
  true,
  'admin@mabiz.test',
  NOW(),
  NOW()
);

-- Agent 역할 1 (대리점장) - manager@mabiz.test
INSERT INTO "OrganizationMember" (
  id,
  organizationId,
  userId,
  phone,
  role,
  displayName,
  isActive,
  email,
  createdAt,
  updatedAt
)
VALUES (
  'mem-mgr-001',
  'org-test-001',
  'mgr-user-001',
  '010-2000-0001',
  'AGENT',
  'Manager User',
  true,
  'manager@mabiz.test',
  NOW(),
  NOW()
);

-- Agent 역할 2 (판매원) - sales@mabiz.test
INSERT INTO "OrganizationMember" (
  id,
  organizationId,
  userId,
  phone,
  role,
  displayName,
  isActive,
  email,
  createdAt,
  updatedAt
)
VALUES (
  'mem-sales-001',
  'org-test-001',
  'sales-user-001',
  '010-3000-0001',
  'AGENT',
  'Sales User',
  true,
  'sales@mabiz.test',
  NOW(),
  NOW()
);

-- Agent 역할 3 (사전판매) - presales@mabiz.test
INSERT INTO "OrganizationMember" (
  id,
  organizationId,
  userId,
  phone,
  role,
  displayName,
  isActive,
  email,
  createdAt,
  updatedAt
)
VALUES (
  'mem-presales-001',
  'org-test-001',
  'presales-user-001',
  '010-4000-0001',
  'AGENT',
  'PreSales User',
  true,
  'presales@mabiz.test',
  NOW(),
  NOW()
);

-- 조직 2의 멤버 1명 (조직 격리 테스트용)
INSERT INTO "OrganizationMember" (
  id,
  organizationId,
  userId,
  phone,
  role,
  displayName,
  isActive,
  email,
  createdAt,
  updatedAt
)
VALUES (
  'mem-other-001',
  'org-test-002',
  'other-user-001',
  '010-5000-0001',
  'AGENT',
  'Other Org User',
  true,
  'other@mabiz.test',
  NOW(),
  NOW()
);


-- ============================================================================
-- Phase 5: Contact 데이터 생성 (테스트 고객 20명)
-- ============================================================================

-- Contact 1: L0 렌즈 테스트 (부재중 고객)
INSERT INTO "Contact" (
  id, organizationId, phone, name, email, createdAt, updatedAt,
  assignedUserId, type, reactivationSegment, reactivationLikelihood,
  lastCruiseDate, cruiseCount, vipStatus
)
VALUES (
  'cust-001',
  'org-test-001',
  '01012345001',
  'Customer 1 - L0 Reactivation',
  'cust001@example.com',
  NOW() - INTERVAL '180 days',
  NOW(),
  'sales-user-001',
  'CUSTOMER',
  '6-12m',
  75,
  NOW() - INTERVAL '180 days',
  3,
  'GOLD'
);

-- Contact 2: L2 렌즈 테스트 (준비 불안)
INSERT INTO "Contact" (
  id, organizationId, phone, name, email, createdAt, updatedAt,
  assignedUserId, type, anxietyScore, anxietyCategory, preparationStage,
  visaRequired, healthConcerns, firstTimeCruise, familyWithKids
)
VALUES (
  'cust-002',
  'org-test-001',
  '01012345002',
  'Customer 2 - L2 Anxiety',
  'cust002@example.com',
  NOW(),
  NOW(),
  'sales-user-001',
  'LEAD',
  85,
  'high',
  'health_concern',
  false,
  '배멀미,고혈압',
  false,
  true
);

-- Contact 3: L3 렌즈 테스트 (경쟁사 언급)
INSERT INTO "Contact" (
  id, organizationId, phone, name, email, createdAt, updatedAt,
  assignedUserId, type, competitorMentioned, lastCompetitorMentionAt,
  differentiationScore
)
VALUES (
  'cust-003',
  'org-test-001',
  '01012345003',
  'Customer 3 - L3 Differentiation',
  'cust003@example.com',
  NOW(),
  NOW(),
  'sales-user-001',
  'LEAD',
  true,
  NOW(),
  45
);

-- Contact 4: L5 렌즈 테스트 (의료신뢰)
INSERT INTO "Contact" (
  id, organizationId, phone, name, email, createdAt, updatedAt,
  assignedUserId, type, healthConcerns
)
VALUES (
  'cust-004',
  'org-test-001',
  '01012345004',
  'Customer 4 - L5 Medical Trust',
  'cust004@example.com',
  NOW(),
  NOW(),
  'sales-user-001',
  'LEAD',
  '당뇨병,배멀미'
);

-- Contact 5: L6 렌즈 테스트 (타이밍/손실회피)
INSERT INTO "Contact" (
  id, organizationId, phone, name, email, createdAt, updatedAt,
  assignedUserId, type, departureDate, budgetRange
)
VALUES (
  'cust-005',
  'org-test-001',
  '01012345005',
  'Customer 5 - L6 Timing',
  'cust005@example.com',
  NOW(),
  NOW(),
  'mgr-user-001',
  'LEAD',
  NOW() + INTERVAL '30 days',
  '5000-10000'
);

-- Contact 6: L7 렌즈 테스트 (배우자 설득)
INSERT INTO "Contact" (
  id, organizationId, phone, name, email, createdAt, updatedAt,
  assignedUserId, type, familyComposition, decisionMaker
)
VALUES (
  'cust-006',
  'org-test-001',
  '01012345006',
  'Customer 6 - L7 Companion',
  'cust006@example.com',
  NOW(),
  NOW(),
  'sales-user-001',
  'LEAD',
  'spouse',
  'spouse'
);

-- Contact 7~20: 추가 테스트 고객 (일반 리드)
INSERT INTO "Contact" (
  id, organizationId, phone, name, email, createdAt, updatedAt,
  assignedUserId, type
)
VALUES
  ('cust-007', 'org-test-001', '01012345007', 'Customer 7', 'cust007@example.com', NOW(), NOW(), 'sales-user-001', 'LEAD'),
  ('cust-008', 'org-test-001', '01012345008', 'Customer 8', 'cust008@example.com', NOW(), NOW(), 'sales-user-001', 'LEAD'),
  ('cust-009', 'org-test-001', '01012345009', 'Customer 9', 'cust009@example.com', NOW(), NOW(), 'mgr-user-001', 'LEAD'),
  ('cust-010', 'org-test-001', '01012345010', 'Customer 10', 'cust010@example.com', NOW(), NOW(), 'mgr-user-001', 'LEAD'),
  ('cust-011', 'org-test-001', '01012345011', 'Customer 11', 'cust011@example.com', NOW(), NOW(), 'sales-user-001', 'CUSTOMER'),
  ('cust-012', 'org-test-001', '01012345012', 'Customer 12', 'cust012@example.com', NOW(), NOW(), 'sales-user-001', 'CUSTOMER'),
  ('cust-013', 'org-test-001', '01012345013', 'Customer 13', 'cust013@example.com', NOW(), NOW(), 'mgr-user-001', 'CUSTOMER'),
  ('cust-014', 'org-test-001', '01012345014', 'Customer 14', 'cust014@example.com', NOW(), NOW(), 'mgr-user-001', 'CUSTOMER'),
  ('cust-015', 'org-test-001', '01012345015', 'Customer 15', 'cust015@example.com', NOW(), NOW(), 'presales-user-001', 'LEAD'),
  ('cust-016', 'org-test-001', '01012345016', 'Customer 16', 'cust016@example.com', NOW(), NOW(), 'presales-user-001', 'LEAD'),
  ('cust-017', 'org-test-001', '01012345017', 'Customer 17', 'cust017@example.com', NOW(), NOW(), 'sales-user-001', 'LEAD'),
  ('cust-018', 'org-test-001', '01012345018', 'Customer 18', 'cust018@example.com', NOW(), NOW(), 'sales-user-001', 'CUSTOMER'),
  ('cust-019', 'org-test-001', '01012345019', 'Customer 19', 'cust019@example.com', NOW(), NOW(), 'mgr-user-001', 'LEAD'),
  ('cust-020', 'org-test-001', '01012345020', 'Customer 20', 'cust020@example.com', NOW(), NOW(), 'mgr-user-001', 'LEAD');

-- 조직 2의 고객 (격리 테스트용)
INSERT INTO "Contact" (
  id, organizationId, phone, name, email, createdAt, updatedAt,
  assignedUserId, type
)
VALUES (
  'cust-org2-001',
  'org-test-002',
  '01099999999',
  'Other Org Customer',
  'other-cust@example.com',
  NOW(),
  NOW(),
  'other-user-001',
  'LEAD'
);


-- ============================================================================
-- Phase 6: SMS 설정 (테스트 조직용)
-- ============================================================================

INSERT INTO "OrgSmsConfig" (
  id, organizationId, aligoKey, aligoUserId, senderPhone, isActive,
  senderVerified, createdAt, updatedAt
)
VALUES (
  'sms-config-001',
  'org-test-001',
  'test_aligo_key_12345',
  'test_user_id',
  '01012341234',
  true,
  true,
  NOW(),
  NOW()
);


-- ============================================================================
-- Phase 7: SMS 템플릿 (테스트용)
-- ============================================================================

INSERT INTO "SmsTemplate" (
  id, organizationId, name, content, lifeStage, isActive, createdAt, updatedAt
)
VALUES
  ('sms-tmpl-001', 'org-test-001', 'Day0 Intro', '크루즈몰입니다. 특가 요금제 안내입니다.', 'inquiry', true, NOW(), NOW()),
  ('sms-tmpl-002', 'org-test-001', 'Day1 Value', '마리나 여행의 가치를 알려드립니다.', 'consideration', true, NOW(), NOW()),
  ('sms-tmpl-003', 'org-test-001', 'Day2 Offer', '한정된 객실. 지금 예약하시면 10% 할인.', 'consideration', true, NOW(), NOW()),
  ('sms-tmpl-004', 'org-test-001', 'Day3 Action', '마지막 기회입니다. 지금 결정하세요.', 'decision', true, NOW(), NOW());


-- ============================================================================
-- Phase 8: 이메일 설정 (테스트 조직용)
-- ============================================================================

INSERT INTO "OrgEmailConfig" (
  id, organizationId, senderName, senderEmail, smtpHost, smtpPort,
  smtpUser, smtpPassEncrypted, isActive, createdAt, updatedAt
)
VALUES (
  'email-config-001',
  'org-test-001',
  'Test Cruisemall',
  'noreply@cruisemall-test.com',
  'smtp.gmail.com',
  587,
  'test@cruisemall.com',
  'encrypted_password_here',
  true,
  NOW(),
  NOW()
);


-- ============================================================================
-- Phase 9: 데이터 검증
-- ============================================================================

-- 확인 1: 조직 생성 확인
SELECT COUNT(*) as org_count FROM "Organization"
WHERE slug LIKE 'test%';
-- Expected: 2

-- 확인 2: 멤버 생성 확인
SELECT COUNT(*) as member_count FROM "OrganizationMember"
WHERE email LIKE '%@mabiz.test';
-- Expected: 5

-- 확인 3: 고객 생성 확인
SELECT COUNT(*) as contact_count FROM "Contact"
WHERE organizationId = 'org-test-001';
-- Expected: 20

-- 확인 4: 전역 관리자 확인
SELECT COUNT(*) as admin_count FROM "GlobalAdmin"
WHERE displayName = 'Global Admin';
-- Expected: 1

-- 확인 5: SMS 설정 확인
SELECT COUNT(*) as sms_config_count FROM "OrgSmsConfig"
WHERE organizationId = 'org-test-001';
-- Expected: 1

-- 확인 6: 이메일 설정 확인
SELECT COUNT(*) as email_config_count FROM "OrgEmailConfig"
WHERE organizationId = 'org-test-001';
-- Expected: 1


-- ============================================================================
-- Phase 10: 종합 데이터 현황 출력
-- ============================================================================

-- Organization 정보
SELECT '=== Organizations ===' as info;
SELECT id, name, slug, plan FROM "Organization" WHERE slug LIKE 'test%';

-- OrganizationMember 정보
SELECT '=== Organization Members ===' as info;
SELECT id, userId, displayName, role, email FROM "OrganizationMember"
WHERE email LIKE '%@mabiz.test'
ORDER BY id;

-- GlobalAdmin 정보
SELECT '=== Global Admins ===' as info;
SELECT id, displayName, phone, userId FROM "GlobalAdmin"
WHERE displayName LIKE '%Admin%';

-- Contact 통계
SELECT '=== Contact Statistics ===' as info;
SELECT
  organizationId,
  COUNT(*) as total_contacts,
  COUNT(CASE WHEN type = 'LEAD' THEN 1 END) as leads,
  COUNT(CASE WHEN type = 'CUSTOMER' THEN 1 END) as customers
FROM "Contact"
WHERE organizationId LIKE 'org-test%'
GROUP BY organizationId;

-- 렌즈별 Contact 분포
SELECT '=== Lens Distribution ===' as info;
SELECT
  'L0' as lens,
  COUNT(*) as count
FROM "Contact"
WHERE organizationId = 'org-test-001' AND reactivationSegment IS NOT NULL
UNION ALL
SELECT
  'L2' as lens,
  COUNT(*) as count
FROM "Contact"
WHERE organizationId = 'org-test-001' AND anxietyScore > 0
UNION ALL
SELECT
  'L3' as lens,
  COUNT(*) as count
FROM "Contact"
WHERE organizationId = 'org-test-001' AND competitorMentioned = true;


-- ============================================================================
-- 완료 메시지
-- ============================================================================

-- SELECT 'Test data setup completed successfully!' as status;
-- SELECT NOW() as setup_time;

