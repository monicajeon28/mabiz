-- ScheduledSms: 예약 발송 테이블 신규
CREATE TABLE "ScheduledSms" (
  "id"              TEXT        NOT NULL,
  "organizationId"  TEXT        NOT NULL,
  "contactId"       TEXT,
  "groupId"         TEXT,
  "message"         TEXT        NOT NULL,
  "scheduledAt"     TIMESTAMPTZ NOT NULL,
  "status"          TEXT        NOT NULL DEFAULT 'PENDING',
  "sentAt"          TIMESTAMPTZ,
  "sentCount"       INTEGER     NOT NULL DEFAULT 0,
  "failedCount"     INTEGER     NOT NULL DEFAULT 0,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ScheduledSms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduledSms_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX "ScheduledSms_orgId_status_scheduledAt_idx"
  ON "ScheduledSms"("organizationId", "status", "scheduledAt");
CREATE INDEX "ScheduledSms_scheduledAt_status_idx"
  ON "ScheduledSms"("scheduledAt", "status");
