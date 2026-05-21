-- ========================================
-- Contact 테이블 userId 상태 분석
-- ========================================

-- 1️⃣ 전체 통계
SELECT
  COUNT(*) as "총_Contact_건수",
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as "userId_설정됨",
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as "userId_NULL",
  ROUND(100.0 * COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) / COUNT(*), 2) as "userId_설정률_%",
  ROUND(100.0 * COUNT(CASE WHEN "userId" IS NULL THEN 1 END) / COUNT(*), 2) as "userId_NULL률_%"
FROM "Contact"
WHERE "deletedAt" IS NULL;

-- 2️⃣ Phone 중복 분석
SELECT
  phone,
  "organizationId",
  COUNT(*) as "중복_건수"
FROM "Contact"
WHERE "deletedAt" IS NULL
GROUP BY phone, "organizationId"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 30;

-- 3️⃣ Organization별 userId 설정률
SELECT
  o.id as "org_id",
  o.name as "org_name",
  COUNT(c.id) as "total_contacts",
  COUNT(CASE WHEN c."userId" IS NOT NULL THEN 1 END) as "with_userId",
  COUNT(CASE WHEN c."userId" IS NULL THEN 1 END) as "without_userId",
  ROUND(100.0 * COUNT(CASE WHEN c."userId" IS NOT NULL THEN 1 END) / COUNT(c.id), 1) as "userId_설정률_%"
FROM "Contact" c
JOIN "Organization" o ON c."organizationId" = o.id
WHERE c."deletedAt" IS NULL
GROUP BY o.id, o.name
ORDER BY COUNT(c.id) DESC
LIMIT 20;

-- 4️⃣ userId 분포 (상위 20개 userId별 Contact 건수)
SELECT
  "userId",
  COUNT(*) as "contact_count",
  COUNT(DISTINCT "organizationId") as "organization_count"
FROM "Contact"
WHERE "userId" IS NOT NULL
  AND "deletedAt" IS NULL
GROUP BY "userId"
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 5️⃣ 고아 Contact (userId는 있는데 GoldMember 없음)
SELECT
  c.id as "contact_id",
  c.phone,
  c."userId",
  c.name,
  c."organizationId",
  c."createdAt"
FROM "Contact" c
WHERE c."userId" IS NOT NULL
  AND c."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
  )
LIMIT 20;

-- 6️⃣ 같은 phone이지만 다른 userId 가진 Contact 그룹
SELECT
  phone,
  "organizationId",
  COUNT(DISTINCT "userId") as "distinct_userIds",
  COUNT(*) as "total_contacts",
  STRING_AGG(DISTINCT CAST("userId" AS TEXT), ', ') as "userIds_list"
FROM "Contact"
WHERE "deletedAt" IS NULL
  AND "userId" IS NOT NULL
GROUP BY phone, "organizationId"
HAVING COUNT(DISTINCT "userId") > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 7️⃣ 최근 30일 생성된 Contact 중 userId 없는 비율
SELECT
  DATE(c."createdAt") as "created_date",
  COUNT(*) as "total",
  COUNT(CASE WHEN c."userId" IS NOT NULL THEN 1 END) as "with_userId",
  COUNT(CASE WHEN c."userId" IS NULL THEN 1 END) as "without_userId",
  ROUND(100.0 * COUNT(CASE WHEN c."userId" IS NULL THEN 1 END) / COUNT(*), 1) as "null_rate_%"
FROM "Contact" c
WHERE c."deletedAt" IS NULL
  AND c."createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY DATE(c."createdAt")
ORDER BY DATE(c."createdAt") DESC;

-- 8️⃣ 삭제된 Contact 통계
SELECT
  COUNT(*) as "soft_deleted_contacts",
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as "with_userId",
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as "without_userId"
FROM "Contact"
WHERE "deletedAt" IS NOT NULL;

-- 9️⃣ 수동 정정 필요 케이스 1: name이 빈 Contact
SELECT
  COUNT(*) as "empty_name_contacts",
  COUNT(CASE WHEN "userId" IS NOT NULL THEN 1 END) as "with_userId",
  COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as "without_userId"
FROM "Contact"
WHERE "deletedAt" IS NULL
  AND ("name" = '' OR "name" IS NULL);

-- 🔟 수동 정정 필요 케이스 2: email 중복 (같은 org 내)
SELECT
  email,
  "organizationId",
  COUNT(*) as "duplicate_count"
FROM "Contact"
WHERE "deletedAt" IS NULL
  AND email IS NOT NULL
  AND email != ''
GROUP BY email, "organizationId"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;
