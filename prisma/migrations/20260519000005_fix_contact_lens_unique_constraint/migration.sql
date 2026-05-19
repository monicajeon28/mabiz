-- Migration: ContactLensClassification unique constraint 수정 (테넌트 격리)
-- Date: 2026-05-19
-- Description: @@unique([contactId, lensType]) → @@unique([organizationId, contactId, lensType])
-- Reason: 다른 조직의 contactId와 충돌 방지, IDOR 취약점 해결

BEGIN;

-- 기존 단일 unique 제약 삭제
ALTER TABLE "ContactLensClassification" DROP CONSTRAINT IF EXISTS "ContactLensClassification_contactId_lensType_key";

-- 새로운 복합 unique 제약 추가 (organizationId 포함)
ALTER TABLE "ContactLensClassification" ADD CONSTRAINT "ContactLensClassification_organizationId_contactId_lensType_key" UNIQUE (organizationId, contactId, lensType);

-- 데이터 무결성 검증
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ContactLensClassification'
    AND constraint_name = 'ContactLensClassification_organizationId_contactId_lensType_key'
    AND constraint_type = 'UNIQUE'
  ) THEN
    RAISE EXCEPTION 'ContactLensClassification unique constraint update failed';
  END IF;
END;
$$;

COMMIT;
