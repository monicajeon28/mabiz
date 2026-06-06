-- Phase 3 — T7: (reservationId, passportNo) 부분 UNIQUE 인덱스
-- 동시 제출/재시도 시 같은 여권번호 중복 탑승객 폭증 차단.
-- passportNo 있을 때만 적용(부분 인덱스) — NULL/공백 다수인 추후제출은 제약 없음.
-- ⚠️ Prisma @@unique로는 표현 불가(NULL 전체 포함). raw SQL로만 관리.
-- 적용 전 중복 진단 필수: scripts/apply-traveler-partial-uq.mjs
CREATE UNIQUE INDEX IF NOT EXISTS "Traveler_reservation_passport_partial_uq"
  ON "Traveler" ("reservationId", "passportNo")
  WHERE "passportNo" IS NOT NULL AND "passportNo" <> '';
