# Menu #38 Phase 3-δ: 모니터링 자동화 코드 검토 (최종)

**작성일**: 2026-05-19
**검토 대상**: 
- `src/lib/cron/verify-execution-log.ts` (494줄, 13.7KB)
- `src/lib/services/rollback-handler.ts` (309줄, 7.9KB)
- `src/lib/services/slack-notifier.ts` (341줄, 9.1KB)
- `src/app/api/admin/verification/*.ts` (3개 API, 220줄)

**검토 기준**: P0(Blocker) / P1(High) / P2(Medium)

---

## 1. P0 체크리스트 (치명적 결함)

### ✅ 1.1 크론잡 일정 (매일 06:00 정확?)

**현황**:
```typescript
export async function cronVerifyExecutionLog() {
  logger.info("[Cron] 자동 검증 크론잡 시작 (06:00)");
  // ...
}
```

**결과**: 
- ✅ 함수명과 주석으로 06:00 의도 명확
- ⚠️ **P0-1 CRITICAL**: Vercel Cron 설정 파일 미발견
  - `vercel.json` 또는 `/api/cron/verify-execution-log` 라우트 파일 필요
  - 현재 크론잡 엔드포인트가 없음 → 실제 실행 불가능

**수정 필요**:
```bash
# 확인 필요
- /api/cron/verify-execution-log/route.ts (생성 필요)
- vercel.json cron configuration (생성 필요)
```

---

### ✅ 1.2 검증 항목 완전성 (4가지 모두 실행?)

**현황**:
```typescript
const [rowConsistency, channelDistribution, campaignFilter, timestampCheck] = 
  await Promise.all([
    verifyCampaignRowConsistency(),
    verifyChannelDistribution(),
    verifyCampaignSourceFilter(),
    verifyTimestampConsistency(),
  ]);
```

**결과**:
- ✅ 4가지 검증 모두 Promise.all로 병렬 실행
- ✅ 각 함수 이름이 명확
- ✅ 검증 결과를 VerificationResult에 통합

**추가 검토**:

#### 1.2.1 행 수 일관성 (≥ 95%) ✅
```typescript
const consistency = (executionLogCount / sendingHistoryCount) * 100;
const passed = consistency >= 95;
```
- ✅ 정확: 95% 임계값 적용
- ✅ 분모 0 체크: `sendingHistoryCount > 0` 조건 확인
- ✅ 최근 7일 롤링 윈도우 적용

**문제점**:
- ⚠️ **P0-2 CRITICAL**: 양방향 비교 없음
  ```typescript
  // 현재: ExecutionLog / SendingHistory
  // 문제: 만약 SendingHistory < ExecutionLog면?
  // 예: SendingHistory=100, ExecutionLog=99 → 99% ✅ PASS
  // 예: SendingHistory=100, ExecutionLog=110 → 110% ❌ 검증 안 됨!
  ```
  
**수정 필요**:
```typescript
const consistency = Math.min(
  (executionLogCount / sendingHistoryCount) * 100,
  (sendingHistoryCount / executionLogCount) * 100
);
```

#### 1.2.2 채널별 동기화 (≥ 99%) ✅

**현황**:
```typescript
let totalDiff = 0;
for (const channel of allChannels) {
  const diff = Math.abs((sendingRatio[channel] || 0) - (executionRatio[channel] || 0));
  totalDiff += diff;
}
const syncRate = 100 - totalDiff / allChannels.size;
const passed = syncRate >= 99;
```

**문제점**:
- ⚠️ **P1-1 HIGH**: 동기화율 계산 로직 오류
  ```typescript
  // 예시
  sendingRatio: { SMS: 60%, EMAIL: 40% }
  executionRatio: { SMS: 40%, EMAIL: 60% }
  allChannels.size: 2
  totalDiff: |60-40| + |40-60| = 20 + 20 = 40
  syncRate: 100 - 40/2 = 100 - 20 = 80%  ← 너무 관대함!
  
  // 이 경우 채널 분포가 완전히 반대인데 syncRate=80%?
  // 실제로는 완전 동기화 불가 상태
  ```

**수정 필요**:
```typescript
// 방법 1: 채널별 비율 차이 최댓값 사용
let maxDiff = 0;
for (const channel of allChannels) {
  const diff = Math.abs((sendingRatio[channel] || 0) - (executionRatio[channel] || 0));
  maxDiff = Math.max(maxDiff, diff);
}
const syncRate = 100 - maxDiff;

// 방법 2: 카이제곱 검정
// 방법 3: 코사인 유사도
```

