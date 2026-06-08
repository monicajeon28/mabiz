-- AddColumn passportRequestId to SmsLog
ALTER TABLE "SmsLog" ADD COLUMN "passportRequestId" TEXT;

-- CreateIndex on passportRequestId for faster queries
CREATE INDEX "SmsLog_passportRequestId_sentAt_idx" ON "SmsLog"("passportRequestId", "sentAt");
