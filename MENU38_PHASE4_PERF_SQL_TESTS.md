# Menu #38 Phase 4 Step 5: 성능 테스트 SQL 스크립트

**목적:** ContactLensClassification 성능 검증용 SQL  
**사용:** psql 또는 pgAdmin에서 실행  
**시기:** 마이그레이션 직후 & 월간 모니터링

---

## 1. 마이그레이션 검증

### 1.1 테이블 생성 확인

```sql
-- 테이블 존재 확인
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name IN (
  'ContactLensClassification',
  'ContactLensSequence',
  'LensTemplate'
)
ORDER BY table_name;

-- 예상: 3개 테이블 (public 스키마)
```

### 1.2 칼럼 추가 확인

```sql
-- Contact 테이블 신규 칼럼
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Contact'
AND column_name IN (
  'lensType',
  'lensConfidenceScore',
  'lensSequenceStatus',
  'lensSequenceStartedAt',
  'l10DecisionLevel',
  'l10ReadinessScore',
  'decisionMadeAt',
  'decisionOutcome'
)
ORDER BY ordinal_position;

-- 예상: 8개 칼럼
```

### 1.3 인덱스 생성 확인

```sql
-- ContactLensClassification 인덱스
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ContactLensClassification'
ORDER BY indexname;

-- 예상: 5개 인덱스
-- - idx_lens_org_type
-- - idx_lens_priority
-- - idx_lens_confidence
-- - idx_lens_contact_id
-- - uk_lens_contact_type (UNIQUE)
```

```sql
-- Contact 테이블 신규 인덱스
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Contact'
AND indexname LIKE 'idx_contact_%'
ORDER BY indexname;

-- 예상: 3개 인덱스
```

---

## 2. 성능 테스트

### 2.1 테스트 데이터 삽입

```sql
-- 테스트용 조직 생성
INSERT INTO "Organization" (id, name, slug, "createdAt", "updatedAt")
VALUES (
  'test-org-perf-001',
  'Performance Test Org',
  'perf-test-001',
  NOW(),
  NOW()
);

-- 테스트용 고객 1,000명 생성
INSERT INTO "Contact" (id, phone, "organizationId", name, "createdAt", "updatedAt")
SELECT
  'contact-' || LPAD(i::text, 6, '0'),
  '010' || LPAD((1000000000 + i)::text, 8, '0'),
  'test-org-perf-001',
  'Test Contact ' || i,
  NOW(),
  NOW()
FROM generate_series(1, 1000) AS i;

-- 렌즈 분류 10,000개 생성 (고객당 최대 10개)
INSERT INTO "ContactLensClassification" (
  id, "contactId", "organizationId", "lensType",
  "confidenceScore", "identificationMethod",
  "identifiedAt", "lastUpdated"
)
SELECT
  'lens-' || LPAD(row_number() OVER ()::text, 7, '0'),
  'contact-' || LPAD(((i - 1) / 10 + 1)::text, 6, '0'),
  'test-org-perf-001',
  CASE (i - 1) % 10
    WHEN 0 THEN 'L1'
    WHEN 1 THEN 'L2'
    WHEN 2 THEN 'L3'
    WHEN 3 THEN 'L4'
    WHEN 4 THEN 'L5'
    WHEN 5 THEN 'L6'
    WHEN 6 THEN 'L7'
    WHEN 7 THEN 'L8'
    WHEN 8 THEN 'L9'
    WHEN 9 THEN 'L10'
  END,
  FLOOR(RANDOM() * 100)::int,
  'QUESTIONNAIRE',
  NOW(),
  NOW()
FROM generate_series(1, 10000) AS i;
```

---

### 2.2 쿼리 1: 특정 고객 렌즈 조회 (UNIQUE 인덱스)

