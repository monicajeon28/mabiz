-- Add pause/cancel fields to ScheduledMessageLog
ALTER TABLE "ScheduledMessageLog" 
ADD COLUMN "pausedAt" TIMESTAMP(3),
ADD COLUMN "pausedBy" INTEGER,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledBy" INTEGER,
ADD COLUMN "cancelReason" TEXT;

-- Create AutomationLog table
CREATE TABLE "AutomationLog" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionDetails" JSONB,
    "relatedId" INTEGER,
    "relatedType" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationLog_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "ScheduledMessageLog" 
ADD CONSTRAINT "ScheduledMessageLog_pausedBy_fkey" 
FOREIGN KEY ("pausedBy") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "ScheduledMessageLog" 
ADD CONSTRAINT "ScheduledMessageLog_cancelledBy_fkey" 
FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "AutomationLog" 
ADD CONSTRAINT "AutomationLog_createdBy_fkey" 
FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add indexes
CREATE INDEX "ScheduledMessageLog_status_pausedAt_cancelledAt_idx" ON "ScheduledMessageLog"("status", "pausedAt", "cancelledAt");
CREATE INDEX "AutomationLog_organizationId_createdAt_idx" ON "AutomationLog"("organizationId", "createdAt");
CREATE INDEX "AutomationLog_organizationId_action_createdAt_idx" ON "AutomationLog"("organizationId", "action", "createdAt");
CREATE INDEX "AutomationLog_relatedType_relatedId_idx" ON "AutomationLog"("relatedType", "relatedId");
