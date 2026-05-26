-- Add Day 0-3 SMS Sequence models
-- Migration: 2026-05-27

-- Create SmsSequenceTemplate table
CREATE TABLE IF NOT EXISTS "SmsSequenceTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "productCode" TEXT,
  "psychologyLens" TEXT,
  "sequenceType" TEXT NOT NULL DEFAULT 'DAY_0_3',
  "day0TemplateId" TEXT,
  "day1TemplateId" TEXT,
  "day2TemplateId" TEXT,
  "day3TemplateId" TEXT,
  "day0Delay" INTEGER NOT NULL DEFAULT 0,
  "day1Delay" INTEGER NOT NULL DEFAULT 1440,
  "day2Delay" INTEGER NOT NULL DEFAULT 2880,
  "day3Delay" INTEGER NOT NULL DEFAULT 4320,
  "conditions" JSONB,
  "triggerOn" TEXT NOT NULL DEFAULT 'PURCHASE',
  "totalSent" INTEGER NOT NULL DEFAULT 0,
  "totalOpened" INTEGER NOT NULL DEFAULT 0,
  "totalClicked" INTEGER NOT NULL DEFAULT 0,
  "totalConverted" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "deployedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmsSequenceTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

-- Create indexes for SmsSequenceTemplate
CREATE INDEX "idx_sms_sequence_org_status" ON "SmsSequenceTemplate"("organizationId", "status");
CREATE INDEX "idx_sms_sequence_org_product" ON "SmsSequenceTemplate"("organizationId", "productCode");
CREATE INDEX "idx_sms_sequence_org_lens" ON "SmsSequenceTemplate"("organizationId", "psychologyLens");
CREATE INDEX "idx_sms_sequence_org_trigger" ON "SmsSequenceTemplate"("organizationId", "triggerOn");
CREATE INDEX "idx_sms_sequence_org_status_deployed" ON "SmsSequenceTemplate"("organizationId", "status", "deployedAt");

-- Create ContactSequenceInstance table
CREATE TABLE IF NOT EXISTS "ContactSequenceInstance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "day0SentAt" TIMESTAMP(3),
  "day1SentAt" TIMESTAMP(3),
  "day2SentAt" TIMESTAMP(3),
  "day3SentAt" TIMESTAMP(3),
  "day0OpenedAt" TIMESTAMP(3),
  "day1OpenedAt" TIMESTAMP(3),
  "day2OpenedAt" TIMESTAMP(3),
  "day3OpenedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "conversionDay" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "nextSendAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "pausedAt" TIMESTAMP(3),
  "pausedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactSequenceInstance_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "SmsSequenceTemplate" ("id") ON DELETE CASCADE,
  CONSTRAINT "uq_contact_sequence" UNIQUE("contactId", "sequenceId")
);

-- Create indexes for ContactSequenceInstance
CREATE INDEX "idx_instance_org_status_next_send" ON "ContactSequenceInstance"("organizationId", "status", "nextSendAt");
CREATE INDEX "idx_instance_org_status" ON "ContactSequenceInstance"("organizationId", "status");
CREATE INDEX "idx_instance_contact_status" ON "ContactSequenceInstance"("contactId", "status");
CREATE INDEX "idx_instance_sequence_status" ON "ContactSequenceInstance"("sequenceId", "status");
CREATE INDEX "idx_instance_next_send_cron" ON "ContactSequenceInstance"("nextSendAt", "status");

-- Create SmsSequenceVariant table
CREATE TABLE IF NOT EXISTS "SmsSequenceVariant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sequenceId" TEXT NOT NULL,
  "variantCode" TEXT NOT NULL,
  "day" INTEGER NOT NULL,
  "messageContent" TEXT NOT NULL,
  "psychology" TEXT,
  "lensName" TEXT,
  "pasonaStage" TEXT,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "convertCount" INTEGER NOT NULL DEFAULT 0,
  "isWinner" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmsSequenceVariant_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "SmsSequenceTemplate" ("id") ON DELETE CASCADE,
  CONSTRAINT "uq_sequence_variant_day" UNIQUE("sequenceId", "variantCode", "day")
);

-- Create indexes for SmsSequenceVariant
CREATE INDEX "idx_variant_sequence" ON "SmsSequenceVariant"("sequenceId");
CREATE INDEX "idx_variant_sequence_day" ON "SmsSequenceVariant"("sequenceId", "day");
