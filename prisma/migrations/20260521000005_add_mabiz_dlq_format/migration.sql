-- P1-4/P1-11: MabizSyncDLQ에 form-data 형식 메타 필드 추가

ALTER TABLE "MabizSyncDLQ"
ADD COLUMN "format" VARCHAR(20) DEFAULT 'json';

-- 코멘트
COMMENT ON COLUMN "MabizSyncDLQ"."format" IS 'Webhook 페이로드 형식: json (기본) 또는 form-data (PayApp)';

-- 인덱스 (format별 DLQ 조회 최적화)
CREATE INDEX "idx_mabiz_dlq_format_status" ON "MabizSyncDLQ"("format", "resolvedAt");
