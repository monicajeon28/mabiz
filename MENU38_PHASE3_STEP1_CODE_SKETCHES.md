# Menu #38 Phase 3 Step 1 - 구현 코드 스케치
> Agent γ의 성능 최적화 기술 명세 (Step 2-3 구현 참고용)

**목적**: 설계 단계에서 구현 방향 명확화  
**범위**: 코드 스케치만 (실제 구현 X)  
**기준일**: 2026-05-18

---

## 1. 배치 분할 패턴 (Promise 기반)

### 1.1 Sub-Batch 처리 (50+50+50)

```typescript
// src/lib/cron/execute-campaigns.ts 개선 안 (Step 3)

const BATCH_SIZE = 150;
const SUB_BATCH_SIZE = 50;
const SUB_BATCH_DELAY_MS = 100; // 서브배치 간 지연

export async function executeCampaignMessages(
  params: ExecutionCampaignParams
): Promise<SendingRecord> {
  const { campaignId, organizationId, groupId, channel, messageBody, messageSubject, contactIds } = params;

  if (contactIds.length === 0) {
    logger.log("[Cron] 발송 대상 없음", { campaignId, channel });
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const batchStartTime = Date.now();
  const memoryBefore = process.memoryUsage().heapUsed;

  try {
    logger.info(`[Cron] ${channel} 배치 발송 시작 (분할 처리)`, {
      campaignId,
      channel,
      totalCount: contactIds.length,
      batchSize: BATCH_SIZE,
      subBatchSize: SUB_BATCH_SIZE,
    });

    // Batch 단위로 처리 (150명씩)
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batch = contactIds.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE);

      // Sub-Batch 단위로 분할 (50명씩)
      for (let j = 0; j < batch.length; j += SUB_BATCH_SIZE) {
        const subBatch = batch.slice(j, j + SUB_BATCH_SIZE);
        const subBatchIndex = Math.floor(j / SUB_BATCH_SIZE);

        const subBatchStartTime = Date.now();

        // 1. 이번 서브배치의 모든 contact를 한 번에 조회 (N+1 최적화)
        const contacts = await db.contact.findMany({
          where: { id: { in: subBatch } },
          select: { id: true, phone: true, email: true },
        });
        const contactMap = new Map(contacts.map(c => [c.id, c]));

        // 2. 메시지 발송 (동시성 제어)
        const concurrency = channel === "SMS" ? 3 : 10; // SMS는 느리게, Email은 빠르게
        const results = await sendMessagesConcurrentlyLimited({
          contactIds: subBatch,
          contactMap,
          params: {
            campaignId,
            organizationId,
            channel,
            messageBody,
            messageSubject,
          },
          concurrency,
        });

        for (const result of results) {
          if (result.status === "SENT") sent++;
          else if (result.status === "FAILED") failed++;
          else if (result.status === "SKIPPED") skipped++;
        }

        const subBatchDuration = Date.now() - subBatchStartTime;
        logger.info(`[Cron] 서브배치 완료`, {
          campaignId,
          channel,
          batchIndex,
          subBatchIndex,
          count: subBatch.length,
          sent: results.filter(r => r.status === "SENT").length,
          duration: `${subBatchDuration}ms`,
          avgLatency: `${subBatchDuration / subBatch.length}ms`,
        });

        // 3. 서브배치 간 지연 (다음 서브배치 대기)
        if (j + SUB_BATCH_SIZE < batch.length) {
          await delay(SUB_BATCH_DELAY_MS);
        }
      }
    }

    const totalDuration = Date.now() - batchStartTime;
    const memoryAfter = process.memoryUsage().heapUsed;

    logger.info(`[Cron] ${channel} 배치 발송 완료`, {
      campaignId,
      sent,
      failed,
      skipped,
      totalCount: contactIds.length,
      duration: `${totalDuration}ms`,
      avgLatency: `${totalDuration / contactIds.length}ms`,
      memoryUsed: `${(memoryAfter - memoryBefore) / 1024 / 1024}MB`,
      memoryPeak: `${process.memoryUsage().heapUsed / 1024 / 1024}MB`,
    });

    return { sent, failed, skipped };
  } catch (err) {
    logger.error(`[Cron] ${channel} 배치 발송 실패`, { campaignId, err });
    return { sent, failed: contactIds.length, skipped };
  }
}
```

