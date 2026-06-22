-- Phase 1B: Passport ImageAsset FK + Google Drive OCR field
-- Add imageAssetId FK to PassportSubmissionGuest (Option A: ImageAsset FK 재사용)
ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "imageAssetId" TEXT;
ALTER TABLE "PassportSubmissionGuest" ADD COLUMN "googleDriveFileIdOcr" TEXT;

-- Add Foreign Key constraint for imageAssetId
ALTER TABLE "PassportSubmissionGuest" ADD CONSTRAINT "PassportSubmissionGuest_imageAssetId_fkey"
  FOREIGN KEY ("imageAssetId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX "PassportSubmissionGuest_imageAssetId_idx" ON "PassportSubmissionGuest"("imageAssetId");
CREATE INDEX "PassportSubmissionGuest_backupStatus_lastBackupAt_idx" ON "PassportSubmissionGuest"("backupStatus", "lastBackupAt");

-- Verify: ImageAsset reverse relation (passportGuests) is defined in Prisma schema only
-- No DB changes needed for reverse relation in PostgreSQL
