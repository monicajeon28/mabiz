# Phase 3 배포 가이드

## 개요
이 문서는 Menu #38 Phase 2~3 배포 시 성능 최적화 및 무중단 배포(Zero-Downtime Deployment) 전략을 설명합니다.

---

## 1. 마이그레이션: CREATE INDEX CONCURRENTLY

### 문제
일반적인 `CREATE INDEX` 명령은 인덱스 생성 중 테이블을 **배타적으로 잠금(exclusive lock)**하여:
- 읽기/쓰기 모두 차단
- 배포 중 CRM 서비스 중단

### 해결: CREATE INDEX CONCURRENTLY
Prisma 마이그레이션에서 `CONCURRENTLY` 옵션 적용:

```sql
-- ✗ 잠금 위험 (배포 중단)
CREATE INDEX idx_execution_campaign_partial ON ExecutionLog(organizationId, status, scheduledAt)
WHERE sourceType='CAMPAIGN';

-- ✓ 무중단 배포 (읽기/쓰기 정상)
CREATE INDEX CONCURRENTLY idx_execution_campaign_partial ON ExecutionLog(organizationId, status, scheduledAt)
WHERE sourceType='CAMPAIGN';
```

### 적용 위치
- `prisma/migrations/20260519000002_add_partial_index_execution_log/migration.sql`
- 3개 인덱스 모두 `CONCURRENTLY` 적용

### 배포 영향
| 항목 | 이전 | 이후 |
|-----|-----|-----|
| 배포 시간 | ~30초 | ~2-3분 |
| 테이블 잠금 | 예 | 없음 |
| 읽기 성능 | 차단 | 정상 |
| 쓰기 성능 | 차단 | 정상 |

---

## 2. 벤치마크: performance.now() 적용

### 문제
`Date.now()` (1ms 해상도) → 측정 오차 ±50%

### 해결
`performance.mark()` + `performance.measure()` 패턴 (0.001ms 해상도):

```typescript
// ✗ 낮은 정확도
const start = Date.now();
// ... 작업
console.log(`시간: ${Date.now() - start}ms`); // 오차: ±1ms

// ✓ 높은 정확도 (0.001ms)
performance.mark('query-start');
// ... 작업
performance.mark('query-end');
const measure = performance.measure('query', 'query-start', 'query-end');
console.log(`시간: ${measure.duration.toFixed(2)}ms`); // 오차: ±0.01ms
```

### 적용 위치
- `scripts/benchmark-execution-log.ts`
- 5개 쿼리 모두 적용

### 실행 방법
```bash
npx ts-node scripts/benchmark-execution-log.ts
```

---

## 3. 벤치마크: 테스트 데이터 격리

### 문제
전사 데이터로 측정 → 결과 왜곡 (영향받는 요인: 데이터 크기, 다른 사용자 부하)

### 해결
테스트 조직으로 격리:

```typescript
// ✗ 전사 데이터 포함
where: { organizationId: { not: 'test' } }

// ✓ 테스트 조직 격리
where: { organizationId: { not: 'test_org_benchmark' } }
```

### 테스트 데이터 준비
```sql
-- 1. 테스트 조직 생성
INSERT INTO Organization (id, name, type, status)
VALUES ('org-benchmark', 'test_org_benchmark', 'DEMO', 'ACTIVE');

-- 2. 테스트 담당자 생성
INSERT INTO User (id, email, organizationId, role)
VALUES ('user-benchmark', 'benchmark@test.local', 'org-benchmark', 'ADMIN');

-- 3. 테스트 연락처 생성 (100-1000건)
INSERT INTO Contact (id, name, email, organizationId)
SELECT 
  'contact-benchmark-' || ROW_NUMBER() OVER (ORDER BY generate_series),
  'Benchmark Contact ' || ROW_NUMBER() OVER (ORDER BY generate_series),
  'contact-' || ROW_NUMBER() OVER (ORDER BY generate_series) || '@test.local',
  'org-benchmark'
FROM generate_series(1, 500);

-- 4. 테스트 실행로그 생성
INSERT INTO ExecutionLog (id, organizationId, sourceType, status, channel)
SELECT 
  'exec-benchmark-' || ROW_NUMBER() OVER (ORDER BY generate_series),
  'org-benchmark',
  'CAMPAIGN',
  (ARRAY['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'])[floor(random()*4)+1],
  'SMS'
FROM generate_series(1, 1000);
```

