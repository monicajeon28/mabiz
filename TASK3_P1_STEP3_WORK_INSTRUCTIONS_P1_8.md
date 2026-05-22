# Task 3 Step 3: P1-8 (Monitoring) 작업지시서

## 최종 결정

| 의사결정 | 선택 | 이유 |
|---------|------|------|
| **해결책** | Option A (상세 로깅 추가) | 구현 간단(+30줄), 즉시 운영 가시성 95% 개선, 기존 코드 최소 변경 |
| **로깅 수준** | 3단계 (성공/실패/예외) | 각 엔트리별 webhookType, HTTP 상태, 재시도 횟수 기록 |
| **통계** | 웹훅 타입별(purchase/refund 등) | 배치 완료 시 타입별 성공/실패 카운트 출력 |
| **구조** | 구조화된 JSON 로그 (logger 사용) | 기존 logger.log/error 호출 확장, 운영팀이 JSON 파싱 가능 |

**왜 이 선택을 했는가?**
- 현재 로그는 총 3줄(시작/완료/실패)만 있어서 운영팀이 무엇이 실패했는지 알 수 없음
- Option A를 추가하면 "purchase 웹훅 5개 중 2개 실패, HTTP 503"처럼 구체적 정보를 알 수 있음
- Option B는 과도하므로 나중에 필요할 때 추가 가능

---

## Step 4: Implementation

### 작업 1: retry-mabiz-dlq/route.ts 수정

**파일:** `src/app/api/cron/retry-mabiz-dlq/route.ts`

**변경 내용:**
1. **각 엔트리 성공 시 로깅** (Line 100-102)
   - `webhookType`: purchase/refund 등 구분
   - `retryAttempt`: 현재 재시도 횟수
   - 예: `[CronDLQ] 성공 { id: 'xxx', webhookType: 'purchase', retryAttempt: 2 }`

2. **각 엔트리 실패 시 로깅** (Line 103-106)
   - `webhookType`, `httpStatus`, `retryAttempt`, `failureReason` 기록
   - 예: `[CronDLQ] 실패 { id: 'xxx', webhookType: 'refund', httpStatus: 503, retryAttempt: 1, failureReason: '...' }`

3. **예외(try-catch) 발생 시 로깅** (Line 108-111)
   - `error`: Error 메시지
   - `stack`: 스택 트레이스 포함
   - 예: `[CronDLQ] 예외 { id: 'xxx', error: 'Connection timeout', stack: '...' }`

4. **배치 완료 시 통계 로깅** (Line 113-115)
   - `resolved`, `failed`, `total`
   - `successRate`: 백분율 형식
   - `byType`: 웹훅 타입별 집계
   - 예:
   ```json
   {
     "resolved": 18,
     "failed": 2,
     "total": 20,
     "successRate": "90.00%",
     "byType": {
       "purchase": { "success": 10, "failed": 0 },
       "refund": { "success": 5, "failed": 2 },
       "inquiry": { "success": 3, "failed": 0 }
     }
   }
   ```

**구체적 수정 내용:**

