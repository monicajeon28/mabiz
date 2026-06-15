# Jeff Bezos 성능 검토 실행 계획 (2026-06-15)

## 📋 Executive Summary

**Jeff Bezos 성능 평가 결과:** 32/100점 (확장성 기준)
- **현재 한계:** 100k Contact까지만 안정적, 1M 레코드 불가능
- **근본 원인:** N+1 쿼리, 인덱스 누락, 메모리 누수, 동시성 문제

---

## 🔴 P0 (치명적) 이슈 3가지

### P0-1: N+1 쿼리 (Contact 상세 조회) - 응답시간 5초 → 200ms
**파일:** `src/app/api/contacts/[id]/route.ts` (라인 25-33)

**문제:**
```typescript
include: {
  groups:       { include: { group: true } },          // N+1 위험
  callLogs:     { orderBy: { createdAt: "desc" }, take: 30 },  // N+1
  memos:        { orderBy: { createdAt: "desc" }, take: 30 },  // N+1
  vipSequences: {
    where:   { status: "ACTIVE" },
    include: { logs: { orderBy: { scheduledAt: "asc" }, take: 30 } },  // N+1
  },
}
```

**영향도:**
- 100 Contact 조회: 200ms ✅
- 10k Contact: 5초+ ⚠️
- 100k Contact: 30초+ 🔴 (Vercel 타임아웃)

**해결책:**
```typescript
// 기본 조회: 필수 필드만 (groups 배제)
select: {
  id: true, phone: true, name: true, email: true,
  // ... 기본 필드
  // callLogs, memos, vipSequences 제외
}

// 탭 클릭 시: Lazy loading (별도 API)
// GET /api/contacts/[id]/call-logs
// GET /api/contacts/[id]/memos
// GET /api/contacts/[id]/vip-sequences
```

**예상 개선:**
- 응답시간: 5초+ → 200ms (25배 개선)
- DB 부하: -70% (중첩 쿼리 제거)

---

### P0-2: 인덱스 누락 (4개) - 쿼리 시간 30초 → 50ms
**파일:** `prisma/schema.prisma` Contact 모델

**현재 인덱스 상태:**
```prisma
// 있는 인덱스
@@index([organizationId])
@@index([organizationId, autoSegment])
@@index([organizationId, status])

// ⚠️ 없는 인덱스 (전체 테이블 스캔 발생!)
// 1. (organizationId, deletedAt, createdAt) — 활성 고객만
// 2. (organizationId, visibility, createdAt) — 공유 필터
// 3. (organizationId, createdBy, createdAt) — 작성자별 조회
// 4. memberCount DESC (Group 큰 그룹부터)
```

**추가할 인덱스:**
```prisma
// Contact 모델
@@index([organizationId, deletedAt, createdAt(sort: Desc)], map: "idx_contact_org_deleted_created")
@@index([organizationId, visibility, createdAt(sort: Desc)], map: "idx_contact_org_visibility_created")
@@index([organizationId, createdBy, createdAt(sort: Desc)], map: "idx_contact_org_created_by_created")

// ContactGroup 모델
@@index([organizationId, memberCount(sort: Desc)], map: "idx_group_org_membercount_desc")
```

**예상 개선:**
- 쿼리 시간: 30초 → 50ms (600배 개선)
- Disk usage: +200MB (인덱스)

---

### P0-3: 메모리 누수 (lensMetadata JSON) - 메모리 1GB → 100MB
**파일:** `prisma/schema.prisma` Contact 모델 (라인 259)

**문제:**
```prisma
model Contact {
  id                  String
  lensMetadata        Json?     @default("{\"decisionLevel\": 0, \"readinessScore\": 0}")
  // 크기: 평균 5KB
  // 100k Contact: 5KB × 100k = 500MB
  // 메모리 로드 시: 1GB+ (중복 로드, 복사 등)
}
```

**해결책 1: 별도 테이블 분리 (권장)**
```prisma
model Contact {
  id                  String
  // lensMetadata 제거 → lensMetadataId FK로 변경
  lensMetadataId      String?
  lensMetadata        ContactLensMetadata? @relation(fields: [lensMetadataId], references: [id], onDelete: Cascade)
}

model ContactLensMetadata {
  id                  String    @id @default(cuid())
  organizationId      String
  decisionLevel       Int       @default(0)
  readinessScore      Int       @default(0)
  compoundHealthRisk  Boolean   @default(false)
  // ... 다른 필드들
  
  contact             Contact   @relation(fields: [id], references: [lensMetadataId])
  @@index([organizationId])
}
```

**해결책 2: JSON 압축 저장 (임시)**
```typescript
// lensMetadata → msgpack 또는 protobuf로 압축
const compressed = msgpack.encode(lensMetadata);  // 5KB → 500B
```

