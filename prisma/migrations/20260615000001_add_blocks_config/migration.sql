-- Phase C: 블록 기반 에디터 설정 추가 (2026-06-15)
ALTER TABLE "CrmLandingPage" ADD COLUMN "blocksConfig" JSONB;

-- 인덱스 생성 (선택적)
CREATE INDEX "CrmLandingPage_blocksConfig_idx" ON "CrmLandingPage" USING gin ("blocksConfig");
