# Real-Time KPI Dashboard - API Reference

## 목차
1. [메트릭 조회 API](#메트릭-조회-api)
2. [WebSocket 이벤트](#websocket-이벤트)
3. [에러 처리](#에러-처리)
4. [인증 & 권한](#인증--권한)
5. [레이트 리미팅](#레이트-리미팅)
6. [예제](#예제)

---

## 메트릭 조회 API

### GET `/api/realtime/kpi/metrics`

**설명**: 조직의 실시간 KPI 메트릭을 조회합니다.

#### 요청

```http
GET /api/realtime/kpi/metrics?org=org-123 HTTP/1.1
Host: yourapp.com
Accept: application/json
```

#### 쿼리 파라미터

| 파라미터 | 필수 | 타입 | 설명 |
|---------|------|------|------|
| `org` | ✅ | string | 조직 ID (CUID 형식) |

#### 응답 (200 OK)

```json
{
  "todayRevenue": 125000,
  "yesterdayRevenue": 98000,
  "lastHourConversion": 3.2,
  "activeDaySequences": 45,
  "topLenses": [
    {
      "lens": "L6",
      "count": 120
    },
    {
      "lens": "L10",
      "count": 95
    },
    {
      "lens": "L0",
      "count": 78
    }
  ],
  "channelMetrics": {
    "sms": {
      "sent": 234,
      "opened": 156,
      "clicked": 32
    },
    "kakao": {
      "sent": 89,
      "opened": 45,
      "clicked": 8
    },
    "email": {
      "sent": 156,
      "opened": 78,
      "clicked": 12
    }
  },
  "partnerLeaderboard": [
    {
      "partnerId": "partner-abc",
      "name": "김순신",
      "amount": 45000
    },
    {
      "partnerId": "partner-def",
      "name": "이순신",
      "amount": 32000
    }
  ],
  "cronHealth": {
    "sms-sequence-day0": {
      "status": "healthy",
      "lastRun": "2026-05-27T12:30:00Z"
    },
    "sms-sequence-day1": {
      "status": "healthy",
      "lastRun": "2026-05-27T12:30:00Z"
    }
  },
  "databaseHealth": {
    "queryLatency": 45,
    "connectionCount": 12
  }
}
```

#### 응답 필드 설명

| 필드 | 타입 | 설명 | 갱신 주기 |
|------|------|------|----------|
| `todayRevenue` | number | 오늘의 총 매출 (단위: 원) | 1분 |
| `yesterdayRevenue` | number | 어제의 총 매출 (단위: 원) | 1일 |
| `lastHourConversion` | number | 최근 1시간 전환율 (단위: %) | 5분 |
| `activeDaySequences` | number | 진행 중인 Day 0-3 시퀀스 개수 | 1분 |
| `topLenses` | array | 상위 3개 렌즈 분포 | 5분 |
| `channelMetrics` | object | SMS/Kakao/Email 발송 현황 | 2분 |
| `partnerLeaderboard` | array | 상위 5개 파트너 (오늘 매출 기준) | 1분 |
| `cronHealth` | object | 크론 작업 상태 | 실시간 |
| `databaseHealth` | object | DB 쿼리 레이턴시 및 연결 수 | 실시간 |

#### 에러 응답

```json
{
  "error": "Organization ID required",
  "status": 400
}
```

#### HTTP 상태 코드

| 상태 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 조직 ID 누락 |
| 401 | 인증 실패 |
| 500 | 서버 에러 |

#### 캐싱

```
Cache-Control: public, max-age=0, must-revalidate
X-Generated-At: 2026-05-27T12:34:56Z
```

응답은 클라이언트 캐시되지 않으며, 서버 측 Redis 캐시로 최적화됩니다.

---

## WebSocket 이벤트

### 연결 (Connection)

#### WebSocket URL

```
ws://yourapp.com/api/realtime/kpi?org=org-123
```

#### 연결 요청

```javascript
const ws = new WebSocket(`ws://yourapp.com/api/realtime/kpi?org=${organizationId}`);

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

### 이벤트 타입

#### 1. `sales-created` (판매 생성)

**발생**: 새로운 판매가 생성되었을 때

```json
{
  "type": "sales-created",
  "amount": 150000,
  "productId": "cruise-jp-10d",
  "partnerId": "partner-abc",
  "time": "2026-05-27T12:34:56.789Z"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `amount` | number | 판매액 (단위: 원) |
| `productId` | string | 상품 ID |
| `partnerId` | string? | 파트너 ID (optional) |
| `time` | string | ISO 8601 타임스탬프 |

#### 2. `sms-opened` (SMS 오픈)

**발생**: 고객이 SMS를 열었을 때

```json
{
  "type": "sms-opened",
  "sequenceId": "seq-123",
  "contactId": "contact-456",
  "time": "2026-05-27T12:34:56.789Z"
}
```

#### 3. `sms-clicked` (SMS 클릭)

**발생**: 고객이 SMS의 링크를 클릭했을 때

```json
{
  "type": "sms-clicked",
  "sequenceId": "seq-123",
  "contactId": "contact-456",
  "time": "2026-05-27T12:34:56.789Z"
}
```

#### 4. `sequence-completed` (시퀀스 완료)

**발생**: Day 0-3 SMS 시퀀스가 완료되었을 때

```json
{
  "type": "sequence-completed",
  "sequenceId": "seq-123",
  "conversionRate": 15.5,
  "time": "2026-05-27T12:34:56.789Z"
}
```

| 필드 | 설명 |
|------|------|
| `conversionRate` | 이 시퀀스의 전환율 (%) |

#### 5. `contact-created` (고객 생성)

**발생**: 새로운 고객이 추가되었을 때

```json
{
  "type": "contact-created",
  "contactId": "contact-789",
  "lensType": "L6",
  "time": "2026-05-27T12:34:56.789Z"
}
```

#### 6. `status-update` (상태 업데이트)

**발생**: 크론 작업이 완료되었을 때

```json
{
  "type": "status-update",
  "cron": "sms-sequence-day0",
  "health": "healthy",
  "lastRun": "2026-05-27T12:34:56.789Z"
}
```

| 값 | 설명 |
|----|------|
| `health: "healthy"` | 정상 작동 |
| `health: "degraded"` | 일부 오류 (수동 개입 권장) |
| `health: "error"` | 심각한 오류 (즉시 확인) |

#### 7. `metrics-update` (메트릭 업데이트)

**발생**: 주요 메트릭이 갱신되었을 때

```json
{
  "type": "metrics-update",
  "metrics": {
    "todayRevenue": 125000,
    "lastHourConversion": 3.2,
    "activeDaySequences": 45
  }
}
```

---

## 에러 처리

### 일반적인 에러

#### 조직 ID 누락

```bash
$ curl https://yourapp.com/api/realtime/kpi/metrics

{
  "error": "Organization ID required",
  "status": 400
}
```

**해결책**: `?org=org-123` 파라미터 추가

#### 인증 실패 (웹소켓)

```javascript
ws.onerror = (event) => {
  console.error('Connection failed:', event.code);
  // 1006: 비정상 종료
  // 1008: 정책 위반 (인증 실패)
  // 1009: 메시지 너무 큼
};
```

**해결책**: 로그인 재확인 필요

#### 서버 에러

```json
{
  "error": "Failed to fetch metrics",
  "status": 500
}
```

**해결책**: 
1. Redis 연결 확인
2. 데이터베이스 상태 확인
3. 서버 로그 확인 (Sentry)

### 재시도 전략

```javascript
// 클라이언트 자동 재시도 (exponential backoff)
let retries = 0;
const maxRetries = 5;
const baseDelay = 1000; // 1초

async function fetchWithRetry() {
  try {
    return await fetch('/api/realtime/kpi/metrics?org=org-123');
  } catch (error) {
    if (retries < maxRetries) {
      const delay = baseDelay * Math.pow(2, retries);
      retries++;
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry();
    }
    throw error;
  }
}
```

---

## 인증 & 권한

### 권한 검증

현재 구현에서 `org` 파라미터를 통해 조직 ID를 검증합니다.

**프로덕션 구성**:

```typescript
// src/app/api/realtime/kpi/metrics/route.ts
export async function GET(request: NextRequest) {
  const { auth } = getAuth(request);
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('org');

  // 1. 인증 확인
  if (!auth?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. 권한 확인 (사용자가 해당 조직의 멤버인지)
  const member = await prisma.organizationMember.findFirst({
    where: {
      userId: auth.userId,
      organizationId: organizationId
    }
  });

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. 메트릭 조회
  const metrics = await realtimeMetricsService.getAllMetrics(organizationId);
  return NextResponse.json(metrics);
}
```

---

## 레이트 리미팅

### HTTP API

**제한**: 분당 100 요청 (조직당)

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2026-05-27T12:35:00Z
```

초과 시:

```json
{
  "error": "Too Many Requests",
  "retryAfter": 60,
  "status": 429
}
```

### WebSocket

**제한**: 조직당 최대 50 동시 연결

초과 시:

```javascript
ws.onerror = (event) => {
  // 1008: Too many connections
  console.error('Connection limit exceeded');
};
```

---

## 예제

### 예제 1: 기본 메트릭 조회

```javascript
async function getMetrics(organizationId) {
  const response = await fetch(
    `/api/realtime/kpi/metrics?org=${organizationId}`
  );
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return await response.json();
}

// 사용
getMetrics('org-123').then(metrics => {
  console.log('오늘 매출:', metrics.todayRevenue);
  console.log('전환율:', metrics.lastHourConversion);
});
```

### 예제 2: WebSocket 구독

```javascript
class KpiSubscriber {
  constructor(organizationId) {
    this.organizationId = organizationId;
    this.ws = null;
    this.reconnectAttempts = 0;
  }

  connect() {
    const wsUrl = `ws://yourapp.com/api/realtime/kpi?org=${this.organizationId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleEvent(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.reconnect();
    };
  }

  handleEvent(event) {
    switch (event.type) {
      case 'sales-created':
        console.log(`판매: ${event.amount}원`);
        break;
      case 'sequence-completed':
        console.log(`시퀀스 완료: ${event.conversionRate}%`);
        break;
    }
  }

  reconnect() {
    if (this.reconnectAttempts < 10) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      setTimeout(() => this.connect(), delay);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 사용
const subscriber = new KpiSubscriber('org-123');
subscriber.connect();
```

### 예제 3: React Hook 사용

```typescript
import { useKpiSocket } from '@/lib/realtime/kpi-socket';

function Dashboard() {
  const { isConnected, metrics, lastEvent } = useKpiSocket();

  return (
    <div>
      <p>상태: {isConnected ? '연결됨' : '폴링 중'}</p>
      <p>오늘 매출: ${metrics?.todayRevenue}</p>
      <p>마지막 이벤트: {lastEvent?.type}</p>
    </div>
  );
}
```

### 예제 4: 폴백 처리

```javascript
// WebSocket + HTTP 폴링 폴백
class KpiClient {
  constructor(organizationId) {
    this.organizationId = organizationId;
    this.useWebSocket = true;
  }

  async getMetrics() {
    if (this.useWebSocket && this.ws?.readyState === WebSocket.OPEN) {
      // WebSocket 응답 대기 (타임아웃 5초)
      return Promise.race([
        new Promise(resolve => {
          this.wsResponseHandler = resolve;
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);
    } else {
      // HTTP 폴링 폴백
      return fetch(
        `/api/realtime/kpi/metrics?org=${this.organizationId}`
      ).then(r => r.json());
    }
  }
}
```

---

## 버전 히스토리

| 버전 | 날짜 | 변경사항 |
|------|------|---------|
| 1.0 | 2026-05-27 | 초기 릴리스 |
| 1.1 (계획) | 2026-06-01 | Socket.IO 지원 |
| 2.0 (계획) | 2026-07-01 | 실시간 차트 데이터 |

---

## 지원

문제 발생 시:
- GitHub Issues: https://github.com/yourorg/mabiz-crm/issues
- Slack: #dev-help
- 이메일: tech@mabiz.com