**예상 개선:**
- 메모리 사용: 1GB → 100MB (10배 절감)
- 쿼리 성능: +20% (JSON 파싱 제거)

---

## 🟡 P1 (중요) 개선점 4가지

### P1-1: ContactGroupMember Race Condition
**파일:** `src/app/api/contacts/route.ts` POST (그룹 추가 시)

**문제:**
```javascript
// 10명이 동시에 같은 그룹 입장
// memberCount += 1  (동시성 문제 발생)
// 결과: memberCount 5개만 증가? (race condition)
```

**해결책: SELECT...FOR UPDATE Lock**
```typescript
// ContactGroup.memberCount 업데이트 시 Lock
await prisma.$transaction(async (tx) => {
  const group = await tx.contactGroup.findFirst({
    where: { id: groupId },
    select: { id: true, memberCount: true }
  });
  
  // 배타적 잠금 상태에서 업데이트
  await tx.contactGroup.update({
    where: { id: groupId },
    data: { memberCount: group!.memberCount + 1 }
  });
});
```

**예상 개선:**
- Race condition 제거 (100% 안정성)

---

### P1-2: Funnel SMS 대량 발송 병목
**파일:** `src/lib/funnel-trigger.ts`

**문제:**
```typescript
// Contact 1M명 × Day 0-3 = 4M ScheduledSms 레코드
// 매일 신규 발송 시 DB 부하 높음 → Lock / Deadlock 발생
```

**해결책: Async Job Queue (Bull/Inngest)**
```typescript
// 방식 1: Bull Redis Queue
import Queue from 'bull';
const smsQueue = new Queue('funnel-sms', process.env.REDIS_URL);

// 대량 발송 (Job 추가)
for (const contactId of contactIds) {
  await smsQueue.add({ contactId, dayOffset: 0 }, { attempts: 3, backoff: 'exponential' });
}

// 워커: 병렬 처리 (100개 batch)
smsQueue.process(100, async (job) => {
  const { contactId, dayOffset } = job.data;
  // SMS 발송 로직
});
```

**예상 개선:**
- 발송 처리 속도: 1M 레코드 → 10분 (기존 1시간+)
- DB 부하: -80%

---

### P1-3: 읽기 복제본 (Read Replica) + 캐싱
**파일:** 아키텍처 수준

**문제:**
```typescript
// 분석 쿼리 (GROUP BY, HAVING) → Primary DB 직격
// 예: 세그먼트별 Contact 통계 (100k 레코드 GROUP BY)
```