```sql
-- 테스트: 특정 고객의 특정 렌즈 조회
EXPLAIN ANALYZE
SELECT *
FROM "ContactLensClassification"
WHERE "contactId" = 'contact-000500'
AND "lensType" = 'L10';

-- 성능 예상:
-- Index Scan using uk_lens_contact_type
-- Rows=1, Actual Rows=1
-- Planning Time: ~0.1ms
-- Execution Time: ~0.2ms
-- ✅ 매우 빠름
```

### 2.3 쿼리 2: 조직별 렌즈 필터링

```sql
-- 테스트: 조직의 모든 L10 고객 조회
EXPLAIN ANALYZE
SELECT *
FROM "ContactLensClassification"
WHERE "organizationId" = 'test-org-perf-001'
AND "lensType" = 'L10'
ORDER BY "confidenceScore" DESC
LIMIT 100;

-- 성능 예상:
-- Index Scan using idx_lens_org_type
-- Rows=100, Actual Rows=100
-- Planning Time: ~0.2ms
-- Execution Time: ~3-5ms
-- ✅ 빠름
```

### 2.4 쿼리 3: 신뢰도 상위 순위

```sql
-- 테스트: 조직의 신뢰도 상위 100개
EXPLAIN ANALYZE
SELECT *
FROM "ContactLensClassification"
WHERE "organizationId" = 'test-org-perf-001'
ORDER BY "confidenceScore" DESC
LIMIT 100;

-- 성능 예상:
-- Index Scan using idx_lens_confidence
-- Rows=100, Actual Rows=100
-- Planning Time: ~0.2ms
-- Execution Time: ~2-10ms
-- ✅ 빠름
```

### 2.5 쿼리 4: Contact JOIN (문제점)

```sql
-- ❌ 느린 방식: JOIN 사용
EXPLAIN ANALYZE
SELECT
  c.id, c.name, c.phone,
  cl."lensType", cl."confidenceScore"
FROM "Contact" c
LEFT JOIN "ContactLensClassification" cl
  ON c.id = cl."contactId"
  AND cl."organizationId" = 'test-org-perf-001'
WHERE c."organizationId" = 'test-org-perf-001'
LIMIT 100;

-- 성능 예상:
-- Nested Loop Left Join
-- Planning Time: ~0.3ms
-- Execution Time: ~15-30ms
-- ⚠️ 느림 (JOIN 비용)
```

### 2.6 쿼리 5: Contact 캐시 칼럼 (최적화)

```sql
-- ✅ 빠른 방식: Contact 캐시 칼럼
EXPLAIN ANALYZE
SELECT
  id, name, phone,
  "lensType", "lensConfidenceScore"
FROM "Contact"
WHERE "organizationId" = 'test-org-perf-001'
LIMIT 100;

-- 성능 예상:
-- Index Scan using idx_contact_org_type
-- Planning Time: ~0.1ms
-- Execution Time: ~0.5-2ms
-- ✅ 매우 빠름 (5-6배 향상)
```

### 2.7 쿼리 성능 비교

```sql
-- 성능 비교 테스트
-- 쿼리 1: JOIN (느림)
WITH slow_query AS (
  SELECT
    c.id, c.name, c.phone,
    cl."lensType", cl."confidenceScore"
  FROM "Contact" c
  LEFT JOIN "ContactLensClassification" cl
    ON c.id = cl."contactId"
  WHERE c."organizationId" = 'test-org-perf-001'
  LIMIT 1000
)

-- 쿼리 2: 캐시 (빠름)
, fast_query AS (
  SELECT
    id, name, phone,
    "lensType", "lensConfidenceScore"
  FROM "Contact"
  WHERE "organizationId" = 'test-org-perf-001'
  LIMIT 1000
)

SELECT
  'JOIN' AS query_type,
  (SELECT COUNT(*) FROM slow_query) AS row_count,
  'See slow query timing above' AS performance

UNION ALL

SELECT
  'Cache' AS query_type,
  (SELECT COUNT(*) FROM fast_query) AS row_count,
  'See fast query timing above' AS performance;
```

---

## 3. 쓰기 성능 테스트

