-- AddColumn passportRequestId to CrmSmsLog
ALTER TABLE "CrmSmsLog" ADD COLUMN "passportRequestId" TEXT;

-- CreateIndex on passportRequestId for faster queries
CREATE INDEX "CrmSmsLog_passportRequestId_sentAt_idx" ON "CrmSmsLog"("passportRequestId", "sentAt");
