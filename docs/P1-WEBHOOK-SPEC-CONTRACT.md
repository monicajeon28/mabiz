# P1 웹훅 Payload 스펙 합의서

**작성일**: 2026-05-11
**목적**: 크루즈닷몰(발신) ↔ CRM(수신) 양쪽 동시 구현을 위한 payload 계약
**상태**: 합의 대기

---

## 공통 규칙

| 항목 | 값 |
|------|-----|
| 인증 | `Authorization: Bearer {SECRET}` + timingSafeEqual |
| 멱등성 | `eventId` (UUID v4) **필수** — ProcessedWebhookEvent로 중복 방지 |
| 응답 | 성공: `200 { ok: true }` / 중복: `200 { ok: true, duplicate: true }` / 실패: `500` |
| 타임아웃 | 5초 |
| 재시도 | GMcruise DLQ 자동 재시도 (5m→15m→60m) |
| 민감정보 | phone은 마스킹 가능 (`010-****-1234`), CRM은 orderId/affiliateCode로 Contact 역추적 |

---

## 1. Lead 상태변경 웹훅

### 엔드포인트
```
POST /api/webhooks/lead-status-change
Authorization: Bearer {MABIZ_LEAD_STATUS_WEBHOOK_SECRET}
```

### 트리거 시점 (크루즈닷몰)
- AffiliateLead 상태가 변경될 때 (`NEW → CONTACTED → PURCHASED → CLOSED` 등)
- 발생 위치: `app/api/admin/affiliate/leads/` 및 파트너 리드 API

### Payload
```typescript
{
  leadId:         number;        // 크루즈닷몰 AffiliateLead.id
  prevStatus:     string;        // 이전 상태 (NEW, CONTACTED, PURCHASED, CLOSED 등)
  newStatus:      string;        // 변경된 상태
  customerPhone:  string | null; // 고객 전화번호 (마스킹 가능)
  customerName?:  string | null; // 고객 이름
  productCode?:   string | null; // 관련 상품코드
  affiliateCode?: string | null; // 파트너 코드 (organizationId 역추적용)
  managerId?:     number | null; // 크루즈닷몰 담당 매니저 ID
  agentId?:       number | null; // 크루즈닷몰 담당 에이전트 ID
  changedAt:      string;        // ISO 8601 타임스탬프
  eventId:        string;        // UUID v4 (멱등성 키)
}
```

### CRM 처리 로직
1. `affiliateCode` → organizationId 역추적 (purchase 패턴과 동일)
2. `customerPhone`으로 Contact 찾기 (마스킹이면 skip)
3. Contact가 있으면:
   - `ContactMemo`에 상태변경 이력 기록: `[리드상태변경] NEW → CONTACTED / 매니저: #42`
   - `newStatus`가 `PURCHASED`이면 `Contact.type = 'PURCHASED'` 업데이트
4. Contact가 없으면: 로그만 기록 (정상 — 아직 CRM에 등록 안 된 리드)

### 환경변수 (크루즈닷몰 Vercel)
```
MABIZ_LEAD_STATUS_WEBHOOK_URL=https://mabiz.cruisedot.com/api/webhooks/lead-status-change
MABIZ_LEAD_STATUS_WEBHOOK_SECRET={CRM팀 발급}
```

---

## 2. 여권 등록 완료 웹훅

### 엔드포인트
```
POST /api/webhooks/passport-approved
Authorization: Bearer {MABIZ_PASSPORT_WEBHOOK_SECRET}
```

### 트리거 시점 (크루즈닷몰)
- `Reservation.passportStatus` → `APPROVED` 변경 시
- 발생 위치: `app/api/admin/apis/` (여권 상태 변경 API)