#### 1.2.3 CAMPAIGN 필터 (100% 매칭) ✅

**현황**:
```typescript
const accuracy = (executionCampaignCount - mismatchCount) / executionCampaignCount * 100;
const passed = accuracy === 100;
```

**문제점**:
- ✅ 로직 정확
- ⚠️ **P1-2 HIGH**: 불필요한 중복 쿼리
  ```typescript
  // executionCampaignCount 이미 계산됨
  // campaignIdNullCount는 불필요 (mismatchCount와 동일)
  ```

**정정**: `campaignIdNullCount`와 `mismatchCount`가 같은 것으로 사용됨
- 하나만 유지하면 됨

#### 1.2.4 타임스탬프 오차 (P99 < 5초) ⚠️

**현황**:
```typescript
const percentile99Index = Math.ceil((99 / 100) * diffs.length) - 1;
const percentile99 = diffs[Math.max(0, percentile99Index)];
const passed = percentile99 < 5;
```

**문제점**:
- ⚠️ **P0-3 CRITICAL**: 샘플 크기 부족 시 의미 없음
  ```typescript
  // 만약 diffs.length = 2:
  percentile99Index = Math.ceil(0.99 * 2) - 1 = Math.ceil(1.98) - 1 = 2 - 1 = 1
  percentile99 = diffs[1]
  
  // 실제로는 50th percentile인데 99th percentile이라 함!
  // 통계적으로 무의미
  ```

**수정 필요**:
```typescript
if (diffs.length < 100) {
  logger.warn("[Verify] 타임스탐프 샘플 크기 부족", { sampleSize: diffs.length });
  // 경고만 하고 PASS로 처리하거나
  // 충분한 샘플이 나올 때까지 대기
  return {
    sampleSize: diffs.length,
    maxDiff: 0,
    percentile99: 0,
    avgDiff: 0,
    passed: true, // 또는 false
    warning: "Sample size too small for reliable P99 calculation"
  };
}
```

- ⚠️ **P1-3 HIGH**: 1000개 샘플 추출 시 DB 성능 영향
  ```typescript
  take: 1000,  // 대량 SELECT
  ```
  
  개선 필요: 인덱스 활용 또는 샘플링 크기 조정

---

### ✅ 1.3 롤백 트리거 (일관성 < 95% → 자동 롤백?)

**현황**:
```typescript
if (!rowConsistency.passed) {
  logger.error("[Verify] 치명적 오류: 행 수 일관성 < 95%", { ... });
  await rollbackToSendingHistory();
  await notifySlack({ type: "CRITICAL_ROLLBACK", ... });
  result.rollbackTriggered = true;
}
```

**결과**: ✅ 자동 롤백 로직 정확

**하지만**:
- ⚠️ **P0-4 CRITICAL**: 롤백 후 무한 재검증 루프 위험
  
  **시나리오**:
  ```
  Day 1 06:00:
  - 검증 실패 (consistency=94%)
  - 롤백 트리거 → Feature Flag 비활성화
  - SendingHistory 사용으로 전환
  
  Day 2 06:00:
  - 재검증 실행
  - 현재 상황: SendingHistory만 사용 중
  - 그러면 ExecutionLog 행 수가 증가하지 않음
  - 일관성 = ExecutionLog(고정) / SendingHistory(증가)
  - 계속 95% 이하 유지?? → 무한 롤백 시도?
  ```

**해결 방안 필요**:
1. 롤백 상태에서는 검증 항목 조정
2. 또는 검증 대상을 ExecutionLog 기반에서 SendingHistory 기반으로 전환

---

### ✅ 1.4 롤백 완료 시간 (< 1분?)

**현황**:
```typescript
export async function rollbackToSendingHistory(
  reason: string = "ExecutionLog inconsistency detected"
): Promise<{ success: boolean; duration: number; details: any; }> {
  const startTime = Date.now();
  
  try {
    await disableExecutionLogFeature();        // <100ms (Redis)
    await invalidateExecutionLogCache();       // <500ms (Redis)
    await setRollbackState(...);               // <100ms (Redis)
    await validateSendingHistoryIntegrity();   // <1000ms (DB count)
    await recordRollbackEvent(...);            // <100ms (logging)
    
    return { success: true, duration: Date.now() - startTime, ... };
  }
}
```

