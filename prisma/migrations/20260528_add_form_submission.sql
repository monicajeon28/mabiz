-- CreateTable FormSubmission (Loop 5-C A/B 테스트)
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variant" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "completionTimeMs" INTEGER NOT NULL,
    "ageRange" TEXT NOT NULL,
    "preferenceType" TEXT NOT NULL,
    "affiliateCode" TEXT,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex on createdAt for time-series queries
CREATE INDEX "FormSubmission_createdAt_idx" ON "FormSubmission"("createdAt");

-- CreateIndex on variant for A/B test aggregation
CREATE INDEX "FormSubmission_variant_idx" ON "FormSubmission"("variant");

-- CreateIndex on segment for segment-wise analysis
CREATE INDEX "FormSubmission_segment_idx" ON "FormSubmission"("segment");

-- Composite index for daily aggregation (variant + date)
CREATE INDEX "FormSubmission_variant_createdAt_idx" ON "FormSubmission"("variant", "createdAt");
