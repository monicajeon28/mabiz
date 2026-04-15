-- Migration: add_funnel_type_link_url
-- 실행 방법: Neon 대시보드 → SQL Editor에 붙여넣기 후 실행
-- 또는 mabiz가 배포된 환경(Vercel/서버)에서 npx prisma db push 실행

-- 1. Funnel 모델에 funnelType 추가
ALTER TABLE "Funnel" ADD COLUMN IF NOT EXISTS "funnelType" TEXT NOT NULL DEFAULT 'GENERAL';

-- 2. FunnelStage 모델에 linkUrl 추가
ALTER TABLE "FunnelStage" ADD COLUMN IF NOT EXISTS "linkUrl" TEXT;

-- 확인 쿼리
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('Funnel', 'FunnelStage')
  AND column_name IN ('funnelType', 'linkUrl')
ORDER BY table_name, column_name;
