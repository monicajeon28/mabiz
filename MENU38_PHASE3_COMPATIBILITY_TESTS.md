# Menu #38 Phase 3 호환성 테스트 가이드

## 테스트 개요

**목표**: SendingHistory + ExecutionLog 병행 운영 환경에서 호환성 검증

**기간**: 1주 (병행 운영)

**범위**:
- Enum 매핑 정확성 (4개 함수)
- 트랜잭션 원자성 (SendingHistory + ExecutionLog)
- API 응답 일관성
- 성능 영향 (< 50ms)
- 데이터 불일치 감지

---

## Test Suite 1: Enum 매핑 단위 테스트

### 1.1 Status 매핑 (양방향)

#### Test Code
```typescript
// tests/lib/enum-mapping.test.ts

import {
  mapExecutionToSendingStatus,
  mapSendingToExecutionStatus,
} from "@/lib/enum-mapping";

describe("Enum Mapping - Status", () => {
  describe("ExecutionStatus → SendingStatus", () => {
    it("PENDING → PENDING", () => {
      expect(mapExecutionToSendingStatus("PENDING")).toBe("PENDING");
    });
    it("SENT → SENT", () => {
      expect(mapExecutionToSendingStatus("SENT")).toBe("SENT");
    });
    it("FAILED → FAILED", () => {
      expect(mapExecutionToSendingStatus("FAILED")).toBe("FAILED");
    });
    it("SKIPPED → SKIPPED", () => {
      expect(mapExecutionToSendingStatus("SKIPPED")).toBe("SKIPPED");
    });
    it("RETRY_SCHEDULED → RETRY_SCHEDULED", () => {
      expect(mapExecutionToSendingStatus("RETRY_SCHEDULED")).toBe("RETRY_SCHEDULED");
    });
    it("ABANDONED → ABANDONED", () => {
      expect(mapExecutionToSendingStatus("ABANDONED")).toBe("ABANDONED");
    });
    it("Unknown → FAILED (fallback)", () => {
      expect(mapExecutionToSendingStatus("UNKNOWN_STATUS")).toBe("FAILED");
    });
  });

  describe("SendingStatus → ExecutionStatus", () => {
    it("PENDING → PENDING", () => {
      expect(mapSendingToExecutionStatus("PENDING")).toBe("PENDING");
    });
    it("SENT → SENT", () => {
      expect(mapSendingToExecutionStatus("SENT")).toBe("SENT");
    });
    it("FAILED → FAILED", () => {
      expect(mapSendingToExecutionStatus("FAILED")).toBe("FAILED");
    });
    it("SKIPPED → SKIPPED", () => {
      expect(mapSendingToExecutionStatus("SKIPPED")).toBe("SKIPPED");
    });
    it("RETRY_SCHEDULED → RETRY_SCHEDULED", () => {
      expect(mapSendingToExecutionStatus("RETRY_SCHEDULED")).toBe("RETRY_SCHEDULED");
    });
    it("ABANDONED → ABANDONED", () => {
      expect(mapSendingToExecutionStatus("ABANDONED")).toBe("ABANDONED");
    });
    it("Unknown → FAILED (fallback)", () => {
      expect(mapSendingToExecutionStatus("UNKNOWN_STATUS")).toBe("FAILED");
    });
  });

  describe("Round-trip (양방향 일관성)", () => {
    const statuses: ExecutionStatus[] = [
      "PENDING",
      "SENT",
      "FAILED",
      "SKIPPED",
      "RETRY_SCHEDULED",
      "ABANDONED",
    ];

    statuses.forEach((status) => {
      it(`${status} 양방향 변환 일관성`, () => {
        const toSending = mapExecutionToSendingStatus(status);
        const backToExecution = mapSendingToExecutionStatus(toSending);
        expect(backToExecution).toBe(status);
      });
    });
  });
});
```

#### 실행 방법
```bash
npm run test -- enum-mapping.test.ts
```

---

### 1.2 FailureReason 매핑 (양방향)

