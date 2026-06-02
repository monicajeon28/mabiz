-- Migration: add-funnel-sms
-- Scope: FunnelSms feature only (idempotent guards used because the live DB has
-- pre-existing drift from migration history; we touch ONLY FunnelSms objects).

-- CreateTable: FunnelSms
CREATE TABLE IF NOT EXISTS "FunnelSms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "senderPhone" TEXT,
    "category" TEXT,
    "description" TEXT,
    "sendHour" INTEGER NOT NULL DEFAULT 10,
    "sendMinute" INTEGER NOT NULL DEFAULT 0,
    "arsNum" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelSms_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FunnelSmsMessage
CREATE TABLE IF NOT EXISTS "FunnelSmsMessage" (
    "id" TEXT NOT NULL,
    "funnelSmsId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "daysAfter" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "msgType" VARCHAR(5) NOT NULL DEFAULT 'SMS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FunnelSmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FunnelSms_organizationId_idx" ON "FunnelSms"("organizationId");
CREATE INDEX IF NOT EXISTS "FunnelSmsMessage_funnelSmsId_idx" ON "FunnelSmsMessage"("funnelSmsId");
CREATE UNIQUE INDEX IF NOT EXISTS "FunnelSmsMessage_funnelSmsId_order_key" ON "FunnelSmsMessage"("funnelSmsId", "order");

-- AlterTable: ContactGroup add funnelSmsId (FunnelSms feature only)
ALTER TABLE "ContactGroup" ADD COLUMN IF NOT EXISTS "funnelSmsId" TEXT;

-- AlterTable: widen ScheduledSms.channel VarChar(50) -> VarChar(100) for FUNNEL_SMS:cuid:cuid keys
ALTER TABLE "ScheduledSms" ALTER COLUMN "channel" SET DATA TYPE VARCHAR(100);

-- AddForeignKey: FunnelSms -> Organization (tenant isolation, cascade on org delete)
DO $$ BEGIN
  ALTER TABLE "FunnelSms" ADD CONSTRAINT "FunnelSms_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: FunnelSmsMessage -> FunnelSms (cascade on parent delete)
DO $$ BEGIN
  ALTER TABLE "FunnelSmsMessage" ADD CONSTRAINT "FunnelSmsMessage_funnelSmsId_fkey"
    FOREIGN KEY ("funnelSmsId") REFERENCES "FunnelSms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey: ContactGroup.funnelSmsId -> FunnelSms (SetNull on delete)
DO $$ BEGIN
  ALTER TABLE "ContactGroup" ADD CONSTRAINT "ContactGroup_funnelSmsId_fkey"
    FOREIGN KEY ("funnelSmsId") REFERENCES "FunnelSms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
