# Menu #38 Phase 2 — Agent γ: WebHook 콜백 엔드포인트 구현 완료

완료 일시: 2026-05-18

## 📋 작업 개요

Menu #38 SMS 템플릿 & 마케팅 자동화 Phase 2 중 Agent γ 담당:
- SendingHistory 상태 업데이트를 위한 WebHook 콜백 엔드포인트 2개 구현
- HMAC-SHA256 서명 검증 + 멱등성 처리
- Aligo SMS 공급자 통합

---

## ✅ 구현 완료 항목

### 1. Prisma 스키마 추가
**파일**: `D:\mabiz-crm\prisma\schema.prisma`

```prisma
model SendingHistory {
  id                String                 @id @default(cuid())
  organizationId    String
  sendingType       String                 // TEMPLATE | AUTOMATION | CAMPAIGN
  sourceId          String?                // templateId | automationId | campaignId
  contactId         String
  phone             String?                // 스냅샷
  email             String?
  channel           String                 // SMS | EMAIL
  subject           String?                // EMAIL 제목
  body              String                 // 메시지 본문
  status            SendingStatus          @default(PENDING)
  failureReason     SendingFailureReason?
  failureUserMsg    String?                // UI용 한국어
  messageId         String?                // Aligo msg_id / Email provider ID
  deliveredAt       DateTime?
  webhookAttempts   Int                    @default(0)
  lastWebhookAt     DateTime?
  scheduledAt       DateTime
  sentAt            DateTime?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  @@index([organizationId, status])
  @@index([contactId, status])
  @@index([messageId])
  @@index([sendingType, sourceId])
  @@index([createdAt(sort: Desc)])
  @@map("SendingHistory")
}
```

### 2. WebHook 유틸 함수
**파일**: `D:\mabiz-crm\src\lib\webhook-execution.ts` (252줄)

10개 함수 구현:
1. `verifyWebhookSignature()` — HMAC-SHA256 서명 검증 (timingSafeEqual)
2. `isProcessedWebhook()` — 멱등성: 이미 처리된 이벤트 확인
3. `markWebhookProcessed()` — ProcessedWebhookEvent 기록
4. `updateSendingStatus()` — SendingHistory 상태 업데이트
5. `mapAligoStatusToSending()` — Aligo stat → SendingStatus 매핑
6. `mapAligoResultToReason()` — Aligo result → SendingFailureReason 매핑
7. `getAligoUserMessage()` — 사용자 메시지 생성 (한국어)
8. `processSendingWebhook()` — 통합 처리 함수
9. `getSendingHistory()` — ID로 조회
10. `getSendingHistoryByMessageId()` — messageId로 조회

### 3. POST /api/webhooks/execution-status
**파일**: `D:\mabiz-crm\src\app\api\webhooks\execution-status\route.ts` (193줄)

일반 WebHook 콜백 엔드포인트:
- **인증**: X-Signature 헤더 (HMAC-SHA256)
- **멱등성**: eventId로 중복 방지
- **상태 코드**:
  - 200: 성공 또는 중복
  - 400: 필수 필드 누락
  - 401: 서명 검증 실패 (재시도 불가)
  - 404: SendingHistory 없음 (재시도 불가)
  - 500: 서버 오류 (DLQ 등록, 재시도 가능)

#### 요청 형식
```json
{
  "eventId": "webhook-123",
  "sendingId": "clh1234567890abcdefghijk",
  "status": "SENT" | "FAILED",
  "failureReason": "PROVIDER_ERROR" | "INVALID_PHONE" | null,
  "failureUserMsg": "일일 발송 한도 초과",
  "messageId": "aligo-msg-789",
  "deliveredAt": "2025-01-15T10:30:00Z"
}
```

#### 응답 형식
```json
{
  "ok": true,
  "executionId": "clh1234567890abcdefghijk",
  "status": "SENT",
  "updatedAt": "2025-01-15T10:30:15Z",
  "duplicate": false
}
```

### 4. GET /api/webhooks/aligo/status
**파일**: `D:\mabiz-crm\src\app\api\webhooks\aligo\status\route.ts` (190줄)

Aligo SMS 콜백 엔드포인트:
- **메서드**: GET (Aligo 명세)
- **멱등성**: msg_id를 eventId로 사용
- **stat 매핑**: 0→PENDING, 1→SENT, 2→FAILED, 3→PENDING
- **result 매핑**:
  - 1000: PROVIDER_ERROR (일반 오류)
  - 1001: INVALID_PHONE (유효하지 않은 번호)
  - 1004: QUOTA_EXCEEDED (일일 한도 초과)
  - 1005: SYSTEM_ERROR (시스템 오류)

#### 쿼리 파라미터
```
GET /api/webhooks/aligo/status?
  msg_id=12345&
  stat=1&
  result=1000&
  dest=01012345678&
  send_time=20250115103000&
  receive_time=20250115103015
```

#### 응답 형식
```json
{
  "ok": true,
  "msg_id": "12345",
  "status": "SENT",
  "updatedAt": "2025-01-15T10:30:15Z"
}
```

### 5. 테스트 가이드
**파일**: `D:\mabiz-crm\docs\WEBHOOK_EXECUTION_STATUS_TEST.md`

- 환경 변수 설정
- curl 테스트 예제
- 테스트 케이스 4개씩 (총 8개)
- 데이터베이스 확인 쿼리
- 통합 테스트 시나리오 4개

---

## 🔒 보안 구현

### HMAC-SHA256 서명 검증
```typescript
const hash = createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');

return timingSafeEqual(
  Buffer.from(signatureHeader),
  Buffer.from(expected)
);
```

**보안 특성**:
- `timingSafeEqual` 사용으로 타이밍 공격 방지
- 전체 payload 검증
- 환경 변수에서 시크릿 로드

