-- P1-6: DLQ status 필드 추가

ALTER TABLE "MabizSyncDLQ"
ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- 기존 데이터 마이그레이션
UPDATE "MabizSyncDLQ"
SET "status" = CASE
  WHEN "resolvedAt" IS NOT NULL THEN 'RESOLVED'
  WHEN "nextRetryAt" <= NOW() THEN 'PENDING'
  ELSE 'PENDING'
END;

-- 상태별 인덱스
CREATE INDEX "idx_dlq_status" ON "MabizSyncDLQ"("status");
CREATE INDEX "idx_dlq_status_nextretry" ON "MabizSyncDLQ"("status", "nextRetryAt");

-- 코멘트
COMMENT ON COLUMN "MabizSyncDLQ"."status" IS 'DLQ 항목 상태: PENDING (대기) / PROCESSING (처리중) / RESOLVED (완료) / FAILED (실패)';
