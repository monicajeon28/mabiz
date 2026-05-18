# Menu #38 Phase 3-δ: 배포 전 최종 체크리스트

**상태**: 배포 차단 상태 (P0 이슈 7개 미해결)
**최종 검토일**: 2026-05-19
**배포 예정일**: 2026-05-20 (P0 해결 후)

---

## 1. P0 이슈 해결 확인 (필수, 배포 차단)

### 1.1 Cron 엔드포인트 생성
- [ ] `/src/app/api/cron/verify-execution-log/route.ts` 파일 생성됨
  - 파일 크기: > 100줄
  - GET/POST 메서드 구현
  - CRON_SECRET 인증 포함
  - 타이밍 세이프 비교 (timingSafeEqual) 적용
  - 개발/운영 환경 분기 처리
  
**검증 방법**:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/verify-execution-log
# 응답: { "ok": true, "message": "...", "timestamp": "..." }
```

### 1.2 행 수 일관성 검증 (양방향)
- [ ] `verify-execution-log.ts` 수정됨
  - 함수: `verifyCampaignRowConsistency()`
  - 변경 전: `consistency = executionLog / sendingHistory`
  - 변경 후: `consistency = min(executionLog / sendingHistory, sendingHistory / executionLog)`
  - 테스트: 양쪽 모두 95% 이상 통과

**검증 코드**:
```typescript
const consistency = Math.min(
  (executionLogCount / sendingHistoryCount) * 100,
  (sendingHistoryCount / executionLogCount) * 100
);
const passed = consistency >= 95;
```

### 1.3 타임스탬프 P99 샘플 크기 검증
- [ ] `verifyTimestampConsistency()` 수정됨
  - 최소 샘플 크기 100개 이상 검증 추가
  - 샘플 < 100개면 경고 로그 + passed = true
  - P99 계산 통계적 유효성 확보

**검증 코드**:
```typescript
if (diffs.length < 100) {
  logger.warn("[Verify] 타임스탐프 샘플 크기 부족", { 
    sampleSize: diffs.length,
    message: "P99 계산이 통계적으로 무의미"
  });
  return { sampleSize: diffs.length, ..., passed: true };
}
```

### 1.4 롤백 무한 루프 방지
- [ ] `verify-execution-log.ts` 수정됨
  - 롤백 상태 감지 로직 추가
  - 검증 항목 동적 조정 (Feature Flag 상태에 따라)
  - 또는 검증 대상 테이블 전환 (ExecutionLog → SendingHistory)

**검증 로직**:
```typescript
const rollbackState = await getRollbackState();
if (rollbackState) {
  // 롤백 중이면 검증 기준 조정 또는 스킵
  logger.info("[Verify] 롤백 상태 감지, 검증 기준 조정");
  // 옵션 1: 검증 스킵
  return { isHealthy: true, message: "Rollback in progress" };
  // 옵션 2: 기준 완화
  const passed = consistency >= 90;  // 95% → 90%
}
```

### 1.5 Redis 오류 시 기본값 수정
- [ ] `rollback-handler.ts` 수정됨
  - 함수: `isExecutionLogEnabled()`
  - 변경 전: `return true` (오류 시)
  - 변경 후: `return false` (오류 시 안전 모드)
  - 테스트: Redis 다운 시나리오 검증

**검증 코드**:
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
    logger.error("[Rollback] Feature Flag 조회 실패, 안전 모드(false) 사용", { error });
    return false;  // ← 변경: true → false
  }
}
```

### 1.6 N+1 쿼리 개선 (타임스탬프 검증)
- [ ] `verifyTimestampConsistency()` 쿼리 최적화
  - 변경 전: 1000개 sendingHistory SELECT + 1000개 executionLog findFirst (1001 쿼리!)
  - 변경 후: 조인 쿼리 또는 배치 쿼리 (2 쿼리 또는 5 쿼리)
  - 성능: ~5-10초 → ~1초 이하
  - 테스트: 실행 시간 측정

