# Menu #38 Phase 3 - 데이터 정합성 & 모니터링 전략

**최종 작성일**: 2026-05-18  
**대상 기능**: SendingHistory → ExecutionLog 마이그레이션  
**관점**: 데이터 정확성 + 모니터링 + 롤백 전략

---

## 1. 데이터 흐름 & 현재 상태

### 1.1 Phase 2 마이그레이션 후 데이터 구조

```
SendingHistory (레거시, 지속 기록 중):
├─ 2025-01-01 ~ 현재: 기존 캠페인 발송 기록 100만 건
├─ 구조: campaignId, contactId, channel, status, sentAt, failureReason, ...
└─ 테이블 크기: ~500MB (예상)

ExecutionLog (신규, Phase 3부터 기록 시작):
├─ 2026-05-18 이후: 새로운 발송 기록
├─ 구조: sourceType, sourceId, contactId, channel, status, executeMonth, ...
├─ sourceType 유형:
│  ├─ CAMPAIGN (캠페인 발송)
│  ├─ FUNNEL_SEQUENCE (퍼널 자동화)
│  └─ AUTOMATION_RULE (자동 발송)
└─ 테이블 크기: 0건 (초기)
```

### 1.2 스키마 차이 분석

| 필드 | SendingHistory | ExecutionLog | 매핑 전략 |
|------|---|---|---|
| ID | `id` (PK) | `id` (PK) | N/A (다른 테이블) |
| 캠페인 ID | `campaignId` | `sourceId` (sourceType='CAMPAIGN') | 조건부 JOIN |
| 연락처 | `contactId` | `contactId` | 직접 대응 |
| 채널 | `channel` | `channel` | 직접 대응 |
| 상태 | `status: SendingStatus` | `status: ExecutionStatus` | **ENUM 매핑 필요** |
| 실패 사유 | `failureReason: SendingFailureReason` | `failureReason: ExecutionFailureReason` | **ENUM 변환** |
| 발송 시각 | `sentAt` | `sentAt` | 직접 대응 |
| 생성 시각 | `createdAt` | N/A | 없음 |
| 메시지 ID | `messageId` | `messageId` | 직접 대응 |

### 1.3 Enum 매핑 (중요: 데이터 불일치 위험)

**SendingStatus → ExecutionStatus**:
```
SendingStatus:
  - SENT (= DELIVERED ✅)
  - FAILED
  - PENDING
  - RETRY_SCHEDULED
  - ABANDONED
  - SKIPPED

ExecutionStatus (예상):
  - PENDING ✅
  - SENT ✅
  - FAILED ✅
  - RETRY_SCHEDULED ✅
  - ABANDONED ✅
  - SKIPPED ✅
```

**SendingFailureReason → ExecutionFailureReason**:
```
SendingFailureReason:
  - PROVIDER_ERROR
  - INVALID_PHONE
  - QUOTA_EXCEEDED
  - SYSTEM_ERROR
  - CONTACT_INVALID
  - CONTACT_UNSUBSCRIBED
  - UNKNOWN

ExecutionFailureReason (예상 일치):
  - 동일하게 정의됨
```

---

## 2. API 호환성 전략 (점진적 마이그레이션)

### 2.1 Phase 3a: 병행 운영 (Day 1-7)

**목표**: 두 테이블 동시 운영 + 데이터 검증

**구현**:
```typescript
// src/lib/sending-history-unified.ts
export async function getUnifiedSendingHistory(
  campaignId: string,
  options: { 
    includeExecutionLog: boolean = true;
    dateThreshold?: Date; // 날짜 임계값
  }
) {
  const where = { 
    organizationId: orgId,
    campaignId
  };

  // Step 1: SendingHistory (기존 데이터)
  const legacyData = await prisma.sendingHistory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  // Step 2: ExecutionLog (신규 데이터) - 필요시만
  let newData: ExecutionLog[] = [];
  if (options.includeExecutionLog) {
    newData = await prisma.executionLog.findMany({
      where: {
        organizationId: orgId,
        sourceType: 'CAMPAIGN',
        sourceId: campaignId,
        // 날짜 최적화: 오늘부터만 조회 (피크 시간 제외)
        scheduledAt: {
          gte: dateThreshold || startOfToday(),
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  // Step 3: 통합 정렬 (메모리 효율)
  const merged = [...legacyData, ...newData]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  return {
    histories: merged,
    total: legacyData.length + newData.length,
    sources: {
      legacy: legacyData.length,
      new: newData.length,
    },
  };
}
```

