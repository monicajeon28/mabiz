# WebHook Execution Status 테스트 가이드

Menu #38 Phase 2 — Agent γ: WebHook 콜백 엔드포인트 구현

## 환경 설정

### 필수 환경 변수

```bash
# .env.local 또는 .env.production

# WebHook 서명 검증용 시크릿
EXECUTION_STATUS_WEBHOOK_SECRET=your-secret-key-here
```

## API 엔드포인트

### 1. POST /api/webhooks/execution-status

일반 WebHook 콜백 엔드포인트 (SendingHistory 상태 업데이트용)

#### 요청

```bash
curl -X POST http://localhost:3000/api/webhooks/execution-status \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=<HMAC-SHA256>" \
  -d '{
    "eventId": "webhook-123",
    "sendingId": "clh1234567890abcdefghijk",
    "status": "SENT",
    "messageId": "aligo-msg-789",
    "deliveredAt": "2025-01-15T10:30:00Z",
    "timestamp": 1737960600000
  }'
```

#### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| eventId | string | ✅ | 이벤트 고유 ID (멱등성 키) |
| sendingId | string | ✅ | SendingHistory ID |
| status | string | ✅ | SENT \| FAILED |
| failureReason | string | ❌ | PROVIDER_ERROR \| INVALID_PHONE \| QUOTA_EXCEEDED \| SYSTEM_ERROR \| NETWORK_ERROR \| BOUNCE (status=FAILED 시) |
| failureUserMsg | string | ❌ | UI 표시용 사용자 메시지 (한국어) |
| messageId | string | ❌ | SMS/Email 공급자 메시지 ID |
| deliveredAt | string | ❌ | 전달 시간 (ISO 8601) |
| timestamp | number | ❌ | Unix timestamp (ms) |

#### 응답

성공 (200):
```json
{
  "ok": true,
  "executionId": "clh1234567890abcdefghijk",
  "status": "SENT",
  "updatedAt": "2025-01-15T10:30:15Z"
}
```

실패 응답:
- `401` — 서명 검증 실패 (재시도 불가)
- `400` — 필수 필드 누락 또는 유효하지 않은 상태
- `404` — SendingHistory를 찾을 수 없음 (재시도 불가)
- `500` — 서버 오류 (DLQ 등록, 재시도 가능)

#### 서명 생성 방법

```javascript
const crypto = require('crypto');

const secret = process.env.EXECUTION_STATUS_WEBHOOK_SECRET;
const payload = {
  eventId: "webhook-123",
  sendingId: "clh1234567890abcdefghijk",
  status: "SENT",
  messageId: "aligo-msg-789",
};

const signature = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');

console.log(signature);
```

#### 테스트 케이스

##### Test 1: 정상 발송 (SENT)

```bash
curl -X POST http://localhost:3000/api/webhooks/execution-status \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=<SIGNATURE>" \
  -d '{
    "eventId": "test-sent-001",
    "sendingId": "clh1234567890abcdefghijk",
    "status": "SENT",
    "messageId": "aligo-msg-001",
    "deliveredAt": "2025-01-15T10:30:00Z"
  }'
```

예상 결과:
- SendingHistory 상태 → SENT
- ProcessedWebhookEvent 기록됨
- 응답: `{ "ok": true, ... }`

##### Test 2: 발송 실패 (FAILED)

```bash
curl -X POST http://localhost:3000/api/webhooks/execution-status \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=<SIGNATURE>" \
  -d '{
    "eventId": "test-failed-001",
    "sendingId": "clh1234567890abcdefghijk",
    "status": "FAILED",
    "failureReason": "QUOTA_EXCEEDED",
    "failureUserMsg": "일일 발송 한도 초과"
  }'
```

예상 결과:
- SendingHistory 상태 → FAILED
- failureReason → QUOTA_EXCEEDED
- failureUserMsg 저장됨

##### Test 3: 중복 이벤트 (멱등성)

같은 eventId로 2번 요청:

```bash
# 첫 번째 요청
curl -X POST http://localhost:3000/api/webhooks/execution-status \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=<SIGNATURE>" \
  -d '{
    "eventId": "test-duplicate-001",
    "sendingId": "clh1234567890abcdefghijk",
    "status": "SENT"
  }'

# 두 번째 요청 (같은 eventId)
curl -X POST http://localhost:3000/api/webhooks/execution-status \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=<SIGNATURE>" \
  -d '{
    "eventId": "test-duplicate-001",
    "sendingId": "clh1234567890abcdefghijk",
    "status": "SENT"
  }'
```

예상 결과:
- 두 요청 모두 `{ "ok": true, "duplicate": true }`
- SendingHistory는 한 번만 업데이트됨

##### Test 4: 서명 검증 실패 (401)

```bash
curl -X POST http://localhost:3000/api/webhooks/execution-status \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=wrong-signature" \
  -d '{
    "eventId": "test-auth-001",
    "sendingId": "clh1234567890abcdefghijk",
    "status": "SENT"
  }'
```

예상 결과: `401 Unauthorized`

---

### 2. GET /api/webhooks/aligo/status

Aligo SMS 콜백 엔드포인트

#### 요청

```bash
curl "http://localhost:3000/api/webhooks/aligo/status?msg_id=12345&stat=1&result=1000&dest=01012345678&send_time=20250115103000&receive_time=20250115103015"
```

#### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| msg_id | string | ✅ | Aligo 메시지 ID |
| stat | string | ✅ | 상태 코드: 0(PENDING), 1(SENT), 2(FAILED), 3(PENDING) |
| result | string | ✅ | 결과 코드 (1000=성공, 1001=유효하지 않은 번호, etc) |
| dest | string | ❌ | 수신자 번호 |
| send_time | string | ❌ | 발송 시간 (YYYYMMDDHHmmss) |
| receive_time | string | ❌ | 수신 시간 (YYYYMMDDHHmmss) |

#### 응답

성공 (200):
```json
{
  "ok": true,
  "msg_id": "12345",
  "status": "SENT",
  "updatedAt": "2025-01-15T10:30:15Z"
}
```

실패 응답:
- `400` — msg_id, stat, result 누락
- `200` — 처리 완료 (SendingHistory 없음, 멱등성)
- `500` — 서버 오류 (DLQ 등록)

#### stat 코드 매핑

| Stat | SendingStatus | 설명 |
|------|---------------|------|
| 0 | PENDING | 수신중 |
| 1 | SENT | 성공 |
| 2 | FAILED | 실패 |
| 3 | PENDING | 대기 |

#### result 코드 매핑 (실패 시)

| Result | Reason | UserMsg |
|--------|--------|---------|
| 1000 | PROVIDER_ERROR | SMS 서비스 오류로 발송 실패 |
| 1001 | INVALID_PHONE | 유효하지 않은 휴대폰 번호 |
| 1004 | QUOTA_EXCEEDED | 일일 발송 한도 초과 |
| 1005 | SYSTEM_ERROR | SMS 서비스 시스템 오류 |

#### 테스트 케이스

##### Test 1: 발송 성공 (stat=1, result=1000)

```bash
curl "http://localhost:3000/api/webhooks/aligo/status?msg_id=msg-001&stat=1&result=1000"
```

예상 결과:
- SendingHistory (messageId=msg-001) 상태 → SENT
- deliveredAt 저장됨

##### Test 2: 발송 실패 — 한도 초과 (stat=2, result=1004)

```bash
curl "http://localhost:3000/api/webhooks/aligo/status?msg_id=msg-002&stat=2&result=1004"
```

예상 결과:
- SendingHistory 상태 → FAILED
- failureReason → QUOTA_EXCEEDED
- failureUserMsg → "일일 발송 한도 초과"

##### Test 3: 유효하지 않은 번호 (stat=2, result=1001)

```bash
curl "http://localhost:3000/api/webhooks/aligo/status?msg_id=msg-003&stat=2&result=1001"
```

예상 결과:
- SendingHistory 상태 → FAILED
- failureReason → INVALID_PHONE
- failureUserMsg → "유효하지 않은 휴대폰 번호"

##### Test 4: 중복 콜백 (멱등성)

```bash
# 첫 번째 요청
curl "http://localhost:3000/api/webhooks/aligo/status?msg_id=msg-duplicate&stat=1&result=1000"

# 두 번째 요청 (같은 msg_id)
curl "http://localhost:3000/api/webhooks/aligo/status?msg_id=msg-duplicate&stat=1&result=1000"
```