**개선 쿼리**:
```typescript
// 방법 1: 원시 SQL (조인)
const diffs = await db.$queryRaw<Array<{ diffSeconds: number }>>`
  SELECT 
    ABS(EXTRACT(EPOCH FROM (sh.createdAt - el.createdAt))) as diffSeconds
  FROM SendingHistory sh
  INNER JOIN ExecutionLog el ON 
    sh.campaignId = el.campaignId AND 
    sh.contactId = el.contactId AND 
    el.sourceType = 'CAMPAIGN'
  WHERE sh.campaignId IS NOT NULL 
    AND sh.createdAt > NOW() - INTERVAL '1 day'
  ORDER BY sh.createdAt DESC
  LIMIT 1000
`;

// 방법 2: Prisma 조인 (Schema에 관계 필요)
const pairs = await db.sendingHistory.findMany({
  where: { 
    campaignId: { not: null },
    createdAt: { gte: new Date(Date.now() - 24*60*60*1000) }
  },
  include: {
    executionLogs: {  // ← Relation 필요
      where: { sourceType: "CAMPAIGN" },
      select: { createdAt: true }
    }
  },
  take: 1000,
  orderBy: { createdAt: "desc" }
});
```

**성능 검증**:
```bash
# 로컬 DB에서 쿼리 실행 시간 측정
EXPLAIN ANALYZE
SELECT 
  ABS(EXTRACT(EPOCH FROM (sh.createdAt - el.createdAt))) as diffSeconds
FROM SendingHistory sh
INNER JOIN ExecutionLog el ON ...
# Planning Time: < 5ms
# Execution Time: < 1000ms (1000개 샘플)
```

### 1.7 토큰 검증 함수 호출
- [ ] 3개 API 모두 수정됨
  - `/api/admin/verification/status/route.ts`
  - `/api/admin/verification/rollback/route.ts`
  - `/api/admin/verification/recovery/route.ts`

**수정 패턴**:
```typescript
const auth = req.headers.get("authorization");
if (!auth || !auth.startsWith("Bearer ")) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const token = auth.substring(7);  // Extract "Bearer {token}"
try {
  await verifyAdminToken(token);  // ← 반드시 호출
} catch (error) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**테스트**:
```bash
# 토큰 검증 실패
curl -X POST http://localhost:3000/api/admin/verification/rollback \
  -H "Authorization: Bearer invalid-token" \
  # 응답: 401 Unauthorized

# 토큰 검증 성공
curl -X POST http://localhost:3000/api/admin/verification/rollback \
  -H "Authorization: Bearer valid-token" \
  # 응답: 200 OK
```

---

## 2. P1 이슈 해결 확인 (권장, 배포 후 1주일)

### 2.1 채널 동기화율 계산 재검토
- [ ] `verifyChannelDistribution()` 로직 재계산
  - 현재: 평균 차이 기반
  - 권장: 최대 차이 기반 또는 카이제곱 검정
  - 테스트: 채널 분포 완전 반대 시나리오

**개선 쿼리**:
```typescript
// 현재 (문제 있음)
const syncRate = 100 - totalDiff / allChannels.size;

// 개선안 1: 최대 차이 기반
let maxDiff = 0;
for (const channel of allChannels) {
  const diff = Math.abs((sendingRatio[channel] || 0) - (executionRatio[channel] || 0));
  maxDiff = Math.max(maxDiff, diff);
}
const syncRate = 100 - maxDiff;

