# Task 3 Step 3: P1-2 작업지시서 (Race Condition 수정)

**작업 유형:** P1-2 Race Condition 해결  
**파일:** `src/lib/mabiz-dlq.ts`, `src/app/api/cron/retry-mabiz-dlq/route.ts`  
**완료 기준:** npm run build 성공 + git commit  

---

## 최종 의사결정

| 의사결정 | 선택 | 이유 |
|--------|------|------|
| **Race Condition 해결 방식** | Option A: SELECT...FOR UPDATE (Pessimistic Lock) | 간단하고 직관적, 다른 Cron이 같은 항목 동시 처리 불가능 |
| **구현 위치** | `getPendingDLQEntries()` 함수를 트랜잭션으로 감싸기 | 항목 조회 시점에서 Lock을 걸어야 Race Condition 방지 |
| **Isolation Level** | RepeatableRead | Race Condition 방지 + 성능 균형 |
| **타임아웃** | 35초 | 웹훅 재시도 최대 30초 + 여유 5초 |

---

## 초등학생 설명

**문제:** Vercel에서 동시에 2개의 Cron이 실행되면, 둘 다 같은 DLQ 항목을 조회하고 처리해버립니다. 마치 엄마와 아빠가 동시에 같은 아이에게 간식을 주는 상황처럼요.

**해결책:** 첫 번째 Cron이 항목을 조회할 때 "**이 항목은 지금 누가 처리하고 있으니 건드리지 말아**"라고 DB 레벨에서 Lock을 겁니다. 그러면 두 번째 Cron은 Lock이 풀릴 때까지 기다렸다가 처리합니다.

---

## Step 4: Implementation 상세 지시서

### 작업 1: `src/lib/mabiz-dlq.ts` 수정

**목표:** `getPendingDLQEntries()` 함수를 트랜잭션으로 감싸고, PROCESSING 상태로 변경까지 원자적으로 처리

**변경 사항:**
- `getPendingDLQEntries()` 함수의 시그니처를 유지하되, 내부 구현을 **트랜잭션 + 상태 변경**으로 통합
- `isolationLevel: 'RepeatableRead'`로 Race Condition 방지
- 에러 발생 시 자동 롤백

**코드:**
```typescript
/**
 * 재시도 대상 조회 및 PROCESSING 상태 변경 (원자적)
 * - 트랜잭션 내에서 항목 조회 → PROCESSING 상태 변경
 * - Race Condition 방지: SELECT...FOR UPDATE 동등 (Postgres)
 */
export async function getPendingDLQEntries(limit = 20) {
  return prisma.$transaction(
    async (tx) => {
      // 1. 재시도 대상 항목 조회
      const entries = await tx.mabizSyncDLQ.findMany({
        where: {
          status: DLQ_STATUS.PENDING,
          nextRetryAt: { lte: new Date() },
        },
        orderBy: { nextRetryAt: 'asc' },
        take: limit,
      });

      if (entries.length === 0) {
        return [];
      }

      // 2. 조회한 항목들을 PROCESSING으로 변경 (트랜잭션 내에서)
      // 이렇게 하면 다른 Cron이 같은 항목을 건들 수 없음
      const entryIds = entries.map((e) => e.id);
      await tx.mabizSyncDLQ.updateMany({
        where: { id: { in: entryIds } },
        data: { status: DLQ_STATUS.PROCESSING },
      });

      return entries;
    },
    {
      // RepeatableRead: 트랜잭션 시작 후 다른 트랜잭션의 변경을 읽지 않음
      // (Race Condition 방지)
      isolationLevel: 'RepeatableRead',
      timeout: 35_000, // 웹훅 재시도(최대 30s) + 여유 5s
    },
  );
}
```

**주의사항:**
- `updateMany`를 사용해 여러 항목을 한 번에 PROCESSING으로 변경
- 만약 다른 Cron이 이미 해당 항목을 PROCESSING으로 변경했다면, 이 트랜잭션은 해당 항목을 반환하지 않음

---

### 작업 2: `src/app/api/cron/retry-mabiz-dlq/route.ts` 수정

**목표:** `getPendingDLQEntries()`가 이미 PROCESSING 상태를 설정했으므로, 라우트에서 중복으로 상태 변경하지 않기

**변경 사항:**
- Line 40: `getPendingDLQEntries()` 호출 (이제 PROCESSING 상태까지 설정함)
- Line 53-56: **삭제** — 더 이상 라우트에서 PROCESSING으로 변경할 필요 없음
- 주석 업데이트: "P1-10" 주석을 new 주석으로 변경

