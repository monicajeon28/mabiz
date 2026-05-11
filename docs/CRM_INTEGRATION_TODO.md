# CRM(mabiz) 연동 TODO — GMcruise 팀 전달용

**작성일**: 2026-05-11  
**대상**: mabiz-CRM 개발팀  
**목적**: GMcruise → CRM 웹훅 연동 현황 정리 및 미구현 항목 요청

---

## 1. 현재 연동 완료 현황

GMcruise 코드(`lib/mabiz-sync.ts`)에서 아래 웹훅이 이미 구현되어 있습니다.
**CRM 팀이 수신 엔드포인트를 구현해야 GMcruise의 데이터 전송이 실제로 처리됩니다.**

| 엔드포인트 | 이벤트 | 인증 방식 | 재시도 | 상태 |
|-----------|--------|----------|--------|------|
| POST /api/webhooks/purchase | 결제 완료 | Bearer | 1회 | GMcruise 송신 구현 완료 |
| POST /api/webhooks/refund | 환불 처리 | Bearer | 1회 | GMcruise 송신 구현 완료 |
| POST /api/webhooks/inquiry | 일반 상품 문의 | Bearer | 1회 | GMcruise 송신 구현 완료 |
| POST /api/webhooks/gold-inquiry | 골드회원 문의 | Bearer | 3회 (1s→2s backoff) | GMcruise 송신 구현 완료 |
| POST /api/webhooks/partner-signup | 파트너 계약 승인 완료 | Bearer | 1회 | GMcruise 송신 구현 완료 |
| POST /api/webhooks/gmcruise/contract-signed | 계약서 서명 | HMAC-SHA256 | 3회 (1s→2s→4s backoff) | GMcruise 송신 구현 완료 |
| POST /api/webhooks/news-sync | 뉴스 발행/비활성화 | Bearer | 1회 | GMcruise 송신 구현 완료 |

> **참고**: 골드회원 문의와 계약서 서명은 파트너 귀속 오류 방지를 위해 높은 신뢰성 정책(3회 재시도) 적용 중.

---

## 2. GMcruise 환경변수 설정 가이드

아래 환경변수를 **GMcruise Vercel 대시보드**에 등록해야 웹훅이 실제로 전송됩니다.
환경변수가 비어 있으면 `lib/mabiz-sync.ts`가 전송을 조용히 건너뜁니다(warn 로그만 기록).

```bash
# 결제 완료 웹훅
MABIZ_PURCHASE_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/purchase
MABIZ_PURCHASE_WEBHOOK_SECRET={CRM팀이 발급한 Bearer 시크릿}

# 환불 웹훅
MABIZ_REFUND_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/refund
MABIZ_REFUND_WEBHOOK_SECRET={CRM팀이 발급한 Bearer 시크릿}

# 일반 문의 웹훅
MABIZ_INQUIRY_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/inquiry
MABIZ_INQUIRY_WEBHOOK_SECRET={CRM팀이 발급한 Bearer 시크릿}

# 골드 문의 웹훅 (3회 재시도 — 파트너 귀속 오류 방지)
MABIZ_GOLD_INQUIRY_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/gold-inquiry
MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET={CRM팀이 발급한 Bearer 시크릿}

# 파트너 계약 승인 완료 웹훅
MABIZ_PARTNER_SIGNUP_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/partner-signup
MABIZ_PARTNER_SIGNUP_WEBHOOK_SECRET={CRM팀이 발급한 Bearer 시크릿}

# 뉴스 발행 웹훅
MABIZ_NEWS_WEBHOOK_URL=https://mabizcruisedot.com/api/webhooks/news-sync
MABIZ_NEWS_WEBHOOK_SECRET={CRM팀이 발급한 Bearer 시크릿}

# 계약서 서명 웹훅 (HMAC 방식 — URL은 코드에 하드코딩됨: https://mabizcruisedot.com/api/webhooks/gmcruise/contract-signed)
PARTNER_CONTRACT_WEBHOOK_SECRET={CRM팀이 발급한 HMAC 시크릿}
```

> **보안 주의**: 각 웹훅별로 독립된 시크릿을 발급하는 것을 권장합니다.  
> Bearer 방식은 `Authorization: Bearer {secret}` 헤더로 전송됩니다.

---

## 3. 웹훅 페이로드 명세

### 3-1. 결제 완료 (purchase)

