-- Add segment and recommendedProduct fields to Contact model
ALTER TABLE "Contact" ADD COLUMN "segment" TEXT;
ALTER TABLE "Contact" ADD COLUMN "recommendedProduct" TEXT;

-- Add index for segment column for faster queries
CREATE INDEX "idx_contact_segment" ON "Contact"("segment");