예상 결과:
- 두 요청 모두 200 OK (멱등성)
- `"duplicate": true` (두 번째 요청)
- SendingHistory는 한 번만 업데이트됨

---

## 데이터베이스 확인

### SendingHistory 테이블 조회

```sql
-- 발송 이력 조회
SELECT id, status, failureReason, messageId, deliveredAt, updatedAt
FROM "SendingHistory"
WHERE organizationId = 'org-id'
ORDER BY createdAt DESC
LIMIT 10;

-- 실패 원인별 집계
SELECT status, failureReason, COUNT(*) as count
FROM "SendingHistory"
WHERE organizationId = 'org-id'
GROUP BY status, failureReason;
```

### ProcessedWebhookEvent 테이블 조회

```sql
-- 처리된 WebHook 이벤트 확인
SELECT eventId, webhookType, processedAt
FROM "ProcessedWebhookEvent"
WHERE webhookType IN ('execution_status', 'aligo_status')
ORDER BY processedAt DESC
LIMIT 20;

-- 중복 이벤트 확인
SELECT eventId, COUNT(*) as count
FROM "ProcessedWebhookEvent"
GROUP BY eventId
HAVING COUNT(*) > 1;
```

---

## 통합 테스트 시나리오

### Scenario 1: 일반 WebHook → SMS 발송 완료

1. SendingHistory 생성 (contact=전상준, status=PENDING)
2. `/api/webhooks/execution-status` 호출 (status=SENT)
3. 검증: SendingHistory status → SENT, deliveredAt 저장됨

### Scenario 2: Aligo 콜백 → SMS 발송 실패

1. SendingHistory 생성 (contact=전상준, status=PENDING, messageId=aligo-123)
2. `/api/webhooks/aligo/status?msg_id=aligo-123&stat=2&result=1004` 호출
3. 검증: SendingHistory status → FAILED, failureReason=QUOTA_EXCEEDED

### Scenario 3: 멱등성 검증

1. 같은 eventId/msg_id로 WebHook 2회 호출
2. 검증: 응답 모두 200 OK, ProcessedWebhookEvent 1개만 생성

### Scenario 4: 오류 처리

1. 서명 검증 실패 → 401 (재시도 불가)
2. SendingHistory 없음 → 404 (재시도 불가)
3. DB 오류 → 500 (DLQ 등록, 재시도 가능)

---

## 로깅 확인

```bash
# NextJS 개발 서버에서 로그 확인
npm run dev

# 로그 필터링 (예: execution-status 관련)
# Console에서 검색: "[ExecutionStatusWebhook]"

# 프로덕션 로깅 (Cloud Logging / Datadog)
# Filter: service="webhook-execution-status"
```

---

## 구현 체크리스트

- [x] SendingHistory 모델 추가 (Prisma schema)
- [x] webhook-execution.ts 유틸 파일 생성
- [x] /api/webhooks/execution-status POST 구현
- [x] /api/webhooks/aligo/status GET 구현
- [x] HMAC-SHA256 서명 검증
- [x] ProcessedWebhookEvent 멱등성 처리
- [x] Aligo stat/result 코드 매핑
- [x] 에러 처리 (401/404/500 구분)
- [x] 로깅 통합
- [ ] 마이그레이션 생성 및 실행
- [ ] 환경 변수 설정 (EXECUTION_STATUS_WEBHOOK_SECRET)
- [ ] 로컬 테스트 완료
- [ ] Staging 배포 및 통합 테스트
- [ ] 프로덕션 배포

---

## 주의사항

1. **시크릿 관리**: EXECUTION_STATUS_WEBHOOK_SECRET은 .env.local에만 저장 (버전 관리 제외)
2. **멱등성**: 같은 eventId/msg_id는 멱등성으로 처리됨
3. **상태 전이**: PENDING → SENT/FAILED만 가능 (역방향 전이 불가)
4. **타이밍 공격**: timingSafeEqual 사용으로 서명 검증 보안 강화
5. **에러 복구**: 500 에러는 DLQ에 등록되어 자동 재시도됨
