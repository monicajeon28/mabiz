-- Phase 3 검토수정 — F2: (submissionId, passportNumber) 부분 UNIQUE 인덱스
-- 게스트 표시 미러 테이블 중복행 방지. passportNumber 있을 때만(부분 인덱스).
-- Prisma @@unique로 표현 불가 → raw SQL.
-- IF NOT EXISTS: 이미 수동 적용(scripts/apply-guest-partial-uq.mjs)된 DB에서도 안전한 no-op.
CREATE UNIQUE INDEX IF NOT EXISTS "guest_submission_passport_partial_uq"
  ON "PassportSubmissionGuest" ("submissionId", "passportNumber")
  WHERE "passportNumber" IS NOT NULL AND "passportNumber" <> '';
