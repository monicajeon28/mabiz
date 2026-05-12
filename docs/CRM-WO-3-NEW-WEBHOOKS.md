# [크루즈닷몰 → CRM 작업지시서] 3개 신규 이벤트 웹훅

**전달일**: 2026-05-11  
**작성**: 크루즈닷몰 개발팀  
**수신**: mabiz CRM 개발팀  
**긴급도**: P1 — 현재 CRM에 수신 엔드포인트 없음

---

## 개요

크루즈닷몰에서 3개의 신규 이벤트를 CRM으로 전송합니다.  
CRM은 각 이벤트를 수신할 엔드포인트 3개를 구현해야 합니다.

---

## 인증 방식

기존 방식과 동일합니다:
```
Authorization: Bearer <SECRET>
Content-Type: application/json
```

각 webhook마다 독립적인 환경변수(URL + SECRET) 사용.

---

## Webhook 1 — Lead 상태 변경

### 크루즈닷몰 환경변수
```
MABIZ_LEAD_STATUS_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/lead-status
MABIZ_LEAD_STATUS_WEBHOOK_SECRET=...
```

### 전송 조건
Lead 상태가 다음 중 하나로 변경될 때만 전송:
- `IN_PROGRESS` — 상담 진행 중
- `CLOSED` — 상담 종료
- `TEST_GUIDE` — 크루즈닷AI 체험 안내

> ⚠️ `PURCHASED`, `REFUNDED`는 별도 webhook(결제/환불)으로 처리하므로 **이 webhook에서는 전송 안 함**

### Payload

```typescript
{
  leadId: number;          // 크루즈닷몰 AffiliateLead.id
  status: string;          // 변경된 상태 ('IN_PROGRESS' | 'CLOSED' | 'TEST_GUIDE')
  previousStatus: string | null;  // 이전 상태
  customerName: string | null;    // 고객 이름
  affiliateCode: string | null;   // 담당 파트너 코드
  changedAt: string;       // ISO timestamp
  eventId: string;         // 멱등성 키 (UUID v4, 크루즈닷몰이 자동 생성)
}
```

### 예시
```json
{
  "leadId": 1042,
  "status": "IN_PROGRESS",
  "previousStatus": "CONTACTED",
  "customerName": "홍길동",
  "affiliateCode": "A001",
  "changedAt": "2026-05-11T08:30:00.000Z",
  "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### CRM 처리 방향 (권장)
- `affiliateCode` 기준으로 담당자 역추적
- Lead 상태를 CRM 내 Contact 또는 Task에 반영
- `eventId` 중복 체크 권장

---

## Webhook 2 — 여권 확인 완료

### 크루즈닷몰 환경변수
```
MABIZ_PASSPORT_APPROVED_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/passport-approved
MABIZ_PASSPORT_APPROVED_WEBHOOK_SECRET=...
```

### 전송 조건
여권 상태가 `COMPLETED`로 변경될 때 (관리자가 여권 제출 확인 후)

### Payload

```typescript
{
  reservationId: number;       // 크루즈닷몰 Reservation.id
  affiliateCode: string | null; // 연결된 AffiliateSale 담당자 코드 (없으면 null)
  completedAt: string;         // ISO timestamp
  eventId: string;             // 멱등성 키
}
```

### 예시
```json
{
  "reservationId": 582,
  "affiliateCode": "A001",
  "completedAt": "2026-05-11T09:00:00.000Z",
  "eventId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

### CRM 처리 방향 (권장)
- `reservationId` 또는 `affiliateCode` 기준으로 고객 조회
- 고객 상태를 "여권 확인 완료"로 업데이트
- 필요 시 담당 파트너에게 알림 발송

---

## Webhook 3 — 결제 실패

### 크루즈닷몰 환경변수
```
MABIZ_PAYMENT_FAILURE_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/payment-failure
MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET=...
```

### 전송 조건
결제 webhook에서 `status !== 'paid'`인 경우 (결제 실패/취소/미완료)

### Payload

```typescript
{
  orderId: string;              // merchant_uid (주문번호), 없으면 'unknown'
  amount: number | null;        // 결제 시도 금액
  reason: string | null;        // 실패 상태값 ('failed' | 'cancelled' | 'ready' 등)
  customerName: string | null;  // 고객 이름
  customerPhone: string | null; // 고객 전화번호 (평문 — 마스킹 없음)
  affiliateCode: string | null; // 파트너 코드
  failedAt: string;             // ISO timestamp
  eventId: string;              // 멱등성 키
}
```

> ⚠️ `customerPhone`은 결제 실패 알림 용도로 평문 전송  
> (결제 완료 webhook과 달리 마스킹 없음 — CRM에서 후속 연락 목적)

### 예시
```json
{
  "orderId": "ORD-20260511-00123",
  "amount": 3500000,
  "reason": "failed",
  "customerName": "김철수",
  "customerPhone": "01098765432",
  "affiliateCode": "B002",
  "failedAt": "2026-05-11T10:15:00.000Z",
  "eventId": "c3d4e5f6-a7b8-9012-cdef-012345678902"
}
```

### CRM 처리 방향 (권장)
- 결제 실패 고객을 CRM에 기록 (리드 상태: 재접촉 필요)
- `affiliateCode` 기준으로 담당자에게 알림
- `orderId`로 중복 처리 방지

---

## 수신 엔드포인트 목록 (CRM 구현 필요)

| 우선순위 | 엔드포인트 | 이벤트 |
|---------|-----------|--------|
| P1 | `POST /api/webhooks/gmcruise/lead-status` | Lead 상태 변경 |
| P1 | `POST /api/webhooks/gmcruise/passport-approved` | 여권 확인 완료 |
| P2 | `POST /api/webhooks/gmcruise/payment-failure` | 결제 실패 |

---

## 크루즈닷몰 측 현황

- 3개 함수 모두 `lib/mabiz-sync.ts`에 구현 완료
- 환경변수 미설정 시 자동으로 건너뜀 (warn 로그만)
- CRM URL/SECRET 환경변수를 `.env`에 추가하면 즉시 전송 시작

**환경변수 추가 방법:**
```env
MABIZ_LEAD_STATUS_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/lead-status
MABIZ_LEAD_STATUS_WEBHOOK_SECRET=<CRM팀이 발급>

MABIZ_PASSPORT_APPROVED_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/passport-approved
MABIZ_PASSPORT_APPROVED_WEBHOOK_SECRET=<CRM팀이 발급>

MABIZ_PAYMENT_FAILURE_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gmcruise/payment-failure
MABIZ_PAYMENT_FAILURE_WEBHOOK_SECRET=<CRM팀이 발급>
```
