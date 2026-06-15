-- Migration: 개인별 이메일 SMTP 설정 (UserEmailConfig)
-- UserSmsConfig 패턴과 동일 — 개인 > 그룹 > 조직 순서 폴백

-- UserEmailConfig 테이블 생성
CREATE TABLE "UserEmailConfig" (
  "id"                    TEXT NOT NULL,
  "organizationId"        TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "emailProvider"         TEXT NOT NULL DEFAULT 'SMTP',
  "senderName"            TEXT NOT NULL DEFAULT '',
  "senderEmail"           TEXT NOT NULL DEFAULT '',
  "smtpHost"              TEXT,
  "smtpPort"              INTEGER DEFAULT 587,
  "smtpUsername"          TEXT,
  "smtpPasswordEncrypted" TEXT,
  "smtpSecure"            BOOLEAN DEFAULT false,
  "isActive"              BOOLEAN NOT NULL DEFAULT false,
  "isVerified"            BOOLEAN NOT NULL DEFAULT false,
  "testedAt"              TIMESTAMP(3),
  "testResult"            TEXT,
  "testErrorMessage"      TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserEmailConfig_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: 사용자당 1개 설정
CREATE UNIQUE INDEX "UserEmailConfig_userId_organizationId_key"
  ON "UserEmailConfig"("userId", "organizationId");

-- 조직별 조회 인덱스
CREATE INDEX "UserEmailConfig_organizationId_idx"
  ON "UserEmailConfig"("organizationId");

-- Foreign key: Organization
ALTER TABLE "UserEmailConfig"
  ADD CONSTRAINT "UserEmailConfig_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ScheduledEmailMessage에 senderUserId 필드 추가
ALTER TABLE "ScheduledEmailMessage"
  ADD COLUMN IF NOT EXISTS "senderUserId" TEXT;
