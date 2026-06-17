-- ============================================================
-- Jeff Bezos: Email Batch Processing + SMS 병렬 처리 (2026-06-16)
-- ============================================================

-- Email Day 0-3 스케줄 메시지
CREATE TABLE "ScheduledEmailMessage" (
  "id"             TEXT        NOT NULL,
  "organizationId" TEXT        NOT NULL,
  "contactId"      TEXT        NOT NULL,
  "groupId"        TEXT,
  "day"            INTEGER     NOT NULL,

  -- Email 콘텐츠
  "subject"        TEXT        NOT NULL,
  "htmlContent"    TEXT        NOT NULL,
  "textContent"    TEXT,
  "variables"      JSONB,

  -- 발송 상태
  "status"         TEXT        NOT NULL DEFAULT 'PENDING',
  "scheduledAt"    TIMESTAMPTZ NOT NULL,
  "sentAt"         TIMESTAMPTZ,
  "failureReason"  TEXT,

  -- 외부 제공자 추적
  "provider"       TEXT        NOT NULL DEFAULT 'GMAIL',
  "messageId"      VARCHAR(256),
  "trackingId"     VARCHAR(256),

  -- 이벤트 추적
  "openedAt"       TIMESTAMPTZ,
  "clickedAt"      TIMESTAMPTZ,
  "bounceType"     TEXT,

  -- 메타데이터
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "ScheduledEmailMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduledEmailMessage_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "ScheduledEmailMessage_org_day_status_scheduled_idx"
  ON "ScheduledEmailMessage"("organizationId", "day", "status", "scheduledAt");
CREATE INDEX "ScheduledEmailMessage_group_day_status_idx"
  ON "ScheduledEmailMessage"("groupId", "day", "status");
CREATE INDEX "ScheduledEmailMessage_contact_day_scheduled_idx"
  ON "ScheduledEmailMessage"("contactId", "day", "scheduledAt");
CREATE INDEX "ScheduledEmailMessage_status_scheduled_idx"
  ON "ScheduledEmailMessage"("status", "scheduledAt");

-- senderUserId 필드 추가 (UserEmailConfig 연결용)
-- 20260616000000_add_user_email_config 에서 이동됨
ALTER TABLE "ScheduledEmailMessage"
  ADD COLUMN IF NOT EXISTS "senderUserId" TEXT;


-- 배치 실행 로그 (성능 모니터링)
CREATE TABLE "BatchExecutionLog" (
  "id"             TEXT        NOT NULL,
  "organizationId" TEXT        NOT NULL,
  "batchType"      TEXT        NOT NULL,

  -- 처리 통계
  "totalCount"     INTEGER     NOT NULL,
  "successCount"   INTEGER     NOT NULL,
  "failCount"      INTEGER     NOT NULL,

  -- 타이밍
  "startedAt"      TIMESTAMPTZ NOT NULL,
  "completedAt"    TIMESTAMPTZ NOT NULL,
  "duration"       INTEGER     NOT NULL,

  -- 성능 메트릭
  "averageLatency" DOUBLE PRECISION,
  "peakQueueSize"  INTEGER,
  "errorRate"      DOUBLE PRECISION,

  -- 디버깅
  "errorSummary"   TEXT,
  "logUrl"         TEXT,

  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "BatchExecutionLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BatchExecutionLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "BatchExecutionLog_org_batchtype_started_idx"
  ON "BatchExecutionLog"("organizationId", "batchType", "startedAt");
CREATE INDEX "BatchExecutionLog_started_duration_idx"
  ON "BatchExecutionLog"("startedAt", "duration");


-- SMS 배치 실행 로그 (ScheduledSms와의 연결용)
CREATE TABLE "SmsBatchExecution" (
  "id"               TEXT        NOT NULL,
  "organizationId"   TEXT        NOT NULL,
  "batchExecutionId" TEXT        NOT NULL,
  "day"              INTEGER     NOT NULL,

  -- 처리된 메시지들
  "scheduledSmsIds"  TEXT[]      NOT NULL DEFAULT '{}',

  -- 상태
  "status"           TEXT        NOT NULL DEFAULT 'PENDING',

  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "SmsBatchExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmsBatchExecution_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "SmsBatchExecution_org_day_status_idx"
  ON "SmsBatchExecution"("organizationId", "day", "status");