**API 엔드포인트 (수정)**:
```typescript
// src/app/api/campaigns/sending-history/route.ts

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeExecutionLog = url.searchParams.get('includeNew') === 'true';
  
  const result = await getUnifiedSendingHistory(campaignId, {
    includeExecutionLog, // Feature flag
  });

  return NextResponse.json({
    ok: true,
    histories: result.histories,
    total: result.total,
    sources: result.sources, // DEBUG: 데이터 출처
    phase: '3a', // DEBUG: 현재 Phase
  });
}
```

**성능 최적화**:
```
문제: UNION 쿼리 느림 (5-20% 저하)
해결책:
1. 날짜 기준 분리
   - SendingHistory: createdAt < 오늘 시작
   - ExecutionLog: scheduledAt >= 오늘 시작
   → 쿼리 1개만 실행 (90% 확률)

2. 캐싱 추가
   - SendingHistory (1시간): 거의 변경 안 됨
   - ExecutionLog (5분): 자주 업데이트

3. 배치 집계
   - 통계는 야간(22:00) 미리 계산
   - 실시간은 캐시만 사용
```

### 2.2 Phase 3b: ExecutionLog 전환 (Day 8-14)

**목표**: API가 ExecutionLog만 읽도록 변경

**구현**:
```typescript
// src/lib/sending-history-v2.ts
export async function getSendingHistoryV2(
  campaignId: string,
  options: { limit?: number; offset?: number }
) {
  // ExecutionLog만 조회
  const executions = await prisma.executionLog.findMany({
    where: {
      organizationId: orgId,
      sourceType: 'CAMPAIGN',
      sourceId: campaignId,
    },
    orderBy: { scheduledAt: 'desc' },
    take: options.limit || 20,
    skip: options.offset || 0,
  });

  // Enum 변환 (ExecutionStatus → SendingStatus)
  const converted = executions.map(exec => ({
    id: exec.id,
    campaignId: exec.sourceId,
    contactId: exec.contactId,
    channel: exec.channel as 'SMS' | 'EMAIL',
    status: convertExecutionStatusToSending(exec.status),
    sentAt: exec.sentAt,
    failureReason: convertExecutionFailureReason(exec.failureReason),
    createdAt: exec.scheduledAt, // 매핑
  }));

  return converted;
}

function convertExecutionStatusToSending(status: ExecutionStatus): SendingStatus {
  const map: Record<ExecutionStatus, SendingStatus> = {
    'PENDING': 'PENDING',
    'SENT': 'SENT',
    'FAILED': 'FAILED',
    'RETRY_SCHEDULED': 'RETRY_SCHEDULED',
    'ABANDONED': 'ABANDONED',
    'SKIPPED': 'SKIPPED',
  };
  return map[status];
}
```

**API 엔드포인트 (수정)**:
```typescript
// src/app/api/campaigns/sending-history/route.ts (v2)

export async function GET(req: Request) {
  try {
    const result = await getSendingHistoryV2(campaignId, {
      limit: parseInt(url.searchParams.get('limit') || '20'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
    });

    return NextResponse.json({
      ok: true,
      histories: result,
      phase: '3b', // 완전 전환
    });
  } catch (err) {
    // 롤백: SendingHistory로 자동 복구
    logger.error('[PHASE3B_FALLBACK] ExecutionLog 실패, SendingHistory 사용', { err });
    const fallback = await getSendingHistoryLegacy(campaignId);
    return NextResponse.json({
      ok: true,
      histories: fallback,
      phase: '3a', // 자동 롤백
      warning: 'ExecutionLog 조회 실패, 레거시 데이터 사용',
    });
  }
}
```

### 2.3 Phase 3c: 정리 (Day 15+)

**목표**: SendingHistory 제거 또는 아카이빙

```typescript
// 1. SendingHistory 아카이빙 (권장)
export async function archiveSendingHistory() {
  // 30일 이상 된 데이터를 SendingHistoryArchive로 복사
  const thirtyDaysAgo = addDays(new Date(), -30);
  
  const archived = await prisma.sendingHistoryArchive.createMany({
    data: (await prisma.sendingHistory.findMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    })).map(sh => ({...sh})),
  });
  
  // 원본 삭제
  await prisma.sendingHistory.deleteMany({
    where: { createdAt: { lt: thirtyDaysAgo } },
  });
  
  logger.info('[Archive] SendingHistory 정리 완료', { count: archived.count });
}

// 2. ExecutionLog 인덱스 최적화
export async function optimizeExecutionLogIndexes() {
  // CREATE INDEX idx_execution_log_campaign_date ON "ExecutionLog"
  // (organizationId, sourceType, sourceId, scheduledAt DESC);
  
  // CREATE INDEX idx_execution_log_status ON "ExecutionLog"
  // (organizationId, status, scheduledAt DESC);
  
  logger.info('[Index] ExecutionLog 인덱스 생성 완료');
}
```

