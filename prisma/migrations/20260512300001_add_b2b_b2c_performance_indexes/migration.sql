-- ============================================================
-- B2B/B2C 10만 고객 성능 최적화 인덱스
-- ============================================================
-- ⚠️  주의사항:
--   1. 이 파일은 참조/수동 실행 전용입니다.
--   2. `prisma migrate deploy` 로 절대 실행하지 마세요.
--   3. 프로덕션 DB(Neon SQL Editor)에서 직접 실행하세요.
--   4. CREATE INDEX CONCURRENTLY는 트랜잭션 안에서 실행 불가 →
--      BEGIN/COMMIT으로 감싸지 마세요.
--   5. 크루즈닷몰 트래픽 최저 시간대(새벽 3~5시)에 실행 권장.
-- ============================================================

-- ---------------------------------------------------------
-- 1. Contact: (organizationId, channel) 복합 인덱스
--    B2B/B2C 채널 필터 시 전체 테이블 스캔 방지
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_org_channel
  ON "Contact"("organizationId", "channel");

-- ---------------------------------------------------------
-- 2. Contact: (organizationId, type) 복합 인덱스
--    고객 유형(LEAD/PURCHASED 등) + 조직 복합 조회 최적화
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_org_type
  ON "Contact"("organizationId", "type");

-- ---------------------------------------------------------
-- 3. Contact: (organizationId, assignedUserId) 복합 인덱스
--    AGENT 담당 고객 조회 최적화
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_org_assigned
  ON "Contact"("organizationId", "assignedUserId");

-- ---------------------------------------------------------
-- 4. VipCareLog: (status, scheduledAt) 복합 인덱스
--    cron에서 오늘 발송 대상 전체 조회 최적화
--    (sequenceId, status, scheduledAt)은 기존 migration에 존재
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vipcarelog_status_scheduled
  ON "VipCareLog"("status", "scheduledAt");

-- ---------------------------------------------------------
-- 5. Contact.tags GIN 인덱스 (배열 검색 전용)
--    tags @> ARRAY['지중해']::text[] 쿼리 최적화
--    B-tree 인덱스로는 배열 포함 검색 불가 → GIN 필수
-- ---------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_tags_gin
  ON "Contact" USING GIN(tags);
