-- Add Cloudinary image fields to AffiliateProfile
ALTER TABLE "AffiliateProfile" ADD COLUMN "promoImageId" VARCHAR(100);
ALTER TABLE "AffiliateProfile" ADD COLUMN "promoImageUrl" TEXT;
ALTER TABLE "AffiliateProfile" ADD COLUMN "coverImageId" VARCHAR(100);
ALTER TABLE "AffiliateProfile" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "AffiliateProfile" ADD COLUMN "featuredImageId" VARCHAR(100);
ALTER TABLE "AffiliateProfile" ADD COLUMN "featuredImageUrl" TEXT;

-- Add Cloudinary image fields to AffiliateMedia
ALTER TABLE "AffiliateMedia" ADD COLUMN "affiliateId" INTEGER;
ALTER TABLE "AffiliateMedia" ADD COLUMN "cloudinaryPublicId" VARCHAR(100);
ALTER TABLE "AffiliateMedia" ADD COLUMN "cloudinaryUrl" TEXT;
ALTER TABLE "AffiliateMedia" ADD COLUMN "imageType" TEXT;

-- Create index for affiliate images
CREATE INDEX "AffiliateMedia_affiliateId_imageType_idx" ON "AffiliateMedia"("affiliateId", "imageType");