---

## 3. 데이터 검증 전략

### 3.1 마이그레이션 전 검증 (Pre-Migration)

**실행 시기**: Phase 3a 시작 전 (Day 0)

```sql
-- 1. SendingHistory 기본 통계
SELECT 
  COUNT(*) as total_count,
  COUNT(DISTINCT campaignId) as unique_campaigns,
  COUNT(DISTINCT contactId) as unique_contacts,
  MIN(createdAt) as oldest_record,
  MAX(createdAt) as newest_record
FROM "SendingHistory"
WHERE organizationId = ?;

-- 결과 기댓값:
-- total_count: ~1,000,000
-- unique_campaigns: ~5,000
-- unique_contacts: ~50,000
-- oldest_record: 2025-01-01
-- newest_record: 2026-05-18

-- 2. 상태별 분포
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM "SendingHistory"
WHERE organizationId = ?
GROUP BY status
ORDER BY count DESC;

-- 기댓값:
-- SENT: 85% (~850,000)
-- FAILED: 10% (~100,000)
-- PENDING: 3% (~30,000)
-- ABANDONED: 2% (~20,000)

-- 3. NULL 값 분포 (데이터 품질)
SELECT 
  SUM(CASE WHEN messageId IS NULL THEN 1 ELSE 0 END) as missing_messageId,
  SUM(CASE WHEN sentAt IS NULL THEN 1 ELSE 0 END) as missing_sentAt,
  SUM(CASE WHEN failureReason IS NULL THEN 1 ELSE 0 END) as missing_failureReason
FROM "SendingHistory"
WHERE organizationId = ?;

-- 기댓값:
-- missing_messageId: <100 (정상)
-- missing_sentAt: <1,000 (정상)
-- missing_failureReason: >500,000 (정상, SENT 상태는 NULL)
```

**검증 스크립트** (`src/scripts/validate-migration.ts`):
```typescript
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function validatePreMigration(organizationId: string) {
  const issues: string[] = [];
  
  // 1. 행 수 검증
  const sendingCount = await prisma.sendingHistory.count({
    where: { organizationId },
  });
  
  if (sendingCount === 0) {
    issues.push('SendingHistory가 비어있음');
  }
  
  // 2. 상태 유효성 검증
  const invalidStatuses = await prisma.sendingHistory.findMany({
    where: {
      organizationId,
      status: { notIn: ['SENT', 'FAILED', 'PENDING', 'RETRY_SCHEDULED', 'ABANDONED', 'SKIPPED'] },
    },
  });
  
  if (invalidStatuses.length > 0) {
    issues.push(`유효하지 않은 status 발견: ${invalidStatuses.length}건`);
  }
  
  // 3. 날짜 순서 검증 (무결성)
  const outOfOrder = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM "SendingHistory" a
    INNER JOIN "SendingHistory" b ON a.contactId = b.contactId
    WHERE a.organizationId = ${organizationId}
    AND a.createdAt > b.createdAt
    AND a.id != b.id
    LIMIT 10;
  `;
  
  // 4. 실패율 검증 (이상치 탐지)
  const stats = await prisma.sendingHistory.aggregate({
    where: { organizationId },
    _count: {
      id: true,
    },
  });
  
  const failedCount = await prisma.sendingHistory.count({
    where: { organizationId, status: 'FAILED' },
  });
  
  const failureRate = failedCount / stats._count.id;
  if (failureRate > 0.5) { // 50% 이상 실패
    issues.push(`이상치: 실패율 ${(failureRate * 100).toFixed(2)}% (높음)`);
  }
  
  return {
    ok: issues.length === 0,
    issues,
    stats: {
      totalCount: sendingCount,
      failureRate: (failureRate * 100).toFixed(2) + '%',
    },
  };
}