### 멱등성 (Idempotence)
```typescript
// ProcessedWebhookEvent로 중복 이벤트 완전 차단
if (await isProcessedWebhook(eventId)) {
  return { ok: true, duplicate: true };
}
```

**멱등성 메커니즘**:
- eventId (일반) / msg_id (Aligo)를 주키로 사용
- 같은 이벤트는 한 번만 처리
- 재시도 시 자동 중복 제거

---

## 📊 에러 처리 전략

| 상태 코드 | 원인 | 재시도 | 로깅 | DLQ |
|----------|------|--------|------|-----|
| 200 | 성공 또는 중복 | ❌ | ✅ | ❌ |
| 400 | 필수 필드 누락 | ❌ | ✅ | ❌ |
| 401 | 서명 검증 실패 | ❌ | ✅ | ❌ |
| 404 | SendingHistory 없음 | ❌ | ✅ | ❌ |
| 500 | 서버 오류 | ✅ | ✅ | ✅ |

**영구 실패** (401, 404): 로깅만 하고 재시도 불가
**일시적 실패** (500): DLQ 등록하여 자동 재시도

---

## 🗄️ 데이터베이스 스키마

### SendingHistory 인덱스
```
1. organizationId + status (조직별 상태 조회)
2. contactId + status (고객별 발송 이력)
3. messageId (공급자 ID로 빠른 조회)
4. sendingType + sourceId (템플릿/자동화 추적)
5. createdAt DESC (최신순 정렬)
```

### 마이그레이션
```bash
npx prisma migrate dev --name "add_sending_history_model"
```

---

## 📝 환경 변수 설정

```bash
# .env.local 또는 .env.production
EXECUTION_STATUS_WEBHOOK_SECRET=your-32-char-random-secret-key

# 권장: 32바이트 이상 무작위 문자열
# 생성: openssl rand -hex 32
```

---

## 🧪 테스트 체크리스트

### 로컬 테스트 (npm run dev)
- [ ] POST /api/webhooks/execution-status (정상)
- [ ] POST /api/webhooks/execution-status (중복)
- [ ] POST /api/webhooks/execution-status (서명 실패)
- [ ] GET /api/webhooks/aligo/status (정상)
- [ ] GET /api/webhooks/aligo/status (중복)
- [ ] GET /api/webhooks/aligo/status (필드 누락)
- [ ] ProcessedWebhookEvent 테이블 확인
- [ ] SendingHistory 상태 업데이트 검증

### Staging 테스트
- [ ] EXECUTION_STATUS_WEBHOOK_SECRET 환경 변수 확인
- [ ] DB 마이그레이션 적용
- [ ] Aligo 실제 발송 테스트
- [ ] WebHook 콜백 수신 검증
- [ ] 멱등성 테스트 (중복 요청)

### 프로덕션 배포
- [ ] 환경 변수 설정
- [ ] DB 마이그레이션 실행
- [ ] WebHook 엔드포인트 등록 (Aligo, 메일 서비스)
- [ ] 모니터링 대시보드 설정
- [ ] 로그 알림 설정

---

## 📂 파일 목록

| 파일 | 줄수 | 설명 |
|------|------|------|
| `prisma/schema.prisma` | +48 | SendingHistory 모델 추가 |
| `src/lib/webhook-execution.ts` | 252 | WebHook 유틸 함수 |
| `src/app/api/webhooks/execution-status/route.ts` | 193 | POST 엔드포인트 |
| `src/app/api/webhooks/aligo/status/route.ts` | 190 | GET 엔드포인트|
| `docs/WEBHOOK_EXECUTION_STATUS_TEST.md` | 456 | 테스트 가이드 |
| **합계** | **1,139줄** | |

---

## 🚀 다음 단계 (Phase 2 Agent δ)

### Agent δ: 발송 API 구현
1. **SendingHistory 생성 API** → `/api/sms-sending`
   - SMS/EMAIL 발송 요청
   - ContactGroup 일괄 발송
   - ScheduledSms 통합

2. **발송 상태 조회 API** → `/api/sending-status/[id]`
   - 발송 이력 조회
   - 멀티 채널 통계

3. **발송 스케줄러**
   - Cron 기반 시간대 발송
   - 재시도 로직
   - Rate limiting (Aligo: 시간당 1000개)

---

## 🔗 관련 문서

- [Menu #38 최종 작업지시서](menu_38_final_work_instructions.md)
- [Menu #38 SMS 템플릿 설계](menu_38_sms_template_design.md)
- [크루즈콜 완전 RAG 통합](cruisecall_complete_rag_integration.md)

---

## ✨ 주요 특징

✅ **타이밍 공격 방지** — timingSafeEqual 사용
✅ **완전한 멱등성** — ProcessedWebhookEvent로 중복 완전 차단
✅ **영구/일시적 실패 구분** — 401/404 vs 500
✅ **Aligo 공급자 통합** — stat/result 코드 정확한 매핑
✅ **사용자 친화적 메시지** — 한국어 에러 메시지
✅ **상세 로깅** — 각 단계별 eventId, sendingId, status 기록
✅ **TypeScript strict mode** — 완전한 타입 안전성
✅ **Prettier 포매팅** — 코드 스타일 통일

---

## 📞 문의 & 수정

구현 중 이슈가 발생하면:
1. `docs/WEBHOOK_EXECUTION_STATUS_TEST.md` 의 테스트 케이스 실행
2. 로그에서 `[ExecutionStatusWebhook]` / `[AligoStatusWebhook]` 필터링
3. ProcessedWebhookEvent 테이블에서 멱등성 확인
4. SendingHistory 상태 업데이트 검증
