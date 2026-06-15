-- Phase 4: Contract Reminder Cron Job
-- Add fields for contract reminder tracking and retry logic

-- Add reminder tracking fields to ContractInstance
ALTER TABLE "ContractInstance" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContractInstance" ADD COLUMN "lastReminderSentAt" TIMESTAMP(3);
ALTER TABLE "ContractInstance" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;

-- Create indexes for cron job performance
CREATE INDEX "idx_contract_instance_reminder_lookup"
ON "ContractInstance"("organizationId", "status", "createdAt")
WHERE "status" = 'SENT' AND "reminderCount" < 3;

CREATE INDEX "idx_contract_instance_last_reminder_sent"
ON "ContractInstance"("organizationId", "lastReminderSentAt");

-- Allow null for expiresAt if not already nullable
-- (Already nullable in schema, so this is just documentation)

-- Verify migration
SELECT COUNT(*) as contract_instance_count FROM "ContractInstance";