### 3.1 단일 INSERT

```sql
-- 단일 행 INSERT 성능
CREATE TEMP TABLE insert_times AS
SELECT
  'single_insert' AS test_name,
  (SELECT
    EXTRACT(EPOCH FROM (now() - to_timestamp(0)))::bigint as ms
  ) AS start_time;

INSERT INTO "ContactLensClassification" (
  id, "contactId", "organizationId",
  "lensType", "confidenceScore",
  "identificationMethod",
  "identifiedAt", "lastUpdated"
)
VALUES (
  'lens-single-test-' || CURRENT_TIMESTAMP::text,
  'contact-000500',
  'test-org-perf-001',
  'L1',
  75,
  'MANUAL',
  NOW(),
  NOW()
);

-- 예상: ~3-4ms (UNIQUE 검증 포함)
```

### 3.2 배치 INSERT (1,000행)

```sql
-- 배치 INSERT (1,000행)
EXPLAIN ANALYZE
INSERT INTO "ContactLensClassification" (
  id, "contactId", "organizationId",
  "lensType", "confidenceScore",
  "identificationMethod",
  "identifiedAt", "lastUpdated"
)
SELECT
  'lens-batch-' || LPAD(row_number() OVER ()::text, 6, '0'),
  'contact-' || LPAD(((i - 1) / 10 + 1001)::text, 6, '0'),
  'test-org-perf-001',
  CASE (i - 1) % 10
    WHEN 0 THEN 'L1'
    WHEN 1 THEN 'L2'
    WHEN 2 THEN 'L3'
    WHEN 3 THEN 'L4'
    WHEN 4 THEN 'L5'
    WHEN 5 THEN 'L6'
    WHEN 6 THEN 'L7'
    WHEN 7 THEN 'L8'
    WHEN 8 THEN 'L9'
    WHEN 9 THEN 'L10'
  END,
  FLOOR(RANDOM() * 100)::int,
  'QUESTIONNAIRE',
  NOW(),
  NOW()
FROM generate_series(1, 1000) AS i;

-- 예상: ~8ms (1,000행, UNIQUE 검증 병렬)
```

### 3.3 UPSERT 성능

```sql
-- UPSERT 성능 (신규 + 기존 혼합)
EXPLAIN ANALYZE
INSERT INTO "ContactLensClassification" (
  id, "contactId", "organizationId",
  "lensType", "confidenceScore",
  "identificationMethod",
  "identifiedAt", "lastUpdated"
)
VALUES (
  'lens-upsert-test',
  'contact-000500',
  'test-org-perf-001',
  'L10',
  95,
  'QUESTIONNAIRE',
  NOW(),
  NOW()
)
ON CONFLICT ("contactId", "lensType")
DO UPDATE SET
  "confidenceScore" = EXCLUDED."confidenceScore",
  "lastUpdated" = NOW();

-- 예상: ~3-4ms (UNIQUE 검증 + UPDATE)
```

---

## 4. 인덱스 성능 분석

### 4.1 인덱스 사용 확인

```sql
-- 각 인덱스별 행 수 및 크기
SELECT
  indexname,
  idx_scan AS scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  CASE
    WHEN idx_scan > 0 THEN
      ROUND((idx_tup_fetch::numeric / idx_scan)::numeric, 2)
    ELSE 0
  END AS avg_tuples_per_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname = 'ContactLensClassification'
ORDER BY idx_scan DESC;

-- 예상: 모든 인덱스가 활발히 사용됨
```

### 4.2 인덱스 크기 분석

```sql
-- 테이블 및 인덱스 총 크기
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'ContactLensClassification';

-- 예상: 인덱스 크기 = 테이블 크기 × 1.5-2배
```

### 4.3 UNIQUE 인덱스 검증

```sql
-- UNIQUE 제약 확인
SELECT
  constraint_name,
  constraint_type,
  column_name
FROM information_schema.constraint_column_usage ccu
JOIN information_schema.table_constraints tc
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'ContactLensClassification'
AND tc.constraint_type = 'UNIQUE'
ORDER BY constraint_name, ordinal_position;

-- 예상: uk_lens_contact_type (contactId, lensType)
```

