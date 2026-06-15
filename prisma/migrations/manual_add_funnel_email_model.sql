-- FunnelEmail 모델 추가 (자동이메일 시퀀스 — FunnelSms와 동일 구조)
-- 실행일: 2026-06-16

CREATE TABLE IF NOT EXISTS "FunnelEmail" (
  "id"              TEXT        NOT NULL,
  "organizationId"  TEXT        NOT NULL,
  "title"           TEXT        NOT NULL,
  "senderName"      TEXT,
  "senderEmail"     TEXT,
  "description"     TEXT,
  "sendHour"        INTEGER     NOT NULL DEFAULT 10,
  "sendMinute"      INTEGER     NOT NULL DEFAULT 0,
  "isActive"        BOOLEAN     NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FunnelEmail_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FunnelEmail_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "FunnelEmailMessage" (
  "id"            TEXT        NOT NULL,
  "funnelEmailId" TEXT        NOT NULL,
  "order"         INTEGER     NOT NULL,
  "daysAfter"     INTEGER     NOT NULL DEFAULT 0,
  "subject"       TEXT        NOT NULL,
  "bodyHtml"      TEXT        NOT NULL,
  "previewText"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FunnelEmailMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FunnelEmailMessage_funnelEmailId_fkey"
    FOREIGN KEY ("funnelEmailId") REFERENCES "FunnelEmail"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FunnelEmailMessage_funnelEmailId_order_key"
    UNIQUE ("funnelEmailId", "order")
);

-- ContactGroup에 funnelEmailId 컬럼 추가 (없는 경우에만)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ContactGroup' AND column_name = 'funnelEmailId'
  ) THEN
    ALTER TABLE "ContactGroup"
      ADD COLUMN "funnelEmailId" TEXT,
      ADD CONSTRAINT "ContactGroup_funnelEmailId_fkey"
        FOREIGN KEY ("funnelEmailId") REFERENCES "FunnelEmail"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS "FunnelEmail_organizationId_idx"
  ON "FunnelEmail"("organizationId");

CREATE INDEX IF NOT EXISTS "FunnelEmailMessage_funnelEmailId_idx"
  ON "FunnelEmailMessage"("funnelEmailId");

CREATE INDEX IF NOT EXISTS "ContactGroup_funnelEmailId_idx"
  ON "ContactGroup"("funnelEmailId");
