-- B-B-1: ProductImage 중복 storagePath 정리
-- 목표: 같은 storagePath를 가진 중복 레코드를 soft delete
-- 전략: 각 storagePath별로 최신(createdAt 최신)을 KEEP, 나머지는 soft delete

BEGIN;

-- Phase 1: 중복 확인 및 통계
WITH duplicate_groups AS (
  SELECT
    "storagePath",
    COUNT(*) as cnt,
    COUNT(CASE WHEN "deletedAt" IS NULL THEN 1 END) as active_cnt
  FROM "ProductImage"
  GROUP BY "storagePath"
  HAVING COUNT(*) > 1
)
SELECT
  COUNT(*) as duplicate_storagepath_count,
  SUM(cnt) as total_duplicated_records,
  SUM(active_cnt) as active_duplicated_records
FROM duplicate_groups;

-- Phase 2: 중복 정리 (최신 1개 제외 soft delete)
-- 각 storagePath 별로:
--   1. createdAt 최신 1개는 KEEP
--   2. 나머지는 soft delete (deletedAt = NOW())
UPDATE "ProductImage" pi
SET "deletedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "deletedAt" IS NULL  -- 활성 레코드만
  AND "storagePath" IN (
    -- 중복이 있는 storagePath
    SELECT "storagePath"
    FROM "ProductImage"
    WHERE "deletedAt" IS NULL
    GROUP BY "storagePath"
    HAVING COUNT(*) > 1
  )
  AND id NOT IN (
    -- 각 storagePath별로 최신(createdAt DESC, id DESC) 1개 선택
    SELECT DISTINCT ON ("storagePath") id
    FROM "ProductImage"
    WHERE "deletedAt" IS NULL
    ORDER BY "storagePath", "createdAt" DESC, id DESC
  );

-- Phase 3: 정리 결과 검증
-- 이 쿼리가 0을 반환해야 성공
SELECT COUNT(*) as remaining_duplicates
FROM (
  SELECT "storagePath"
  FROM "ProductImage"
  WHERE "deletedAt" IS NULL
  GROUP BY "storagePath"
  HAVING COUNT(*) > 1
) subq;

-- Phase 4: 로그 (검증 용도)
-- 정리된 레코드 수 확인
SELECT
  COUNT(*) FILTER (WHERE "deletedAt" >= CURRENT_TIMESTAMP - INTERVAL '1 minute') as cleaned_records,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE "deletedAt" IS NULL) as active_records
FROM "ProductImage";

COMMIT;