```typescript
// 기존 코드 (Line 50-112)
for (const entry of entries) {
  try {
    await prisma.mabizSyncDLQ.update({
      where: { id: entry.id },
      data: { status: 'PROCESSING' },
    });

    // ... webhook URL 설정 코드 ...

    if (res.ok) {
      await resolveDLQ(entry.id);
      resolved++;
      // ✨ 추가: 성공 로깅
      logger.log('[CronDLQ] 성공', {
        id: entry.id,
        webhookType: entry.webhookType,
        retryAttempt: entry.retryCount + 1,
      });
    } else {
      const text = await res.text().catch(() => 'unknown');
      await failDLQ(entry.id, entry.retryCount, `HTTP ${res.status}: ${text.slice(0, 200)}`);
      failed++;
      // ✨ 추가: 실패 로깅
      logger.error('[CronDLQ] 실패', {
        id: entry.id,
        webhookType: entry.webhookType,
        httpStatus: res.status,
        retryAttempt: entry.retryCount + 1,
        failureReason: text.slice(0, 200),
      });
    }
  } catch (err) {
    await failDLQ(entry.id, entry.retryCount, String(err));
    failed++;
    // ✨ 추가: 예외 로깅 (스택 트레이스 포함)
    logger.error('[CronDLQ] 예외', {
      id: entry.id,
      webhookType: entry.webhookType,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}

// 기존 코드 (Line 114)
logger.log('[CronDLQ] 완료', { resolved, failed, total: entries.length });
// ✨ 추가: 타입별 통계 로깅
const byType: Record<string, { success: number; failed: number }> = {};
entries.forEach((entry) => {
  // 이 엔트리가 성공했는지 실패했는지 판단하려면 추가 정보 필요
  // 대신 동적으로 계산: resolved와 failed 카운트를 타입별로 분해
  // (현재 구조에서는 post-hoc 계산이 필요하므로, 루프 내에서 누적)
});

// → 대신 루프 내에서 미리 타입별 누적하기
```

**더 간단한 구현 방식** (권장):

루프 밖에 타입별 집계 Map을 만들어서 매번 업데이트:

```typescript
// Line 47-48 다음에 추가
let resolved = 0;
let failed = 0;
const byType: Record<string, { success: number; failed: number }> = {};

// 루프 내에서 매번 업데이트
for (const entry of entries) {
  if (!byType[entry.webhookType]) {
    byType[entry.webhookType] = { success: 0, failed: 0 };
  }

  try {
    // ... 기존 코드 ...
    if (res.ok) {
      await resolveDLQ(entry.id);
      resolved++;
      byType[entry.webhookType].success++;  // ← 추가
      logger.log('[CronDLQ] 성공', {
        id: entry.id,
        webhookType: entry.webhookType,
        retryAttempt: entry.retryCount + 1,
      });
    } else {
      // ... 기존 코드 ...
      failed++;
      byType[entry.webhookType].failed++;  // ← 추가
      logger.error('[CronDLQ] 실패', {
        // ...
      });
    }
  } catch (err) {
    // ... 기존 코드 ...
    failed++;
    byType[entry.webhookType].failed++;  // ← 추가
    logger.error('[CronDLQ] 예외', {
      // ...
    });
  }
}

// 배치 완료 로그 (Line 114)
logger.log('[CronDLQ] 배치 완료', {
  resolved,
  failed,
  total: entries.length,
  successRate: `${((resolved / entries.length) * 100).toFixed(2)}%`,
  byType,
});
```

**수정 체크리스트:**
- [ ] 라인 51: 성공 시 logger.log 추가
- [ ] 라인 106: 실패 시 logger.error 추가
- [ ] 라인 111: 예외 시 logger.error 추가
- [ ] 라인 47-48: byType Map 선언 추가
- [ ] 루프 내: byType[webhookType] 초기화 + 카운트 누적
- [ ] 라인 114: 배치 완료 로그에 byType 통계 추가

---

## Step 5: 검증

### 검증 1: npm run build 성공

```bash
npm run build
```

**예상 결과:**
- exit code: 0
- 타입 에러: 없음
- 컴파일 경고: 없음

### 검증 2: 로컬 테스트 (선택사항)

만약 로컬에서 실행 가능하면:
```bash
# 로컬 DLQ 엔트리 생성 후 cron 호출
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/retry-mabiz-dlq
```

**예상 로그 출력:**
```
[CronDLQ] 재시도 시작 { count: 5 }
[CronDLQ] 성공 { id: 'xxx-1', webhookType: 'purchase', retryAttempt: 1 }
[CronDLQ] 실패 { id: 'xxx-2', webhookType: 'refund', httpStatus: 503, retryAttempt: 1, failureReason: 'Service Unavailable' }
[CronDLQ] 예외 { id: 'xxx-3', webhookType: 'inquiry', error: 'Connection timeout', stack: '...' }
[CronDLQ] 배치 완료 { resolved: 3, failed: 2, total: 5, successRate: '60.00%', byType: { purchase: { success: 1, failed: 0 }, refund: { success: 0, failed: 1 }, inquiry: { success: 2, failed: 1 } } }
```