### 1.2 동시성 제어 함수

```typescript
/**
 * 동시성 제한이 있는 메시지 발송
 * - SMS: concurrency=3 (초당 10건 내)
 * - Email: concurrency=10 (Gmail SMTP 또는 SendGrid)
 */
async function sendMessagesConcurrentlyLimited(params: {
  contactIds: string[];
  contactMap: Map<string, { id: string; phone: string | null; email: string | null }>;
  params: {
    campaignId: string;
    organizationId: string;
    channel: "SMS" | "EMAIL";
    messageBody: string;
    messageSubject?: string;
  };
  concurrency: number;
}): Promise<Array<{ contactId: string; status: SendingStatus; failureReason?: SendingFailureReason }>> {
  const { contactIds, contactMap, params: sendParams, concurrency } = params;

  const results = [];
  const queue: Promise<any>[] = [];

  for (let i = 0; i < contactIds.length; i++) {
    const contactId = contactIds[i];

    // 동시성 제한: queue가 concurrency 이상이면 하나 완료 대기
    if (queue.length >= concurrency) {
      await Promise.race(queue);
      queue.splice(queue.findIndex(p => Promise.resolve(p) === p), 1);
    }

    // 비동기 발송 시작
    const promise = sendSingleMessage({
      campaignId: sendParams.campaignId,
      organizationId: sendParams.organizationId,
      contactId,
      channel: sendParams.channel,
      messageBody: sendParams.messageBody,
      messageSubject: sendParams.messageSubject,
      preloadedContact: contactMap.get(contactId),
    })
      .then(result => {
        results.push(result);
        return result;
      })
      .catch(err => {
        logger.error("[Cron] 개별 발송 에러", { contactId, err });
        results.push({ contactId, status: "FAILED", failureReason: "SYSTEM_ERROR" });
        return null;
      });

    queue.push(promise);
  }

  // 남은 Promise 모두 완료 대기
  await Promise.all(queue);

  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 2. SMS Rate Limit 제어 (재설계)

### 2.1 Queue 기반 SMS 발송

```typescript
// src/lib/cron/sms-rate-limiter.ts (신규 파일)

interface SmsRequest {
  config: AligoConfig;
  receiver: string;
  msg: string;
  msgType?: "SMS" | "LMS";
  organizationId?: string;
  contactId?: string;
  channel?: string;
}

interface RateLimiterConfig {
  maxPerSecond: number;        // 초당 최대 요청 수
  windowMs: number;            // 윈도우 크기 (ms)
  retryDelayMs: number;        // 재시도 지연 (ms)
}

/**
 * SMS Rate Limiter
 * - Aligo API 초당 10건 제한 대응
 * - 토큰 버킷 알고리즘 사용
 * - 재시도 로직 포함
 */