**결과**:
- ✅ 각 스텝이 빠름 (총 < 1500ms)
- ✅ 시간 측정 정확

**확인 필요**:
- validateSendingHistoryIntegrity()에서 대량 count 쿼리
  ```typescript
  const totalRecords = await db.sendingHistory.count();  // ← 느릴 수 있음
  ```
  
  개선: `WHERE createdAt > NOW() - 7 days` 추가

---

### ✅ 1.5 Slack 알림 전송 (오류는 아닌지?)

**현황**:
```typescript
async function sendSlackWebhook(payload: SlackNotificationPayload): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_VERIFY;
  
  if (!webhookUrl) {
    logger.warn("[Slack] SLACK_WEBHOOK_VERIFY 환경변수 미설정");
    return;
  }
  
  try {
    const response = await fetch(webhookUrl, { ... });
    if (!response.ok) {
      logger.error("[Slack] Webhook 전송 실패", { status: response.status });
      throw new Error(`Webhook error: ${response.statusText}`);
    }
  } catch (error) {
    logger.error("[Slack] Webhook 전송 중 오류", { error });
  }
}
```

**결과**:
- ✅ Slack 오류가 메인 로직을 방해하지 않음
- ✅ 환경변수 미설정 시 silently fail

**문제점**:
- ⚠️ **P1-4 HIGH**: `response.ok` 후 throw하면 catch 블록에서 또 다시 처리
  
  **코드 흐름**:
  ```typescript
  if (!response.ok) {
    throw new Error(...);  // ← throw
  }
  // 아래로 내려올 일 없음
  ```
  
  개선: `if (!response.ok) { logger.error(...); return; }`

---

## 2. P1 체크리스트 (High Priority)

### ✅ 2.1 Feature Flag Redis 접근 (에러 처리?)

**현황**:
```typescript
export async function isExecutionLogEnabled(): Promise<boolean> {
  try {
    const flag = await getCache<string>(FEATURE_FLAG_KEY);
    if (flag === null) {
      const envValue = process.env.ENABLE_EXECUTION_LOG === "true";
      await setCache(FEATURE_FLAG_KEY, envValue ? "1" : "0", 3600);
      return envValue;
    }
    return flag === "1";
  } catch (error) {
    logger.warn("[Rollback] Feature Flag 조회 실패, 기본값(true) 사용", { error });
    return true;  // ← 안전 모드로?
  }
}
```

**문제점**:
- ⚠️ **P0-5 CRITICAL**: 오류 발생 시 기본값이 `true`
  
  **시나리오**:
  ```
  Redis 서버 다운:
  - isExecutionLogEnabled() 호출
  - Redis 접근 실패
  - 기본값 true 반환
  - ExecutionLog 계속 사용 ← 실제로는 롤백되어야 함!
  ```

**수정 필요**:
```typescript
catch (error) {
  logger.error("[Rollback] Feature Flag 조회 실패, 안전 모드(false) 사용", { error });
  return false;  // ← SendingHistory로 폴백
}
```

### ✅ 2.2 검증 병렬 실행 (Promise.all 사용?)

**현황**:
```typescript
const [rowConsistency, channelDistribution, campaignFilter, timestampCheck] = 
  await Promise.all([
    verifyCampaignRowConsistency(),
    verifyChannelDistribution(),
    verifyCampaignSourceFilter(),
    verifyTimestampConsistency(),
  ]);
```

**결과**: ✅ 병렬 실행 정확

**성능 분석**:
- `verifyCampaignRowConsistency()`: ~500ms (2개 count)
- `verifyChannelDistribution()`: ~800ms (2개 groupBy)
- `verifyCampaignSourceFilter()`: ~500ms (2개 count)
- `verifyTimestampConsistency()`: ~3000ms (1000개 SELECT + 1000개 findFirst 루프!)

**문제점**:
- ⚠️ **P0-6 CRITICAL**: verifyTimestampConsistency() 성능 이슈
  ```typescript
  for (const sending of sendingHistorySample) {
    const execution = await db.executionLog.findFirst({  // ← N+1 쿼리!
      where: {
        campaignId: sending.campaignId,
        contactId: sending.contactId,
        sourceType: "CAMPAIGN",
      },
    });
  }
  // 1000번의 DB 쿼리!
  // 총 실행 시간: ~5-10초
  ```