// 개선안 2: 코사인 유사도
const dotProduct = ...;
const syncRate = (dotProduct / (magnitude1 * magnitude2)) * 100;
```

### 2.2 CAMPAIGN 필터 불필요한 쿼리 제거
- [ ] `verifyCampaignSourceFilter()` 간소화
  - 제거: `campaignIdNullCount` 쿼리 (mismatchCount와 중복)
  - 유지: `executionCampaignCount`, `mismatchCount` 만

### 2.3 1000개 샘플 크기 조정
- [ ] `verifyTimestampConsistency()` 샘플 크기 검토
  - 현재: 1000개 (N+1 쿼리로 인해 너무 느림)
  - 권장: 100-500개 (조인 쿼리 최적화 후)
  - 설정: 환경변수로 조정 가능하게

```typescript
const TIMESTAMP_SAMPLE_SIZE = parseInt(process.env.TIMESTAMP_SAMPLE_SIZE || "500");
const sendingHistorySample = await db.sendingHistory.findMany({
  take: TIMESTAMP_SAMPLE_SIZE,  // ← 조정
  // ...
});
```

### 2.4 Slack 에러 처리 중복 제거
- [ ] `slack-notifier.ts` 정리
  - `if (!response.ok) { throw ... }` 제거 (catch에서 처리)
  - `else { logger.error(...); return; }` 로 수정

```typescript
if (!response.ok) {
  logger.error("[Slack] Webhook 전송 실패", {
    status: response.status,
    statusText: response.statusText,
  });
  return;  // ← throw 제거
}
```

### 2.5 DB 연결 풀 설정 확인
- [ ] `.env` 또는 `DATABASE_URL` 검증
  ```bash
  # 확인
  echo $DATABASE_URL
  
  # 형식 (Neon PostgreSQL)
  postgresql://user:password@host/dbname?connection_limit=20&PoolingMode=transaction
  
  # 형식 (Supabase PostgreSQL)
  postgresql://user:password@host/dbname?sslmode=require&connection_limit=20
  ```

- [ ] Prisma connection pool 설정
  ```prisma
  // prisma/schema.prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
    // connection_limit은 DATABASE_URL의 쿼리 파라미터에서 설정
  }
  ```

### 2.6 Feature Flag 동적 라우팅 적용
- [ ] 실제 API에서 `routeBySendingTable()` 또는 `checkFeatureFlag()` 사용
  - 찾기: campaign 조회 API 모두 검색
  - 적용: API 핸들러에 래퍼 추가

```typescript
// 예: campaign stats 조회
export async function GET(req: NextRequest) {
  return withFeatureFlagCheck(async (flagStatus) => {
    if (flagStatus.executionLogEnabled) {
      // ExecutionLog 사용
      const stats = await db.executionLog.groupBy({ ... });
    } else {
      // SendingHistory 폴백
      const stats = await db.sendingHistory.groupBy({ ... });
    }
  });
}
```

---

## 3. 코드 검토 (필수)

### 3.1 Peer Review
- [ ] 개발팀 1명 이상이 코드 리뷰 완료
- [ ] 리뷰어 확인사항:
  - [ ] P0 이슈 7개 모두 수정됨
  - [ ] 신규 코드에 주석 있음
  - [ ] 테스트 커버리지 확인
  - [ ] 보안 이슈 없음 (SQL injection, token exposure 등)

### 3.2 자동화 검사
- [ ] `npm run lint` 통과 (ESLint)
- [ ] `npm run type-check` 통과 (TypeScript)
- [ ] `npm test` 통과 (Jest, 최소 10개 테스트)

```bash
npm run lint -- src/lib/cron/verify-execution-log.ts src/lib/services/rollback-handler.ts src/lib/services/slack-notifier.ts src/app/api/admin/verification
npm run type-check
npm test -- verify-execution-log rollback-handler slack-notifier
```

---

## 4. 성능 테스트 (필수)

### 4.1 검증 함수 실행 시간
- [ ] 목표: 전체 검증 < 10초
  - `verifyCampaignRowConsistency()`: < 1초
  - `verifyChannelDistribution()`: < 1초
  - `verifyCampaignSourceFilter()`: < 1초
  - `verifyTimestampConsistency()`: < 2초 (N+1 제거 후)

**측정 방법**:
```bash
# 로컬 실행
curl -X POST http://localhost:3000/api/cron/verify-execution-log

# 응답에서 duration 확인
# "timestamp": "...", "duration": 4523ms  ← 5초 미만
```

### 4.2 롤백 시간
- [ ] 목표: 롤백 < 1분 (60초)
  - 실제 측정: 834ms (기존 결과)
  - 확인: 롤백 중 메시지 발송 영향 없음

### 4.3 DB 연결 풀 포화
- [ ] 동시 실행 시 연결 부족 테스트
  - 현재 설정: connection_limit=10 (기본값)
  - 권장: connection_limit=20 (증설)
  - 테스트: 크론잡 + API 동시 실행

```bash
# 부하 테스트
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/cron/verify-execution-log &
done
wait

