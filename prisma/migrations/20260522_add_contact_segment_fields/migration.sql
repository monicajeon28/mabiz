-- Add segment classification fields to Contact model
-- Phase 3 Track C: Auto-segment classification based on demographics

-- Add new columns for segment classification
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "marriageStatus" VARCHAR(20);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "marriageDate" TIMESTAMPTZ;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "childrenAges" INTEGER[];
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "childrenPlanned" VARCHAR(20);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "ageInYears" INT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "autoSegment" VARCHAR(20) DEFAULT 'unclassified';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "segmentUpdatedAt" TIMESTAMPTZ DEFAULT now();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_contact_org_segment" ON "Contact"("organizationId", "autoSegment");
CREATE INDEX IF NOT EXISTS "idx_contact_marriage_date" ON "Contact"("marriageDate");
CREATE INDEX IF NOT EXISTS "idx_contact_children_ages" ON "Contact" USING GIN("childrenAges");

-- Set segmentUpdatedAt to current timestamp for existing rows if not set
UPDATE "Contact" SET "segmentUpdatedAt" = now() WHERE "segmentUpdatedAt" IS NULL;
