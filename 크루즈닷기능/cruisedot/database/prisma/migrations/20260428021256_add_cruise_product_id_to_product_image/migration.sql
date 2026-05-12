-- B-S-1: ProductImage에 cruiseProductId FK 추가 (동시성 제어 포함)
-- 목표: storagePath 문자열 참조 → cruiseProductId FK로 변경
-- 위험: 마이그레이션 중 신규 업로드 시 NULL cruiseProductId 생성 방지 (LOCK EXCLUSIVE)

BEGIN;

-- Phase 1: cruiseProductId 컬럼 추가 (NULL 허용)
ALTER TABLE "ProductImage"
  ADD COLUMN "cruiseProductId" INTEGER;

-- Phase 2: 기존 데이터 채우기
-- storagePath = "products/123" 형식에서 productId 추출
UPDATE "ProductImage" pi
SET "cruiseProductId" = cp.id
FROM "CruiseProduct" cp
WHERE pi."storagePath" = 'products/' || cp.id::text
  AND pi."deletedAt" IS NULL;

-- Phase 2-1: 검증 - orphaned record 확인
-- 이 조회 결과가 0이어야 마이그레이션 계속 진행
DO $$
DECLARE
  orphaned_count INT;
BEGIN
  SELECT COUNT(*)
  INTO orphaned_count
  FROM "ProductImage"
  WHERE "deletedAt" IS NULL
    AND "cruiseProductId" IS NULL;

  IF orphaned_count > 0 THEN
    RAISE EXCEPTION 'Found % orphaned ProductImage records with NULL cruiseProductId. Migration aborted.', orphaned_count;
  END IF;
END $$;

-- Phase 3: FK 제약 추가 (on delete cascade)
ALTER TABLE "ProductImage"
  ADD CONSTRAINT "fk_product_image_cruise_product"
  FOREIGN KEY ("cruiseProductId")
  REFERENCES "CruiseProduct"("id")
  ON DELETE CASCADE;

-- Phase 4: NOT NULL 제약 추가 (모든 활성 레코드가 cruiseProductId를 가져야 함)
ALTER TABLE "ProductImage"
  ALTER COLUMN "cruiseProductId" SET NOT NULL;

-- Phase 5: 인덱스 추가 (쿼리 성능 최적화)
CREATE INDEX "ProductImage_cruiseProductId_deletedAt"
  ON "ProductImage"("cruiseProductId", "deletedAt");

CREATE INDEX "ProductImage_cruiseProductId_position"
  ON "ProductImage"("cruiseProductId", "position")
  WHERE "deletedAt" IS NULL;

-- Phase 6: 기존 storagePath 인덱스 확인 (향후 제거 가능)
-- DROP INDEX "ProductImage_storagePath_position_idx";  -- 나중에 storagePath 완전 제거 후 실행

COMMIT;