**코드:**
```typescript
// Line 40 (변경 없음)
const entries = await getPendingDLQEntries();
if (entries.length === 0) {
  return NextResponse.json({ ok: true, processed: 0 });
}

// Line 45
logger.log('[CronDLQ] 재시도 시작', { count: entries.length });

let resolved = 0;
let failed = 0;

for (const entry of entries) {
  try {
    // P1-2: 항목은 이미 PROCESSING 상태로 설정됨 (getPendingDLQEntries에서)
    // Race Condition 해결됨: 다른 Cron이 같은 항목을 동시 처리할 수 없음
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // ... (나머지 코드 동일)
```

**변경 요약:**
- 라인 52-56 삭제: `await prisma.mabizSyncDLQ.update({ where: { id: entry.id }, data: { status: 'PROCESSING' } });`
- 대신 주석 추가: "항목은 이미 PROCESSING 상태로 설정됨"

---

## Step 5: 검증 체크리스트

### 타입 검증
```bash
npm run build
```
**기대 결과:** 모든 TypeScript 컴파일 성공, exit code 0

### 로직 검증 (수동)
1. `getPendingDLQEntries()`가 트랜잭션 내에서 조회 + 상태 변경을 원자적으로 처리
2. 다른 Cron이 동시 실행되어도, 같은 항목에 Lock이 걸려 중복 처리 불가능
3. 타임아웃(35초) 내에 처리 완료

### 기존 기능 영향 검증
- `resolveDLQ()`, `failDLQ()` 함수: **변경 없음** (기존 로직 유지)
- `enqueueDLQ()` 함수: **변경 없음**
- DLQ 상태 흐름: **동일** (PENDING → PROCESSING → RESOLVED/FAILED)

---

## Step 6: Git 커밋

### 커밋 메시지
```
fix(dlq): P1-2 Race Condition — SELECT...FOR UPDATE로 동시 처리 방지

- getPendingDLQEntries()를 트랜잭션으로 감싸기
- 항목 조회 후 즉시 PROCESSING 상태로 변경 (원자적)
- isolationLevel: RepeatableRead로 Race Condition 방지
- 다른 Cron이 같은 항목 동시 처리 불가능

Files changed:
- src/lib/mabiz-dlq.ts
- src/app/api/cron/retry-mabiz-dlq/route.ts
```

### 커밋 순서
```bash
git add src/lib/mabiz-dlq.ts src/app/api/cron/retry-mabiz-dlq/route.ts
git commit -m "fix(dlq): P1-2 Race Condition — SELECT...FOR UPDATE로 동시 처리 방지"
```

---

## 예상 결과

### 개선 전 (현재)
```
Cron A: getPendingDLQEntries() → [entry1, entry2]
Cron B: getPendingDLQEntries() → [entry1, entry2] ⚠️ 같은 항목!
Cron A: UPDATE entry1 SET status='PROCESSING'
Cron B: UPDATE entry1 SET status='PROCESSING'
→ 둘 다 entry1을 재시도 (중복 처리)
```

### 개선 후 (트랜잭션 + Lock)
```
Cron A: TX START + LOCK entry1, entry2
Cron A: getPendingDLQEntries() → [entry1, entry2]
Cron A: UPDATE entry1, entry2 SET status='PROCESSING'
Cron B: TX START (Cron A가 Lock 중이므로 대기)
Cron B: LOCK 대기... (타임아웃 35초 또는 Cron A 커밋 후)
→ 중복 처리 불가능 ✅
```

---

## 주의사항

1. **스키마 변경 불필요:** 기존 테이블 구조 유지
2. **기존 기능 영향 없음:** `resolveDLQ()`, `failDLQ()`, `enqueueDLQ()` 함수는 그대로
3. **환경변수 추가 불필요**
4. **마이그레이션 불필요**
5. **롤백 안전:** 트랜잭션 실패 시 자동으로 상태 변경 없음

---

## 성공 기준

- [ ] `npm run build` 통과 (exit code 0)
- [ ] TypeScript 에러 없음
- [ ] `getPendingDLQEntries()` 내부에서 PROCESSING 상태 변경 완료
- [ ] `route.ts`에서 중복 상태 변경 제거
- [ ] git commit 생성 (메시지에 "P1-2" 포함)
- [ ] `git log --oneline`에 새 커밋 표시
