-- Menu #55: L5 (자기투영) + L6 (타이밍/손실회피) 이중 렌즈 필드 추가

-- L5 Lens: 자기투영 필드
ALTER TABLE "Contact" ADD COLUMN "selfProjectionScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN "selfProjectionType" VARCHAR(50);
ALTER TABLE "Contact" ADD COLUMN "personalHealthCondition" VARCHAR(100);
ALTER TABLE "Contact" ADD COLUMN "personalHealthConcern" TEXT;
ALTER TABLE "Contact" ADD COLUMN "compoundHealthRisk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "spouseHealthCondition" VARCHAR(100);
ALTER TABLE "Contact" ADD COLUMN "spouseHealthConcern" TEXT;
ALTER TABLE "Contact" ADD COLUMN "familyHealthProfile" JSONB;
ALTER TABLE "Contact" ADD COLUMN "selfProjectionAssessmentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "selfProjectionSequenceStartedAt" TIMESTAMP(3);

-- L6 Lens: 타이밍/손실회피 필드
ALTER TABLE "Contact" ADD COLUMN "timingUrgencyScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN "timingType" VARCHAR(30);
ALTER TABLE "Contact" ADD COLUMN "priceDeadlineDate" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "seatAvailability" INTEGER;
ALTER TABLE "Contact" ADD COLUMN "ageRelevanceScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN "healthWindowStatus" VARCHAR(30);
ALTER TABLE "Contact" ADD COLUMN "lastDecisionWindow" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "decisionWindowExpiresAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "lossAversionPhrase" TEXT;
ALTER TABLE "Contact" ADD COLUMN "medicalAuthorityCredential" VARCHAR(100);
ALTER TABLE "Contact" ADD COLUMN "medicalAuthorityName" VARCHAR(50);
ALTER TABLE "Contact" ADD COLUMN "timingUrgencyAssessmentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "timingUrgencySequenceStartedAt" TIMESTAMP(3);

-- L5+L6 통합 필드
ALTER TABLE "Contact" ADD COLUMN "l5l6CombinedScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contact" ADD COLUMN "l5l6MedicalRiskLevel" VARCHAR(20);
ALTER TABLE "Contact" ADD COLUMN "l5l6SmsDay0Sent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "l5l6SmsDay0SentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "l5l6SmsDay1Sent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "l5l6SmsDay1SentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "l5l6SmsDay2Sent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "l5l6SmsDay2SentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "l5l6SmsDay3Sent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "l5l6SmsDay3SentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "l5l6ConversionAt" TIMESTAMP(3);

-- L5 Lens 인덱스
CREATE INDEX "idx_contact_self_projection_score" ON "Contact"("organizationId", "selfProjectionScore");
CREATE INDEX "idx_contact_self_projection_type" ON "Contact"("organizationId", "selfProjectionType");
CREATE INDEX "idx_contact_compound_health_risk" ON "Contact"("organizationId", "compoundHealthRisk");
CREATE INDEX "idx_contact_self_projection_sequence" ON "Contact"("organizationId", "selfProjectionSequenceStartedAt");

-- L6 Lens 인덱스
CREATE INDEX "idx_contact_timing_urgency_score" ON "Contact"("organizationId", "timingUrgencyScore");
CREATE INDEX "idx_contact_timing_type" ON "Contact"("organizationId", "timingType");
CREATE INDEX "idx_contact_price_deadline" ON "Contact"("organizationId", "priceDeadlineDate");
CREATE INDEX "idx_contact_decision_window_expires" ON "Contact"("organizationId", "decisionWindowExpiresAt");
CREATE INDEX "idx_contact_l5l6_combined_score" ON "Contact"("organizationId", "l5l6CombinedScore");
CREATE INDEX "idx_contact_l5l6_medical_risk" ON "Contact"("organizationId", "l5l6MedicalRiskLevel");
CREATE INDEX "idx_contact_l5l6_sms_status" ON "Contact"("organizationId", "l5l6SmsDay0Sent", "l5l6SmsDay1Sent", "l5l6SmsDay2Sent", "l5l6SmsDay3Sent");
CREATE INDEX "idx_contact_l5l6_conversion" ON "Contact"("organizationId", "l5l6ConversionAt");
