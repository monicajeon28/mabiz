-- Add folder structure fields to ProductImage
ALTER TABLE "ProductImage" ADD COLUMN "cloudinaryFolder" VARCHAR(255);
ALTER TABLE "ProductImage" ADD COLUMN "folderPath" VARCHAR(500);

-- Add composite index for folder structure queries
CREATE INDEX "ProductImage_cloudinaryFolder_folderPath_idx" ON "ProductImage"("cloudinaryFolder", "folderPath");
