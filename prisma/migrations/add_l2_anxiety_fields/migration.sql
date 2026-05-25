-- Menu #48: L2 렌즈 - 준비 불안도 필드 추가

ALTER TABLE "Contact" ADD COLUMN "anxietyScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN "anxietyCategory" VARCHAR(20) DEFAULT 'low';
ALTER TABLE "Contact" ADD COLUMN "preparationStage" VARCHAR(50) DEFAULT 'inquiry';
ALTER TABLE "Contact" ADD COLUMN "visaRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "passportDaysLeft" INTEGER;
ALTER TABLE "Contact" ADD COLUMN "firstTimeCruise" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "familyWithKids" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "healthConcerns" TEXT;
ALTER TABLE "Contact" ADD COLUMN "anxietyAssessmentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "anxietySequenceStartedAt" TIMESTAMP(3);

-- 인덱스 추가
CREATE INDEX "idx_contact_anxiety_category" ON "Contact"("anxietyCategory");
CREATE INDEX "idx_contact_preparation_stage" ON "Contact"("preparationStage");
CREATE INDEX "idx_contact_visa_required" ON "Contact"("visaRequired");
CREATE INDEX "idx_contact_anxiety_score" ON "Contact"("anxietyScore");