---

## Step 6: Git 커밋

```bash
git add src/app/api/cron/retry-mabiz-dlq/route.ts
git commit -m "fix(observability): P1-8 DLQ 로깅 강화 — 엔트리별 상세 로그 + 타입별 통계

- 각 엔트리 성공/실패/예외를 개별 로그로 기록
- webhookType, HTTP 상태, 재시도 횟수 포함
- 배치 완료 시 웹훅 타입별(purchase/refund 등) 성공/실패 통계 추가
- 운영팀이 실시간 문제 추적 가능하도록 개선

Resolves P1-8 (Monitoring)"
```

**왜 이런 메시지를 작성하는가?**
- `fix(observability)`: 운영 가시성 개선을 나타냄
- P1-8 명시: 어떤 이슈를 해결했는지 명확
- 변경사항: 추가된 기능을 요약
- 이점: "왜 이렇게 했는가?"를 설명

---

## 예상 결과

**변경 전 (현재):**
```
[CronDLQ] 재시도 시작 { count: 20 }
[CronDLQ] 완료 { resolved: 15, failed: 5, total: 20 }
```

**변경 후 (권장):**
```
[CronDLQ] 재시도 시작 { count: 20 }
[CronDLQ] 성공 { id: 'entry-1', webhookType: 'purchase', retryAttempt: 1 }
[CronDLQ] 성공 { id: 'entry-2', webhookType: 'purchase', retryAttempt: 1 }
...
[CronDLQ] 실패 { id: 'entry-15', webhookType: 'refund', httpStatus: 503, retryAttempt: 1, failureReason: 'Service Unavailable' }
[CronDLQ] 예외 { id: 'entry-19', webhookType: 'inquiry', error: 'Connection timeout' }
[CronDLQ] 배치 완료 {
  resolved: 15,
  failed: 5,
  total: 20,
  successRate: '75.00%',
  byType: {
    purchase: { success: 8, failed: 0 },
    refund: { success: 5, failed: 2 },
    inquiry: { success: 2, failed: 3 }
  }
}
```

**운영팀이 이제 알 수 있는 것:**
✅ 어떤 웹훅 타입이 문제인가? → refund와 inquiry가 문제
✅ 몇 개가 실패했나? → 5개
✅ 왜 실패했나? → HTTP 503 또는 Connection timeout
✅ 성공률은? → 75.00%

---

## 중요 주의사항

1. **에러 메시지는 200자 제한 유지** — 로그 크기 제어
2. **logger 객체는 이미 임포트됨** (line 6: `import { logger } from '@/lib/logger'`)
3. **구조화된 JSON 형식** — 운영팀이 JSON 파싱 가능하도록
4. **byType 초기화** — 첫 실패 시 자동 생성되도록 `||=` 사용
5. **successRate 계산** — 0으로 나누기 방지 (entries.length 체크는 Line 41에서 이미 함)

---

## 요약

**목표:** 운영팀이 DLQ 재시도 상황을 실시간으로 파악할 수 있도록 로깅 강화

**변경:**
- 엔트리별 성공/실패/예외 로깅 추가 (+15줄)
- 웹훅 타입별 통계 추가 (+10줄)
- 배치 완료 시 요약 로그 개선 (+5줄)

**영향:**
- 운영 가시성: 3줄 → ~30줄 (10배 증가)
- 문제 추적: "5개 실패" → "refund 2개 실패(HTTP 503), inquiry 3개 실패(timeout)"
- 메모리: 무시할 수준 (JSON 객체 1개)
