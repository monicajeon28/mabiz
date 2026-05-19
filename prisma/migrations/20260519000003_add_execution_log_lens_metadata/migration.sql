-- Migration: ExecutionLog lensMetadata 칼럼 추가 (Phase 4)
-- Date: 2026-05-19
-- Description: 렌즈 분류 메타데이터를 ExecutionLog에 저장

BEGIN;

ALTER TABLE "ExecutionLog" ADD COLUMN IF NOT EXISTS "lensMetadata" JSONB;

-- 데이터 무결성 검증
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ExecutionLog' AND column_name = 'lensMetadata') THEN
    RAISE EXCEPTION 'ExecutionLog.lensMetadata column creation failed';
  END IF;
END;
$$;

COMMIT;
