-- ============================================================================
-- Contact 쿼리 성능 튜닝 가이드 (2026-06-15)
--
-- 파일: docs/CONTACT_QUERY_PERFORMANCE_TUNING.sql
-- 용도: 프로덕션 환경에서 Contact 조회 성능 검증 및 튜닝
-- ============================================================================

-- ============================================================================
-- 1. 현재 인덱스 상태 확인
-- ============================================================================

-- 인덱스 목록 조회 (Contact 관련)
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_indexes
WHERE tablename = 'Contact'
  AND indexname LIKE 'idx_contact_org%'
ORDER BY indexname;

-- 예상 결과:
-- idx_contact_org_assigned       | CREATE INDEX ... ON "Contact"("organizationId", "assignedUserId")
-- idx_contact_org_created_by     | CREATE INDEX ... ON "Contact"("organizationId", "createdBy")
-- idx_contact_org_visibility     | CREATE INDEX ... ON "Contact"("organizationId", "visibility")

-- ============================================================================
-- 2. 역할별 쿼리 성능 검증 (EXPLAIN ANALYZE)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 2-1. OWNER (대리점장) 쿼리 성능
-- ─────────────────────────────────────────────────────────────────────────
-- WHERE: organizationId = $1 AND visibility != 'ADMIN_ONLY' AND deletedAt IS NULL
-- 인덱스: idx_contact_org_visibility

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*)
FROM "Contact"
WHERE "organizationId" = 'org-cruisedot-main'
AND "visibility" != 'ADMIN_ONLY'
AND "deletedAt" IS NULL;

-- 예상 결과:
-- Index Scan using idx_contact_org_visibility on "Contact"
--   Index Cond: ("organizationId" = 'org-cruisedot-main' AND "visibility" != 'ADMIN_ONLY')
--   Filter: ("deletedAt" IS NULL)
--   Execution Time: 5-10ms
--   Buffers: shared hit=50-100 (인덱스 스캔만)

-- ─────────────────────────────────────────────────────────────────────────
-- 2-2. AGENT (판매원) 쿼리 성능
-- ─────────────────────────────────────────────────────────────────────────
-- WHERE: organizationId = $1 AND (assignedUserId = $2 OR createdBy = $2)
--        AND visibility != 'ADMIN_ONLY' AND deletedAt IS NULL
-- 인덱스: idx_contact_org_assigned + idx_contact_org_created_by (BitmapOr)

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*)
FROM "Contact"
WHERE "organizationId" = 'org-cruisedot-main'
AND (
  "assignedUserId" = 'user-12345'
  OR "createdBy" = 'user-12345'
)
AND "visibility" != 'ADMIN_ONLY'
AND "deletedAt" IS NULL;

-- 예상 결과:
-- BitmapHeap Scan on "Contact"
--   Recheck Cond: (("organizationId" = 'org-cruisedot-main' AND "assignedUserId" = 'user-12345')
--                   OR ("organizationId" = 'org-cruisedot-main' AND "createdBy" = 'user-12345'))
--   Filter: ("visibility" != 'ADMIN_ONLY' AND "deletedAt" IS NULL)
--   Heap Blocks: exact=150
--   Execution Time: 15-25ms
--   Buffers: shared hit=200-250

-- ─────────────────────────────────────────────────────────────────────────
-- 2-3. GLOBAL_ADMIN (시스템관리자) 쿼리 성능
-- ─────────────────────────────────────────────────────────────────────────
-- WHERE: deletedAt IS NULL
-- 인덱스: 없음 (전체 테이블 스캔)
-- 주의: 빈도가 낮으므로 최적화 불필요

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT COUNT(*)
FROM "Contact"
WHERE "deletedAt" IS NULL;

-- 예상 결과:
-- Seq Scan on "Contact"
--   Filter: ("deletedAt" IS NULL)
--   Execution Time: 50-100ms (조직당 1M 고객 기준)
--   Buffers: shared hit=10000-20000

-- ============================================================================
-- 3. 인덱스 스캔 통계 (모니터링)
-- ============================================================================

-- 인덱스별 스캔 횟수 및 효율성
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scan_count,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  ROUND(100.0 * idx_tup_fetch / NULLIF(idx_tup_read, 0), 2) AS fetch_efficiency_pct
FROM pg_stat_user_indexes
WHERE tablename = 'Contact'
  AND indexname LIKE 'idx_contact_org%'
ORDER BY idx_scan DESC;

-- 예상 결과:
-- idx_contact_org_assigned       | 10,234 scans | 50,000 read | 48,000 fetched | 96%
-- idx_contact_org_visibility     | 8,945 scans  | 35,000 read | 33,000 fetched | 94%
-- idx_contact_org_created_by     | 2,123 scans  | 12,000 read | 10,500 fetched | 87%