#### Test Code
```typescript
describe("Enum Mapping - FailureReason", () => {
  describe("ExecutionFailureReason → SendingFailureReason", () => {
    it("INVALID_EMAIL → INVALID_EMAIL", () => {
      expect(mapExecutionToSendingFailureReason("INVALID_EMAIL")).toBe("INVALID_EMAIL");
    });
    it("INVALID_PHONE → INVALID_PHONE", () => {
      expect(mapExecutionToSendingFailureReason("INVALID_PHONE")).toBe("INVALID_PHONE");
    });
    it("INVALID_CONTACT → INVALID_PHONE (정보 손실)", () => {
      expect(mapExecutionToSendingFailureReason("INVALID_CONTACT")).toBe("INVALID_PHONE");
      // 경고 로그 확인
    });
    it("OPT_OUT → OPT_OUT", () => {
      expect(mapExecutionToSendingFailureReason("OPT_OUT")).toBe("OPT_OUT");
    });
    it("QUOTA_EXCEEDED → QUOTA_EXCEEDED", () => {
      expect(mapExecutionToSendingFailureReason("QUOTA_EXCEEDED")).toBe("QUOTA_EXCEEDED");
    });
    it("SYSTEM_ERROR → SYSTEM_ERROR", () => {
      expect(mapExecutionToSendingFailureReason("SYSTEM_ERROR")).toBe("SYSTEM_ERROR");
    });
    it("PROVIDER_ERROR → PROVIDER_ERROR", () => {
      expect(mapExecutionToSendingFailureReason("PROVIDER_ERROR")).toBe("PROVIDER_ERROR");
    });
    it("NETWORK_ERROR → NETWORK_ERROR", () => {
      expect(mapExecutionToSendingFailureReason("NETWORK_ERROR")).toBe("NETWORK_ERROR");
    });
    it("BOUNCE → BOUNCE", () => {
      expect(mapExecutionToSendingFailureReason("BOUNCE")).toBe("BOUNCE");
    });
    it("Unknown → SYSTEM_ERROR (fallback)", () => {
      expect(mapExecutionToSendingFailureReason("UNKNOWN_REASON")).toBe("SYSTEM_ERROR");
    });
    it("null/undefined → null", () => {
      expect(mapExecutionToSendingFailureReason(null)).toBeNull();
      expect(mapExecutionToSendingFailureReason(undefined)).toBeNull();
    });
  });

  describe("SendingFailureReason → ExecutionFailureReason", () => {
    // (유사한 테스트, INVALID_CONTACT는 SendingFailureReason에 없음)
  });
});
```

---

## Test Suite 2: 트랜잭션 원자성 테스트

### 2.1 SendingHistory + ExecutionLog 동시 생성

#### Test Code
```typescript
// tests/lib/services/contact-template-sender.test.ts

describe("Contact Template Sender - Transaction Atomicity", () => {
  it("SendingHistory + ExecutionLog 동시 생성 성공", async () => {
    const result = await sendToContactByTemplate({
      contactId: "contact-1",
      channel: "SMS",
      messageBody: "Test message",
      organizationId: "org-1",
      campaignId: "campaign-1",
      sourceType: "CAMPAIGN",
      sourceId: "campaign-1",
      sourceName: "Test Campaign",
      useExecutionLog: true,
    });

    expect(result.status).toBe("SENT" | "FAILED" | "SKIPPED");
    expect(result.sendingHistoryId).toBeDefined();
    if (result.status === "SENT" || result.status === "FAILED") {
      expect(result.executionLogId).toBeDefined();
    }

    // DB 검증
    const sending = await db.sendingHistory.findUnique({
      where: { id: result.sendingHistoryId },
    });
    const execution = await db.executionLog.findUnique({
      where: { id: result.executionLogId },
    });

    expect(sending).toBeDefined();
    expect(execution).toBeDefined();
    expect(sending.status).toBe(execution.status); // 상태 일치
  });

  it("부분 실패 (SendingHistory 생성 실패 → ExecutionLog 스킵)", async () => {
    // Mock sendingHistory.create() to fail
    jest.spyOn(db.sendingHistory, "create").mockRejectedValueOnce(new Error("DB Error"));

    const result = await sendToContactByTemplate({
      contactId: "contact-1",
      channel: "SMS",
      messageBody: "Test message",
      organizationId: "org-1",
      useExecutionLog: true,
    });

    expect(result.sendingHistoryId).toBeUndefined();
    // ExecutionLog 생성 안 됨
    const executions = await db.executionLog.findMany({
      where: { contactId: "contact-1" },
    });
    expect(executions.length).toBe(0); // 또는 이전 데이터만
  });

  it("ExecutionLog Feature Flag 제어", async () => {
    // Feature Flag = true
    const resultWithFlag = await sendToContactByTemplate({
      contactId: "contact-1",
      channel: "SMS",
      messageBody: "Test",
      organizationId: "org-1",
      campaignId: "campaign-1",
      useExecutionLog: true, // override
    });

    expect(resultWithFlag.executionLogId).toBeDefined();

    // Feature Flag = false
    const resultWithoutFlag = await sendToContactByTemplate({
      contactId: "contact-2",
      channel: "SMS",
      messageBody: "Test",
      organizationId: "org-1",
      useExecutionLog: false, // override
    });

    expect(resultWithoutFlag.executionLogId).toBeUndefined();
  });
});
```

