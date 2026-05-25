-- Add reactivation fields to Contact model
ALTER TABLE "Contact" ADD COLUMN "reactivationSegment" VARCHAR(20),
ADD COLUMN "reactivationLikelihood" INTEGER DEFAULT 0,
ADD COLUMN "smsDay0Sent" BOOLEAN DEFAULT false,
ADD COLUMN "smsDay0SentAt" TIMESTAMP,
ADD COLUMN "smsDay1Sent" BOOLEAN DEFAULT false,
ADD COLUMN "smsDay1SentAt" TIMESTAMP,
ADD COLUMN "smsDay2Sent" BOOLEAN DEFAULT false,
ADD COLUMN "smsDay2SentAt" TIMESTAMP,
ADD COLUMN "smsDay3Sent" BOOLEAN DEFAULT false,
ADD COLUMN "smsDay3SentAt" TIMESTAMP,
ADD COLUMN "lastCruiseDate" TIMESTAMP,
ADD COLUMN "lastSatisfactionScore" INTEGER,
ADD COLUMN "cruiseCount" INTEGER DEFAULT 0,
ADD COLUMN "vipStatus" VARCHAR(20);

-- Create indexes for reactivation queries
CREATE INDEX "idx_contact_reactivation_segment" ON "Contact"("organizationId", "reactivationSegment");
CREATE INDEX "idx_contact_reactivation_likelihood" ON "Contact"("organizationId", "reactivationLikelihood" DESC);
CREATE INDEX "idx_contact_last_cruise_date" ON "Contact"("organizationId", "lastCruiseDate");
CREATE INDEX "idx_contact_reactivation_sms_status" ON "Contact"("organizationId", "smsDay0Sent", "smsDay1Sent", "smsDay2Sent", "smsDay3Sent");
