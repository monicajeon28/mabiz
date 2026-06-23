-- AddColumn: Google Drive backup fields to GmPassportSubmissionGuest
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='PassportSubmissionGuest' AND column_name='googleDriveFileId') THEN
    ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "googleDriveFileId" TEXT;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='PassportSubmissionGuest' AND column_name='lastBackupAt') THEN
    ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "lastBackupAt" TIMESTAMP;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='PassportSubmissionGuest' AND column_name='backupStatus') THEN
    ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "backupStatus" TEXT NOT NULL DEFAULT 'pending';
  END IF;
END $$;

-- CreateTable: PassportBackupLog (if not exists)
CREATE TABLE IF NOT EXISTS "PassportBackupLog" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "guestId" INTEGER NOT NULL,
  "googleDriveFileId" TEXT,
  "backupTime" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex (if not exists)
CREATE INDEX IF NOT EXISTS "PassportBackupLog_status_idx" ON "PassportBackupLog"("status");
CREATE INDEX IF NOT EXISTS "PassportBackupLog_guestId_idx" ON "PassportBackupLog"("guestId");
CREATE INDEX IF NOT EXISTS "PassportBackupLog_createdAt_idx" ON "PassportBackupLog"("createdAt");

-- CreateIndex: for GmPassportSubmissionGuest (if not exists)
CREATE INDEX IF NOT EXISTS "PassportSubmissionGuest_backupStatus_idx" ON "PassportSubmissionGuest"("backupStatus");