### Payload
```typescript
{
  reservationId:  number;        // 크루즈닷몰 Reservation.id
  productCode?:   string | null; // 상품코드
  shipName?:      string | null; // 선박명
  departureDate?: string | null; // 출발일 (YYYY-MM-DD)
  passportStatus: string;        // "APPROVED"
  customerPhone:  string | null; // 고객 전화번호 (마스킹 가능)
  affiliateCode?: string | null; // 파트너 코드 (organizationId 역추적용)
  approvedAt:     string;        // ISO 8601 타임스탬프
  eventId:        string;        // UUID v4 (멱등성 키)
}
```

### CRM 처리 로직
1. `affiliateCode` → organizationId 역추적
2. `customerPhone`으로 Contact 찾기 (마스킹이면 skip, reservationId 관련 bookingRef로 fallback)
3. Contact가 있으면:
   - `ContactMemo`에 기록: `[여권승인] MSC 그란디오사 / 출발 2026-07-01 / 여권 승인 완료`
4. Contact가 없으면: 로그만 기록

### 환경변수 (크루즈닷몰 Vercel)
```
MABIZ_PASSPORT_WEBHOOK_URL=https://mabiz.cruisedot.com/api/webhooks/passport-approved
MABIZ_PASSPORT_WEBHOOK_SECRET={CRM팀 발급}
```

---

## 3. 결제 실패 알림 웹훅

### 엔드포인트
```
POST /api/webhooks/payment-failure
Authorization: Bearer {MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET}
```

### 트리거 시점 (크루즈닷몰)
- `Payment.status`가 실패 상태로 변경될 때:
  - `refund_pending` — 환불 대기 중 (PG 처리 지연)
  - `pgCancelFailed` — PG 취소 실패
  - `payment_failed` — 결제 자체 실패
- 발생 위치: `app/api/payment/webhook/route.ts` 및 환불 처리 API

### Payload
```typescript
{
  orderId:        string;        // 주문번호
  saleId?:        number | null; // 크루즈닷몰 AffiliateSale.id
  status:         string;        // 실패 상태 (refund_pending, pgCancelFailed, payment_failed)
  amount:         number;        // 금액 (원)
  failureReason?: string | null; // 실패 사유 (PG 응답 메시지)
  customerPhone?: string | null; // 고객 전화번호 (마스킹 가능)
  affiliateCode?: string | null; // 파트너 코드
  occurredAt:     string;        // ISO 8601 타임스탬프
  eventId:        string;        // UUID v4 (멱등성 키)
}
```

### CRM 처리 로직
1. `orderId`로 CRM AffiliateSale 찾기 → Contact 역추적
2. Contact가 있으면:
   - `ContactMemo`에 기록: `[결제실패] 150만원 / PG취소실패 / 주문번호: ORDER_001`
   - `Contact.type`은 변경하지 않음 (실패가 해소될 수 있으므로)
3. Contact가 없으면: 로그만 기록
4. **중요**: 결제 실패는 크루즈닷몰이 감지 즉시 웹훅 발송 — CRM은 수신만

### 환경변수 (크루즈닷몰 Vercel)
```
MABIZ_PAYMENT_FAILURE_WEBHOOK_URL=https://mabiz.cruisedot.com/api/webhooks/payment-failure
MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET={CRM팀 발급}
```

---

## 양쪽 구현 체크리스트

### 크루즈닷몰 (발신)
```
[ ] lib/mabiz-sync.ts에 syncLeadStatusToMabiz() 함수 추가
[ ] lib/mabiz-sync.ts에 syncPassportApprovedToMabiz() 함수 추가
[ ] lib/mabiz-sync.ts에 syncPaymentFailureToMabiz() 함수 추가
[ ] 각 트리거 지점에서 함수 호출
[ ] 환경변수 6개 Vercel에 등록 (URL 3개 + SECRET 3개)
[ ] DLQ 재시도 정책 적용
```

### CRM (수신)
```
[ ] POST /api/webhooks/lead-status-change 엔드포인트 구현
[ ] POST /api/webhooks/passport-approved 엔드포인트 구현
[ ] POST /api/webhooks/payment-failure 엔드포인트 구현
[ ] Bearer 시크릿 3개 발급 + .env 등록
[ ] 각 웹훅 테스트
```