```json
{
  "phone": "01012345678",
  "name": "홍길동",
  "productName": "MSC 지중해 크루즈 7박",
  "departureDate": "2026-07-01",
  "orderId": "ORDER_20260511_001",
  "affiliateCode": "PARTNER_ABC",
  "cabinType": "INTERIOR",
  "eventId": "uuid-v4-중복방지키"
}
```

### 3-2. 환불 처리 (refund)

```json
{
  "orderId": "ORDER_20260511_001",
  "saleId": 1234,
  "amount": 1500000,
  "reason": "고객 요청 환불",
  "refundedAt": "2026-05-11T10:00:00.000Z",
  "eventId": "uuid-v4-중복방지키"
}
```

### 3-3. 일반 상품 문의 (inquiry)

```json
{
  "name": "홍길동",
  "phone": "01012345678",
  "message": "크루즈 객실 문의드립니다.",
  "productCode": "MSC-MED-2026",
  "productName": "MSC 지중해 크루즈",
  "affiliateCode": "PARTNER_ABC",
  "inquiryId": 567,
  "eventId": "uuid-v4-중복방지키"
}
```

### 3-4. 골드회원 문의 (gold-inquiry)

```json
{
  "name": "홍길동",
  "phone": "01012345678",
  "message": "골드 멤버십 문의드립니다.",
  "inquiryId": 789,
  "affiliateCode": "PARTNER_ABC",
  "affiliateMallUserId": "MALL_USER_123",
  "managerId": 42,
  "agentId": null,
  "eventId": "uuid-v4-중복방지키"
}
```

### 3-5. 파트너 계약 승인 완료 (partner-signup)

```json
{
  "mallUserId": "MALL_USER_123",
  "name": "홍길동",
  "phone": "01012345678",
  "affiliateType": "BRANCH_MANAGER",
  "affiliateCode": "PARTNER_ABC",
  "eventId": "uuid-v4-중복방지키"
}
```

`affiliateType` 가능 값: `BRANCH_MANAGER` | `SALES_AGENT` | `PRESALES` | `HQ`

### 3-6. 계약서 서명 (contract-signed) — HMAC 방식

```json
{
  "contractRef": "CONTRACT_REF_001",
  "ownerName": "홍길동",
  "ownerPhone": "01012345678",
  "ownerEmail": "hong@example.com",
  "orgName": "ABC 크루즈 대리점",
  "signedAt": "2026-05-11T09:30:00.000Z"
}
```

### 3-7. 뉴스 발행/비활성화 (news-sync)

```json
{
  "action": "create",
  "shortCode": "NEWS_ABC123",
  "title": "2026 지중해 크루즈 특가",
  "url": "https://gmcruise.co.kr/news/abc123",
  "eventId": "uuid-v4-중복방지키"
}
```

`action` 가능 값: `"create"` | `"deactivate"`

---

## 4. HMAC-SHA256 서명 검증 방법 (계약서 서명 이벤트)

GMcruise에서 `/api/webhooks/gmcruise/contract-signed` 호출 시 사용하는 서명 방식입니다.
CRM 수신 측에서 아래와 같이 검증해야 합니다.

**GMcruise 서명 생성 코드 (`lib/mabiz-sync.ts` 기준)**:
```
signature = 'sha256=' + HMAC-SHA256(secret, rawBody)
헤더: X-Signature, X-Timestamp
```

**CRM 수신 측 검증 예시 (Node.js)**:

```js
import crypto from 'crypto';

function verifySignature(secret, body, signature) {
  // body: Buffer 또는 raw string (JSON.stringify 전 원본)
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(body))
    .digest('hex');

  // timing-safe 비교 (길이 다르면 false 반환)
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// 헤더에서 추출
const signature = req.headers['x-signature'];  // 'sha256=abc123...'
const timestamp = req.headers['x-timestamp'];   // Unix ms 문자열
const rawBody = req.rawBody;                    // raw body 사용 권장

const isValid = verifySignature(process.env.PARTNER_CONTRACT_WEBHOOK_SECRET, rawBody, signature);
if (!isValid) return res.status(401).json({ ok: false });
```

> **주의**: `req.body`가 파싱된 JSON 객체이면 검증 실패합니다. 반드시 **raw body** (Buffer/string)를 사용하세요.

---

## 5. 미연결 이벤트 — 향후 구현 필요

### P0 (높은 우선순위 — 비즈니스 필수)

#### 5-1. Reservation 생성 이벤트