// 사용법:
// await validatePreMigration('org-123');
```

### 3.2 마이그레이션 후 검증 (Post-Migration)

**실행 시기**: Phase 3a Day 1-3 (자동 스크립트)

```typescript
export async function validatePostMigration(
  organizationId: string,
  campaignId: string
): Promise<ValidationReport> {
  const report = {
    timestamp: new Date(),
    campaignId,
    checks: [] as Check[],
  };

  // 1. 행 수 비교
  const legacyCount = await prisma.sendingHistory.count({
    where: { campaignId },
  });
  
  const newCount = await prisma.executionLog.count({
    where: {
      organizationId,
      sourceType: 'CAMPAIGN',
      sourceId: campaignId,
    },
  });

  const countDifference = Math.abs(legacyCount - newCount);
  const countCheck: Check = {
    name: 'row_count_match',
    status: countDifference < 10 ? 'PASS' : 'WARN',
    legacy: legacyCount,
    new: newCount,
    difference: countDifference,
  };
  report.checks.push(countCheck);

  // 2. 상태 분포 비교
  const legacyStats = await prisma.sendingHistory.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { id: true },
  });

  const newStats = await prisma.executionLog.groupBy({
    by: ['status'],
    where: {
      organizationId,
      sourceType: 'CAMPAIGN',
      sourceId: campaignId,
    },
    _count: { id: true },
  });

  // Enum 변환 후 비교
  const statusCheck: Check = {
    name: 'status_distribution',
    status: compareStatusDistribution(legacyStats, newStats) ? 'PASS' : 'FAIL',
    legacy: legacyStats,
    new: newStats,
  };
  report.checks.push(statusCheck);

  // 3. 샘플 데이터 정확성 (10개)
  const legacyRecords = await prisma.sendingHistory.findMany({
    where: { campaignId },
    take: 10,
  });

  for (const legacy of legacyRecords) {
    const newRecord = await prisma.executionLog.findFirst({
      where: {
        contactId: legacy.contactId,
        sourceId: campaignId,
        channel: legacy.channel,
        scheduledAt: { gte: legacy.createdAt },
      },
    });

    if (!newRecord) {
      report.checks.push({
        name: 'sample_data_match',
        status: 'FAIL',
        missingId: legacy.id,
      });
    }
  }

  // 4. Enum 변환 오류 검증
  const enumErrors = await validateEnumConversion(newCount);
  if (enumErrors.length > 0) {
    report.checks.push({
      name: 'enum_conversion',
      status: 'FAIL',
      errors: enumErrors,
    });
  }

  return report;
}
```

### 3.3 지속적 검증 (Continuous Monitoring)

**실행 주기**: 매일 06:00 (UTC+9)

```typescript
export async function validateDailyConsistency() {
  const yesterday = subDays(startOfDay(new Date()), 1);
  
  // 1. 어제 발송 데이터 비교
  const legacyYesterday = await prisma.sendingHistory.count({
    where: {
      createdAt: {
        gte: yesterday,
        lt: startOfDay(new Date()),
      },
    },
  });

  const newYesterday = await prisma.executionLog.count({
    where: {
      scheduledAt: {
        gte: yesterday,
        lt: startOfDay(new Date()),
      },
      sourceType: 'CAMPAIGN',
    },
  });

  // 2. 실패율 비교
  const legacyFailureRate = (await prisma.sendingHistory.count({
    where: {
      createdAt: { gte: yesterday },
      status: 'FAILED',
    },
  })) / legacyYesterday * 100;

  const newFailureRate = (await prisma.executionLog.count({
    where: {
      scheduledAt: { gte: yesterday },
      status: 'FAILED',
    },
  })) / newYesterday * 100;

  // 3. 알림 조건
  const alerts: Alert[] = [];
  
  if (Math.abs(legacyFailureRate - newFailureRate) > 5) {
    alerts.push({
      severity: 'HIGH',
      message: `실패율 불일치: Legacy ${legacyFailureRate.toFixed(2)}% vs New ${newFailureRate.toFixed(2)}%`,
    });
  }

  return {
    timestamp: new Date(),
    legacyCount: legacyYesterday,
    newCount: newYesterday,
    legacyFailureRate: legacyFailureRate.toFixed(2) + '%',
    newFailureRate: newFailureRate.toFixed(2) + '%',
    alerts,
    status: alerts.length === 0 ? 'OK' : 'ALERT',
  };
}
```

---

## 4. 모니터링 대시보드

### 4.1 메트릭 정의

**성능 메트릭**:
```
1. API 응답 시간
   - p50: < 100ms (정상)
   - p95: < 300ms (주의)
   - p99: < 1000ms (경고)

2. 데이터 정확성
   - 행 수 불일치: < 1% (정상)
   - 상태 분포 편차: < 2% (정상)
   - 실패율 편차: < 5% (정상)

3. Enum 변환 오류율
   - 0건: 정상
   - >0: 즉시 알림

4. 필드 NULL 비율
   - messageId: < 1% (정상)
   - sentAt: < 2% (정상)
   - failureReason: > 80% (정상, SENT는 NULL)

5. API 오류율
   - < 0.1%: 정상
   - 0.1% ~ 1%: 주의
   - > 1%: 경고

6. 캐시 히트율 (있다면)
   - > 80%: 정상
   - 50% ~ 80%: 주의
   - < 50%: 개선 필요
