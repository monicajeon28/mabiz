# Task 3 Step 2: P1-2 (Race Condition) 10렌즈 토론

## P1-2: 동시 재시도로 인한 중복 처리 및 데이터 불일치 위험

**파일:** `src/app/api/cron/retry-mabiz-dlq/route.ts` (line 52-56)  
**현황:** Cron 작업이 PROCESSING 상태로 변경한 후 재시도를 진행하지만, **멀티 인스턴스 환경에서 같은 DLQ 항목이 여러 Cron이 동시에 처리할 수 있는 Race Condition 발생**

---

## 10렌즈 분석

| 렌즈 | 평가 | 이유 |
|------|------|------|
| **보안** | 🟡 | PROCESSING 상태 변경 후 실제 재시도 전 타임윈도우에서 원본 웹훅 전송 장애 시 데이터 불일치. 예: 2단계 웹훅(commission 확정)이 PROCESSING 중 실패하면 affiliateSale의 상태가 불완전. |
| **성능** | 🟡 | DB 업데이트 연산 3회(PROCESSING, RESOLVED/FAILED, 재시도마다). 20개씩 한 번에 처리하므로 60회 쿼리 → 병목. 배치 UPDATE로 개선 가능. |
| **신뢰성** | 🔴 | **"다른 Cron 인스턴스의 중복 처리 방지"**라는 주석이 있지만 실제로는 방지 안 함. Vercel에서 같은 시간에 2개 Cron 실행 가능 → 두 Cron 모두 getPendingDLQEntries()로 같은 20개 항목 조회 → PROCESSING 상태로 동시 변경 → 재시도 중복 실행. |
| **운영성** | 🟡 | 실패 시 failDLQ() 호출하는데, 이미 PROCESSING → PENDING으로 상태 되돌림. 하지만 failDLQ() 자체 실패하면? DB 트랜잭션 없음. |
| **테스트성** | 🔴 | Race Condition 테스트 불가능. 동시성 시나리오(2개 Cron 동시 실행)를 Playwright로 검증할 수 없음. |
| **명확성** | 🟡 | "멱등성 기반"이라는 주석은 이해하기 어려움. 실제 멱등성 메커니즘이 명확하지 않음. eventId 중복 방지는 purchase 웹훅에만 있고, DLQ 영역에는 없음. |
| **유지보수성** | 🟡 | 3단계 상태 전환(PENDING → PROCESSING → RESOLVED/FAILED)이 분산되어 있음. `mabiz-dlq.ts`와 `route.ts`에서 로직을 나뉘어 관리 → 수정 시 양쪽 확인 필요. |
| **확장성** | 🟡 | 새로운 웹훅 타입 추가 시 getWebhookSecret()에 수동으로 추가. 환경변수 추가도 필요. 확장성 낮음. |
| **문서화** | 🟡 | DLQ 상태 다이어그램 없음. PENDING → PROCESSING → (RESOLVED \| FAILED) 흐름과 재시도 정책이 3곳에 산재. |
| **의도** | 🔴 | **요구사항: "멀티 인스턴스에서 중복 처리 방지"인데, 코드는 실제 방지 메커니즘 없음.** "다른 Cron 인스턴스의 중복 처리 방지"라는 주석이 의도는 표현하지만 구현되지 않음. |

---

## 문제 상황 (초등학생 수준)

**쉽게 말해:** 학교 매점에서 "떨어진 음료수를 다시 주문하는 시스템"을 생각해보세요.

- **DLQ란:** 처음 주문이 실패하면 "미처리 주문서" 폴더에 보관 → 5분마다 자동 재시도
- **현재 문제:** 
  - 학교가 커서 **2명의 관리자가 같은 시간에 일함**
  - 관리자 A, B가 "미처리 주문서"를 동시에 꺼냈는데 **똑같은 주문을 2번씩 진행**
  - 음료수 2개가 오거나, 결제가 2번 되는 등 **중복 처리** 발생

**이게 왜 문제인가:**
1. **주문 2배 계산:** affiliateSale 수당이 2번 적립되어 돈 손실
2. **의도와 다른 상태:** 웹훅은 1번만 와야 하는데 2번 처리
3. **테스트 불가:** 실제 운영 환경에서만 발생하므로 개발자가 못 찾음

---

## 권장 해결책

### Option A: SELECT ... FOR UPDATE로 Pessimistic Lock (권장) ⭐

```typescript
// Cron 시작 시, 트랜잭션 내에서 먼저 건 PROCESSING으로 변경할 항목들을 Lock
const entries = await prisma.$transaction(async (tx) => {
  return tx.mabizSyncDLQ.findMany({
    where: {
      status: 'PENDING',
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: 20,
    // Postgres 구문: SELECT ... FOR UPDATE
  });
}, {
  isolationLevel: 'RepeatableRead', // Race Condition 방지
  timeout: 35000, // 웹훅 재시도(최대 30s) + 여유
});
```

**장점:**
- 간단하고 직관적 (다른 Cron이 같은 행을 건들 수 없음)
- 트랜잭션 내에서 PROCESSING 상태 변경 → 원자성 보장

**단점:** DB 성능 영향 가능 (Lock 경합)

---

### Option B: 고유 Cron ID + 낙관적 업데이트 (복잡)

```typescript
// Cron마다 고유 ID 부여 (UUID)
const cronId = crypto.randomUUID();

// 시도 1: PENDING → PROCESSING (with cronId)로 변경
const updated = await prisma.mabizSyncDLQ.updateMany({
  where: {
    id: { in: entryIds },
    status: 'PENDING', // 다른 Cron이 변경했으면 UPDATE 0개
    processingCronId: null, // 아직 아무도 처리 중이 아님
  },
  data: {
    status: 'PROCESSING',
    processingCronId: cronId,
  },
});

// 변경된 개수 < 요청 개수 → 일부는 다른 Cron이 처리 중
if (updated.count < entries.length) {
  // 경고 로깅
}
```

**장점:**
- Lock 불필요 → 성능 우수
- 동시성 높음

**단점:**
- 스키마 변경 필요 (processingCronId 추가)
- 로직 복잡

---

### Option C: 분산 Lock (Redis) (가장 확장성 좋음)

Vercel KV나 외부 Redis 사용 → 다른 프로젝트와도 공유 가능

**단점:** 외부 의존성 추가

---

## 의사결정 제안

**현재 상황:**
- Vercel Cron이 "5분마다 매우 높은 확률로 중복 실행"하지는 않지만 **가능성 존재**
- 2단계 웹훅 시스템에서 중복 처리 = 수당 중복 적립 = **큰 금전 손실**

**추천:** **Option A (SELECT ... FOR UPDATE)**
- 구현 시간: 2시간
- 위험도: 낮음 (Postgres 표준 기능)
- 성능: 프로덕션에서 입증됨

---

## 최종 결론

**P1-2는 "동시성 Race Condition"입니다.** 현재 코드의 주석("멱등성 기반")과 실제 구현의 괴리가 있으므로, 즉시 Select...FOR UPDATE 또는 낙관적 락으로 보강이 필요합니다. 특히 금전 거래(수당)와 관련된 부분이므로 **P1 우선순위 타당합니다.**