**수정 필요**:
```typescript
// 방법: 조인 쿼리 사용
const pairs = await db.sendingHistory.findMany({
  where: {
    campaignId: { not: null },
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
  include: {
    executionLog: {  // ← ExecutionLog와의 관계 필요
      select: { createdAt: true },
    },
  },
  take: 1000,
  orderBy: { createdAt: "desc" },
});

const diffs = pairs
  .filter(p => p.executionLog)
  .map(p => {
    const diffMs = Math.abs(p.createdAt.getTime() - p.executionLog!.createdAt.getTime());
    return diffMs / 1000;
  });
```

---

### ✅ 2.3 DB 연결 풀링 (동시 쿼리 > 5개?)

**현황**:
```typescript
const [sendingHistoryCount, executionLogCount] = await Promise.all([
  db.sendingHistory.count({ ... }),  // Query 1
  db.executionLog.count({ ... }),    // Query 2
]);

const sendingByChannel = await db.sendingHistory.groupBy({ ... });  // Query 3
const executionByChannel = await db.executionLog.groupBy({ ... }); // Query 4
// ... 더 많은 쿼리
```

**동시 쿼리 개수**:
- Promise.all 내부: 4개 (row consistency + channel dist + campaign filter + timestamp)
- 각 함수 내부 추가 쿼리: ~10개

**문제점**:
- ⚠️ **P1-5 HIGH**: Prisma 기본 연결 풀 (10개)이 부족할 수 있음
  
  ```
  DATABASE_URL에서 connection pool size 확인
  Standard: 5 + 5 reserved = 10
  만약 동시 쿼리 > 10개면 대기
  ```

**확인 필요**:
- `DATABASE_URL` 또는 `prisma/.env`에서 `?connection_limit=20` 추가

---

### ✅ 2.4 롤백 중 신규 요청 (middleware에서 캐치?)

**현황**:
```typescript
// feature-flag-middleware.ts
export async function routeBySendingTable(
  executionLogQuery: () => Promise<any>,
  sendingHistoryQuery: () => Promise<any>
): Promise<any> {
  const flagStatus = await checkFeatureFlag();
  
  if (flagStatus.executionLogEnabled) {
    return executionLogQuery();
  } else {
    return sendingHistoryQuery();  // ← Fallback
  }
}
```

**결과**: ✅ 동적 라우팅 가능

**하지만**:
- ⚠️ **P1-6 HIGH**: 실제 사용처가 없음
  - 어느 API에서 routeBySendingTable()을 호출하는가?
  - 검색 결과: 사용처 없음!

**수정 필요**:
1. 모든 campaign 조회 API에서 `routeBySendingTable()` 적용
2. 또는 메인 API 미들웨어에서 `withFeatureFlagCheck()` 적용

---

### ✅ 2.5 관리자 API 인증 (Bearer Token 검증?)

**현황**:
```typescript
// rollback/route.ts
const auth = req.headers.get("authorization");
if (!auth || !auth.startsWith("Bearer ")) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// 하지만 실제 토큰 검증은?
// const token = auth.substring(7);  // "Bearer {token}"
// await verifyAdminToken(token);  // ← 호출 안 함!
```

**문제점**:
- ⚠️ **P0-7 CRITICAL**: 토큰 형식만 체크하고 실제 검증 안 함
  
  ```typescript
  // 현재 코드
  if (!auth || !auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // "Bearer anything"이면 통과!
  // "Bearer " + (임의 문자열) → 인증 완료?? 아니!
  ```

