-- Phase 3 — T7: (reservationId, passportNo) 부분 UNIQUE 인덱스
-- 동시 제출/재시도 시 같은 여권번호 중복 탑승객 폭증 차단.
-- passportNo 있을 때만(부분 인덱스). Prisma @@unique로 표현 불가 → raw SQL.
-- IF NOT EXISTS: 이미 수동 적용(scripts/apply-traveler-partial-uq.mjs)된 DB에서도 안전한 no-op.
CREATE UNIQUE INDEX IF NOT EXISTS "Traveler_reservation_passport_partial_uq"
  ON "Traveler" ("reservationId", "passportNo")
  WHERE "passportNo" IS NOT NULL AND "passportNo" <> '';
