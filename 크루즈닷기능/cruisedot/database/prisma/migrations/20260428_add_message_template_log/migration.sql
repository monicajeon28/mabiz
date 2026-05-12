-- A-6: MessageTemplate + MessageLog 추가, UserPreference 필드 확장
-- 목적: 메시징 시스템 핵심 테이블 (B-3 탈퇴자 차단, B-6 마스킹 기반)
-- 롤백: DROP TABLE "MessageLog"; DROP TABLE "MessageTemplate";
--       ALTER TABLE "UserPreference" DROP COLUMN "pushEnabled", DROP COLUMN "marketingConsent",
--       DROP COLUMN "consentDate", DROP COLUMN "withdrawalDate", DROP COLUMN "unsubscribeToken";

BEGIN;

-- MessageTemplate: 메시지 템플릿 관리
CREATE TABLE "MessageTemplate" (
  "id"        SERIAL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "channel"   TEXT NOT NULL,              -- PUSH|EMAIL|SMS
  "locale"    TEXT NOT NULL DEFAULT 'ko-KR',
  "subject"   TEXT,
  "content"   TEXT NOT NULL,              -- Handlebars 템플릿
  "variables" TEXT[] NOT NULL DEFAULT '{}',
  "status"    TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "MessageTemplate_name_key" UNIQUE ("name")
);

CREATE INDEX "MessageTemplate_channel_status_idx" ON "MessageTemplate"("channel", "status");

-- MessageLog: 메시지 발송 이력 (12개월 후 소프트 삭제)
CREATE TABLE "MessageLog" (
  "id"              SERIAL PRIMARY KEY,
  "affiliateId"     INTEGER,
  "userId"          INTEGER,
  "templateId"      INTEGER NOT NULL,
  "channel"         TEXT NOT NULL,
  "recipient"       TEXT NOT NULL,       -- 실제 이메일/폰 (DB 내부용)
  "recipientMasked" TEXT NOT NULL,       -- "a****@gmail.com" (API 응답용)
  "content"         TEXT NOT NULL,
  "variables"       JSONB NOT NULL DEFAULT '{}',
  "status"          TEXT NOT NULL DEFAULT 'QUEUED',  -- QUEUED|SENT|FAILED|BOUNCED
  "sentAt"          TIMESTAMPTZ,
  "failureReason"   TEXT,
  "retryCount"      INTEGER NOT NULL DEFAULT 0,
  "maxRetries"      INTEGER NOT NULL DEFAULT 3,
  "nextRetryAt"     TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt"       TIMESTAMPTZ,
  CONSTRAINT "fk_message_log_template" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id")
);

CREATE INDEX "MessageLog_userId_status_createdAt_idx" ON "MessageLog"("userId", "status", "createdAt");
CREATE INDEX "MessageLog_channel_status_idx" ON "MessageLog"("channel", "status");
CREATE INDEX "MessageLog_nextRetryAt_idx" ON "MessageLog"("nextRetryAt");
CREATE INDEX "MessageLog_deletedAt_idx" ON "MessageLog"("deletedAt");

-- UserPreference: 마케팅 수신 동의 필드 추가 (기존 테이블 확장)
ALTER TABLE "UserPreference"
  ADD COLUMN IF NOT EXISTS "pushEnabled"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "consentDate"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "withdrawalDate"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;

-- unsubscribeToken은 이메일 수신거부 링크용 (UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_unsubscribeToken_key"
  ON "UserPreference"("unsubscribeToken")
  WHERE "unsubscribeToken" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "UserPreference_marketingConsent_withdrawalDate_idx"
  ON "UserPreference"("marketingConsent", "withdrawalDate");

COMMIT;
