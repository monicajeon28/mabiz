-- Task 1: Contact.userId FK 추가 전 데이터 정정 스크립트
-- 실행 순서: 분석쿼리 1 → SCRIPT 1 → 분석쿼리 2 → SCRIPT 2 → 분석쿼리 6 → SCRIPT 3

-- ============================================================================
-- 분석 쿼리 1: 고아 Contact 개수 (userId 있는데 GmUser 없음)
-- ============================================================================
-- SELECT COUNT(*) as orphaned_contacts
-- FROM "Contact" c
-- WHERE c."userId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId");


-- ============================================================================
-- SCRIPT 1: 고아 Contact 정정 (userId 있는데 GmUser 없음)
-- ============================================================================
UPDATE "Contact" c
SET "userId" = NULL, "updatedAt" = NOW()
WHERE c."userId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId");

-- 예상: 위의 분석 쿼리 1 결과 개수만큼 행 업데이트


-- ============================================================================
-- 분석 쿼리 2: 중복 Contact 개수 (같은 phone+org)
-- ============================================================================
-- SELECT
--   COUNT(*) as duplicate_count,
--   phone, "organizationId"
-- FROM "Contact"
-- WHERE "deletedAt" IS NULL
-- GROUP BY phone, "organizationId"
-- HAVING COUNT(*) > 1
-- ORDER BY COUNT(*) DESC;


-- ============================================================================
-- SCRIPT 2: 중복 Contact 정정 (같은 phone+org, soft delete + CallLog 재지정)
-- ============================================================================
-- 단계 1: 중복된 Contact 중 오래된 것들을 식별하고 소프트 삭제
WITH duplicate_groups AS (
  SELECT
    phone, "organizationId",
    ARRAY_AGG(id ORDER BY "createdAt") as ids,
    ARRAY_AGG(id ORDER BY "createdAt" DESC LIMIT 1)[1] as latest_id
  FROM "Contact"
  WHERE "deletedAt" IS NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(*) > 1
),
old_contacts AS (
  SELECT unnest(ids[1:array_length(ids, 1) - 1]) as id
  FROM duplicate_groups
)
UPDATE "Contact" c
SET "deletedAt" = NOW(), "updatedAt" = NOW()
FROM old_contacts
WHERE c.id = old_contacts.id;

-- 단계 2: CallLog를 최신 Contact로 재지정 (REQUIRED - 필수 실행)
WITH duplicate_groups AS (
  SELECT
    phone, "organizationId",
    ARRAY_AGG(id ORDER BY "createdAt") as ids,
    ARRAY_AGG(id ORDER BY "createdAt" DESC LIMIT 1)[1] as latest_id
  FROM "Contact"
  WHERE "deletedAt" IS NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(*) > 1
),
old_contact_ids AS (
  SELECT unnest(ids[1:array_length(ids, 1) - 1]) as old_id, latest_id
  FROM duplicate_groups
)
UPDATE "CallLog" cl
SET "contactId" = old_contact_ids.latest_id
FROM old_contact_ids
WHERE cl."contactId" = old_contact_ids.old_id;


-- ============================================================================
-- 분석 쿼리 6: 다중 userId 개수 (같은 phone, 다른 userId)
-- ============================================================================
-- SELECT
--   COUNT(DISTINCT "userId") as user_count,
--   phone,
--   STRING_AGG(DISTINCT "userId"::text, ', ') as userIds
-- FROM "Contact"
-- WHERE "deletedAt" IS NULL
--   AND "userId" IS NOT NULL
-- GROUP BY phone
-- HAVING COUNT(DISTINCT "userId") > 1
-- ORDER BY COUNT(DISTINCT "userId") DESC;


-- ============================================================================
-- SCRIPT 3: 다중 userId 표준화 (같은 phone, 다른 userId → Contact.createdAt과 가장 가까운 User 선택)
-- ============================================================================
WITH multi_user_contacts AS (
  SELECT
    c.id,
    c.phone,
    c."userId",
    c."createdAt",
    (
      SELECT u.id
      FROM "User" u
      WHERE u.id IN (
        SELECT DISTINCT "userId"
        FROM "Contact"
        WHERE "deletedAt" IS NULL
          AND "userId" IS NOT NULL
          AND phone = c.phone
      )
      ORDER BY ABS(EXTRACT(EPOCH FROM (u."createdAt" - c."createdAt"))) ASC
      LIMIT 1
    ) as closest_userId
  FROM "Contact" c
  WHERE "deletedAt" IS NULL
    AND "userId" IS NOT NULL
),
multi_user_groups AS (
  SELECT phone
  FROM multi_user_contacts
  GROUP BY phone
  HAVING COUNT(DISTINCT "userId") > 1
)
UPDATE "Contact" c
SET "userId" = m.closest_userId, "updatedAt" = NOW()
FROM multi_user_contacts m
WHERE c.id = m.id
  AND c.phone IN (SELECT phone FROM multi_user_groups)
  AND c."userId" != m.closest_userId;

-- 예상: 위의 분석 쿼리 6에서 찾은 다중 userId 레코드들


-- ============================================================================
-- 최종 검증: FK 추가 전 데이터 정합성 확인
-- ============================================================================
-- 이 쿼리가 0을 반환해야 FK 추가 가능
-- SELECT COUNT(*) as invalid_user_fk
-- FROM "Contact" c
-- WHERE c."userId" IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId");
