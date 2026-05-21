-- ========================================
-- Contact userId 마이그레이션 전 정정 SQL
-- ========================================
-- 주의: 각 스크립트를 실행하기 전에 반드시 백업을 만들어야 합니다!
-- BACKUP: pg_dump -h ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech -U neondb_owner neondb > backup_$(date +%Y%m%d_%H%M%S).sql

-- ========================================
-- SCRIPT 1: 고아 Contact 정정
-- 유형: userId가 있지만 GoldMember 없는 Contact (orphaned references)
-- 영향: Contact.userId = NULL 설정하여 미아 상태 해제
-- 목표: FK 무결성 확보
-- ========================================

-- 검증 쿼리 (실행 전 영향 범위 확인)
-- SELECT COUNT(*) as orphaned_count
-- FROM "Contact" c
-- WHERE c."userId" IS NOT NULL
--   AND c."deletedAt" IS NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
--   );

-- 정정 스크립트 (유효성 확인 후 실행)
BEGIN TRANSACTION;

UPDATE "Contact"
SET
  "userId" = NULL,
  "updatedAt" = NOW()
WHERE "userId" IS NOT NULL
  AND "deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
  );

-- 변경 건수 확인 (ROLLBACK 원할 시 이 단계에서 가능)
SELECT COUNT(*) as rows_updated FROM "Contact"
WHERE "userId" IS NULL
  AND "updatedAt" = NOW()::date;

-- 확인 후 주석 제거 및 실행
-- COMMIT;
-- ROLLBACK;  -- 변경 취소

-- ========================================
-- SCRIPT 2: 중복 Contact 병합
-- 유형: 같은 phone+org에 여러 Contact (예: 재방문 고객)
-- 영향: 최신 Contact만 유지, 나머지는 soft delete
-- 목표: 데이터 중복 제거
-- ========================================

-- 병합 전략:
-- 1. phone + org별로 가장 최신 Contact를 "대표 Contact"로 선정
-- 2. 다른 Contact들을 soft delete 처리
-- 3. CallLog, ContactGroup 등 외래키는 대표 Contact로 재지정

-- 검증 쿼리
-- SELECT COUNT(*) as duplicate_groups
-- FROM (
--   SELECT phone, "organizationId"
--   FROM "Contact"
--   WHERE "deletedAt" IS NULL
--   GROUP BY phone, "organizationId"
--   HAVING COUNT(*) > 1
-- ) t;

-- 정정 스크립트
BEGIN TRANSACTION;

-- Step 1: 중복 그룹별 대표 Contact 선정 (updatedAt 최신)
CREATE TEMP TABLE duplicate_contacts AS
SELECT
  c.id,
  c.phone,
  c."organizationId",
  ROW_NUMBER() OVER (PARTITION BY c.phone, c."organizationId" ORDER BY c."updatedAt" DESC) as rn
FROM "Contact" c
WHERE c."deletedAt" IS NULL;

-- Step 2: 대표가 아닌 Contact soft delete
UPDATE "Contact" c
SET "deletedAt" = NOW(), "updatedAt" = NOW()
WHERE c.id IN (
  SELECT id FROM duplicate_contacts WHERE rn > 1
);

-- Step 3: 삭제된 Contact와 연결된 CallLog를 대표 Contact로 재지정
UPDATE "CallLog" cl
SET
  "contactId" = (
    SELECT c2.id
    FROM "Contact" c2
    WHERE c2.phone = c1.phone
      AND c2."organizationId" = c1."organizationId"
      AND c2."deletedAt" IS NULL
    ORDER BY c2."updatedAt" DESC
    LIMIT 1
  ),
  "updatedAt" = NOW()
FROM "Contact" c1
WHERE cl."contactId" = c1.id
  AND c1."deletedAt" = NOW()::date;

SELECT COUNT(*) as duplicates_removed FROM "Contact"
WHERE "deletedAt" = NOW()::date;

-- COMMIT;
-- ROLLBACK;

-- ========================================
-- SCRIPT 3: 같은 phone 다중 userId 정정
-- 유형: 같은 phone이지만 다른 userId 가진 Contact들
-- 영향: 최신 userId만 유지
-- 목표: phone 기반 userId 일관성 확보
-- ========================================

-- 검증 쿼리
-- SELECT phone, "organizationId", COUNT(DISTINCT "userId") as distinct_count
-- FROM "Contact"
-- WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
-- GROUP BY phone, "organizationId"
-- HAVING COUNT(DISTINCT "userId") > 1;

-- 정정 스크립트
BEGIN TRANSACTION;

-- phone+org별로 최신 userId 찾기
CREATE TEMP TABLE latest_user_ids AS
SELECT
  phone,
  "organizationId",
  (ARRAY_AGG("userId" ORDER BY "updatedAt" DESC))[1] as latest_userId
FROM "Contact"
WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
GROUP BY phone, "organizationId";

-- 해당 phone의 모든 Contact를 최신 userId로 일치시키기
UPDATE "Contact" c
SET
  "userId" = lui."latest_userId",
  "updatedAt" = NOW()
FROM latest_user_ids lui
WHERE c.phone = lui.phone
  AND c."organizationId" = lui."organizationId"
  AND c."deletedAt" IS NULL
  AND c."userId" != lui."latest_userId";

SELECT COUNT(*) as user_id_standardized FROM "Contact"
WHERE "updatedAt" = NOW()::date;

-- COMMIT;
-- ROLLBACK;

-- ========================================
-- SCRIPT 4: 검증 쿼리 (정정 후 상태 확인)
-- ========================================

-- 최종 통계
SELECT
  COUNT(*) as total_active,
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userId,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userId,
  COUNT(DISTINCT phone) as unique_phones
FROM "Contact"
WHERE "deletedAt" IS NULL;

-- 중복 여부 재확인
SELECT COUNT(*) as remaining_duplicates
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(*) > 1
) t;

-- userId 일관성 재확인
SELECT COUNT(*) as inconsistencies
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(DISTINCT "userId") > 1
) t;

-- ========================================
-- REFERENCE: Contact.userId 용도
-- ========================================
-- userId (Int): 크루즈닷몰 사용자 ID
-- 관계: GoldMember.userId (1:1 또는 1:N)
-- 마이그레이션 목적:
--   - Contact를 GoldMember로 업그레이드 가능하게
--   - 중복 방지 및 일관성 유지
--   - 감정 분석 및 세그먼트 추적
-- ========================================
