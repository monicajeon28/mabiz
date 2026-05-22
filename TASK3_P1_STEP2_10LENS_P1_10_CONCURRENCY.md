# Task 3 Step 2: P1-10 (Concurrency) 10렌즈 토론

## P1-10: Cron 멀티 인스턴스 동시성 문제 (Race Condition)

**파일:** `src/app/api/cron/retry-mabiz-dlq/route.ts` (line 40-56)  
**현황:** Vercel Cron에서 같은 DLQ 항목이 다중 인스턴스로 동시에 처리되는 문제

---

## 문제의 원인 (쉽게 설명)

크론(Cron)은 매 5분마다 웹훅 재시도를 담당하는 작은 프로그램입니다. 문제는 **클라우드 서버가 여러 대일 때 발생**합니다:

1. 서버 A: "아직 처리 안 된 항목 조회" → item #100 발견
2. 서버 B: 동시에 "아직 처리 안 된 항목 조회" → 같은 item #100 발견
3. 서버 A: item #100을 PROCESSING으로 변경 후 재시도 시작
4. 서버 B: item #100을 PROCESSING으로 변경 후 재시도 시작
5. **결과:** 같은 웹훅이 2번 실행됨 → 데이터 중복, 수당 중복 계산 등

---

## 10렌즈 분석

| 렌즈 | 평가 | 이유 |
|------|------|------|
| **신뢰성** | 🔴 심각 | DLQ 항목이 중복 처리될 수 있어 데이터 일관성 깨짐. 동시에 2-3개 서버에서 같은 항목 처리 가능 |
| **성능** | 🟡 주의 | 불필요한 중복 처리로 API 호출 2배 증가, 데이터베이스 업데이트 불필요하게 2회 실행 |
| **신뢰성(멱등성)** | 🔴 심각 | 웹훅 핸들러가 eventId 기반 멱등성만 구현. DLQ 재시도는 eventId가 없어서 멱등성 보장 안 됨 |
| **운영성** | 🟡 주의 | 중복 처리되면 로그만 남고 사용자가 모름. 수당 중복 계산은 결국 대사 시 발견 |
| **테스트성** | 🔴 심각 | 동시성 버그는 테스트 환경에서 재현 어려움. 단일 서버 환경에서는 항상 정상 |
| **명확성** | 🟡 주의 | "PROCESSING 상태로 변경"은 아래 문제점이 있음: 변경 후 웹훅 실패 시 어떻게 되는가? |
| **유지보수성** | 🟡 주의 | 상태 전이 로직이 여러 함수에 분산 (getPending→PROCESSING→resolveDLQ/failDLQ). 중앙화 부족 |
| **확장성** | 🔴 심각 | 인스턴스 개수 증가할수록 중복 처리 확률 증가. 확장성이 떨어짐 |
| **문서화** | 🟡 주의 | 코드 주석에 멀티 인스턴스 문제 언급 없음. "다른 Cron 인스턴스의 중복 처리 방지"라는 주석은 이미 이를 인식했다는 뜻 |
| **의도** | 🔴 심각 | PROCESSING 상태 변경만으로는 중복 방지 불가. DB 수준의 원자적 연산 필요 |

---

## 핵심 문제점 (구체적인 코드)

**현재 코드 (line 40-56):**
```typescript
const entries = await getPendingDLQEntries();  // ← SQL SELECT
if (entries.length === 0) {
  return NextResponse.json({ ok: true, processed: 0 });
}

for (const entry of entries) {
  try {
    // P1-10 문제: SELECT 후 UPDATE 사이에 시간차 발생
    // 다른 서버도 같은 SELECT 결과를 가질 수 있음
    await prisma.mabizSyncDLQ.update({
      where: { id: entry.id },
      data: { status: 'PROCESSING' },
    });
    // ← 여기서 실패 시 PROCESSING 상태로 영구 정체
```

**문제 시나리오:**

1. **중복 처리:**
   - Server A: `SELECT * FROM mabizSyncDLQ WHERE status='PENDING' AND nextRetryAt <= NOW()`
   - Server B: 동시에 같은 쿼리 실행
   - 둘 다 entry#100 조회 → 둘 다 UPDATE 실행 → 같은 웹훅 2번 재시도

2. **정체 (Hanging State):**
   - Server A: UPDATE status='PROCESSING' 후 웹훅 실패
   - `failDLQ()` 호출 → PENDING으로 복구 예정
   - 하지만 failDLQ 실패 시? → PROCESSING에 그대로 정체

3. **Timeout 없음:**
   - 항목이 PROCESSING에서 몇 시간, 며칠 방치되어도 자동 복구 없음

---

## 권장 해결책

### Option A: Database-level Locking (추천) ⭐

```typescript
// Cron에서 원자적 연산으로 변경
const entry = await prisma.mabizSyncDLQ.findFirstAndUpdate({
  where: { 
    status: 'PENDING',
    nextRetryAt: { lte: new Date() }
  },
  data: { status: 'PROCESSING' },
  orderBy: { nextRetryAt: 'asc' },
  take: 1,
  // ← SELECT와 UPDATE가 원자적으로 실행됨
});
// (Prisma에 없으면 raw SQL 사용: UPDATE ... WHERE ... RETURNING)
```

**장점:** 완벽한 중복 방지, 데이터베이스가 보장  
**단점:** Prisma는 직접 지원 안 함, raw SQL 필요

---

### Option B: Distributed Lock (Pub/Sub or Redis)

```typescript
// Redis 분산 락 추가
const lockKey = `dlq-processing-${entry.id}`;
const locked = await redis.set(lockKey, '1', 'EX', 300, 'NX');
if (!locked) {
  // 다른 서버가 이미 처리 중
  continue;
}
try {
  // 웹훅 재시도
} finally {
  await redis.del(lockKey);
}
```

**장점:** 확장성 좋음, 명확한 의도  
**단점:** Redis 추가 의존성, 네트워크 지연

---

### Option C: eventId 기반 멱등성 강화 (부분 해결)

```typescript
// failDLQ에서 eventId 자동 생성
const eventId = `dlq-retry-${entry.id}-${entry.retryCount}`;
// 웹훅 재시도 시 eventId 포함
// 웹훅 핸들러가 이미 processedWebhookEvent로 체크
```

**장점:** 중복 처리되더라도 멱등성 보장  
**단점:** 근본 해결 아님, 로그/모니터링 복잡 증가

---

## 추가 발견사항

1. **failDLQ 타이밍 문제 (line 109):**
   ```typescript
   catch (err) {
     await failDLQ(entry.id, entry.retryCount, String(err));
   }
   ```
   - failDLQ 자체가 실패하면? 항목이 PROCESSING에서 정체

2. **Timeout 전략 부재:**
   - PROCESSING 상태가 1시간 이상이면 자동으로 PENDING으로 복구해야 함
   - 예: `UPDATE ... SET status='PENDING' WHERE status='PROCESSING' AND updatedAt < NOW() - INTERVAL 1 HOUR`

3. **모니터링 부족:**
   - PROCESSING 상태 항목이 쌓이면 알림 필요
   - 중복 처리 감지 로직 없음

---

## 최종 결론

이 P1-10 이슈는 **신뢰성과 확장성을 심각하게 훼손**하므로 **Option A 또는 Option B를 즉시 구현**하기를 권장합니다.
