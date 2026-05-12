-- Add position field to ProductImage for image ordering
ALTER TABLE "ProductImage" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Create composite index for efficient sorting by product and position
CREATE INDEX "ProductImage_storagePath_position_idx" ON "ProductImage"("storagePath", "position");