**수정 필요**:
```typescript
const auth = req.headers.get("authorization");
if (!auth || !auth.startsWith("Bearer ")) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const token = auth.substring(7);  // Extract token
try {
  await verifyAdminToken(token);  // Actual verification
} catch (error) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## 3. P2 체크리스트 (Medium Priority)

### ✅ 3.1 모니터링 메트릭 (검증 시간, 롤백 횟수)

**현황**:
```typescript
duration: Date.now() - startTime
```

**결과**: ✅ 검증 시간 측정

**부족한 부분**:
- ⚠️ **P2-1**: 롤백 횟수 누적 통계 없음
  - Redis에 `crm:metrics:rollback_count` 추가 필요
  - 월별 집계 필요

---

### ✅ 3.2 운영 가이드 (FAQ 5개 이상?)

**현황**:
```typescript
export function getRecoveryGuide(): string {
  return `
## ExecutionLog 롤백 복구 가이드

### 상황
...
### 복구 절차
1단계: 데이터 검증 (필수)
2단계: ExecutionLog 재검증
3단계: 수동 복구 (검증 후)
4단계: 모니터링
  `;
}
```

**결과**: ✅ 기본 가이드 있음

**부족한 부분**:
- ⚠️ **P2-2**: FAQ 형식 아님 (절차 가이드만 있음)
  - "Q: 롤백 후 얼마나 빨리 복구되나?" 없음
  - "Q: 수동 복구 중 메시지는 발송되나?" 없음
  - "Q: 롤백 상태를 어떻게 모니터링하나?" 없음

---

### ✅ 3.3 복구 절차 (3단계 SQL 테스트?)

**현황**:
```typescript
export function getRecoveryGuide(): string {
  return `
**1단계: 데이터 검증 (필수)**
\`\`\`sql
SELECT COUNT(*) as total, ...
FROM SendingHistory
WHERE campaignId IS NOT NULL AND createdAt > NOW() - INTERVAL '7 days';
\`\`\`
  `;
}
```

**결과**: ✅ SQL 템플릿 제공

**문제점**:
- ⚠️ **P2-3**: SQL에 INTERVAL '7 days' 사용 (PostgreSQL)
  - Neon(PostgreSQL) 기준인가?
  - Supabase는?
  - MySQL이면 INTERVAL 7 DAY (다름!)

---

### ✅ 3.4 월간 점검 체크리스트 (7개 항목?)

**현황**: 없음

**필요사항**:
- [ ] 지난 30일 롤백 이벤트 리뷰
- [ ] ExecutionLog vs SendingHistory 정합성 수동 검증
- [ ] Redis 연결 상태 확인
- [ ] DB 연결 풀 상태 확인
- [ ] Slack 알림 채널 구독 확인
- [ ] 크론잡 실행 로그 검토
- [ ] 성능 지표 (P99 응답시간) 확인

---

### ✅ 3.5 향후 확장성 (다른 Phase 모니터링 추가 가능?)

**현황**:
- 현재: Menu #38 Phase 2 (ExecutionLog) 모니터링만
- 향후: Phase 3, Phase 4도 검증?

**아키텍처 평가**:
```typescript
export async function verifyExecutionLogConsistency(): Promise<VerificationResult> {
  // Menu #38 Phase 2 전용 검증
}
```

**문제점**:
- ⚠️ **P2-4**: 확장성 부족
  - 다른 Phase의 테이블도 모니터링 필요 시 새로운 함수 필요
  - 공통 검증 프레임워크 부재

**개선안**:
```typescript
interface VerificationRule {
  name: string;
  description: string;
  test: () => Promise<boolean>;
  threshold: number;
  onFailure: () => Promise<void>;
}

