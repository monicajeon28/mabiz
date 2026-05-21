-- ========================================
-- Task 1 Step 5 Phase A: Before 데이터 수집
-- 목적: SCRIPT 1/2/3 실행 전 현황 파악
-- 실행: npx prisma db execute --stdin < TASK1_STEP5_BEFORE_VALIDATION.sql
-- ========================================

-- 1-1. 고아 Contact 개수
-- 정의: userId가 있지만 GoldMember가 없는 Contact
SELECT 'Query 1-1: 고아 Contact 개수' as description, COUNT(*) as value
FROM "Contact" c
WHERE c."userId" IS NOT NULL
  AND c."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
  );

-- 1-2. 중복 Contact 개수
-- 정의: 같은 phone + organizationId로 여러 Contact 존재
SELECT 'Query 1-2: 중복 Contact 그룹 개수' as description, COUNT(*) as value
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(*) > 1
) t;

-- 1-3. 중복 Contact의 CallLog 영향도
-- 정의: SCRIPT 2 실행 시 재지정 대상이 될 CallLog
SELECT 'Query 1-3: 중복 Contact의 CallLog 영향도' as description, COUNT(*) as value
FROM "CallLog" cl
WHERE EXISTS (
  SELECT 1 FROM "Contact" c
  WHERE c.id = cl."contactId"
    AND c."deletedAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM (
        SELECT phone, "organizationId"
        FROM "Contact"
        WHERE "deletedAt" IS NULL
        GROUP BY phone, "organizationId"
        HAVING COUNT(*) > 1
      ) t
      WHERE t.phone = c.phone
        AND t."organizationId" = c."organizationId"
    )
);

-- 1-4. 다중 userId Contact 개수
-- 정의: 같은 phone이지만 다른 userId를 가진 Contact 그룹
SELECT 'Query 1-4: 다중 userId Contact 그룹 개수' as description, COUNT(*) as value
FROM (
  SELECT phone, "organizationId"
  FROM "Contact"
  WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
  GROUP BY phone, "organizationId"
  HAVING COUNT(DISTINCT "userId") > 1
) t;

-- 1-5. 전체 통계
-- 목적: 전체 구조 파악
SELECT
  'Query 1-5: 전체 Contact 통계' as description,
  COUNT(*) as total_active,
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as with_userId,
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as without_userId,
  COUNT(DISTINCT phone) as unique_phones
FROM "Contact"
WHERE "deletedAt" IS NULL;