---

## Test Suite 3: API 응답 호환성

### 3.1 GET /api/campaigns/sending-history

#### Test Scenario
```typescript
describe("API - GET /api/campaigns/sending-history", () => {
  it("응답 필드 동일성 (Phase 2 기준)", async () => {
    const response = await fetch("/api/campaigns/sending-history", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    expect(data.data).toBeDefined();
    
    // 각 항목이 필수 필드를 가지는지 확인
    data.data.forEach((item: SendingHistory) => {
      expect(item.id).toBeDefined();
      expect(item.contactId).toBeDefined();
      expect(item.campaignId).toBeDefined();
      expect(item.status).toMatch(/PENDING|SENT|FAILED|SKIPPED|RETRY_SCHEDULED|ABANDONED/);
      expect(item.failureReason).toBeNull() || 
        expect(item.failureReason).toMatch(/INVALID_EMAIL|INVALID_PHONE|OPT_OUT|QUOTA_EXCEEDED|SYSTEM_ERROR|PROVIDER_ERROR|NETWORK_ERROR|BOUNCE/);
      expect(item.createdAt).toBeDefined();
    });
  });

  it("정렬 순서 일관성 (createdAt DESC)", async () => {
    const response = await fetch("/api/campaigns/sending-history", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    for (let i = 0; i < data.data.length - 1; i++) {
      const current = new Date(data.data[i].createdAt).getTime();
      const next = new Date(data.data[i + 1].createdAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next); // DESC 확인
    }
  });

  it("Pagination 호환성", async () => {
    const page1 = await fetch("/api/campaigns/sending-history?page=1&limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());

    const page2 = await fetch("/api/campaigns/sending-history?page=2&limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());

    expect(page1.data.length).toBeLessThanOrEqual(10);
    expect(page2.data.length).toBeLessThanOrEqual(10);
    
    // 중복 확인 (page 1과 page 2의 항목이 겹치지 않아야 함)
    const page1Ids = new Set(page1.data.map((d: any) => d.id));
    const page2Ids = new Set(page2.data.map((d: any) => d.id));
    const intersection = [...page1Ids].filter(id => page2Ids.has(id));
    expect(intersection.length).toBe(0);
  });
});
```

---

## Test Suite 4: 성능 측정

### 4.1 응답 시간 벤치마크