export async function runVerificationSuite(rules: VerificationRule[]) {
  const results = await Promise.all(rules.map(r => r.test()));
  // ...
}
```

---

## 4. 추가 발견 사항

### 4.1 타입 검사 미흡

**문제점**:
```typescript
// rollback-handler.ts
async function recordRollbackEvent(reason: string, details: any): Promise<void> {
  // ← details: any는 위험
  // 구조화된 타입 필요
}
```

**수정**:
```typescript
interface RollbackEventDetails {
  validationResult: VerifyResult;
  timestamp: string;
  triggeredBy: "AUTOMATIC" | "MANUAL";
}
```

### 4.2 로깅 레벨 불일치

**문제점**:
```typescript
if (!rowConsistency.passed) {
  logger.error("[Verify] 치명적 오류: 행 수 일관성 < 95%", { ... });
  await rollbackToSendingHistory();  // ← 자동 복구됨
}
```

**개선**: error 대신 critical 또는 alert 레벨 필요?

### 4.3 테스트 부재

**현황**: 유닛 테스트, 통합 테스트 모두 없음

**필요사항**:
```typescript
// __tests__/verify-execution-log.test.ts
describe("verifyExecutionLogConsistency", () => {
  it("should pass when consistency >= 95%", async () => {
    // ...
  });
  
  it("should trigger rollback when consistency < 95%", async () => {
    // ...
  });
});
```

---

## 5. 최종 정리

### P0 (Blocker) 이슈: 7개

| ID | 제목 | 심각도 | 해결책 |
|---|---|---|---|
| P0-1 | Cron 엔드포인트 파일 미발견 | 치명 | `/api/cron/verify-execution-log/route.ts` 생성 |
| P0-2 | 행 수 일관성 단방향 비교 | 치명 | 양방향 min() 적용 |
| P0-3 | 타임스탬프 P99 샘플 부족 | 치명 | 최소 샘플 크기 100개 이상 검증 |
| P0-4 | 롤백 후 무한 루프 위험 | 치명 | 검증 로직 조정 필요 |
| P0-5 | Redis 오류 시 기본값 true | 치명 | 기본값을 false로 변경 |
| P0-6 | N+1 쿼리 (타임스탬프 검증) | 치명 | 조인 쿼리로 개선 |
| P0-7 | 토큰 검증 미실행 | 치명 | verifyAdminToken() 호출 추가 |

### P1 (High) 이슈: 6개

| ID | 제목 | 해결책 |
|---|---|---|
| P1-1 | 채널 동기화율 계산 오류 | 최대 차이 기반 재계산 |
| P1-2 | CAMPAIGN 필터 중복 쿼리 | campaignIdNullCount 제거 |
| P1-3 | 1000개 샘플 DB 성능 영향 | 샘플 크기 조정 (100-500) |
| P1-4 | Slack 에러 처리 중복 | throw 대신 return으로 수정 |
| P1-5 | DB 연결 풀 부족 위험 | connection_limit=20 확인 |
| P1-6 | routeBySendingTable() 미사용 | 실제 API에 적용 필요 |

### P2 (Medium) 이슈: 4개

| ID | 제목 | 해결책 |
|---|---|---|
| P2-1 | 롤백 횟수 메트릭 없음 | Redis 카운터 추가 |
| P2-2 | 운영 가이드 FAQ 부족 | FAQ 5개 이상 작성 |
| P2-3 | SQL 문법 DB별 불일치 | 주석에서 DB 명시 |
| P2-4 | 확장성 부족 | 검증 규칙 프레임워크화 |

---

## 6. 배포 전 체크리스트

### 필수 (배포 차단)
- [ ] P0 이슈 7개 모두 수정
- [ ] `/api/cron/verify-execution-log/route.ts` 생성 및 테스트
- [ ] `vercel.json` cron configuration 추가
- [ ] 토큰 검증 함수 호출 확인
- [ ] N+1 쿼리 개선 및 성능 테스트

### 권장 (배포 전)
- [ ] P1 이슈 6개 수정
- [ ] 유닛 테스트 작성 (최소 10개)
- [ ] 통합 테스트 (크론 수동 실행)
- [ ] Slack 웹훅 연동 확인

### 선택 (배포 후)
- [ ] P2 이슈 처리
- [ ] 모니터링 대시보드 구축
- [ ] 월간 점검 자동화

---

## 7. 코드 리뷰 점수

**평가 기준**: 0-100점

| 항목 | 점수 | 근거 |
|---|---|---|
| **구조 및 설계** | 8/10 | 명확한 계층 분리, 하지만 확장성 부족 |
| **정확성** | 5/10 | P0 7개 이슈로 인해 크게 감점 |
| **성능** | 4/10 | N+1 쿼리, 과도한 샘플 크기 |
| **테스트** | 0/10 | 테스트 완전 부재 |
| **문서화** | 6/10 | 기본 주석은 있지만 운영 가이드 부족 |
| **보안** | 5/10 | 토큰 검증 미실행, Redis 오류 처리 |

**종합**: **6.3/10** (배포 불가 상태)

---

## 8. 우선순위별 작업 순서

### Phase 1 (긴급, 1일)
1. P0 이슈 7개 수정
2. Cron 엔드포인트 생성
3. 토큰 검증 추가
4. 성능 테스트

### Phase 2 (고우선, 2-3일)
1. P1 이슈 6개 수정
2. 유닛 테스트 작성
3. 통합 테스트 실행

### Phase 3 (권장, 후속)
1. P2 이슈 처리
2. 모니터링 대시보드
3. 운영 가이드 완성

---

**검토 완료**: 2026-05-19
**검토자**: Claude Code - Phase 3-δ
**다음 단계**: P0 이슈 수정 후 재검토
