# Task 3 Step 2: P1-1 (DLQ 재시도 배열) 10렌즈 토론

## Context
- P0 8개 완료, P1-9/P1-4/P1-11 완료
- **P1-1 선택**: DLQ 재시도 배열 범위 초과 (고위험도)

---

## P1-1: RETRY_DELAYS_MIN 배열 범위 초과

**현황:**
```typescript
// src/lib/mabiz-dlq.ts L4-5, L46
const RETRY_DELAYS_MIN = [5, 15, 60];  // 배열 길이 = 3

export async function failDLQ(id: string, retryCount: number, reason: string) {
  const nextDelay = RETRY_DELAYS_MIN[retryCount] ?? null;  // ← 범위 초과 위험
  // ...
}

// getPendingDLQEntries L65
retryCount: { lt: 3 }  // 0, 1, 2만 조회
```

**문제점:**
1. maxRetries=3이지만 실제 재시도는 0,1,2 (3회 아님)
2. retryCount=2일 때 RETRY_DELAYS_MIN[2]=60 (마지막)
3. retryCount=3일 때 RETRY_DELAYS_MIN[3]=undefined → nextRetryAt=null
4. nextRetryAt=null이면 getPendingDLQEntries에서 조회 안됨 (lte: now 조건 실패)
5. **결과**: 3번 실패한 DLQ 엔트리가 영구 정체

---

## 10렌즈 분석

| 렌즈 | 평가 | 설명 |
|------|------|------|
| **보안** | ✅ 좋음 | 보안 이슈 아님 |
| **신뢰성** | 🔴 매우높음 | DLQ 엔트리 영구 정체 → 웹훅 손실 |
| **운영성** | 🔴 매우높음 | 3회 실패 후 메모리 누수 (정체된 엔트리 증가) |
| **테스트성** | 🟡 중간 | 3회 이상 실패 케이스 테스트 필요 |
| **명확성** | 🔴 높음 | maxRetries=3 vs retryCount<3 불일치 |
| **유지보수** | 🔴 높음 | 배열/maxRetries/조건 3곳 수정 필요 |
| **성능** | 🔴 높음 | 정체된 엔트리가 DB 크기 증가 |
| **확장성** | 🟡 중간 | 재시도 정책 변경 시 3곳 모두 수정 필요 |
| **문서화** | 🔴 높음 | maxRetries=3의 의미가 불명확 |
| **의도** | 🔴 높음 | "최대 3회 재시도"인데 실제는 다름 |

---

## 핵심 의사결정

### **Q1: maxRetries=3은 진짜 3회인가?**

**Option A (현재)**: 실제로는 2회
```
retryCount: 0 → 1차 재시도
retryCount: 1 → 2차 재시도
retryCount: 2 → 3차 재시도
retryCount: 3 → 조회 불가 (정체)
```

**Option B (수정)**: 진정한 3회
```
maxRetries = 3
retryCount < 3: [0, 1, 2] 재시도
retryCount >= 3: 정지
```

---

### **Q2: RETRY_DELAYS_MIN 배열을 어떻게 수정할 것인가?**

**Option A (권장)**: 배열 길이 확장 + maxRetries 명시
```typescript
const RETRY_DELAYS_MIN = [5, 15, 60];  // 3회 재시도: [0]=5m, [1]=15m, [2]=60m

export async function failDLQ(id: string, retryCount: number, reason: string) {
  const maxRetries = 3;
  if (retryCount >= maxRetries) {
    // 최대 재시도 도달 → 상태 변경 또는 로그
    return;
  }
  const nextDelay = RETRY_DELAYS_MIN[retryCount];
  // ...
}
```

**Option B (보조)**: 안전한 접근
```typescript
const nextDelay = RETRY_DELAYS_MIN[retryCount] ?? RETRY_DELAYS_MIN[RETRY_DELAYS_MIN.length - 1];
// 범위 초과 시 마지막 값(60분) 사용
```

---

### **Q3: 재시도 정책을 exponential backoff로 변경할 것인가?**

**Option A (현재)**: 선형
```
[5, 15, 60] → 5분, 15분, 60분
```

**Option B (대안)**: exponential
```
[1, 5, 25, 125] → 1분, 5분, 25분, 125분 (각 5배)
```

**현재 선택**: Option A (선형) 유지 - 이미 합리적임

---

## 권장 해결책

### **1단계: maxRetries와 retryCount 일관성 확인**
```bash
grep -n "maxRetries\|retryCount\|RETRY_DELAYS" src/lib/mabiz-dlq.ts
```

### **2단계: 재시도 정책 명시**
```typescript
const MAX_RETRIES = 3;
const RETRY_DELAYS_MIN = [5, 15, 60];  // 3회에 해당

export async function failDLQ(id: string, retryCount: number, reason: string) {
  if (retryCount >= MAX_RETRIES) {
    // 최대 재시도 도달
    logger.warn('[DLQ] 최대 재시도 도달', { id, maxRetries: MAX_RETRIES });
    await prisma.mabizSyncDLQ.update({
      where: { id },
      data: { resolvedAt: new Date() }  // 또는 failedAt
    });
    return;
  }
  
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
}
```

### **3단계: schema.prisma 검증**
- `maxRetries: Int @default(3)` 필드 확인
- status 필드 추가 필요 여부 (PENDING/PROCESSING/FAILED/RESOLVED)

---

## 의사결정 포인트

**Q1: maxRetries=3 유지할 것인가?**
- A (추천): 예. 현재 설정이 합리적. 단, 코드와 일관성 맞추기.

**Q2: 최대 재시도 도달 시 어떻게 처리?**
- A (추천): resolvedAt 설정 (또는 새 failedAt 필드). 영구 정체 방지.
- B: 별도의 failed_at/failed_count 필드 추가.

---

## 결론 (Step 2 완료)

**P1-1 핵심 문제:**
> DLQ 배열 범위 초과로 3회 이상 실패한 엔트리가 **영구 정체**

**권장 해결 순서:**
1. ✅ P1-1 분석 (완료)
2. 🔄 코드 수정 (Step 4)
   - failDLQ()에 maxRetries 체크 추가
   - 최대 도달 시 상태 변경
3. ⏳ schema 검증 (Step 4)
4. ⏳ 테스트 (Step 5)
5. ⏳ 커밋 (Step 6)