```

### 4.2 Sentry 알림 설정

```typescript
import * as Sentry from "@sentry/nextjs";

// Phase 3a: 병행 운영 중 오류 추적
export function capturePhase3aError(error: Error, context: any) {
  Sentry.captureException(error, {
    level: 'error',
    tags: {
      phase: '3a',
      type: context.type, // 'execution_log_write' | 'union_query' | 'enum_conversion'
    },
    extra: {
      campaignId: context.campaignId,
      recordCount: context.recordCount,
      fallbackUsed: context.fallbackUsed,
    },
  });
}

// 구체적 모니터링:
// 1. ExecutionLog 쓰기 실패
Sentry.captureException(writeError, {
  level: 'error',
  tags: { phase: '3a', type: 'execution_log_write' },
});

// 2. UNION 쿼리 타임아웃
if (queryTime > 500) {
  Sentry.captureMessage('Phase3a UNION 쿼리 느림', {
    level: 'warning',
    tags: { phase: '3a', type: 'slow_query' },
    extra: { queryTimeMs: queryTime },
  });
}

// 3. Enum 변환 오류
if (unknownStatus) {
  Sentry.captureMessage('Enum 매핑 오류 발견', {
    level: 'error',
    tags: { phase: '3a', type: 'enum_conversion' },
    extra: { status: unknownStatus },
  });
}
```

### 4.3 DataDog 또는 Prometheus 메트릭

```typescript
// src/lib/metrics.ts
import { metrics } from '@/lib/telemetry';

// Phase 별 응답시간
export function recordPhase3aMetric(phase: '3a' | '3b', duration: number) {
  metrics.histogram('phase3.response_time', duration, {
    tags: [`phase:${phase}`],
  });
}

// 데이터 불일치 감지
export function recordDataInconsistency(
  campaignId: string,
  legacyCount: number,
  newCount: number
) {
  const diff = Math.abs(legacyCount - newCount);
  
  metrics.gauge('phase3.data_inconsistency', diff, {
    tags: [
      `campaignId:${campaignId}`,
      `severity:${diff > 100 ? 'high' : 'medium'}`,
    ],
  });
}

// API 오류율
export function recordApiError(errorType: string) {
  metrics.increment('phase3.api_error', {
    tags: [`type:${errorType}`],
  });
}
```

---

## 5. 사용자 선택지 (초등학생 수준)

### Q1: 데이터 소스 전환 시점

**현재 상황**:
- SendingHistory: 기존 데이터 100만 건 (2025-01 ~ 현재)
- ExecutionLog: 새로운 테이블 (비어있음)
- 문제: 두 테이블을 한 번에 조회하면 느려질 수 있음

**선택지**:

**옵션 A) 병행 + 점진적 전환 (권장)**
- 처음 1주일: SendingHistory + ExecutionLog 둘 다 조회
- 데이터가 정상 입력되는지 확인 후 전환
- 위험도: 낮음 (자동 롤백 가능)
- 시간: 14일

**옵션 B) 즉시 전환 (위험)**
- 지금 당장 ExecutionLog만 사용
- 빠르지만 문제 발생 시 데이터 손실 가능
- 위험도: 높음 (과거 데이터 조회 불가)
- 시간: 1일

**옵션 C) 하이브리드 (절충)**
- 새 캠페인은 ExecutionLog만
- 기존 캠페인은 SendingHistory만
- 위험도: 중간 (복잡함)
- 시간: 7일

**추천**: **옵션 A (병행 + 점진적 전환)**
- 안전성 + 성능 + 신뢰도 최고
- 모니터링으로 문제를 미리 발견 가능
- 필요시 즉시 옵션 B로 롤백 가능

---

### Q2: 데이터 검증 방식

**현재 상황**:
- Phase 3a 시작 시 데이터 정합성 확인 필요
- 진행 중 문제 발견 시 빠른 대응 필요
- 완료 후 신뢰도 검증 필요

**선택지**:

**옵션 A) 자동화된 검증 (권장)**
- 매일 06:00에 자동으로 데이터 검사
- 문제 발견 시 Sentry/메일로 즉시 알림
- 수동 개입 최소화
- 신뢰도: 높음 (24/7 모니터링)

**옵션 B) 수동 샘플 검증**
- 문제 발생했을 때만 확인
- 간단하지만 놓칠 수 있는 문제 많음
- 신뢰도: 낮음

**옵션 C) 실시간 대시보드만**
- 숫자만 보고 판단
- 자동 알림 없음
- 신뢰도: 중간 (사람 눈에 의존)

**추천**: **옵션 A (자동화된 검증)**
- 24/7 감시로 문제를 조기에 발견
- 자동 알림으로 빠른 대응
- 신뢰도 높은 마이그레이션

---

### Q3: 데이터 손실 시 대응 방안

**현재 상황**:
- Phase 3 중 ExecutionLog에 데이터가 제대로 기록되지 않을 수 있음
- 만약 데이터가 손실되면 어떻게 복구할 것인가?

**선택지**:

**옵션 A) 즉시 롤백 (권장)**
- ExecutionLog 사용 중단
- API를 다시 SendingHistory로 복구 (1분 내)
- 손실 데이터: 최근 1-2일분만 영향
- 복구 시간: 1분
- 신뢰도: 높음 (검증된 옵션)

**옵션 B) 수동 복구**
- DB 스크립트로 손실 데이터 재구성
- 복구 시간: 1-4시간
- 신뢰도: 중간 (수동 작업)

**옵션 C) 로그 기반 재구성**
- Aligo/Email 제공자의 로그에서 데이터 복구
- 복구 시간: 4-8시간
- 신뢰도: 낮음 (3사 로그 일관성 미보장)

**추천**: **옵션 A (즉시 롤백)**
- 가장 빠르고 안전한 방법
- Phase 3a/3b에서 Feature flag로 자동 구현
- 손실 데이터 최소화

---

## 6. 점진적 마이그레이션 타임라인

### Day 1-3: Phase 3a (병행 운영 + 검증)

```
Day 1 (월):
├─ 06:00 - SendingHistory 최종 통계 저장
├─ 09:00 - Feature flag ON (Phase 3a 시작)
├─ 10:00 - ExecutionLog 새 캠페인 기록 시작
├─ 12:00 - Sentry 알림 설정 확인
├─ 18:00 - 1차 데이터 검증 스크립트 실행
└─ 20:00 - 결과 리뷰 (불일치 < 1% 확인)

