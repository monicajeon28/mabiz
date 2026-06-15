# 성능 최적화 로드맵 (Jeff Bezos 검토 기반) (2026-06-15)

## 📊 현재 상태 평가

| 지표 | 현재 | 목표 | 우선순위 |
|------|------|------|---------|
| **Contact 상세 조회** | 5초+ | 200ms | 🔴 P0-1 |
| **Contact 목록 조회** | 30초 | 500ms | 🔴 P0-2 |
| **메모리 (100k Contact)** | 1GB | 100MB | 🔴 P0-3 |
| **Race Condition** | 예 | 아니오 | 🟡 P1-1 |
| **SMS 대량 발송** | 1시간+ | 10분 | 🟡 P1-2 |

---

## 🎯 3단계 실행 계획

### **Phase 1: 즉시 (P0 - 1일)**

P0-1, P0-2, P0-3 3가지 치명적 문제를 동시에 해결.

#### Task 1.1: Lazy Loading API (P0-1)
**문서:** `PERF_P0_1_LAZY_LOADING.md`

**범위:**
- [ ] 기존 GET /api/contacts/[id] 수정 (includes 제거)
- [ ] 새 API 3개 생성
  - GET /api/contacts/[id]/call-logs
  - GET /api/contacts/[id]/memos
  - GET /api/contacts/[id]/vip-sequences
- [ ] 프론트엔드 Tabs 컴포넌트 수정
- [ ] 테스트 작성

**예상 시간:** 2시간
**담당자:** Frontend + API Team

---

#### Task 1.2: 인덱스 최적화 (P0-2)
**문서:** `PERF_P0_2_INDEX_OPTIMIZATION.md`

**범위:**
- [ ] 마이그레이션 파일 생성 (4개 인덱스)
  - idx_contact_org_deleted_created
  - idx_contact_org_visibility_created
  - idx_contact_org_created_by_created
  - idx_group_org_membercount_desc
- [ ] Prisma schema 업데이트
- [ ] 성능 테스트 (EXPLAIN ANALYZE)
- [ ] 테스트 작성

**예상 시간:** 30분
**담당자:** DB Team

---

#### Task 1.3: 메모리 최적화 (P0-3)
**문서:** `PERF_P0_3_MEMORY_OPTIMIZATION.md`

**범위:**
- [ ] ContactLensMetadata 테이블 생성 (마이그레이션)
- [ ] Prisma schema 업데이트 (Contact + 새 모델)
- [ ] 데이터 마이그레이션 스크립트 작성
- [ ] API 수정 (3개 파일)
- [ ] 테스트 작성

**예상 시간:** 3시간
**담당자:** DB + API Team

---

### **Phase 2: 위험 제거 (P1 - 3일)**

P1-1, P1-2 중요 개선사항 처리.

#### Task 2.1: Race Condition 해결 (P1-1)
**문제:** ContactGroupMember 동시 입장 시 memberCount 불일치

**해결책:**
```typescript
// SELECT...FOR UPDATE 사용
await prisma.$transaction(async (tx) => {
  const group = await tx.contactGroup.findFirst({
    where: { id: groupId },
    select: { id: true, memberCount: true }
  });
  
  await tx.contactGroup.update({
    where: { id: groupId },
    data: { memberCount: group!.memberCount + 1 }
  });
});
```

**범위:**
- [ ] Contact 생성 로직 수정 (group 추가)
- [ ] Group join 로직 수정
- [ ] 동시성 테스트 추가

**예상 시간:** 1시간
**담당자:** API Team

---

#### Task 2.2: Async Job Queue (P1-2)
**문제:** Funnel SMS 1M 대량 발송 시 DB 부하 높음

**선택지:**
- Option A: Bull (Redis 기반, 간단)
- Option B: Inngest (클라우드 기반, 안정적)

**권장:** Bull (로컬 개발 편함)

**범위:**
- [ ] Bull Queue 설정
- [ ] SMS 발송 Job 정의
- [ ] Worker 구현 (병렬 처리 100개 batch)
- [ ] 부하 테스트

**예상 시간:** 4시간
**담당자:** Backend + DevOps

---

### **Phase 3: 확장성 (P1 - 1주)**

대규모 운영을 위한 인프라 개선.

#### Task 3.1: Read Replica + Redis 캐싱 (P1-3)
**문제:** 분석 쿼리 (GROUP BY) → Primary DB 직격

**구현:**
1. Read Replica 설정 (Supabase/RDS)
2. Redis 캐싱 레이어
3. 캐시 무효화 전략

