-- Add orientation column to ImageAsset table
ALTER TABLE "ImageAsset" ADD COLUMN "orientation" INTEGER NOT NULL DEFAULT 1;

-- Add index for orientation queries if needed
CREATE INDEX "ImageAsset_org_orientation_idx" ON "ImageAsset"("organizationId", "orientation");
