-- Add channel field to AdminMessage table for better compliance tracking
ALTER TABLE "AdminMessage" ADD COLUMN "channel" VARCHAR(20) NOT NULL DEFAULT 'GROUP';

-- Create indexes for channel-based filtering
CREATE INDEX "idx_admin_message_channel" ON "AdminMessage"("organizationId", "channel");
CREATE INDEX "idx_admin_message_type_channel" ON "AdminMessage"("organizationId", "messageType", "channel");