-- ⚠️  fetch_efficiency < 80% 인 경우:
--   → 인덱스가 많은 불일치 행을 읽음 (필터 비효율)
--   → 인덱스 컬럼 순서 변경 검토 필요

-- ============================================================================
-- 4. 특정 역할의 쿼리 성능 비교
-- ============================================================================

-- AGENT 역할의 쿼리 최적화 (판매원 A가 담당한 모든 고객)
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT id, name, phone, assignedUserId, createdBy
FROM "Contact"
WHERE "organizationId" = 'org-cruisedot-main'
AND (
  "assignedUserId" = 'user-12345'
  OR "createdBy" = 'user-12345'
)
AND "visibility" != 'ADMIN_ONLY'
AND "deletedAt" IS NULL
LIMIT 100;

-- \g (format=json)로 JSON 형식 출력 → 외부 도구로 분석 가능

-- ============================================================================
-- 5. 인덱스 유지보수
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 5-1. 불필요한 인덱스 제거 (scans = 0인 경우)
-- ─────────────────────────────────────────────────────────────────────────

-- 스캔 통계 리셋 (월 1회 권장)
SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;

-- 결과에 따라 불필요한 인덱스 제거:
-- DROP INDEX CONCURRENTLY idx_unused_index;

-- ─────────────────────────────────────────────────────────────────────────
-- 5-2. ANALYZE 및 VACUUM (주 1회 권장)
-- ─────────────────────────────────────────────────────────────────────────

-- Contact 테이블 통계 갱신
ANALYZE "Contact";

-- 인덱스 파편화 정리
VACUUM ANALYZE "Contact";

-- ⚠️  대규모 테이블 (> 1M 행):
-- VACUUM ANALYZE "Contact" (VERBOSE);  -- 진행상황 표시

-- ─────────────────────────────────────────────────────────────────────────
-- 5-3. REINDEX (월 1회 권장, 프로덕션 야간 시간 권장)
-- ─────────────────────────────────────────────────────────────────────────

-- 인덱스 재구축 (CONCURRENTLY 사용으로 잠금 방지)
REINDEX INDEX CONCURRENTLY idx_contact_org_assigned;
REINDEX INDEX CONCURRENTLY idx_contact_org_created_by;
REINDEX INDEX CONCURRENTLY idx_contact_org_visibility;

-- 전체 인덱스 재구축
REINDEX TABLE CONCURRENTLY "Contact";

-- ============================================================================
-- 6. 성능 문제 진단 및 해결
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 6-1. 느린 쿼리 감지 (pg_stat_statements 필요)
-- ─────────────────────────────────────────────────────────────────────────

-- 설치 (1회): CREATE EXTENSION pg_stat_statements;

SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query LIKE '%"Contact"%'
  AND mean_exec_time > 10  -- 10ms 이상 쿼리
ORDER BY mean_exec_time DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────
-- 6-2. 인덱스 미사용 감지
-- ─────────────────────────────────────────────────────────────────────────

-- 스캔 통계가 없는 인덱스 (의심)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE tablename = 'Contact'
  AND idx_scan < 10  -- 스캔 횟수 10회 미만
  AND pg_relation_size(indexrelid) > 1000000  -- 1MB 이상 크기
ORDER BY pg_relation_size(indexrelid) DESC;

-- 결과:
-- - 1MB 이상의 미사용 인덱스 → 삭제 검토
-- - 하지만 신규 인덱스 (< 7일)는 유지 (워밍업 기간)

-- ─────────────────────────────────────────────────────────────────────────
-- 6-3. 테이블 블로트 검사 (여러 VACUUM 후에도 큰 경우)
-- ─────────────────────────────────────────────────────────────────────────

SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size
FROM pg_tables
WHERE tablename = 'Contact';

-- Contact 테이블이 20GB 이상인 경우:
-- → ALTER TABLE REBUILD 또는 pg_repack 사용 검토

-- ============================================================================
-- 7. PostgreSQL 성능 설정 최적화
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 7-1. 현재 설정 확인
-- ─────────────────────────────────────────────────────────────────────────

SHOW shared_buffers;         -- 일반적으로 RAM의 25% (예: 8GB 이상)
SHOW effective_cache_size;   -- 일반적으로 RAM의 50-75% (예: 16GB 이상)
SHOW work_mem;               -- 정렬/그룹화 임시 메모리 (기본값 4MB)
SHOW maintenance_work_mem;   -- VACUUM/CREATE INDEX 메모리 (기본값 64MB)
SHOW random_page_cost;       -- SSD의 경우 1.1 권장 (기본값 4.0)
SHOW enable_bitmapscan;      -- 기본값 on ✅