---

## 4. 데이터베이스 풀 설정

### 환경변수: DATABASE_URL
```env
DATABASE_URL="postgresql://user:pass@host/db?max_pool_size=20&statement_cache_size=0"
```

| 설정 | 값 | 설명 |
|------|-----|------|
| max_pool_size | 20 | Neon 연결 풀 제한 (권장: 10-30) |
| statement_cache_size | 0 | 캐시 비활성화 (필요 시 메모리 이슈 회피) |

### 검증
```bash
# 1. 연결 풀 상태 확인
curl https://console.neon.tech/api/v2/projects/{project_id}/connection_pools

# 2. 쿼리 성능 측정
npx ts-node scripts/benchmark-execution-log.ts
```

---

## 5. 배포 체크리스트

### 배포 전
- [ ] 모든 마이그레이션 테스트 완료
- [ ] `npx prisma migrate deploy` 로컬 실행 성공
- [ ] 벤치마크 실행: `npx ts-node scripts/benchmark-execution-log.ts`
- [ ] 벤치마크 결과 200ms 이내 확인

### 배포 중
- [ ] Vercel 자동 배포 시작
- [ ] 마이그레이션 실행 (2-3분 소요)
- [ ] 테이블 락 확인: PostgreSQL 콘솔에서 `SELECT * FROM pg_locks WHERE relation IS NOT NULL;`

### 배포 후
- [ ] 헬스체크: `GET /api/health` 응답 200
- [ ] 오류 모니터링: Sentry/Vercel Logs 확인
- [ ] 성능 모니터링: Datadog/New Relic 대시보드 확인
- [ ] 사용자 피드백: Slack #crm-alerts 채널 확인

---

## 6. 롤백 절차

마이그레이션 실패 시:

```bash
# 1. 마이그레이션 되돌리기
npx prisma migrate resolve --rolled-back 20260519000002_add_partial_index_execution_log

# 2. 이전 버전 재배포
git revert HEAD
git push origin main

# 3. Vercel 자동 재배포
# (Vercel 대시보드에서 이전 배포 재배포 가능)
```

---

## 7. 성능 목표

| 메트릭 | 목표 | 현황 |
|--------|------|------|
| today-stats API | <200ms | ✓ 측정중 |
| campaign metrics | <200ms | ✓ 측정중 |
| retry search | <200ms | ✓ 측정중 |
| contact history | <200ms | ✓ 측정중 |
| 배포 중단시간 | 0초 | ✓ CONCURRENTLY 적용 |

---

## 문제 해결

### 마이그레이션 실패: "CREATE INDEX CONCURRENTLY 지원 안함"
**원인**: Prisma 버전이 낮거나 SQL 문법 오류
**해결**:
```bash
npm update @prisma/client@latest
npx prisma generate
```

### 벤치마크 결과 200ms 초과
**원인**: 인덱스 미생성, 데이터 과다, 풀 설정 오류
**해결**:
1. 마이그레이션 재실행: `npx prisma migrate deploy`
2. 인덱스 확인: `\d execution_log` (PostgreSQL)
3. 쿼리 분석: `EXPLAIN ANALYZE SELECT ...`
4. 풀 설정 확인: `.env.local`의 `DATABASE_URL` 검증

---

## 참고
- Prisma 공식 문서: https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing
- PostgreSQL CONCURRENTLY: https://www.postgresql.org/docs/current/sql-createindex.html
- Neon 연결 풀: https://neon.tech/docs/connect/connection-pooling