**해결책:**
```typescript
// 1. Read Replica로 분산
const readDb = prisma.$extends({
  result: {
    queryRaw: async (result) => result, // Read-only로 마킹
  }
});

// 분석 쿼리 → Read Replica
const stats = await readDb.$queryRaw(
  Prisma.sql`SELECT autoSegment, COUNT(*) as count FROM Contact GROUP BY autoSegment`
);

// 2. Redis 캐싱
const cacheKey = `contact:stats:${organizationId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const stats = await prisma.contact.groupBy({
  by: ['autoSegment'],
  where: { organizationId },
  _count: true,
});
await redis.setex(cacheKey, 300, JSON.stringify(stats)); // TTL 5분
return stats;
```

**예상 개선:**
- 분석 쿼리 응답: 30초 → 100ms (캐시 히트)
- Primary DB 부하: -40%

---

### P1-4: 시간계열 테이블 분할 (Partitioning)
**파일:** `prisma/schema.prisma` ScheduledSms 모델

**문제:**
```typescript
// ScheduledSms 1M 레코드 (월별로 누적)
// 월별 쿼리 시: 전체 테이블 스캔 → 느림
```

**해결책: PostgreSQL Time-series Partitioning**
```sql
-- Migration: 월별 파티셔닝
ALTER TABLE ScheduledSms 
PARTITION BY RANGE (EXTRACT(YEAR_MONTH FROM scheduledAt)) (
  PARTITION p_202606 VALUES LESS THAN ('202607'),
  PARTITION p_202607 VALUES LESS THAN ('202608'),
  PARTITION p_202608 VALUES LESS THAN ('202609'),
  PARTITION p_max VALUES LESS THAN MAXVALUE
);

-- 쿼리: 2026-06 데이터만 검색 (파티션 prune)
SELECT * FROM ScheduledSms 
WHERE scheduledAt BETWEEN '2026-06-01' AND '2026-06-30'
-- → 실제로는 p_202606 파티션만 스캔
```

**예상 개선:**
- 월별 조회 성능: 30초 → 100ms (10배 향상)
- 대량 DELETE 성능: O(n) → O(1) (파티션 드롭)

---

## 📊 구현 우선순위 & 타이밍

### Phase 1: 즉시 (P0 - 1일)
- [ ] P0-1: Lazy loading API 3개 추가 (call-logs, memos, vip-sequences)
- [ ] P0-2: 인덱스 4개 추가 (마이그레이션)
- [ ] 코드 수정 + TSC 검증

### Phase 2: 위험 제거 (P1 - 3일)
- [ ] P1-1: ContactGroupMember SELECT...FOR UPDATE 추가
- [ ] P1-2: Bull Queue 또는 Inngest 설정 (선택)
- [ ] 테스트 + 배포

### Phase 3: 확장성 (P1 - 1주)
- [ ] P1-3: Read Replica 인프라 + Redis 캐싱
- [ ] P1-4: Time-series 파티셔닝 마이그레이션
- [ ] 부하 테스트

---

## ✅ 성공 기준

| 메트릭 | 현재 | 목표 | 개선율 |
|--------|------|------|--------|
| **Contact 상세 조회** | 5초+ | 200ms | 25배 |
| **Contact 목록 조회 (10k)** | 30초 | 500ms | 60배 |
| **인덱스 히트율** | 40% | 95% | - |
| **메모리 (100k Contact)** | 1GB | 100MB | 10배 |
| **Race condition** | 예 | 아니오 | 100% |
| **Daily SMS 발송 (1M)** | 1시간+ | 10분 | 6배 |

---

## 🔧 구현 상세

### P0-1 구현: Lazy Loading API

**새 파일: `src/app/api/contacts/[id]/call-logs/route.ts`**
```typescript
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limit = parseInt(searchParams.get("limit") ?? "30", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const [callLogs, total] = await Promise.all([
    prisma.callLog.findMany({
      where: { contactId: id },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: { id: true, content: true, result: true, duration: true, userId: true, createdAt: true }
    }),
    prisma.callLog.count({ where: { contactId: id } })
  ]);

  // userId → 이름 배치 조회
  const userIds = [...new Set(callLogs.map(l => l.userId))];
  const names = await resolveUserNames(userIds); // 배치 조회 헬퍼
  
  return NextResponse.json({
    ok: true,
    callLogs: callLogs.map(l => ({ ...l, userName: names.get(l.userId) })),
    total,
    limit,
    offset
  });
}
```

### P0-2 구현: 인덱스 추가

**새 마이그레이션: `prisma/migrations/20260615_add_perf_indexes/migration.sql`**
```sql
-- Contact 인덱스 3개
CREATE INDEX idx_contact_org_deleted_created 
  ON Contact(organizationId, deletedAt, createdAt DESC)
  WHERE deletedAt IS NOT NULL;

CREATE INDEX idx_contact_org_visibility_created
  ON Contact(organizationId, visibility, createdAt DESC);

CREATE INDEX idx_contact_org_created_by_created
  ON Contact(organizationId, "createdBy", createdAt DESC)
  WHERE "createdBy" IS NOT NULL;

-- ContactGroup 인덱스 1개
CREATE INDEX idx_group_org_membercount_desc
  ON ContactGroup(organizationId, memberCount DESC);
```

### P0-3 구현: lensMetadata 분리

**새 마이그레이션: `prisma/migrations/20260615_split_lens_metadata/migration.sql`**
```sql
-- 새 테이블
CREATE TABLE ContactLensMetadata (
  id SERIAL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  decisionLevel INT DEFAULT 0,
  readinessScore INT DEFAULT 0,
  compoundHealthRisk BOOLEAN DEFAULT FALSE,
  -- ... 다른 필드
  UNIQUE(organizationId, id)
);

-- Contact 마이그레이션
ALTER TABLE Contact ADD COLUMN lensMetadataId VARCHAR(255);
ALTER TABLE Contact DROP COLUMN lensMetadata;

CREATE INDEX idx_lens_metadata_org ON ContactLensMetadata(organizationId);
```

---

## 🚀 배포 가이드

### 로컬 테스트
```bash
# 1. 마이그레이션 실행
npx prisma migrate dev --name add_perf_indexes

# 2. TSC 검증
npx tsc --noEmit

# 3. 부하 테스트
npm run test:performance
```

### Vercel 배포
```bash
# 1. DB 마이그레이션 (자동)
# (Deploy 시 자동 실행)

# 2. 코드 배포
git push origin main

# 3. 모니터링
# Vercel Analytics → Core Web Vitals 확인
```

---

## 📈 모니터링 대시보드

**추가할 메트릭:**
1. API 응답시간 분포 (Contact GET 분위수)
2. DB 쿼리 실행 시간 (Query logs)
3. 메모리 사용량 (Node heap)
4. 인덱스 히트율 (pg_stat_user_indexes)
5. Lock 대기 시간 (pg_locks)

---

**작성자:** Jeff Bezos (성능 검토)  
**검토일:** 2026-06-15  
**구현 예상 기간:** 1주