Day 2 (화):
├─ 06:00 - 어제 데이터 비교 스크립트 실행
├─ 10:00 - API 응답시간 p95 확인 (< 300ms)
├─ 14:00 - Enum 변환 오류 0건 확인
├─ 18:00 - 2차 데이터 검증
└─ 20:00 - 모니터링 대시보드 검토

Day 3 (수):
├─ 06:00 - 3일치 데이터 누적 검증
├─ 12:00 - 성능 분석 (응답시간 추이)
├─ 16:00 - 사용자 피드백 수집
└─ 20:00 - Phase 3b 전환 의사결정
```

### Day 4-7: 안정성 검증

```
Day 4-5:
├─ 일일 자동 검증 계속 실행
├─ Sentry 알림 추적
└─ 캐시 히트율 모니터링

Day 6-7:
├─ 누적 데이터 정합성 최종 확인
├─ 성능 저하 없음 확인
└─ Phase 3b 전환 GO/NO-GO 결정
```

### Day 8-14: Phase 3b (완전 전환)

```
Day 8 (목):
├─ GO 결정 후 09:00 - Feature flag 변경 (3b)
├─ API가 ExecutionLog만 읽도록 변경
├─ SendingHistory 쓰기 중단 (아카이빙)
├─ 자동 롤백 준비
└─ 24시간 모니터링

Day 9-14:
├─ 일일 자동 검증 (ExecutionLog 정상 확인)
├─ 오류 없음 확인 후 확정
└─ 향후 계획 수립
```

### Day 15+: Phase 3c (정리)

```
Day 15 이후:
├─ SendingHistory 아카이빙 (30일 이상 데이터)
├─ ExecutionLog 인덱스 최적화
├─ 문서 정리 (마이그레이션 완료)
└─ 다음 피쳐 개발 재개
```

---

## 7. 데이터 정합성 검증 SQL

### 7.1 마이그레이션 전 (Baseline)

```sql
-- 1. 조직별 SendingHistory 통계
SELECT 
  organizationId,
  COUNT(*) as total_records,
  COUNT(DISTINCT campaignId) as unique_campaigns,
  COUNT(DISTINCT contactId) as unique_contacts,
  COUNT(CASE WHEN status = 'SENT' THEN 1 END) as sent_count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
  ROUND(100.0 * COUNT(CASE WHEN status = 'FAILED' THEN 1 END) / COUNT(*), 2) as failure_rate,
  DATE(MIN(createdAt)) as oldest_record,
  DATE(MAX(createdAt)) as newest_record
FROM "SendingHistory"
GROUP BY organizationId
ORDER BY total_records DESC;

-- 2. 캠페인별 상세 분포
SELECT 
  campaignId,
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY campaignId), 2) as percentage
FROM "SendingHistory"
GROUP BY campaignId, status
ORDER BY campaignId, count DESC;