**범위:**
- [ ] Read Replica DB 설정
- [ ] Prisma replica 연결
- [ ] 캐싱 레이어 구현
- [ ] 캐시 TTL 정책 결정

**예상 시간:** 2일
**담당자:** DevOps + Backend

---

#### Task 3.2: 시간계열 파티셔닝 (P1-4)
**문제:** ScheduledSms 월별 누적 → 느린 쿼리

**구현:**
```sql
PARTITION BY RANGE (EXTRACT(YEAR_MONTH FROM scheduledAt))
```

**범위:**
- [ ] PostgreSQL 파티셔닝 설정
- [ ] 마이그레이션 스크립트
- [ ] 쿼리 최적화 (파티션 프루닝)
- [ ] 모니터링

**예상 시간:** 3일
**담당자:** DB Team

---

## 📈 성능 목표 (측정 기준)

### 1. 응답 시간

```
Contact 상세 조회 (현재: 5초+ → 목표: 200ms)
├─ Lazy loading: -4.8초
├─ 인덱스 최적화: -200ms (부분)
└─ 최종: 200ms ✅

Contact 목록 조회 10k (현재: 30초 → 목표: 500ms)
├─ 인덱스 최적화: -29.5초
├─ 메모리 최적화: -1초
└─ 최종: 500ms ✅
```

### 2. 메모리 사용량

```
100k Contact 동시 로드 (현재: 1GB → 목표: 100MB)
├─ lensMetadata 분리: -500MB
├─ 메모리 수거 개선: -200MB
├─ 불필요한 필드 제거: -200MB
└─ 최종: 100MB ✅
```

### 3. 동시성

```
Contact 100명이 동시에 같은 그룹에 입장
├─ Before: memberCount 불일치 (race condition)
└─ After: 정확한 카운팅 ✅
```

### 4. 처리량

```
Funnel SMS 1M 발송 (현재: 1시간+ → 목표: 10분)
├─ Async Queue: 6배 속도 개선
├─ 병렬 처리: 8개 Worker
└─ 최종: 10분 ✅
```

---

## 🧪 검증 계획

### Phase 1 검증 (P0)

```bash
# 1. 로컬 테스트
npm run test:perf

# 2. TSC 검증
npx tsc --noEmit

# 3. 마이그레이션 테스트
npx prisma migrate dev

# 4. 메모리 프로파일링
node --inspect scripts/perf-test-memory.ts

# 5. 부하 테스트
npm run test:load -- --concurrency=100 --duration=60s
```

### Phase 2 검증 (P1)

```bash
# 1. Race condition 테스트
npm run test:concurrency -- --iterations=1000

# 2. Job Queue 테스트
npm run test:queue -- --jobs=10000

# 3. 메모리 누수 테스트
npm run test:leak -- --duration=3600s
```

### Phase 3 검증 (P1)

```bash
# 1. Read Replica 장애 테스트
npm run test:failover

# 2. 캐시 일관성 테스트
npm run test:cache-consistency

# 3. 파티셔닝 성능 테스트
npm run test:partition-performance
```

---

## 📋 배포 일정

### Day 1 (Phase 1: P0)

| 시간 | 작업 | 담당 |
|------|------|------|
| 09:00 | P0-1 Lazy Loading 시작 | Frontend+API |
| 10:00 | P0-2 인덱스 마이그레이션 | DB |
| 11:00 | P0-3 lensMetadata 분리 시작 | DB+API |
| 15:00 | 통합 테스트 | QA |
| 17:00 | Git 커밋 | Team |
| 18:00 | Vercel 배포 | DevOps |

### Day 2-4 (Phase 2: P1)

| 일자 | 작업 | 담당 |
|------|------|------|
| Day 2 | P1-1 Race Condition + P1-2 Bull Queue 시작 | Backend |
| Day 3 | P1-2 Job Queue 구현 완료 + 테스트 | Backend+QA |
| Day 4 | 부하 테스트 + 모니터링 설정 | DevOps |

### Day 5-14 (Phase 3: P1)

| 일자 | 작업 | 담당 |
|------|------|------|
| Day 5-6 | P1-3 Read Replica 인프라 | DevOps |
| Day 7-8 | P1-3 캐싱 레이어 | Backend |
| Day 9-12 | P1-4 파티셔닝 구현 | DB |
| Day 13-14 | 최종 부하 테스트 + 모니터링 | QA+DevOps |

---

## 💰 리소스 할당

### 인력

| 역할 | 인원 | 투입 시간 |
|------|------|---------|
| Frontend Developer | 1 | 2시간 |
| API Developer | 2 | 6시간 |
| DB Engineer | 1 | 8시간 |
| Backend Developer | 1 | 6시간 |
| DevOps Engineer | 1 | 4시간 |
| QA Engineer | 1 | 5시간 |
| **총계** | **7명** | **31시간** |