-- ─────────────────────────────────────────────────────────────────────────
-- 7-2. 최적화 권장사항
-- ─────────────────────────────────────────────────────────────────────────

-- SSD 환경 설정 (RDS/클라우드 권장)
-- ALTER SYSTEM SET random_page_cost = 1.1;

-- 대규모 배치 작업 (VACUUM FULL, REINDEX)
-- ALTER SYSTEM SET maintenance_work_mem = '512MB';

-- 설정 적용
-- SELECT pg_reload_conf();

-- ============================================================================
-- 8. 성능 벤치마크 스크립트 (주 1회 실행 권장)
-- ============================================================================

-- 모든 Contact 조회 쿼리의 p50, p95, p99 응답시간 수집
-- (예: 매주 월요일 자정 실행)

DO $$
DECLARE
  v_org_id TEXT := 'org-cruisedot-main';
  v_user_id TEXT := 'user-12345';
  v_start_time TIMESTAMP;
  v_elapsed_ms INT;
BEGIN
  -- OWNER 쿼리 벤치마크
  v_start_time := CLOCK_TIMESTAMP();
  EXECUTE 'SELECT COUNT(*) FROM "Contact" WHERE "organizationId" = $1 AND "visibility" != ''ADMIN_ONLY'' AND "deletedAt" IS NULL'
    USING v_org_id;
  v_elapsed_ms := EXTRACT(EPOCH FROM (CLOCK_TIMESTAMP() - v_start_time)) * 1000;
  RAISE NOTICE 'OWNER query: % ms', v_elapsed_ms;

  -- AGENT 쿼리 벤치마크
  v_start_time := CLOCK_TIMESTAMP();
  EXECUTE 'SELECT COUNT(*) FROM "Contact" WHERE "organizationId" = $1 AND ("assignedUserId" = $2 OR "createdBy" = $2) AND "visibility" != ''ADMIN_ONLY'' AND "deletedAt" IS NULL'
    USING v_org_id, v_user_id;
  v_elapsed_ms := EXTRACT(EPOCH FROM (CLOCK_TIMESTAMP() - v_start_time)) * 1000;
  RAISE NOTICE 'AGENT query: % ms', v_elapsed_ms;
END
$$;

-- ============================================================================
-- 9. 주기적 유지보수 스크립트
-- ============================================================================

-- PostgreSQL의 pg_cron 확장 사용 (선택사항)
-- 설치: CREATE EXTENSION pg_cron;

-- 주 1회 VACUUM ANALYZE (월요일 자정)
-- SELECT cron.schedule('contact-vacuum', '0 0 * * 1', 'VACUUM ANALYZE "Contact"');

-- 월 1회 REINDEX (첫 번째 일요일 23시)
-- SELECT cron.schedule('contact-reindex', '0 23 * * 0',
--   'REINDEX INDEX CONCURRENTLY idx_contact_org_assigned, '
--   'REINDEX INDEX CONCURRENTLY idx_contact_org_created_by, '
--   'REINDEX INDEX CONCURRENTLY idx_contact_org_visibility');

-- ============================================================================
-- 참고: buildContactWhere() 함수 (src/lib/rbac.ts L71-102)
-- ============================================================================

-- TypeScript 함수:
-- export function buildContactWhere(ctx: AuthContext, extra: Record<string, unknown> = {})
--
-- AGENT 역할 반환:
-- {
--   organizationId: ctx.organizationId!,
--   OR: [
--     { assignedUserId: ctx.userId },      -- idx_contact_org_assigned
--     { createdBy: ctx.userId },           -- idx_contact_org_created_by
--   ],
--   visibility: { not: "ADMIN_ONLY" },     -- idx_contact_org_visibility
--   deletedAt: null,
-- }
--
-- 생성 SQL:
-- WHERE "organizationId" = $1
--   AND ("assignedUserId" = $2 OR "createdBy" = $2)
--   AND "visibility" != 'ADMIN_ONLY'
--   AND "deletedAt" IS NULL

-- ============================================================================
-- 문제 발생 시 연락
-- ============================================================================

-- Contact 조회 성능 문제 발생:
-- 1. EXPLAIN ANALYZE 결과 수집
-- 2. 현재 행 수: SELECT COUNT(*) FROM "Contact";
-- 3. 인덱스 통계: SELECT * FROM pg_stat_user_indexes WHERE tablename = 'Contact';
-- 4. Team C (Contact 최적화 담당)에 보고

-- 문서 참고: docs/CONTACT_INDEX_OPTIMIZATION_2026-06-15.md