---

## 5. 유지보수

### 5.1 VACUUM

```sql
-- 마이그레이션 직후
VACUUM ANALYZE "ContactLensClassification";
VACUUM ANALYZE "Contact";

-- 월간 실행 (자동 AUTOVACUUM 외)
-- 예상 시간: 5-10초 (10K 행)
```

### 5.2 REINDEX

```sql
-- UNIQUE 인덱스 재구성 (선택사항)
REINDEX INDEX "uk_lens_contact_type";
REINDEX INDEX "idx_lens_org_type";
REINDEX INDEX "idx_lens_priority";
REINDEX INDEX "idx_lens_confidence";
REINDEX INDEX "idx_lens_contact_id";

-- 예상 시간: 2-3초 (모든 인덱스)
```

### 5.3 통계 갱신

```sql
-- 쿼리 플래너 통계 갱신
ANALYZE "ContactLensClassification";
ANALYZE "Contact";

-- 예상 시간: 1-2초
```

---

## 6. 모니터링 쿼리

### 6.1 느린 쿼리 감지

```sql
-- 느린 쿼리 기록 (pg_stat_statements 필요)
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%ContactLensClassification%'
OR query ILIKE '%ContactLensSequence%'
ORDER BY mean_exec_time DESC;

-- 설정: shared_preload_libraries = 'pg_stat_statements'
```

### 6.2 테이블 및 인덱스 상태

```sql
-- 테이블 크기 및 행 수
SELECT
  schemaname,
  tablename,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  ROUND(100 * n_dead_tup / (n_live_tup + n_dead_tup), 2) AS dead_ratio,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_stat_user_tables
WHERE tablename IN ('ContactLensClassification', 'ContactLensSequence', 'LensTemplate')
ORDER BY pg_relation_size(schemaname||'.'||tablename) DESC;

-- dead_ratio > 10% 면 VACUUM 권장
```

### 6.3 인덱스 효율성

```sql
-- 사용되지 않는 인덱스 감지
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE tablename IN ('ContactLensClassification', 'Contact')
AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- idx_scan = 0 인 인덱스는 삭제 고려
```

---

## 7. 정리

### 7.1 테스트 데이터 삭제

```sql
-- 테스트 데이터 삭제
DELETE FROM "ContactLensClassification"
WHERE "organizationId" = 'test-org-perf-001';

DELETE FROM "Contact"
WHERE "organizationId" = 'test-org-perf-001';

DELETE FROM "Organization"
WHERE id = 'test-org-perf-001';

-- VACUUM (선택사항)
VACUUM ANALYZE "ContactLensClassification";
VACUUM ANALYZE "Contact";
```

---

## 8. 결과 해석 가이드

### 성능 평가

| 실행 시간 | 평가 | 액션 |
|----------|------|------|
| < 1ms | ✅ 매우 빠름 | 없음 |
| 1-5ms | ✅ 빠름 | 없음 |
| 5-20ms | ⚠️ 주의 | 모니터링 |
| 20-100ms | ⚠️ 느림 | 쿼리 최적화 |
| > 100ms | ❌ 매우 느림 | 즉시 개선 |

### 예상 vs 실제 편차

| 지표 | 예상 | 허용 범위 |
|------|------|---------|
| UNIQUE 검증 | 0.5ms | ±0.2ms |
| JOIN 쿼리 | 15-30ms | ±5ms |
| 캐시 쿼리 | 0.5-2ms | ±1ms |
| 배치 INSERT | 8ms | ±2ms |

---

**실행 팁:**
1. 테스트는 저부하 시간에 실행
2. 3회 이상 반복 실행 (평균값 사용)
3. 계획 시간 무시 (실행 시간만 확인)
4. 월간 모니터링으로 추세 감시

