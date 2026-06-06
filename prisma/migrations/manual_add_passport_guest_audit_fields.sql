-- Phase 3 — T5: GmPassportSubmissionGuest 감사필드 추가 (additive, nullable, 백필 불필요)
-- 누가/어디서/언제 채웠나 추적. 라이브 안전 (기존 행은 NULL 유지).
ALTER TABLE "PassportSubmissionGuest"
  ADD COLUMN IF NOT EXISTS "submittedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
