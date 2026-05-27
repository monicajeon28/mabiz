-- Add msg field to SmsLog (for tracking actual message content)
ALTER TABLE "CrmSmsLog" ADD COLUMN IF NOT EXISTS "msg" TEXT DEFAULT '';

-- Update existing records with contentPreview if msg is empty
UPDATE "CrmSmsLog" SET "msg" = "contentPreview" WHERE "msg" = '' OR "msg" IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "idx_CrmSmsLog_msg_status" ON "CrmSmsLog"("organizationId", "status", "sentAt");
