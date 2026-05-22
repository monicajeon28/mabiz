-- Migration: Add A/B Test metadata to CallLog
-- Date: 2026-05-22
-- Purpose: Enable Phase 3 Track D statistical analysis

-- A/B 테스트 메타데이터
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "abTestGroup" VARCHAR(10);
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "abTestWeek" INTEGER;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "scriptVersion" VARCHAR(50);

-- 콜 단계 추적 (이의처리 Track A와 연동)
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "callPhase" VARCHAR(50);
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "phaseStartedAt" TIMESTAMP WITH TIME ZONE;

-- 콜 타이밍 (정확한 지속 시간 계산)
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "callStartedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "callEndedAt" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "callDurationMs" INTEGER;

-- 이탈 분석
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "abandonmentMs" INTEGER;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "abandonmentPhase" VARCHAR(50);

-- 녹음 동의 (GDPR/개인정보보호법)
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "recordingConsent" BOOLEAN DEFAULT false;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "recordingConsentAt" TIMESTAMP WITH TIME ZONE;

-- 분석 도우미 필드
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "conversionDay" INTEGER;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_calllog_abtest_group" ON "CallLog"("abTestGroup");
CREATE INDEX IF NOT EXISTS "idx_calllog_abtest_week" ON "CallLog"("abTestWeek");
CREATE INDEX IF NOT EXISTS "idx_calllog_started_at" ON "CallLog"("callStartedAt");
CREATE INDEX IF NOT EXISTS "idx_calllog_abandonment_phase" ON "CallLog"("abandonmentPhase");

-- 기존 데이터 마이그레이션: callStartedAt을 createdAt으로 초기화 (null이면 사용 안 함)
UPDATE "CallLog" SET "callStartedAt" = "createdAt" WHERE "callStartedAt" IS NULL;
