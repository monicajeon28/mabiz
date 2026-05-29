-- Passport 관리 시스템 성능 최적화 인덱스
-- 대상: customers/product-codes/send API 쿼리 최적화
-- CONCURRENTLY 사용으로 프로덕션 다운타임 없이 적용 가능

-- 1. Reservation 복합 부분 인덱스
-- customers API EXISTS 서브쿼리 + product-codes JOIN 공통 최적화
-- 예상 효과: 고객 목록 쿼리 70-85% 단축
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservation_main_confirmed_paid
ON "Reservation"("mainUserId", "paymentAmount")
WHERE "status" = 'CONFIRMED' AND "paymentAmount" > 0;

-- product-codes 집계 쿼리 (tripId 기준 GROUP BY 최적화)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservation_trip_confirmed_paid
ON "Reservation"("tripId", "mainUserId")
WHERE "status" = 'CONFIRMED' AND "paymentAmount" > 0;

-- 2. Trip LATERAL JOIN 최적화
-- customers API: WHERE userId=? ORDER BY departureDate DESC LIMIT 1
-- 예상 효과: LATERAL JOIN Sort 단계 제거 → Index Scan Only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_userid_departure_desc
ON "Trip"("userId", "departureDate" DESC);

-- 3. PassportSubmission LATERAL JOIN 최적화
-- customers API: WHERE userId=? ORDER BY updatedAt DESC LIMIT 1
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passport_submission_userid_updated_desc
ON "PassportSubmission"("userId", "updatedAt" DESC);

-- 4. PassportRequestLog 일일 제한 체크 최적화 (send API 루프)
-- 예상 효과: 유저별 24시간 SUCCESS 카운트 쿼리 90% 단축
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passport_log_userid_success_sent
ON "PassportRequestLog"("userId", "sentAt" DESC)
WHERE "status" = 'SUCCESS';

-- 통계 업데이트 (쿼리 플래너 최적화)
ANALYZE "Reservation";
ANALYZE "Trip";
ANALYZE "PassportSubmission";
ANALYZE "PassportRequestLog";
