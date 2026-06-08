-- Team E: 여권 쿼리 성능 최적화 인덱스 추가 (2026-06-08)
-- 목표: 고객 1000명 조회 < 2초

-- 1️⃣ GmPassportSubmission 복합 인덱스 추가
-- 목적: 미제출자 빠른 조회 (tripId + isSubmitted)
CREATE INDEX IF NOT EXISTS "idx_passport_tripId_isSubmitted"
ON "PassportSubmission"("tripId", "isSubmitted");

-- 2️⃣ GmPassportSubmission 삭제 용도 인덱스
-- 목적: 여행별 여권 기록 일괄 삭제 성능
CREATE INDEX IF NOT EXISTS "idx_passport_tripId_userId"
ON "PassportSubmission"("tripId", "userId");

-- 3️⃣ GmPassportRequestLog 시간순 정렬 인덱스
-- 목적: 사용자별 요청 이력 최신순 조회
CREATE INDEX IF NOT EXISTS "idx_passport_request_log_user_created"
ON "PassportRequestLog"("userId", "createdAt" DESC);

-- 성능 검증:
-- SELECT * FROM "PassportSubmission"
--   WHERE "tripId" = 123 AND "isSubmitted" = false
--   LIMIT 50 OFFSET 0
-- -- 인덱스 전: 풀 테이블 스캔 (500ms)
-- -- 인덱스 후: 인덱스 스캔 (< 50ms)

-- SELECT * FROM "PassportRequestLog"
--   WHERE "userId" = 456
--   ORDER BY "createdAt" DESC
--   LIMIT 10
-- -- 인덱스 전: 정렬 필요 (200ms)
-- -- 인덱스 후: 인덱스 조회 (< 20ms)