# 확인
tail -f logs/database.log | grep "pool exhausted"
```

---

## 5. 통합 테스트 (필수)

### 5.1 E2E 시나리오
- [ ] **시나리오 1: 정상 검증**
  - 데이터 정상 상태
  - 기대: isHealthy=true, no rollback
  - 검증: Slack 초록색 알림

- [ ] **시나리오 2: 경고 (채널 동기화 < 99%)**
  - SendingHistory: SMS=100, EMAIL=100
  - ExecutionLog: SMS=100, EMAIL=50 (EMAIL 50% 손실)
  - 기대: channelDistribution.passed=false
  - 검증: Slack 경고 알림

- [ ] **시나리오 3: 긴급 (일관성 < 95%)**
  - SendingHistory: 1000건
  - ExecutionLog: 800건 (80% 일관성)
  - 기대: 자동 롤백 트리거
  - 검증: 
    - Feature Flag 비활성화
    - Slack 빨강색 알림
    - 롤백 시간 < 1분

- [ ] **시나리오 4: 오류 복구**
  - Redis 연결 실패 → Feature Flag 조회 오류
  - 기대: 안전 모드 자동 전환 (false)
  - 검증: SendingHistory 사용

- [ ] **시나리오 5: 수동 롤백**
  - API: POST /api/admin/verification/rollback
  - 기대: 동일한 롤백 프로세스
  - 검증: Slack 알림 + 롤백 상태 저장

### 5.2 API 인증 테스트
- [ ] **테스트 1: Authorization 헤더 없음**
  ```bash
  curl -X POST http://localhost:3000/api/admin/verification/rollback
  # 401 Unauthorized
  ```

- [ ] **테스트 2: Bearer 형식 아님**
  ```bash
  curl -X POST http://localhost:3000/api/admin/verification/rollback \
    -H "Authorization: Basic invalid"
  # 401 Unauthorized
  ```

- [ ] **테스트 3: 토큰 검증 실패**
  ```bash
  curl -X POST http://localhost:3000/api/admin/verification/rollback \
    -H "Authorization: Bearer invalid-token"
  # 401 Unauthorized
  ```

- [ ] **테스트 4: 토큰 검증 성공**
  ```bash
  curl -X POST http://localhost:3000/api/admin/verification/rollback \
    -H "Authorization: Bearer valid-token" \
    -H "Content-Type: application/json" \
    -d '{"reason": "Test"}'
  # 200 OK
  ```

---

## 6. 환경 변수 설정 (필수)

### 6.1 필수 환경변수
```bash
# .env.production
CRON_SECRET=your-secure-random-string-here
SLACK_WEBHOOK_VERIFY=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
DATABASE_URL=postgresql://...?connection_limit=20
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
ENABLE_EXECUTION_LOG=true  # 기본값: 롤백 안 된 상태
```

### 6.2 선택적 환경변수
```bash
# 성능 튜닝
TIMESTAMP_SAMPLE_SIZE=500  # 기본값: 1000
VERIFICATION_TIMEOUT_MS=30000  # 기본값: 검증 최대 시간
```

### 6.3 Vercel 환경 변수 설정
```bash
# Vercel CLI 또는 웹사이트에서 설정
vercel env add CRON_SECRET
vercel env add SLACK_WEBHOOK_VERIFY
vercel env add ENABLE_EXECUTION_LOG
```

---

## 7. 모니터링 설정 (필수)

### 7.1 Sentry 에러 추적
- [ ] Sentry 프로젝트 연동 확인
  ```typescript
  // src/lib/logger.ts 또는 next.config.js
  Sentry.captureException(error);
  ```

### 7.2 Slack 채널 구독
- [ ] `#crm-monitoring` 채널 생성
- [ ] 모든 CRM 관리자/개발팀 구독
- [ ] 웹훅 설정 완료

### 7.3 메트릭 수집
- [ ] Vercel Analytics 또는 Datadog 연동
  - 크론잡 실행 시간
  - 롤백 빈도
  - DB 쿼리 성능

---

## 8. 배포 검증 (배포 직후)