export class SmsRateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private queue: SmsRequest[] = [];
  private processing = false;

  constructor(private config: RateLimiterConfig) {
    this.tokens = config.maxPerSecond;
    this.lastRefillTime = Date.now();
  }

  /**
   * 큐에 요청 추가
   * 자동으로 처리 시작
   */
  async enqueueAndWait(request: SmsRequest): Promise<AligoResponse> {
    this.queue.push(request);
    
    if (!this.processing) {
      this.processing = true;
      try {
        await this.processQueue();
      } finally {
        this.processing = false;
      }
    }

    // ⚠️ 실제로는 Promise 기반 큐 관리 필요
    // 여기선 스케치만
    return { result_code: 1, message: "queued" };
  }

  /**
   * 큐 처리 (비동기 배경)
   */
  private async processQueue() {
    while (this.queue.length > 0) {
      // 토큰 확인
      this.refillTokens();

      if (this.tokens < 1) {
        // 토큰 부족 → 대기
        const waitTime = this.config.windowMs - (Date.now() - this.lastRefillTime);
        logger.warn("[SmsRateLimiter] 토큰 부족, 대기", { waitTime });
        await delay(Math.max(100, waitTime));
        continue;
      }

      const request = this.queue.shift();
      if (!request) break;

      this.tokens--;

      try {
        const result = await sendSms(request);
        logger.info("[SmsRateLimiter] 발송 완료", {
          phone: request.receiver.substring(0, 4) + "***",
          tokens: this.tokens,
        });
      } catch (err) {
        logger.error("[SmsRateLimiter] 발송 실패", { err });
      }
    }
  }

  /**
   * 토큰 재충전 (Token Bucket 알고리즘)
   */
  private refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;

    if (elapsed >= this.config.windowMs) {
      this.tokens = this.config.maxPerSecond;
      this.lastRefillTime = now;
    }
  }
}

// 사용 예시
const smsLimiter = new SmsRateLimiter({
  maxPerSecond: 3,         // 보수적 설정 (초당 3건)
  windowMs: 1000,          // 1초
  retryDelayMs: 100,
});
```

### 2.2 Concurrency 제어 (간단한 버전)

```typescript
/**
 * 간단한 동시성 제어 (Phase 3 Step 3 구현)
 * Aligo API 초당 3건 내 제한
 */
async function sendSmsBatchWithRateLimit(
  requests: Array<{ phone: string; msg: string }>
): Promise<void> {
  const concurrency = 3; // 초당 최대 3건
  const interval = 1000; // 1초
  
  let sent = 0;
  let lastResetTime = Date.now();

  for (const req of requests) {
    // 1초 주기로 카운터 리셋
    const now = Date.now();
    if (now - lastResetTime >= interval) {
      sent = 0;
      lastResetTime = now;
    }

    // 이미 3건 발송했으면 대기
    if (sent >= concurrency) {
      const waitTime = interval - (now - lastResetTime);
      await delay(waitTime);
      sent = 0;
      lastResetTime = Date.now();
    }

    // 발송
    await sendSms({...req});
    sent++;

    logger.debug("[SmsRateLimit] 발송", {
      phone: req.phone.substring(0, 4) + "***",
      sent,
      concurrency,
    });
  }
}
```

---

## 3. 환경변수 설정 (Step 2)

### 3.1 .env.local 추가 항목

```env
# Phase 3: 성능 최적화
# ─────────────────────────────────

# 1. Cron 설정
CRON_CAMPAIGN_INTERVAL="*/5 * * * *"        # 캠페인 발송 (5분)
CRON_RETRY_INTERVAL="*/2 * * * *"           # 재시도 (2분)
CRON_CAMPAIGN_TIMEOUT_SECONDS="300"         # 캠페인 타임아웃 (5분)

# 2. 배치 처리 설정
CAMPAIGN_BATCH_SIZE="150"                   # 배치 크기 (명)
CAMPAIGN_SUB_BATCH_SIZE="50"                # 서브배치 크기 (명)
CAMPAIGN_SUB_BATCH_DELAY_MS="100"           # 서브배치 간 지연 (ms)

# 3. Rate Limit 설정
SMS_RATE_LIMIT_PER_SECOND="3"               # Aligo 초당 제한 (건)
EMAIL_RATE_LIMIT_PER_SECOND="10"            # Email 초당 제한 (건)
SMS_RETRY_DELAY_MS="100"                    # SMS 재시도 지연 (ms)

# 4. DB 설정 (DATABASE_URL에 반영)
# DATABASE_URL에 max_pool_size=30 설정 완료 (Step 2)

