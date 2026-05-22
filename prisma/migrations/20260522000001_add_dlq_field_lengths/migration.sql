-- P1-3: MabizSyncDLQ 필드 길이 제한 추가

-- failureReason: 5000자 (스택 트레이스 10-20줄, 안전한 범위)
ALTER TABLE "MabizSyncDLQ"
ALTER COLUMN "failureReason" TYPE VARCHAR(5000);

-- webhookType: 100자
ALTER TABLE "MabizSyncDLQ"
ALTER COLUMN "webhookType" TYPE VARCHAR(100);

-- webhookUrl: 2000자 (URL 안전 범위)
ALTER TABLE "MabizSyncDLQ"
ALTER COLUMN "webhookUrl" TYPE VARCHAR(2000);

-- 코멘트
COMMENT ON COLUMN "MabizSyncDLQ"."failureReason" IS 'Webhook 처리 실패 사유, 최대 5000자 (truncated 표시)';
COMMENT ON COLUMN "MabizSyncDLQ"."webhookType" IS 'Webhook 타입 (purchase/refund/inquiry 등), 최대 100자';
COMMENT ON COLUMN "MabizSyncDLQ"."webhookUrl" IS 'Webhook 엔드포인트 URL, 최대 2000자';
