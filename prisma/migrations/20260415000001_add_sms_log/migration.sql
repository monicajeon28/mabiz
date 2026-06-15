-- CreateTable: SmsLog (문자 발송 내역 로그)
-- 90일 초과 레코드는 daily cron에서 자동 삭제

CREATE TABLE "SmsLog" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId"      TEXT,
    "phone"          TEXT NOT NULL,
    "contentPreview" TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'SENT',
    "blockReason"    TEXT,
    "resultCode"     TEXT,
    "msgId"          TEXT,
    "channel"        TEXT NOT NULL DEFAULT 'FUNNEL',
    "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_orgId_sentAt_idx" ON "SmsLog"("organizationId", "sentAt");
CREATE INDEX "SmsLog_contactId_sentAt_idx" ON "SmsLog"("contactId", "sentAt");

-- AlterTable: Funnel에 funnelType 추가 (이전 manual 마이그레이션 대체)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Funnel') THEN
    ALTER TABLE "Funnel" ADD COLUMN IF NOT EXISTS "funnelType" TEXT NOT NULL DEFAULT 'GENERAL';
  END IF;
END $$;

-- AlterTable: FunnelStage에 linkUrl 추가
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'FunnelStage') THEN
    ALTER TABLE "FunnelStage" ADD COLUMN IF NOT EXISTS "linkUrl" TEXT;
  END IF;
END $$;
