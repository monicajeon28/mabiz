-- AddColumn: Google Drive backup fields to GmPassportSubmissionGuest
ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "googleDriveFileId" TEXT;
ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "lastBackupAt" TIMESTAMP;
ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "backupStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable: PassportBackupLog
CREATE TABLE "PassportBackupLog" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "guestId" INTEGER NOT NULL,
  "googleDriveFileId" TEXT,
  "backupTime" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PassportBackupLog_status_idx" ON "PassportBackupLog"("status");
CREATE INDEX "PassportBackupLog_guestId_idx" ON "PassportBackupLog"("guestId");
CREATE INDEX "PassportBackupLog_createdAt_idx" ON "PassportBackupLog"("createdAt");

-- CreateIndex: for GmPassportSubmissionGuest
CREATE INDEX "PassportSubmissionGuest_backupStatus_idx" ON "PassportSubmissionGuest"("backupStatus");