- **언제**: 결제 완료 후 `Reservation` 레코드 생성 시 (`app/api/payment/webhook/route.ts` 내부)
- **현재 상태**: DB에만 저장, CRM에 알림 없음
- **추가 필요**: `syncReservationToMabiz()` 함수 신규 작성 + payment webhook 내부에서 호출
- **CRM이 받아야 할 데이터**:

```json
{
  "reservationId": 1001,
  "userId": 55,
  "tripId": 12,
  "productCode": "MSC-MED-2026",
  "shipName": "MSC 그란디오사",
  "departureDate": "2026-07-01",
  "cabinType": "INTERIOR",
  "totalPeople": 2,
  "saleId": 1234,
  "createdAt": "2026-05-11T10:00:00.000Z"
}
```

- **환경변수 추가 필요**: `MABIZ_RESERVATION_WEBHOOK_URL` / `MABIZ_RESERVATION_WEBHOOK_SECRET`

#### 5-2. SystemConsultation 연동

- **현재 상태**: `/system-inquiry` 폼 제출 → GMcruise DB(`SystemConsultation` 테이블)에만 저장
- **CRM과 DB 공유 중**: CRM이 `SystemConsultation` 테이블을 직접 읽을 수 있음 (DB 공유 설정 완료)
- **권장**: CRM이 `SystemConsultation` 테이블을 직접 SELECT 하는 방식 (웹훅 없이)
- **CRM이 읽어야 할 필드**: `id`, `name`, `phone`, `message`, `status`, `managerId`, `agentId`, `createdAt`
- **웹훅 방식 원할 경우**: `syncSystemConsultationToMabiz()` 함수 신규 작성 필요

---

### P1 (중간 우선순위)

#### 5-3. AffiliateLead 상태 변경 이벤트

- **언제**: Lead 상태가 `NEW → CONTACTED → PURCHASED` 등으로 변경될 때
- **현재 상태**: 상태 변경이 CRM에 전달되지 않음
- **추가 필요**: admin 리드 관리 API(`app/api/admin/affiliate/leads/`) 및 파트너 리드 API에 웹훅 트리거 추가
- **CRM이 받아야 할 데이터**: `leadId`, `prevStatus`, `newStatus`, `customerPhone`, `managerId`, `agentId`, `changedAt`

#### 5-4. Payment 실패 / 환불 실패 이벤트

- **현재 상태**: `refund_pending`, `pgCancelFailed` 상태가 DB(`Payment.status`)에만 기록됨
- **문제**: CRM 담당자가 알림 없이 장시간 방치 가능
- **추가 필요**: 결제 실패/환불 실패 시 CRM 알림 웹훅 (또는 CRM이 `Payment` 테이블을 주기적으로 폴링)
- **CRM이 받아야 할 데이터**: `orderId`, `saleId`, `status`, `amount`, `failureReason`, `occurredAt`

#### 5-5. 여권 등록 완료 이벤트

- **언제**: `Reservation.passportStatus` → `APPROVED` 변경 시
- **현재 상태**: 상태 변경이 CRM에 전달되지 않음
- **추가 필요**: 여권 상태 변경 API(`app/api/admin/apis/`) 내부에 웹훅 트리거 추가
- **CRM이 받아야 할 데이터**: `reservationId`, `productCode`, `shipName`, `passportStatus`, `approvedAt`

---

### P2 (낮은 우선순위)

#### 5-6. 예약 상태 변경 (Reservation.status 변경)
- 상태 값: `CONFIRMED` | `CANCELLED` | `COMPLETED`
- 현재 CRM에 전달 없음

#### 5-7. PNR 발권 완료 (pnrStatus → ISSUED)
- `app/api/admin/pnr-request/send/route.ts`에서 발권 처리
- 발권 완료 시 CRM 알림 없음

#### 5-8. 최종 확정 승인/거절 (finalConfirmStatus 변경)
- `app/api/admin/final-confirm/route.ts` 및 `app/api/partner/customers/[leadId]/final-confirm/route.ts`에서 처리
- 승인/거절 결과가 CRM에 전달되지 않음

---

## 6. DLQ 재처리 가이드

GMcruise → CRM 웹훅 전송 실패 시 `MabizSyncDLQ` 테이블에 적재됩니다.

**DLQ 자동 재시도 정책** (`/api/cron/retry-mabiz-dlq`):
- 1차 실패: 5분 후 재시도
- 2차 실패: 15분 후 재시도
- 3차 실패: 60분 후 재시도
- 3회 초과: `resolvedAt` 마킹 → 수동 확인 대기