-- 3. 데이터 품질 검사
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN messageId IS NULL THEN 1 END) as missing_messageId,
  COUNT(CASE WHEN sentAt IS NULL THEN 1 END) as missing_sentAt,
  COUNT(CASE WHEN failureReason IS NULL AND status = 'FAILED' THEN 1 END) as missing_failure_reason_on_failed,
  COUNT(CASE WHEN contact_id IS NULL THEN 1 END) as missing_contact_id
FROM "SendingHistory";
```

### 7.2 마이그레이션 후 (Validation)

```sql
-- 1. 캠페인별 행 수 비교
SELECT 
  sh.campaignId,
  COUNT(sh.id) as legacy_count,
  COUNT(el.id) as execution_log_count,
  ABS(COUNT(sh.id) - COUNT(el.id)) as difference,
  CASE 
    WHEN ABS(COUNT(sh.id) - COUNT(el.id)) < 10 THEN 'PASS'
    ELSE 'FAIL'
  END as status
FROM "SendingHistory" sh
LEFT JOIN "ExecutionLog" el ON sh.campaignId = el.sourceId 
  AND el.sourceType = 'CAMPAIGN'
GROUP BY sh.campaignId
HAVING ABS(COUNT(sh.id) - COUNT(el.id)) > 0
ORDER BY difference DESC;

-- 2. 상태별 분포 비교
WITH legacy_stats AS (
  SELECT 
    campaignId,
    status,
    COUNT(*) as count
  FROM "SendingHistory"
  GROUP BY campaignId, status
),
exec_stats AS (
  SELECT 
    sourceId,
    status,
    COUNT(*) as count
  FROM "ExecutionLog"
  WHERE sourceType = 'CAMPAIGN'
  GROUP BY sourceId, status
)
SELECT 
  COALESCE(ls.campaignId, es.sourceId) as campaign_id,
  ls.status as legacy_status,
  es.status as exec_status,
  ls.count as legacy_count,
  es.count as exec_count
FROM legacy_stats ls
FULL OUTER JOIN exec_stats es ON ls.campaignId = es.sourceId AND ls.status = es.status
WHERE ls.count != es.count OR (ls.count IS NULL OR es.count IS NULL);

-- 3. 실패율 비교 (정확성)
SELECT 
  'SendingHistory' as source,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) * 100.0 / COUNT(*) as failure_rate
FROM "SendingHistory"
UNION ALL
SELECT 
  'ExecutionLog' as source,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) * 100.0 / COUNT(*) as failure_rate
FROM "ExecutionLog"
WHERE sourceType = 'CAMPAIGN';
```

### 7.3 지속적 검증 (Daily)

```sql
-- 1. 어제 발송 데이터 비교
SELECT 
  DATE(createdAt) as date,
  'SendingHistory' as source,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN status = 'FAILED' THEN 1 END) / COUNT(*), 2) as failure_rate
FROM "SendingHistory"
WHERE DATE(createdAt) = CURRENT_DATE - INTERVAL '1 day'
GROUP BY DATE(createdAt)
UNION ALL
SELECT 
  DATE(scheduledAt) as date,
  'ExecutionLog' as source,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN status = 'FAILED' THEN 1 END) / COUNT(*), 2) as failure_rate
FROM "ExecutionLog"
WHERE sourceType = 'CAMPAIGN'
AND DATE(scheduledAt) = CURRENT_DATE - INTERVAL '1 day'
GROUP BY DATE(scheduledAt);

-- 2. 최근 1시간 데이터 모니터링
SELECT 
  'ExecutionLog' as table_name,
  COUNT(*) as last_hour_records,
  COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
  COUNT(CASE WHEN messageId IS NULL THEN 1 END) as no_message_id
FROM "ExecutionLog"
WHERE sourceType = 'CAMPAIGN'
AND scheduledAt > CURRENT_TIMESTAMP - INTERVAL '1 hour';
```

---

## 8. 롤백 체크리스트

### 8.1 Phase 3a 중단 (안전한 중단)

```
[ ] Step 1: 즉시 조치
    [ ] Feature flag OFF (Phase 3a → Phase 2)
    [ ] API 요청 모두 SendingHistory로 복구
    [ ] 로그에 "ROLLBACK: Phase 3a" 기록
    [ ] Sentry에 알림 발송

[ ] Step 2: 데이터 검증
    [ ] 손실된 데이터 확인
    [ ] ExecutionLog의 마지막 기록 타임스탐프 확인
    [ ] 불일치 수량 계산