# 5. 모니터링 (선택)
ENABLE_CAMPAIGN_METRICS="true"              # 성능 메트릭 로깅
METRICS_LOG_LEVEL="info"                    # 상세 로깅
```

### 3.2 Prisma 설정 확인

```prisma
// prisma/schema.prisma (변경 불필요, DATABASE_URL로 제어)

datasource db {
  provider = "postgresql"
  // url은 .env.local DATABASE_URL에서 자동 로드
  // max_pool_size=30은 DATABASE_URL의 쿼리 파라미터로 설정
}
```

**DATABASE_URL 예시**:
```
postgresql://user:pass@host/db?max_pool_size=30&sslmode=require
```

---

## 4. 로깅 강화 (Step 4)

### 4.1 메트릭 클래스

```typescript
// src/lib/cron/campaign-metrics.ts (신규)

export interface CampaignMetrics {
  campaignId: string;
  channel: "SMS" | "EMAIL";
  startTime: number;
  endTime?: number;
  batchSize: number;
  contactCount: number;
  sent: number;
  failed: number;
  skipped: number;
  memoryBefore: number;
  memoryAfter?: number;
  subBatchMetrics?: Array<{
    index: number;
    count: number;
    duration: number;
    avgLatency: number;
  }>;
}

export class CampaignMetricsCollector {
  private metrics: CampaignMetrics;

  constructor(params: {
    campaignId: string;
    channel: "SMS" | "EMAIL";
    batchSize: number;
    contactCount: number;
  }) {
    this.metrics = {
      campaignId: params.campaignId,
      channel: params.channel,
      startTime: Date.now(),
      batchSize: params.batchSize,
      contactCount: params.contactCount,
      sent: 0,
      failed: 0,
      skipped: 0,
      memoryBefore: process.memoryUsage().heapUsed,
      subBatchMetrics: [],
    };
  }

  recordSubBatch(index: number, count: number, duration: number) {
    this.metrics.subBatchMetrics!.push({
      index,
      count,
      duration,
      avgLatency: duration / count,
    });
  }

  recordResult(status: SendingStatus) {
    if (status === "SENT") this.metrics.sent++;
    else if (status === "FAILED") this.metrics.failed++;
    else if (status === "SKIPPED") this.metrics.skipped++;
  }

  finish() {
    this.metrics.endTime = Date.now();
    this.metrics.memoryAfter = process.memoryUsage().heapUsed;
    return this.metrics;
  }

  toJSON() {
    const duration = (this.metrics.endTime || Date.now()) - this.metrics.startTime;
    const successRate = this.metrics.sent / (this.metrics.sent + this.metrics.failed) || 0;
    const memoryUsed = (this.metrics.memoryAfter || 0) - this.metrics.memoryBefore;

    return {
      campaignId: this.metrics.campaignId,
      channel: this.metrics.channel,
      result: {
        sent: this.metrics.sent,
        failed: this.metrics.failed,
        skipped: this.metrics.skipped,
        successRate: `${(successRate * 100).toFixed(2)}%`,
      },
      performance: {
        totalDuration: `${duration}ms`,
        avgLatency: `${duration / this.metrics.contactCount}ms`,
        throughput: `${(this.metrics.contactCount / (duration / 1000)).toFixed(0)} msg/s`,
      },
      resource: {
        memoryUsed: `${memoryUsed / 1024 / 1024}MB`,
        memoryPeak: `${this.metrics.memoryAfter! / 1024 / 1024}MB`,
      },
      subBatches: this.metrics.subBatchMetrics,
    };
  }
}
```

### 4.2 개선된 로깅

```typescript
// execute-campaigns.ts 내 사용 예시

const metricsCollector = new CampaignMetricsCollector({
  campaignId: campaign.id,
  channel: "SMS",
  batchSize: BATCH_SIZE,
  contactCount: contactIdList.length,
});

