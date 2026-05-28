-- CreateTable: FormSubmission (폼 제출 추적 및 완성율 분석)
-- Loop 5-C 분석 데이터 저장소
-- 실시간 폼 완성율 모니터링 + 세그먼트별 성과 추적

CREATE TABLE "FormSubmission" (
    "id"              TEXT NOT NULL,
    "variant"         TEXT NOT NULL,
    "segment"         TEXT NOT NULL,
    "completionTimeMs" INT NOT NULL,
    "ageRange"        TEXT NOT NULL,
    "preferenceType"  TEXT NOT NULL,
    "affiliateCode"   TEXT,
    "userAgent"       TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (쿼리 성능 최적화)
CREATE INDEX "FormSubmission_createdAt_idx" ON "FormSubmission"("createdAt");
CREATE INDEX "FormSubmission_variant_idx" ON "FormSubmission"("variant");
CREATE INDEX "FormSubmission_segment_idx" ON "FormSubmission"("segment");
CREATE INDEX "FormSubmission_variant_createdAt_idx" ON "FormSubmission"("variant", "createdAt");

-- Comment: 인덱스 용도
-- createdAt_idx: 시간대별 폼 제출 분석 (일별/주별/월별 트렌드)
-- variant_idx: A/B 테스트 변형별 필터링
-- segment_idx: 세그먼트별 성과 분해
-- variant_createdAt_idx: 변형×시간 복합 쿼리 (가장 자주 사용)