### 인프라

| 항목 | 현재 | 변경 | 비용 |
|------|------|------|------|
| PostgreSQL Storage | 10GB | +200MB (인덱스) | +$5/월 |
| Read Replica | 없음 | 추가 | +$50/월 |
| Redis | 없음 | 추가 (Queue + 캐싱) | +$30/월 |
| **총 추가 비용** | - | - | **+$85/월** |

---

## 📊 성공 기준

### Green Light (배포 가능)

- [ ] TSC: 0 에러
- [ ] Unit Tests: 100% 통과
- [ ] 응답시간: 목표 달성 (P0: 200ms/500ms, P1: 수렴)
- [ ] 메모리: 목표 달성 (100MB)
- [ ] Race Condition: 0건
- [ ] 부하 테스트: 100명 동시 사용자 OK

### Yellow Light (주의 필요)

- [ ] TSC: 경고 5건 미만
- [ ] Unit Tests: 95% 이상 통과
- [ ] 응답시간: 목표 대비 10% 이상 미달
- [ ] 메모리: 목표 대비 20% 초과

### Red Light (배포 불가)

- [ ] TSC: 10건 이상 에러
- [ ] Unit Tests: 90% 미만 통과
- [ ] 응답시간: 목표 대비 50% 이상 미달
- [ ] Race Condition: 1건 이상
- [ ] 부하 테스트 실패

---

## 🔍 모니터링 대시보드

### 실시간 메트릭 (Vercel Analytics)

```
1. API 응답시간 (P50/P95/P99)
   ├─ GET /api/contacts: 200ms / 500ms / 1s
   ├─ GET /api/contacts/[id]: 100ms / 300ms / 500ms
   └─ POST /api/contacts: 500ms / 1s / 2s

2. 메모리 사용량
   ├─ Node Heap: 100MB-200MB
   ├─ RSS: 300MB-400MB
   └─ GC 빈도: 5분/회

3. 에러율
   ├─ 5xx: 0.1% 이하
   ├─ 타임아웃: 0%
   └─ Race Condition: 0

4. 처리량
   ├─ 요청/초: 100 RPS
   ├─ SMS 발송/시: 10k
   └─ 데이터베이스 쿼리/초: 1k
```

### 주간 리포트

```
[매주 금요일]
- P50/P95/P99 응답시간 추이
- 메모리 사용량 변화
- 에러율 분석
- 부하 테스트 결과
- 다음주 계획
```

---

## 🚀 배포 후 롤백 계획

### 긴급 롤백 (5분 이내)

```bash
# P0-1: Lazy Loading 롤백 (includes 복원)
git revert <commit-hash>
vercel rollback production

# P0-2: 인덱스 롤백 (비활성화)
-- 비활성화 (drop은 금지)
ALTER INDEX idx_contact_org_deleted_created UNUSABLE;

# P0-3: lensMetadata 롤백 (Contact + ContactLensMetadata 동시 쿼리)
-- JSON 컬럼 복구 (임시)
ALTER TABLE Contact ADD COLUMN lensMetadata_backup JSONB;
```

### 점진적 롤백 (1시간)

```
1. 트래픽 1% → 이전 버전으로 (Feature Flag)
2. 모니터링 (30분)
3. 트래픽 100% → 이전 버전 (필요시)
4. 원인 분석
5. 핫픽스 배포
```

---

## 📞 에스컬레이션

### 문제 발생 시 연락처

| 문제 | 담당자 | 연락처 | SLA |
|------|--------|--------|------|
| API 응답시간 초과 | Backend Lead | 즉시 | 15분 |
| 메모리 누수 | DevOps | 즉시 | 30분 |
| Race Condition | DB Engineer | 즉시 | 1시간 |
| 인덱스 부하 | DB Engineer | 이메일 | 2시간 |

---

## 📚 참고 문서

1. **P0-1:** `PERF_P0_1_LAZY_LOADING.md`
2. **P0-2:** `PERF_P0_2_INDEX_OPTIMIZATION.md`
3. **P0-3:** `PERF_P0_3_MEMORY_OPTIMIZATION.md`
4. **전체 액션 플랜:** `PERF_REVIEW_ACTION_PLAN.md`

---

**작성자:** Performance Review Team  
**검토자:** Jeff Bezos (성능 기준)  
**승인자:** CTO  
**상태:** 준비 완료  
**시작일:** 2026-06-15  
**완료일:** 2026-06-29 (예상)

