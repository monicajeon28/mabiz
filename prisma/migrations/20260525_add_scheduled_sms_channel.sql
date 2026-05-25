-- AddColumn: Add channel field to ScheduledSms
-- Purpose: Track SMS campaign type (DAY0_INIT, DAY1_OBJECTION, DAY2_VALUE, DAY3_ACTION, DAY7_FOLLOWUP, etc.)

ALTER TABLE "ScheduledSms" ADD COLUMN "channel" VARCHAR(50) DEFAULT 'GENERAL';
CREATE INDEX "idx_scheduled_sms_channel" ON "ScheduledSms"("channel");
CREATE INDEX "idx_scheduled_sms_org_channel_status" ON "ScheduledSms"("organizationId", "channel", "status");
