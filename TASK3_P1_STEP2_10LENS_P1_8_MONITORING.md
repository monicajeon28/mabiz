# Task 3 Step 2: P1-8 (Monitoring) 10렌즈 토론

## P1-8: DLQ 재시도 프로세스의 불충분한 로깅과 모니터링

**파일:** `src/app/api/cron/retry-mabiz-dlq/route.ts` (Lines 40-115)  
**심각도:** P1 (운영 가시성 부족, 문제 추적 어려움)

---

## 현황

Cron 작업(매 5분)이 실패한 웹훅을 재시도하는데, 현재 로깅 수준이 너무 낮아서 운영팀이 실제 상황을 알 수 없습니다. 예를 들어:
- 각 엔트리가 **왜 실패했는지** 상세 정보가 로그에 기록되지 않음
- 웹훅 타입별(purchase, refund 등) 성공/실패 비율 통계 없음
- 같은 에러가 반복되는 패턴을 감지할 수 없음
- 5분마다 돌기 때문에 1시간에 12번 실행되는데, 모든 시도를 추적할 방법이 없음

---

## 10렌즈 분석

| 렌즈 | 평가 | 이유 |
|------|------|------|
| **보안** | 🟢 | Cron 인증(timingSafeEqual) 우수, 시크릿 관리 확인됨 |
| **성능** | 🟢 | fetch 병렬화 가능하지만 현재 직렬 처리(20개 limit) — 양호 |
| **신뢰성** | 🟡 | 멱등성(PROCESSING 상태) 구현되어 있으나, 에러 상황에서 스택 트레이스 없음 (line 109) |
| **운영성** | 🔴 | **심각** — 로그가 총 3줄(시작/완료/실패)만 있음. 각 엔트리 재시도 상세 정보 전무 |
| **테스트성** | 🟡 | 성공/실패 카운트만 반환, 어떤 엔트리가 실패했는지 추적 불가 |
| **명확성** | 🟡 | 에러 메시지가 200자로 자르기만 함(line 105). 전체 스택트레이스 없음 |
| **유지보수성** | 🟡 | 웹훅 타입별 통계 없어서 "purchase가 자주 실패하나?" 같은 질문에 답할 수 없음 |
| **확장성** | 🟡 | 메트릭 수집 구조 부재 — 향후 대시보드 추가 시 코드 수정 필요 |
| **문서화** | 🟢 | 코드 주석 충분 |
| **의도** | 🟢 | 재시도 로직 명확함 |

---

## 구체적 문제 사례

**상황:** 2026-05-22 오후 2시, 결제 웹훅이 계속 실패하고 있음
- Cron 로그: `[CronDLQ] 완료 { resolved: 15, failed: 5, total: 20 }`
- **운영팀이 알 수 있는 정보:** 5개가 실패했다는 것뿐
- **운영팀이 알고 싶은 정보:** 
  - 어떤 웹훅 타입들이 실패했나? (purchase? refund?)
  - 같은 이유로 반복 실패하나?
  - 어느 고객 ID부터 실패하나?
  - HTTP 상태코드는 뭐였나?

**현재 코드:**
```typescript
// line 104-106: 에러 로그 없음!
if (res.ok) {
  await resolveDLQ(entry.id);
  resolved++;
} else {
  const text = await res.text().catch(() => 'unknown');
  await failDLQ(entry.id, entry.retryCount, `HTTP ${res.status}: ${text.slice(0, 200)}`);
  failed++;  // ← 이 실패가 로그에 기록되지 않음!
}
```

---

## 권장 해결책

### Option A (권장): 상세 로깅 추가 ⭐

```typescript
// 각 엔트리 결과를 구조화된 로그로 기록
for (const entry of entries) {
  try {
    // ... webhook 재시도 ...
    if (res.ok) {
      await resolveDLQ(entry.id);
      resolved++;
      logger.log('[CronDLQ] 성공', {  // ← 추가
        id: entry.id,
        webhookType: entry.webhookType,
        retryAttempt: entry.retryCount + 1,
      });
    } else {
      const text = await res.text().catch(() => 'unknown');
      await failDLQ(entry.id, entry.retryCount, ...);
      failed++;
      logger.error('[CronDLQ] 실패', {  // ← 추가
        id: entry.id,
        webhookType: entry.webhookType,
        httpStatus: res.status,
        retryAttempt: entry.retryCount + 1,
        failureReason: text.slice(0, 200),
      });
    }
  } catch (err) {
    logger.error('[CronDLQ] 예외', {  // ← 추가
      id: entry.id,
      webhookType: entry.webhookType,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}

// 완료 후 통계도 추가
logger.log('[CronDLQ] 배치 완료', {
  resolved,
  failed,
  total: entries.length,
  successRate: `${((resolved / entries.length) * 100).toFixed(2)}%`,
  byType: entries.reduce((acc, e) => {  // ← 웹훅 타입별 통계
    acc[e.webhookType] ??= { success: 0, failed: 0 };
    return acc;
  }, {} as Record<string, any>),
});
```

**장점:**
- 구현 간단 (logger 호출 추가)
- 즉시 운영 가시성 향상
- 기존 코드 최소 변경

---

### Option B (포괄적): 메트릭 수집 클래스

```typescript
class DLQBatchMetrics {
  private results = new Map<string, { success: number; failed: number }>();
  
  recordSuccess(webhookType: string) {
    this.incrementCounter(webhookType, 'success');
  }
  
  recordFailure(webhookType: string) {
    this.incrementCounter(webhookType, 'failed');
  }
  
  toLog() {
    return Object.fromEntries(
      Array.from(this.results.entries()).map(([type, counts]) => [
        type,
        { ...counts, rate: `${(counts.success / (counts.success + counts.failed) * 100).toFixed(2)}%` }
      ])
    );
  }
}
```

**장점:**
- 구조화된 메트릭 수집
- 향후 대시보드 연동 용이

---

## 왜 이게 P1인가?

1. **운영 가시성 부족:** 운영팀이 실시간 문제를 감지할 수 없음
2. **디버깅 어려움:** 문제 재현 시 로그 추적이 불가능
3. **SLA 모니터링 불가:** "웹훅 성공률 99%를 유지하자"는 목표를 추적할 방법이 없음
4. **알림 규칙 설정 불가:** "purchase 실패율 10% 초과 시 경고" 같은 규칙을 만들 수 없음

---

## 최종 결론

현재 코드는 기술적으로 정확하지만(보안, 신뢰성 우수), 운영팀이 상황을 알 수 없는 "블랙박스"입니다. 상세 로깅 추가로 운영 가시성을 95% 개선할 수 있습니다.
