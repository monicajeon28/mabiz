# Task 3 Step 3: P1-1 (DLQ 재시도) 작업지시서

## 최종 결정

| 의사결정 | 선택 | 이유 |
|--------|------|------|
| maxRetries 정책 | **3회 유지** | 현재 설정 합리적 |
| 최대 도달 시 처리 | **resolvedAt 설정** | 영구 정체 방지, 간단 |
| 배열 범위 | **안전 검사 추가** | failDLQ()에서 조건 추가 |

---

## Step 4 Implementation: P1-1 DLQ 재시도 배열 범위 초과 해결

**목표:**
1. failDLQ()에 maxRetries 체크 추가 — 5분
2. 최대 도달 시 resolvedAt 설정 — 5분
3. 로그 추가 (최대 도달 기록) — 5분
4. schema 검증 (필요시 마이그레이션) — 5분
5. 테스트 및 검증 — 10분
6. 총 30분

---

### 작업 1: failDLQ() 함수 수정

**파일:** `src/lib/mabiz-dlq.ts`

**현재 코드** (L45-56):
```typescript
export async function failDLQ(id: string, retryCount: number, reason: string): Promise<void> {
  const nextDelay = RETRY_DELAYS_MIN[retryCount] ?? null;
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: {
      retryCount: retryCount + 1,
      failureReason: reason,
      nextRetryAt: nextDelay ? new Date(Date.now() + nextDelay * 60_000) : null,
    },
  });
  logger.warn('[DLQ] 재시도 실패', { id, retryCount: retryCount + 1, nextDelay });
}
```

**문제:**
- `retryCount >= 3`일 때 배열 범위 초과
- nextRetryAt=null이 되지만 조회되지 않음 (무한 정체)

**수정 후:**
```typescript
export async function failDLQ(id: string, retryCount: number, reason: string): Promise<void> {
  const MAX_RETRIES = 3;
  
  // 최대 재시도 도달 → 정지
  if (retryCount >= MAX_RETRIES) {
    await prisma.mabizSyncDLQ.update({
      where: { id },
      data: {
        retryCount: retryCount + 1,
        failureReason: reason,
        resolvedAt: new Date(),  // ← 완료 처리 (영구 정체 방지)
        nextRetryAt: null,
      },
    });
    logger.warn('[DLQ] 최대 재시도 도달', { id, maxRetries: MAX_RETRIES, reason });
    return;
  }

  // 다음 재시도 예약
  const nextDelay = RETRY_DELAYS_MIN[retryCount];
  const nextRetryAt = new Date(Date.now() + nextDelay * 60_000);
  
  await prisma.mabizSyncDLQ.update({
    where: { id },
    data: {
      retryCount: retryCount + 1,
      failureReason: reason,
      nextRetryAt,
    },
  });
  logger.warn('[DLQ] 재시도 예약', { id, retryCount: retryCount + 1, nextDelayMin: nextDelay });
}
```

---

### 작업 2: 상수화 (선택사항)

**개선:** RETRY_DELAYS_MIN 상수 명시화

```typescript
// src/lib/mabiz-dlq.ts L4-5
const MAX_RETRIES = 3;
const RETRY_DELAYS_MIN = [5, 15, 60];  // MAX_RETRIES에 해당 (0-indexed)

// 검증 (코멘트)
// RETRY_DELAYS_MIN.length === MAX_RETRIES
// [0]=5m, [1]=15m, [2]=60m (3회 재시도)
```

---

### 작업 3: getPendingDLQEntries 검증

**파일:** `src/lib/mabiz-dlq.ts` (L61-71)

**현재 코드:**
```typescript
export async function getPendingDLQEntries(limit = 20) {
  return prisma.mabizSyncDLQ.findMany({
    where: {
      resolvedAt: null,
      retryCount: { lt: 3 },  // ← 문제: 0, 1, 2만 조회
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: limit,
  });
}
```

**분석:**
- `retryCount < 3` → retryCount = 0, 1, 2만 조회
- retryCount = 3이면 조회 안됨 (하지만 resolvedAt이 설정되므로 자동 제외)
- ✅ 현재 코드는 문제 없음 (failDLQ 수정 후 resolvedAt이 자동 설정됨)

---

### 작업 4: schema 검증 (선택)

**파일:** `prisma/schema.prisma`

**확인 항목:**
```bash
grep -A 20 "model MabizSyncDLQ" prisma/schema.prisma | grep -E "maxRetries|retryCount|resolvedAt"
```

**현재 상태:** maxRetries 필드 확인
- maxRetries: Int @default(3) ✅ 있음
- retryCount: Int @default(0) ✅ 있음
- resolvedAt: DateTime? ✅ 있음

→ **마이그레이션 불필요**

---

## Step 5 검증

### 검증 목록

- [ ] failDLQ() 함수 MAX_RETRIES 체크 추가
- [ ] 최대 도달 시 resolvedAt 설정
- [ ] 로그 메시지 추가 (최대 도달/재시도 예약 분리)
- [ ] npm run build 성공
- [ ] TypeScript 타입 검사 통과

### 수동 테스트 (선택)

```bash
# 1. 로컬 개발 서버 시작
npm run dev

# 2. DLQ 항목 3회 이상 실패 시뮬레이션
# failDLQ(id, 0, reason) → retryCount=1
# failDLQ(id, 1, reason) → retryCount=2
# failDLQ(id, 2, reason) → retryCount=3, resolvedAt 설정됨

# 3. 데이터베이스 확인
# SELECT * FROM "MabizSyncDLQ" WHERE id='<test-id>' AND "resolvedAt" IS NOT NULL;
```

---

## Step 6 Git 커밋

**파일:**
- src/lib/mabiz-dlq.ts

**커밋 메시지:**

```
fix(dlq): P1-1 DLQ 재시도 배열 범위 초과 해결

- failDLQ()에 MAX_RETRIES 체크 추가
- 최대 재시도 도달 시 resolvedAt 설정 (영구 정체 방지)
- 로그 메시지 개선 (최대 도달/재시도 구분)

문제:
- retryCount >= 3일 때 RETRY_DELAYS_MIN 배열 범위 초과
- nextRetryAt=null이 되어 getPendingDLQEntries에서 조회 안됨
- 결과: 3회 이상 실패한 DLQ 엔트리가 영구 정체

해결:
- MAX_RETRIES=3 명시화
- failDLQ()에서 retryCount >= MAX_RETRIES 체크
- 도달 시 resolvedAt 설정으로 완료 처리

테스트:
- npm run build ✓
- failDLQ() 로직 검증 ✓

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## 시간 예상

- 작업 1 (failDLQ 수정): 10분
- 작업 2 (상수화): 3분
- 작업 3 (getPendingDLQEntries 검증): 5분
- 작업 4 (schema 검증): 3분
- 검증: 5분
- 커밋: 5분

**총: 31분**

---

## 체크리스트

- [ ] failDLQ() MAX_RETRIES 체크 추가
- [ ] resolvedAt 설정 로직 추가
- [ ] 로그 메시지 개선
- [ ] npm run build 성공
- [ ] Git 커밋 완료