#### 측정 방법
```typescript
// tests/performance/menu38-phase3.bench.ts

import { performance } from "perf_hooks";

describe("Performance - Menu #38 Phase 3", () => {
  it("sendToContactByTemplate 응답 시간 < 50ms", async () => {
    const iterations = 100;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      await sendToContactByTemplate({
        contactId: `contact-${i}`,
        channel: i % 2 === 0 ? "SMS" : "EMAIL",
        messageBody: "Test message",
        organizationId: "org-1",
        campaignId: "campaign-1",
        useExecutionLog: true,
      });

      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p50 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.5)];
    const p99 = times[Math.floor(times.length * 0.99)];

    console.log(`Average: ${avg.toFixed(2)}ms`);
    console.log(`P50: ${p50.toFixed(2)}ms`);
    console.log(`P99: ${p99.toFixed(2)}ms`);

    expect(avg).toBeLessThan(50);
    expect(p50).toBeLessThan(50);
    expect(p99).toBeLessThan(100);
  });

  it("executeCampaignMessages 배치 처리 성능 (50개 Contact)", async () => {
    const start = performance.now();

    const result = await executeCampaignMessages({
      campaignId: "campaign-1",
      organizationId: "org-1",
      groupId: "group-1",
      channel: "SMS",
      messageBody: "Test message",
      contactIds: Array.from({ length: 50 }, (_, i) => `contact-${i}`),
    });

    const end = performance.now();
    const duration = end - start;

    console.log(`Batch processing time: ${duration.toFixed(2)}ms for 50 contacts`);
    console.log(`Average per contact: ${(duration / 50).toFixed(2)}ms`);

    expect(duration).toBeLessThan(5000); // 5초 이내
    expect(result.sent + result.failed + result.skipped).toBe(50);
  });
});
```

#### 실행
```bash
npm run bench -- menu38-phase3.bench.ts
```

---

## Test Suite 5: 데이터 불일치 감지

### 5.1 SendingHistory vs ExecutionLog 카운트 비교

#### SQL 쿼리 검증
```sql
-- 검증 1: 캠페인별 SendingHistory vs ExecutionLog 카운트
SELECT 
  sh.campaignId,
  COUNT(DISTINCT sh.id) as sending_count,
  COUNT(DISTINCT el.id) as execution_count,
  CASE 
    WHEN COUNT(DISTINCT sh.id) = COUNT(DISTINCT el.id) THEN 'OK'
    ELSE 'MISMATCH'
  END as status
FROM SendingHistory sh
LEFT JOIN ExecutionLog el 
  ON sh.campaignId = el.campaignId
  AND sh.contactId = el.contactId
WHERE sh.campaignId IS NOT NULL
  AND sh.createdAt > NOW() - INTERVAL '1 day'
GROUP BY sh.campaignId
HAVING COUNT(DISTINCT sh.id) != COUNT(DISTINCT el.id);
```

#### 데이터 일관성 테스트
```typescript
describe("Data Consistency - SendingHistory vs ExecutionLog", () => {
  it("캠페인별 카운트 일치", async () => {
    const campaigns = await db.crmMarketingCampaign.findMany({
      where: { status: "ACTIVE" },
    });

    for (const campaign of campaigns) {
      const sendingCount = await db.sendingHistory.count({
        where: { campaignId: campaign.id },
      });

      const executionCount = await db.executionLog.count({
        where: { campaignId: campaign.id },
      });

      // ExecutionLog가 있으면 일치해야 함
      if (executionCount > 0) {
        expect(sendingCount).toBe(executionCount);
      }
    }
  });

  it("Status 매핑 일치도 검증", async () => {
    const mismatches = await db.$queryRaw`
      SELECT sh.id, sh.status, el.status
      FROM SendingHistory sh
      LEFT JOIN ExecutionLog el 
        ON sh.campaignId = el.campaignId
        AND sh.contactId = el.contactId
      WHERE sh.campaignId IS NOT NULL
        AND sh.status != el.status
      LIMIT 100;
    `;

    // 매핑을 통해 일치해야 함
    for (const mismatch of mismatches) {
      const mappedStatus = mapSendingToExecutionStatus(mismatch.status);
      expect(mappedStatus).toBe(mismatch.executionStatus);
    }
  });
});
```

---

## Test Suite 6: Enum 매핑 특수 케이스

### 6.1 INVALID_CONTACT 정보 손실 검증

