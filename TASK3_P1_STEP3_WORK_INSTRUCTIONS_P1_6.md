# Task 3 Step 3: P1-6 (DLQ status) 작업지시서

## 최종 결정

| 의사결정 | 선택 | 이유 |
|--------|------|------|
| 상태 개수 | **4가지** (PENDING/PROCESSING/RESOLVED/FAILED) | P1-10 멱등성 필수 |
| 마이그레이션 | **자동** (resolvedAt 기반) | 기존 데이터 보존 |
| resolvedAt 유지 | **예** | 완료 시간 추적 필요 |

---

## Step 4 Implementation

**목표:**
1. 마이그레이션 작성 — 5분
2. schema.prisma 수정 — 3분
3. mabiz-dlq.ts 수정 (상태 관리) — 10분
4. retry-mabiz-dlq.ts 수정 (PROCESSING) — 10분
5. npm run build — 5분
6. 총 33분

---

### 작업 1: 마이그레이션

**파일:** `prisma/migrations/20260522000002_add_dlq_status/migration.sql`

```sql
-- P1-6: DLQ status 필드 추가

ALTER TABLE "MabizSyncDLQ"
ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- 기존 데이터 마이그레이션
UPDATE "MabizSyncDLQ"
SET "status" = CASE
  WHEN "resolvedAt" IS NOT NULL THEN 'RESOLVED'
  WHEN "nextRetryAt" <= NOW() THEN 'PENDING'
  ELSE 'PENDING'
END;

-- 상태별 인덱스
CREATE INDEX "idx_dlq_status" ON "MabizSyncDLQ"("status");
CREATE INDEX "idx_dlq_status_nextretry" ON "MabizSyncDLQ"("status", "nextRetryAt");

-- 코멘트
COMMENT ON COLUMN "MabizSyncDLQ"."status" IS 'DLQ 항목 상태: PENDING (대기) / PROCESSING (처리중) / RESOLVED (완료) / FAILED (실패)';
```

---

### 작업 2: schema.prisma

```typescript
model MabizSyncDLQ {
  // ... 기존 필드 ...
  
  // P1-6: 상태 필드 추가
  status   String  @default("PENDING") @db.VarChar(20)
  
  // ... 인덱스 ...
  @@index([status])
  @@index([status, nextRetryAt])
}
```

---

### 작업 3: mabiz-dlq.ts

**추가할 상수:**
```typescript
type DLQStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'FAILED';

const DLQ_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  RESOLVED: 'RESOLVED',
  FAILED: 'FAILED',
} as const;
```

**enqueueDLQ 수정:**
```typescript
await prisma.mabizSyncDLQ.create({
  data: {
    // ... 기존 ...
    status: DLQ_STATUS.PENDING,  // ← 추가
  },
});
```

**resolveDLQ 수정:**
```typescript
export async function resolveDLQ(id: string): Promise<void> {
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: {
      status: DLQ_STATUS.RESOLVED,  // ← 추가
      resolvedAt: new Date(),
    },
  });
}
```

**failDLQ 수정:**
```typescript
// ... 최대 재시도 도달 시
if (retryCount >= MAX_RETRIES) {
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: {
      status: DLQ_STATUS.FAILED,    // ← 추가
      resolvedAt: new Date(),
      nextRetryAt: null,
    },
  });
}

// ... 다음 재시도 예약
await prisma.mabizSyncDLQ.update({
  where: { id },
  data: {
    status: DLQ_STATUS.PENDING,     // ← 명시적
    failureReason: truncatedReason,
    nextRetryAt: new Date(...),
  },
});
```

**getPendingDLQEntries 수정:**
```typescript
export async function getPendingDLQEntries(limit = 20) {
  return prisma.mabizSyncDLQ.findMany({
    where: {
      status: DLQ_STATUS.PENDING,   // ← 상태로 조회 (명시적)
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: limit,
  });
}
```

---

### 작업 4: retry-mabiz-dlq.ts

**entry 처리 전 상태 변경:**
```typescript
for (const entry of entries) {
  try {
    // 처리 시작 → PROCESSING 상태로 변경 (P1-10 멱등성)
    await prisma.mabizSyncDLQ.update({
      where: { id: entry.id },
      data: { status: DLQ_STATUS.PROCESSING },
    });

    // ... 웹훅 호출 ...

    if (res.ok) {
      await resolveDLQ(entry.id);
      resolved++;
    } else {
      await failDLQ(entry.id, entry.retryCount, `HTTP ${res.status}`);
      failed++;
    }
  } catch (err) {
    await failDLQ(entry.id, entry.retryCount, String(err));
    failed++;
  }
}
```

---

## Step 5 검증

- [ ] 마이그레이션 파일 작성
- [ ] schema.prisma status 필드 추가
- [ ] mabiz-dlq.ts DLQ_STATUS 상수 추가
- [ ] getPendingDLQEntries status 조건 수정
- [ ] resolveDLQ status='RESOLVED' 설정
- [ ] failDLQ status='FAILED' 설정
- [ ] retry-mabiz-dlq PROCESSING 상태 관리
- [ ] npm run build 성공

---

## Step 6 커밋

```
fix(dlq): P1-6 DLQ status 필드 추가 (상태 관리 명확화)

- status VARCHAR(20) 필드 추가 (PENDING/PROCESSING/RESOLVED/FAILED)
- getPendingDLQEntries: status='PENDING' 조건으로 명시적 조회
- retry-mabiz-dlq: 처리 시 PROCESSING 상태 설정 (P1-10 멱등성 기반)
- resolveDLQ/failDLQ: 상태 업데이트

문제:
- DLQ 상태가 암묵적 (resolvedAt/nextRetryAt 조합)
- PROCESSING 상태 없음 → 멀티 인스턴스에서 중복 처리 가능
- FAILED 상태 없음 → 최종 실패 항목 구분 불가능

해결:
- status 필드로 명시적 상태 관리
- PROCESSING 상태로 멱등성 기반 마련 (P1-10)
- FAILED 상태로 최종 실패 항목 추적 가능

테스트:
- npm run build ✓
- 마이그레이션 적용 ✓

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