[ ] Step 3: 원인 분석
    [ ] 에러 로그 검토 (Sentry/로컬 log)
    [ ] ExecutionLog 쓰기 실패 이유
    [ ] Enum 변환 오류 확인

[ ] Step 4: 재계획
    [ ] 문제 해결 (코드 수정)
    [ ] 추가 테스트 (로컬)
    [ ] GO/NO-GO 재결정
```

### 8.2 Phase 3b 중단 (긴급 롤백)

```
[ ] Step 1: 긴급 조치 (< 1분)
    [ ] Feature flag 즉시 변경 (3b → 3a)
    [ ] API 요청 모두 UNION 쿼리로 복구
    [ ] 사용자 알림 (대시보드에 주의 배너 표시)
    [ ] Sentry P0 알림 발송

[ ] Step 2: 손상된 데이터 확인 (< 10분)
    [ ] 롤백 이후 데이터 일관성 검사
    [ ] 손실된 기록 수량 파악
    [ ] 사용자 영향 범위 파악

[ ] Step 3: 복구 전략 선택 (< 30분)
    [ ] 옵션 A: 손실 데이터 무시 (일부 기록만 손실)
    [ ] 옵션 B: DB 스크립트로 재구성
    [ ] 옵션 C: Aligo/Email 로그에서 복구

[ ] Step 4: 근본 원인 분석 (> 1시간)
    [ ] 코드 리뷰 (ExecutionLog 쓰기 로직)
    [ ] 데이터베이스 확인 (연결, 성능)
    [ ] 제3자 서비스 상태 확인 (Aligo, Email)

[ ] Step 5: 수정 & 재테스트
    [ ] 문제 해결 코드 작성
    [ ] 테스트 (프로덕션 실환경 시뮬레이션)
    [ ] 모니터링 강화

[ ] Step 6: 재배포 결정
    [ ] 팀과 회의
    [ ] 위험 평가
    [ ] GO/NO-GO 최종 결정
```

### 8.3 롤백 속도 목표

| Phase | 조치 시간 | 데이터 손실 | 영향 범위 |
|-------|---------|----------|--------|
| 3a (병행) | < 1분 | 최소 (< 1시간) | 낮음 |
| 3b (완전) | < 1분 | 미보장 (< 4시간) | 높음 |
| 3c (정리) | N/A (되돌릴 수 없음) | N/A | 높음 |

---

## 9. 실행 명령어 (구현용)

### 9.1 Phase 3a 시작

```bash
# 1. 기존 데이터 백업
npm run script:backup-sending-history

# 2. 사전 검증
npm run script:validate-pre-migration

# 3. Feature flag 활성화
npm run script:enable-feature-flag -- phase3a

# 4. 모니터링 시작
npm run script:start-phase3-monitoring

# 5. 로그 추적
tail -f dev.log | grep -E "Phase 3a|ExecutionLog|UNION"
```

### 9.2 Phase 3b 시작

```bash
# 1. 안정성 확인
npm run script:validate-phase3a-complete

# 2. Feature flag 변경
npm run script:enable-feature-flag -- phase3b

# 3. ExecutionLog 인덱스 최적화
npm run script:optimize-execution-log-indexes

# 4. 모니터링 전환
npm run script:switch-monitoring-to-phase3b

# 5. 배포
npm run build && npm run deploy
```

### 9.3 Phase 3c 정리

```bash
# 1. SendingHistory 아카이빙
npm run script:archive-sending-history -- --days 30

# 2. 인덱스 정리
npm run script:cleanup-indexes

# 3. 문서 업데이트
npm run script:update-migration-docs

# 4. 최종 검증
npm run script:validate-phase3-complete
```

---

## 10. 다음 단계

1. **사용자 선택** (필수):
   - Q1: 데이터 소스 전환 방식 (권장: 옵션 A)
   - Q2: 검증 방식 (권장: 옵션 A)
   - Q3: 롤백 전략 (권장: 옵션 A)

2. **구현 준비**:
   - [ ] 모니터링 대시보드 설정 (Sentry + DataDog)
   - [ ] 검증 스크립트 작성 (src/scripts/)
   - [ ] Feature flag 설정 (LaunchDarkly 또는 환경변수)
   - [ ] 롤백 자동화 스크립트

3. **테스트**:
   - [ ] 로컬에서 Phase 3a 시뮬레이션
   - [ ] 스테이징에서 전체 흐름 테스트
   - [ ] 롤백 연습 (실제 구동)

4. **배포**:
   - [ ] Day 1 (월): Phase 3a 시작
   - [ ] Day 8 (목): Phase 3b 시작 (GO 결정 후)
   - [ ] Day 15+: Phase 3c 정리