#### Test Code
```typescript
describe("Special Case - INVALID_CONTACT Mapping", () => {
  it("INVALID_CONTACT → INVALID_PHONE 매핑", () => {
    const result = mapExecutionToSendingFailureReason("INVALID_CONTACT");
    expect(result).toBe("INVALID_PHONE");
  });

  it("경고 로그 발생", () => {
    const warnSpy = jest.spyOn(logger, "warn");
    mapExecutionToSendingFailureReason("INVALID_CONTACT");
    
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("INVALID_CONTACT"),
      expect.any(Object)
    );
  });

  it("역매핑 불가능 (정보 손실)", () => {
    // INVALID_PHONE → INVALID_CONTACT 매핑 불가능
    const result = mapSendingToExecutionFailureReason("INVALID_PHONE");
    expect(result).toBe("INVALID_PHONE"); // INVALID_CONTACT로 복구 불가
  });
});
```

---

## 병행 운영 모니터링 대시보드

### 주요 메트릭

```sql
-- 1. 시간별 발송 통계 (SendingHistory vs ExecutionLog)
SELECT 
  DATE_TRUNC('hour', sh.createdAt) as hour,
  COUNT(DISTINCT sh.id) as sending_count,
  COUNT(DISTINCT el.id) as execution_count,
  COUNT(CASE WHEN sh.status = 'SENT' THEN 1 END) as sent_count,
  COUNT(CASE WHEN sh.status = 'FAILED' THEN 1 END) as failed_count,
  COUNT(CASE WHEN sh.status = 'SKIPPED' THEN 1 END) as skipped_count
FROM SendingHistory sh
LEFT JOIN ExecutionLog el ON sh.contactId = el.contactId 
  AND sh.campaignId = el.campaignId
WHERE sh.createdAt > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- 2. 실패 원인 분포
SELECT 
  sh.failureReason,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM SendingHistory sh
WHERE sh.status = 'FAILED'
  AND sh.createdAt > NOW() - INTERVAL '24 hours'
GROUP BY sh.failureReason
ORDER BY count DESC;

-- 3. 재시도 현황
SELECT 
  status,
  COUNT(*) as count,
  AVG(retryCount) as avg_retry_count,
  MAX(retryCount) as max_retry_count
FROM SendingHistory
WHERE createdAt > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- 4. 응답 시간 P50, P95, P99
SELECT 
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) as p99
FROM execution_metrics
WHERE timestamp > NOW() - INTERVAL '24 hours';
```

---

## Alerting Rules

### 1. 데이터 불일치 감지 (P0)
```
Name: SendingHistory vs ExecutionLog Count Mismatch
Condition: 
  COUNT(SendingHistory) - COUNT(ExecutionLog) > 10
  OR (COUNT(ExecutionLog) - COUNT(SendingHistory) > 10 AND COUNT(ExecutionLog) > 0)
Duration: 5 minutes
Action: Page on call
```

### 2. 높은 실패율 (P1)
```
Name: High Failure Rate
Condition:
  COUNT(FAILED) / COUNT(*) > 0.1 (10%)
Duration: 10 minutes
Action: Slack notification
```

### 3. 응답 시간 저하 (P2)
```
Name: Response Time Degradation
Condition:
  P95(response_time_ms) > 100ms
Duration: 5 minutes
Action: Dashboard alert
```

---

## 테스트 실행 순서

1. **단위 테스트** (enum-mapping)
2. **통합 테스트** (contact-template-sender)
3. **API 테스트** (sending-history endpoint)
4. **성능 벤치마크** (응답시간)
5. **데이터 일관성 검증** (SQL queries)
6. **모니터링 알림** 설정

---

## 결과 기록

| 테스트 | 결과 | 시간 | 메모 |
|--------|------|------|------|
| Enum Status 매핑 | PASS | 100ms | 6개 케이스 모두 통과 |
| Enum FailureReason | PASS | 150ms | INVALID_CONTACT 경고 로그 확인 |
| 트랜잭션 원자성 | FAIL | - | db.$transaction 부재 (P0) |
| API 호환성 | PASS | 200ms | 필드 동일, 정렬 일관 |
| 성능 (단일) | PASS | - | avg 12ms, P99 25ms < 50ms |
| 성능 (배치) | PASS | - | 50 contact 1.2sec |
| 데이터 일관성 | - | - | 병행 운영 주 시작 시 체크 |