// 각 서브배치 완료 후
metricsCollector.recordSubBatch(subBatchIndex, subBatch.length, subBatchDuration);

// 결과 기록
for (const result of results) {
  metricsCollector.recordResult(result.status);
}

// 완료
const metrics = metricsCollector.finish();
logger.info(`[Cron] 캠페인 메트릭`, metrics.toJSON());

// 추가: Datadog 또는 CloudWatch 연동
if (process.env.ENABLE_CAMPAIGN_METRICS === "true") {
  await logMetricsToExternalService(metrics);
}
```

---

## 5. 부하 테스트 케이스 (Step 5)

### 5.1 Jest 단위 테스트

```typescript
// src/lib/cron/__tests__/execute-campaigns.test.ts

import { executeCampaignMessages } from "../execute-campaigns";

describe("executeCampaignMessages - 성능", () => {
  it("should handle batch 150 within 90 seconds", async () => {
    const contactIds = generateMockContactIds(150);
    
    const startTime = Date.now();
    const result = await executeCampaignMessages({
      campaignId: "test-campaign-1",
      organizationId: "test-org",
      groupId: "test-group",
      channel: "SMS",
      messageBody: "Test message",
      contactIds,
    });
    const duration = Date.now() - startTime;

    expect(result.sent + result.failed + result.skipped).toBe(150);
    expect(duration).toBeLessThan(90000); // 90초 이내
  });

  it("should respect SMS rate limit (3 per second)", async () => {
    const contactIds = generateMockContactIds(30); // 30명
    const startTime = Date.now();
    
    await executeCampaignMessages({
      campaignId: "test-campaign-2",
      organizationId: "test-org",
      groupId: "test-group",
      channel: "SMS",
      messageBody: "Test message",
      contactIds,
    });
    
    const duration = Date.now() - startTime;
    // 30명 / 3 rate-limit = 최소 10초
    expect(duration).toBeGreaterThanOrEqual(10000);
  });

  it("should handle sub-batch division correctly", async () => {
    const contactIds = generateMockContactIds(155); // 150 + 5
    
    const result = await executeCampaignMessages({
      campaignId: "test-campaign-3",
      organizationId: "test-org",
      groupId: "test-group",
      channel: "EMAIL",
      messageBody: "Test message",
      contactIds,
    });

    // 155명 모두 처리되어야 함
    expect(result.sent + result.failed + result.skipped).toBe(155);
  });

  it("should collect metrics correctly", async () => {
    // CampaignMetricsCollector 테스트
    const collector = new CampaignMetricsCollector({
      campaignId: "test",
      channel: "SMS",
      batchSize: 50,
      contactCount: 100,
    });

    collector.recordSubBatch(0, 50, 5000);
    collector.recordSubBatch(1, 50, 4800);

    for (let i = 0; i < 95; i++) collector.recordResult("SENT");
    for (let i = 0; i < 5; i++) collector.recordResult("FAILED");

    const metrics = collector.finish();
    expect(metrics.sent).toBe(95);
    expect(metrics.failed).toBe(5);
    expect(metrics.endTime).toBeGreaterThan(metrics.startTime);
  });
});
```

### 5.2 통합 테스트 시나리오

```typescript
// src/lib/cron/__tests__/campaign-integration.test.ts