**CRM 팀이 반드시 구현해야 할 사항**:

| 항목 | 내용 |
|------|------|
| 멱등성(Idempotency) 처리 | 모든 웹훅에 `eventId` 필드 포함됨. CRM은 동일 `eventId` 재수신 시 중복 처리 금지 |
| 응답 코드 | 성공: HTTP 200 `{ ok: true }` / 실패: HTTP 4xx or 5xx (DLQ에 저장되어 자동 재시도) |
| 타임아웃 | GMcruise 타임아웃 설정: 일반 5초 / HMAC(계약서) 8초. CRM 응답이 이 이내에 와야 함 |

**DLQ 테이블 구조 참고** (`prisma/schema.prisma`):
```
MabizSyncDLQ {
  id            Int
  syncType      String   // 'Purchase' | 'Refund' | 'Inquiry' | 'GoldInquiry' | 'PartnerSignup' | 'News' | 'ContractSigned'
  payload       Json
  webhookUrl    String
  failureReason String?
  retryCount    Int
  nextRetryAt   DateTime
  resolvedAt    DateTime?  // null이면 미처리 상태
}
```

---

## 7. 데이터 흐름 다이어그램

```
고객 결제
  └→ Payment (GMcruise DB)
  └→ AffiliateSale 생성 (GMcruise DB)
  └→ CommissionLedger 생성 (GMcruise DB)
  └→ Reservation 생성 (GMcruise DB)
  └→ [송신 완료] 웹훅: purchase → CRM
  └→ [P0 미연결] 웹훅: reservation → CRM

상품 문의 (일반)
  └→ ProductInquiry (GMcruise DB)
  └→ [송신 완료] 웹훅: inquiry → CRM

골드회원 문의
  └→ ProductInquiry (GMcruise DB)
  └→ [송신 완료] 웹훅: gold-inquiry → CRM (3회 재시도)

크루즈 비즈니스 시스템 문의 (/system-inquiry)
  └→ SystemConsultation (GMcruise DB)
  └→ [P0 미연결] CRM 직접 DB 읽기 권장 (공유 DB 사용 중)

파트너 계약 흐름
  AffiliateContract 제출
    └→ 서명 요청 → affiliate/contract/sign
    └→ [송신 완료] 웹훅: contract-signed → CRM (HMAC)
  관리자 계약 승인 완료
    └→ AffiliateProfile 생성
    └→ [송신 완료] 웹훅: partner-signup → CRM

환불 처리
  관리자 환불 처리 (app/api/admin/refund)
    └→ AffiliateSale.status = REFUNDED
    └→ [송신 완료] 웹훅: refund → CRM

뉴스 발행 (admin/cruisedot-news/publish)
  └→ [송신 완료] 웹훅: news-sync → CRM

AffiliateLead 상태 변경
  └→ [P1 미연결] CRM에 전달 없음

여권 등록 완료 (passportStatus → APPROVED)
  └→ [P1 미연결] CRM에 전달 없음

결제 실패 / 환불 실패
  └→ Payment.status = refund_pending | pgCancelFailed
  └→ [P1 미연결] CRM 알림 없음
```

---

## 8. 연동 검증 체크리스트

CRM 팀이 각 웹훅 엔드포인트 구현 후 GMcruise 팀에 알려주세요.

```
[ ] /api/webhooks/purchase — CRM 수신 엔드포인트 구현 완료
[ ] /api/webhooks/refund — CRM 수신 엔드포인트 구현 완료
[ ] /api/webhooks/inquiry — CRM 수신 엔드포인트 구현 완료
[ ] /api/webhooks/gold-inquiry — CRM 수신 엔드포인트 구현 완료
[ ] /api/webhooks/partner-signup — CRM 수신 엔드포인트 구현 완료
[ ] /api/webhooks/gmcruise/contract-signed — HMAC 검증 포함 구현 완료
[ ] /api/webhooks/news-sync — CRM 수신 엔드포인트 구현 완료
[ ] 각 웹훅별 Bearer 시크릿 발급 + GMcruise Vercel 환경변수 등록 완료
[ ] PARTNER_CONTRACT_WEBHOOK_SECRET 발급 완료
[ ] eventId 기반 멱등성 처리 구현 완료
[ ] 응답 형식 (200 OK / 4xx 5xx) 확인 완료
```