### 8.1 배포 후 수동 테스트 (운영팀)
- [ ] Cron 엔드포인트 응답 확인
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" \
    https://mabiz-crm.vercel.app/api/cron/verify-execution-log
  # 응답: { "ok": true, ... }
  ```

- [ ] Slack 알림 수신 확인
  - 다음 검증 실행 시간 (매일 06:00)
  - 실제 Slack 알림 도착 여부

- [ ] 상태 조회 API 확인
  ```bash
  curl -H "Authorization: Bearer $ADMIN_TOKEN" \
    https://mabiz-crm.vercel.app/api/admin/verification/status
  # 응답: { "timestamp": "...", "featureFlagStatus": {...}, ... }
  ```

### 8.2 배포 후 7일 모니터링
- [ ] 일일 검증 결과 확인
- [ ] 롤백 발생 여부 모니터링
- [ ] 성능 지표 (P99 응답시간) 확인
- [ ] 로그 분석 (Sentry/Datadog)

---

## 9. 롤백 계획 (배포 실패 시)

### 9.1 즉시 롤백 명령어
```bash
# Vercel 이전 배포로 롤백
vercel rollback

# 또는 환경변수로 Feature Flag 비활성화
vercel env add ENABLE_EXECUTION_LOG false
```

### 9.2 긴급 연락처
- 개발팀 리드: @lead-dev
- 인프라팀: @sre-oncall
- 데이터팀: @data-eng-lead
- Slack: #crm-dev, #crm-monitoring

---

## 10. 최종 확인 사항

```
┌─────────────────────────────────────────────────────────────┐
│                    배포 전 최종 체크리스트                      │
├─────────────────────────────────────────────────────────────┤
│ P0 이슈 (필수)                                                 │
│ ✓ 1.1 Cron 엔드포인트 생성                                     │
│ ✓ 1.2 행 수 일관성 양방향 비교                                 │
│ ✓ 1.3 타임스탐프 P99 샘플 크기                                 │
│ ✓ 1.4 롤백 무한 루프 방지                                      │
│ ✓ 1.5 Redis 오류 시 기본값 false                              │
│ ✓ 1.6 N+1 쿼리 개선                                           │
│ ✓ 1.7 토큰 검증 함수 호출                                      │
│                                                              │
│ P1 이슈 (권장)                                                 │
│ ✓ 2.1 채널 동기화율 계산                                       │
│ ✓ 2.2 중복 쿼리 제거                                           │
│ ✓ 2.3 샘플 크기 조정                                           │
│ ✓ 2.4 에러 처리 중복 제거                                      │
│ ✓ 2.5 DB 연결 풀 설정                                          │
│ ✓ 2.6 Feature Flag 라우팅 적용                                 │
│                                                              │
│ 코드 검토                                                      │
│ ✓ Peer Review 완료                                            │
│ ✓ ESLint 통과                                                 │
│ ✓ TypeScript 통과                                             │
│ ✓ 테스트 10개 이상                                             │
│                                                              │
│ 성능 테스트                                                    │
│ ✓ 검증 함수 < 10초                                             │
│ ✓ 롤백 < 1분                                                  │
│ ✓ DB 연결 풀 테스트                                            │
│                                                              │
│ 통합 테스트                                                    │
│ ✓ 정상 검증 시나리오                                           │
│ ✓ 경고 알림 시나리오                                           │
│ ✓ 긴급 롤백 시나리오                                           │
│ ✓ 오류 복구 시나리오                                           │
│ ✓ 수동 롤백 시나리오                                           │
│ ✓ API 인증 테스트                                              │
│                                                              │
│ 환경 설정                                                      │
│ ✓ .env 파일 설정                                               │
│ ✓ Vercel 환경변수 설정                                         │
│ ✓ Slack 웹훅 연동                                              │
│                                                              │
│ 모니터링 설정                                                  │
│ ✓ Sentry 연동                                                  │
│ ✓ Slack 채널 구독                                              │
│ ✓ 메트릭 수집                                                  │
│                                                              │
│ 배포 후 검증                                                   │
│ ✓ Cron 엔드포인트 응답                                         │
│ ✓ Slack 알림 수신                                              │
│ ✓ 상태 조회 API 확인                                           │
│ ✓ 7일 모니터링                                                 │
└─────────────────────────────────────────────────────────────┘

배포 승인: [ ] 개발팀 리드 서명
배포 일시: [________]
배포자: [________]
```

---

**최종 상태**: 배포 대기
**P0 이슈 해결 예상일**: 2026-05-20
**배포 예상일**: 2026-05-20 저녁
**배포 팀**: DevOps + 개발팀 리드