describe("Campaign Integration - 1500명 대량 발송", () => {
  it("should process 1500 contacts in single cron execution", async () => {
    // 1500명 데이터 생성
    const contactIds = generateMockContactIds(1500);

    // Batch 150 × 10 = 1500
    // Sub-batch 50 × 30 = 1500
    const startTime = Date.now();

    const result = await executeCampaignMessages({
      campaignId: "large-campaign-1500",
      organizationId: "test-org",
      groupId: "test-group",
      channel: "SMS",
      messageBody: "Large scale test message",
      contactIds,
    });

    const duration = Date.now() - startTime;

    // 검증
    expect(result.sent + result.failed + result.skipped).toBe(1500);
    expect(duration).toBeLessThan(300000); // 5분 이내
    
    // 메모리 누수 확인
    const memoryAfter = process.memoryUsage().heapUsed;
    expect(memoryAfter).toBeLessThan(200 * 1024 * 1024); // 200MB 이하
  });

  it("should handle parallel campaigns (3 concurrent)", async () => {
    const campaign1 = executeCampaignMessages({
      campaignId: "parallel-1",
      organizationId: "test-org",
      groupId: "test-group",
      channel: "SMS",
      messageBody: "Campaign 1",
      contactIds: generateMockContactIds(500),
    });

    const campaign2 = executeCampaignMessages({
      campaignId: "parallel-2",
      organizationId: "test-org",
      groupId: "test-group",
      channel: "EMAIL",
      messageBody: "Campaign 2",
      contactIds: generateMockContactIds(500),
    });

    const campaign3 = executeCampaignMessages({
      campaignId: "parallel-3",
      organizationId: "test-org",
      groupId: "test-group",
      channel: "SMS",
      messageBody: "Campaign 3",
      contactIds: generateMockContactIds(500),
    });

    const results = await Promise.all([campaign1, campaign2, campaign3]);

    // 총 1500명 처리
    const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
    expect(totalSent).toBeGreaterThan(1350); // 90% 이상 성공
  });
});
```

---

## 6. 배포 체크리스트 (Step 6)

### 6.1 Pre-Deployment 검사

```bash
# 1. 환경변수 설정 확인
echo "DATABASE_URL max_pool_size check:"
grep "max_pool_size" .env.local
# → max_pool_size=30 확인

# 2. 코드 변경사항 확인
git diff src/lib/cron/execute-campaigns.ts
git diff src/lib/cron/sms-rate-limiter.ts

# 3. 테스트 실행
npm run test -- src/lib/cron/__tests__/

# 4. 성능 벤치마크
npm run test:performance -- campaign-batch-size-150

# 5. 린트 확인
npm run lint -- src/lib/cron/

# 6. 빌드 확인
npm run build
```

### 6.2 배포 전략

```
Phase 3 Step 6 배포 (2%-98% Canary):

1. 2% 배포 (Canary)
   - 모니터링 1시간
   - 에러율, 응답시간, DB pool 확인
   
2. 25% 배포
   - 모니터링 30분
   - SMS/Email 성공률 확인
   
3. 100% 배포
   - 풀 프로덕션 전환
   - 메트릭 수집 시작

4. 롤백 준비
   - 이전 BATCH_SIZE=50으로 복원 가능
   - 환경변수 롤백만으로 즉시 실행 가능
```

### 6.3 Rollback 절차

```bash
# Rollback (문제 발생 시)
# 1. 환경변수 복원
CAMPAIGN_BATCH_SIZE="50"
CAMPAIGN_SUB_BATCH_SIZE="50"

# 2. 배포
vercel deploy --prod

# 3. Cron 수동 트리거 (검증)
curl -X POST https://api.mabizcruisedot.com/api/cron/campaigns \
  -H "X-Cron-Secret: $CRON_SECRET"
```

---

## 7. 참고: 현재 코드 위치

| 파일 | 라인 | 내용 |
|------|------|------|
| `src/lib/cron/execute-campaigns.ts` | 83-132 | 배치 발송 로직 |
| `src/lib/cron/execute-campaigns.ts` | 138-277 | 개별 메시지 발송 |
| `src/lib/aligo.ts` | 72-144 | SMS 발송 |
| `src/lib/email.ts` | 106-146 | Email 발송 |
| `.env.local` | 14 | DATABASE_URL (pool 설정) |

---

**작성**: Agent γ  
**상태**: 설계 단계 코드 스케치  
**다음**: Step 2 (δ-DevOps: 환경변수 설정)
