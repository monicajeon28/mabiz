# GMcruise → mabiz-CRM 웹훅 연동 가이드

**대상 독자**: mabiz-CRM 백엔드 개발자  
**문서 목적**: CRM 수신 엔드포인트를 구현하는 데 필요한 모든 명세를 단일 문서에 제공  
**최종 업데이트**: 2026-05-11  
**소스 기준**: `lib/mabiz-sync.ts`, `app/api/payment/webhook/route.ts` 외 6개 호출점

---

## 1. 개요

GMcruise(크루즈닷몰)는 결제 완료 · 환불 · 문의 · 파트너 가입 등 8가지 이벤트가 발생하면 mabiz-CRM으로 HTTP POST 웹훅을 전송합니다.

### 아키텍처 요약

```
GMcruise (Next.js / Vercel)
  │
  ├─ lib/mabiz-sync.ts   ← 웹훅 전송 함수 모음
  │       └─ postToMabiz()   ← 내부 공통 함수 (Bearer 인증, 재시도, DLQ)
  │       └─ notifyMabizContractSigned()   ← HMAC 전용 함수
  │
  └─ 이벤트 발생 시 fire-and-forget으로 CRM 호출
         실패 시 MabizSyncDLQ 테이블에 적재 → 5분 후 Cron 재시도
```

### 인증 방식 — 2종류 혼용 주의

| 인증 방식 | 적용 이벤트 | 헤더 |
|----------|------------|------|
| Bearer Token | 7개 이벤트 (Purchase, Refund, Inquiry, GoldInquiry, PartnerSignup, News, + DLQ 재시도) | `Authorization: Bearer {secret}` |
| HMAC-SHA256 | contract-signed 1개 | `X-Signature`, `X-Timestamp` |

### 공통 특성

- 모든 요청에 `eventId` (UUID v4) 자동 포함 → **CRM에서 중복 수신 방지를 위한 멱등성 키로 사용**
- 타임아웃: Bearer 요청 5초 / ContractSigned 8초
- 호스트 화이트리스트: `mabizcruisedot.com`, `mabiz.vercel.app`, `localhost` (GMcruise 측 URL 검증)

---

## 2. 공통 헤더 (Bearer 방식)

```
POST {MABIZ_*_WEBHOOK_URL}
Content-Type: application/json
Authorization: Bearer {MABIZ_*_WEBHOOK_SECRET}
X-Event-Id: {UUID}   ← eventId는 body에도 포함됨 (중복 체크용)
```

> **구현 권장사항**: CRM 수신 엔드포인트는 `Authorization` 헤더를 먼저 검증한 뒤 `eventId`로 중복 수신 여부를 확인하세요. 동일 `eventId`가 재수신되면 HTTP 200을 반환하되 실제 처리는 건너뜁니다(멱등성).

---

## 3. 이벤트별 상세 명세

### 이벤트 1 — 결제 완료 (Purchase)

**트리거**: 결제 PG 웹훅 수신 후 `AffiliateSale` 레코드 생성 완료 시  
**호출 파일**: `app/api/payment/webhook/route.ts` (L904–L913)  
**함수**: `syncPurchaseToMabiz()`  
**재시도**: 1회 (실패 시 DLQ 적재)  
**환경변수**:

| 변수명 | 설명 |
|--------|------|
| `MABIZ_PURCHASE_WEBHOOK_URL` | CRM 수신 엔드포인트 URL |
| `MABIZ_PURCHASE_WEBHOOK_SECRET` | Bearer 토큰 값 |

**Payload**:

```json
{
  "phone": "01012345678",
  "name": "홍길동",
  "productName": "로열캐리비안 7박 지중해",
  "departureDate": "2024-03-15T00:00:00.000Z",
  "orderId": "ORDER-550e8400-e29b-41d4-a716",
  "affiliateCode": "ABCD",
  "cabinType": "인사이드",
  "eventId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**필드 설명**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `phone` | string | 필수 | 숫자만 (`01012345678` 형식, 하이픈 없음) |
| `name` | string | 필수 | 고객 이름 |
| `productName` | string | 선택 | 크루즈 상품명 |
| `departureDate` | string \| null | 선택 | ISO 8601 형식 또는 null |
| `orderId` | string | 선택 | 주문 UUID (`merchant_uid`) |
| `affiliateCode` | string \| null | 선택 | 공유링크 파트너 코드. 직접 판매면 null |
| `cabinType` | string \| null | 선택 | 객실 타입 (인사이드/오션뷰/발코니/스위트) |
| `eventId` | string | 필수 | UUID v4 — 멱등성 키 |

---

### 이벤트 2 — 환불 처리 (Refund)

**트리거 경로 2가지**:

1. **판매 건별 환불**: `app/api/admin/affiliate/sales/[saleId]/refund/route.ts` — 관리자가 어필리에이트 판매 건을 직접 환불 처리  
2. **결제 건 직접 환불**: `app/api/admin/refund/route.ts` — 관리자가 Payment ID로 환불 처리

두 경로 모두 동일한 `syncRefundToMabiz()` 함수를 호출합니다.

**재시도**: 1회 (실패 시 DLQ 적재)  
**환경변수**:

| 변수명 | 설명 |
|--------|------|
| `MABIZ_REFUND_WEBHOOK_URL` | CRM 수신 엔드포인트 URL |
| `MABIZ_REFUND_WEBHOOK_SECRET` | Bearer 토큰 값 |

**Payload**:

```json
{
  "orderId": "ORDER-550e8400-e29b-41d4-a716",
  "saleId": 123,
  "amount": 500000,
  "reason": "고객 요청",
  "refundedAt": "2024-03-15T09:00:00.000Z",
  "eventId": "550e8400-e29b-41d4-a716-446655440001"
}
```

**필드 설명**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `orderId` | string | 필수 | 원래 결제 주문 ID |
| `saleId` | number \| null | 선택 | GMcruise AffiliateSale PK. 결제 건 직접 환불 시 null 가능 |
| `amount` | number | 필수 | 환불 금액 (원화, 정수) |
| `reason` | string | 선택 | 환불 사유 (관리자 입력) |
| `refundedAt` | string | 필수 | ISO 8601 형식 환불 완료 시각 |
| `eventId` | string | 필수 | UUID v4 — 멱등성 키 |

> **참고**: GMcruise에서 PG(웰컴페이먼츠) 취소는 수동 처리 정책입니다. 이 웹훅은 CRM 상태 동기화 목적이며, PG 취소 완료 여부와 무관하게 전송됩니다.

---

### 이벤트 3 — 일반 상품 문의 (Inquiry)

**트리거**: 크루즈닷몰 상품 상세 페이지의 문의 폼 제출 시 (`productCode != 'GOLD_MEMBERSHIP'`)  
**호출 파일**: `app/api/public/inquiry/route.ts` (L332–L345)  
**함수**: `syncInquiryToMabiz()`  
**재시도**: 1회 (실패 시 DLQ 적재)  
**환경변수**:

| 변수명 | 설명 |
|--------|------|
| `MABIZ_INQUIRY_WEBHOOK_URL` | CRM 수신 엔드포인트 URL |
| `MABIZ_INQUIRY_WEBHOOK_SECRET` | Bearer 토큰 값 |

**Payload**:

```json
{
  "name": "홍길동",
  "phone": "01012345678",
  "message": "이 상품 문의드립니다.",
  "productCode": "RC-2024-001",
  "productName": "로열캐리비안 7박 지중해",
  "affiliateCode": "ABCD",
  "inquiryId": 456,
  "eventId": "550e8400-e29b-41d4-a716-446655440002"
}
```

**필드 설명**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | 필수 | 문의자 이름 |
| `phone` | string | 필수 | 숫자만 (`01012345678` 형식) |
| `message` | string \| null | 선택 | 문의 내용 |
| `productCode` | string | 필수 | GMcruise 상품 코드 |
| `productName` | string | 선택 | 상품명 |
| `affiliateCode` | string \| null | 선택 | 공유링크 파트너 코드 |
| `inquiryId` | number | 필수 | GMcruise ProductInquiry PK |
| `eventId` | string | 필수 | UUID v4 — 멱등성 키 |

---

### 이벤트 4 — 골드회원 문의 (GoldInquiry)

**트리거**: 크루즈닷몰 골드회원 상품(`GOLD_MEMBERSHIP`) 문의 폼 제출 시  
**호출 파일**: `app/api/public/inquiry/route.ts` (L316–L330)  
**함수**: `syncGoldInquiryToMabiz()`  
**재시도**: **3회** (Exponential Backoff: 1s → 2s → 4s) — 파트너 귀속 누락 방지를 위해 일반 문의보다 높은 신뢰성 적용  
**환경변수**:

| 변수명 | 설명 |
|--------|------|
| `MABIZ_GOLD_INQUIRY_WEBHOOK_URL` | CRM 수신 엔드포인트 URL |
| `MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET` | Bearer 토큰 값 |

**Payload**:

```json
{
  "name": "홍길동",
  "phone": "01012345678",
  "message": "골드 멤버십 문의드립니다.",
  "inquiryId": 789,
  "affiliateCode": "ABCD",
  "affiliateMallUserId": "pre_XY1234",
  "managerId": 10,
  "agentId": 20,
  "eventId": "550e8400-e29b-41d4-a716-446655440003"
}
```

**필드 설명**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | 필수 | 문의자 이름 |
| `phone` | string | 필수 | 숫자만 (`01012345678` 형식) |
| `message` | string \| null | 선택 | 문의 내용 |
| `inquiryId` | number | 필수 | GMcruise ProductInquiry PK |
| `affiliateCode` | string \| null | 선택 | 공유링크 파트너 코드 |
| `affiliateMallUserId` | string \| null | 선택 | mabiz Mall 유저 ID (예: `pre_XY1234`) |
| `managerId` | number \| null | 선택 | GMcruise AffiliateProfile PK (대리점장) |
| `agentId` | number \| null | 선택 | GMcruise AffiliateProfile PK (판매원) |
| `eventId` | string | 필수 | UUID v4 — 멱등성 키 |

> **중요**: `affiliateMallUserId`가 `pre_`로 시작하면 프리마케터(프리세일즈)입니다. CRM에서 별도 그룹으로 처리가 필요한 경우 이 접두사로 구분하세요.

---

### 이벤트 5 — 파트너 계약 완료 (PartnerSignup)

**트리거**: 관리자가 `affiliate/contracts/[contractId]/complete` 처리 완료 시  
**호출 파일**: `app/api/admin/affiliate/contracts/[contractId]/complete/route.ts` (L129–L134)  
**함수**: `syncPartnerSignupToMabiz()`  
**재시도**: 1회 (실패 시 DLQ 적재)  
**환경변수**:

| 변수명 | 설명 |
|--------|------|
| `MABIZ_PARTNER_SIGNUP_WEBHOOK_URL` | CRM 수신 엔드포인트 URL |
| `MABIZ_PARTNER_SIGNUP_WEBHOOK_SECRET` | Bearer 토큰 값 |

**Payload**:

```json
{
  "mallUserId": "pre_XY1234",
  "name": "홍길동",
  "phone": "01012345678",
  "affiliateType": "BRANCH_MANAGER",
  "affiliateCode": "ABCD",
  "eventId": "550e8400-e29b-41d4-a716-446655440004"
}
```

**필드 설명**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `mallUserId` | string \| null | 선택 | mabiz Mall 유저 ID (계약 시 미할당이면 null) |
| `name` | string | 필수 | 파트너 이름 |
| `phone` | string \| null | 선택 | 파트너 전화번호 |
| `affiliateType` | string | 필수 | `BRANCH_MANAGER` \| `SALES_AGENT` \| `PRESALES` \| `HQ` |
| `affiliateCode` | string \| null | 선택 | 공유링크 파트너 코드 |
| `eventId` | string | 필수 | UUID v4 — 멱등성 키 |

---

### 이벤트 6 — 계약서 전자서명 완료 (ContractSigned)

> ⚠️ **인증 방식이 다릅니다.** Bearer Token 대신 HMAC-SHA256 서명을 사용합니다.

**트리거**: 파트너가 전자계약서에 서명 완료 시  
**호출 파일**: `app/api/affiliate/contract/sign/route.ts` (L273–L280)  
**함수**: `notifyMabizContractSigned()`  
**URL**: `https://mabizcruisedot.com/api/webhooks/gmcruise/contract-signed` (하드코딩)  
**재시도**: **3회** (Exponential Backoff: 1s → 2s → 4s)  
**환경변수**:

| 변수명 | 설명 |
|--------|------|
| `PARTNER_CONTRACT_WEBHOOK_SECRET` | HMAC 서명 키 (Bearer secret과 별개) |

#### HMAC-SHA256 서명 방식

GMcruise 송신 측 코드 (`lib/mabiz-sync.ts`, L257–L267):

```typescript
function signContractWebhook(body: string, secret: string): Record<string, string> {
  const timestamp = Date.now().toString(); // Unix timestamp (밀리초)
  const signature = 'sha256=' + createHmac('sha256', secret)
    .update(Buffer.from(body))             // body 전체를 그대로 사용 (timestamp 미포함)
    .digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-Signature': signature,             // 예: "sha256=abc123..."
    'X-Timestamp': timestamp,             // 예: "1715420400000"
  };
}
```

> **주의**: 서명 대상은 `body` 단독입니다. `timestamp + "." + body` 형식이 아닙니다. CRM 수신 측에서 서명을 재현할 때 동일하게 body 단독으로 HMAC을 계산해야 합니다.

#### CRM 수신 측 검증 절차

```
1. X-Signature 헤더에서 "sha256=" 접두사 제거
2. HMAC-SHA256(PARTNER_CONTRACT_WEBHOOK_SECRET, raw_body_bytes) 계산
3. 계산값(hex) == 수신값(hex) 비교 (타이밍 공격 방지: 상수시간 비교 사용)
4. X-Timestamp로 재전송 공격 방지: |now_ms - timestamp_ms| > 300_000 이면 거부
```

**Request Headers**:

```
Content-Type: application/json
X-Signature: sha256=a1b2c3d4e5f6...
X-Timestamp: 1715420400000
```

**Payload** (`eventId` 없음 — ContractSigned 전용 함수는 eventId를 포함하지 않습니다):

```json
{
  "contractRef": "12345",
  "ownerName": "홍길동",
  "ownerPhone": "01012345678",
  "ownerEmail": "hong@example.com",
  "orgName": "홍길동 대리점",
  "signedAt": "2024-03-15T09:00:00.000Z"
}
```

**필드 설명**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `contractRef` | string | 필수 | GMcruise 계약 DB PK (문자열 변환). 중복 방지용 고유 키 |
| `ownerName` | string | 필수 | 대리점장 이름 |
| `ownerPhone` | string | 필수 | 대리점장 전화번호 |
| `ownerEmail` | string | 선택 | 이메일 (있으면 CRM 초대 이메일 발송 트리거) |
| `orgName` | string | 필수 | 대리점명 |
| `signedAt` | string | 필수 | 서명 완료 시각 ISO 8601 |

> **순서 주의**: ContractSigned(이벤트 6, 전자서명 완료) → PartnerSignup(이벤트 5, 관리자 계약 처리 완료) 순서로 두 이벤트가 연속 발생할 수 있습니다. CRM에서 `contractRef`를 기준으로 중복 처리하세요.

---

### 이벤트 7 — 뉴스 발행 (News create)

**트리거**: 관리자가 크루즈닷 뉴스를 발행할 때  
**호출 파일**: `app/api/admin/cruisedot-news/publish/route.ts` (L324–L328)  
**함수**: `syncNewsToMabiz({ action: 'create', ... })`  
**재시도**: 1회 (실패 시 DLQ 적재)  
**환경변수**:

| 변수명 | 설명 |
|--------|------|
| `MABIZ_NEWS_WEBHOOK_URL` | CRM 수신 엔드포인트 URL |
| `MABIZ_NEWS_WEBHOOK_SECRET` | Bearer 토큰 값 |

**Payload**:

```json
{
  "action": "create",
  "shortCode": "NEWS-abc123",
  "title": "2024 지중해 크루즈 특가 안내",
  "url": "https://cruisedot.com/news/abc123",
  "eventId": "550e8400-e29b-41d4-a716-446655440006"
}
```

---

### 이벤트 8 — 뉴스 비활성화 (News deactivate)

**트리거**: 관리자가 크루즈닷 뉴스를 비활성화(삭제)할 때  
**호출 파일**: `app/api/admin/cruisedot-news/publish/route.ts` (L366–L369)  
**함수**: `syncNewsToMabiz({ action: 'deactivate', ... })`  
**재시도**: 1회 (실패 시 DLQ 적재)  
**환경변수**: 이벤트 7과 동일 (`MABIZ_NEWS_WEBHOOK_URL` / `MABIZ_NEWS_WEBHOOK_SECRET`)

**Payload**:

```json
{
  "action": "deactivate",
  "shortCode": "NEWS-abc123",
  "eventId": "550e8400-e29b-41d4-a716-446655440007"
}
```

**News 공통 필드 설명**:

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `action` | `"create"` \| `"deactivate"` | 필수 | 발행 또는 비활성화 |
| `shortCode` | string | 필수 | 뉴스 slug / 고유 코드. 중복 방지용 키 |
| `title` | string | `create` 시 전송 | 뉴스 제목 |
| `url` | string | `create` 시 전송 | 발행된 뉴스 URL |
| `eventId` | string | 필수 | UUID v4 — 멱등성 키 |

---

## 4. 실패 처리 — Dead Letter Queue (DLQ)

### DLQ 적재 조건

모든 재시도 소진 후 최종 전송 실패 시 `MabizSyncDLQ` 테이블에 자동 적재됩니다.

### MabizSyncDLQ 테이블 스키마

```sql
CREATE TABLE "MabizSyncDLQ" (
  "id"            SERIAL PRIMARY KEY,
  "syncType"      VARCHAR(50) NOT NULL,   -- 이벤트 유형 (아래 참고)
  "payload"       JSONB NOT NULL,          -- 원본 전송 payload
  "webhookUrl"    TEXT NOT NULL,           -- 전송 대상 URL
  "failureReason" TEXT,                   -- 실패 원인
  "retryCount"    INTEGER DEFAULT 0,
  "nextRetryAt"   TIMESTAMPTZ NOT NULL,   -- 다음 재시도 예정 시각
  "resolvedAt"    TIMESTAMPTZ,            -- 처리 완료 시각 (Cron이 성공 후 기록)
  "createdAt"     TIMESTAMPTZ DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL
);
```

### syncType 값 목록

| syncType | 이벤트 |
|----------|--------|
| `Purchase` | 결제 완료 |
| `Refund` | 환불 처리 |
| `Inquiry` | 일반 상품 문의 |
| `GoldInquiry` | 골드회원 문의 |
| `PartnerSignup` | 파트너 계약 완료 |
| `News` | 뉴스 발행/비활성화 |
| `ContractSigned` | 계약서 전자서명 완료 |

### DLQ 재시도 프로세스

```
최종 실패 감지
  └─ MabizSyncDLQ 레코드 생성 (nextRetryAt = now + 5분)
       └─ Cron Job (5분 주기) — MabizSyncDLQ에서 nextRetryAt <= now 레코드 조회
            ├─ 전송 성공 → resolvedAt 기록
            └─ 전송 실패 → retryCount 증가 + nextRetryAt 갱신 (지수 백오프)
```

> **CRM 개발자 참고**: DLQ 재시도 전송에도 동일한 Bearer 인증과 동일한 `eventId`가 포함됩니다. `eventId`로 멱등성을 보장하면 중복 처리 문제가 없습니다.

---

## 5. CRM 수신 엔드포인트 구현 가이드

### 권장 응답 코드

| 상황 | HTTP 응답 코드 |
|------|--------------|
| 정상 처리 완료 | `200 OK` |
| 동일 eventId 중복 수신 | `200 OK` (실제 처리 건너뜀) |
| 인증 실패 (Bearer/HMAC 불일치) | `401 Unauthorized` |
| Payload 형식 오류 | `400 Bad Request` |
| CRM 내부 오류 | `500 Internal Server Error` |

> GMcruise는 `res.ok` (HTTP 200–299)이면 성공으로 간주합니다. 4xx/5xx는 모두 실패로 처리되어 재시도 또는 DLQ 적재로 이어집니다.

### 멱등성 처리 (필수 구현)

```
1. 수신된 eventId를 DB에 기록 (예: webhook_events 테이블)
2. 동일 eventId 재수신 시 → 200 반환, DB 기록 없이 종료
3. 신규 eventId → 정상 처리 후 eventId 기록
```

### Bearer 인증 검증 (의사 코드)

```
received_token = Authorization 헤더에서 "Bearer " 제거
expected_token = 환경변수에서 로드한 secret

// 타이밍 공격 방지: 상수시간 비교 사용
if !constant_time_equal(received_token, expected_token):
  return 401
```

---

## 6. 미연결 이벤트 (향후 연동 예정)

현재 GMcruise에서 구현되어 있으나 CRM 웹훅 연결이 없는 이벤트입니다. 향후 연동 우선순위 논의 시 참고하세요.

| 이벤트 | 발생 시점 | 현황 |
|--------|----------|------|
| Reservation 생성 | 결제 완료 후 예약 레코드 자동 생성 | GMcruise DB에만 기록, CRM 전송 없음 |
| AffiliateLead 상태 변경 | 리드 → 상담중 → 계약 → 구매 | GMcruise 내부에서만 관리 |
| PNR / 여권 등록 완료 | 고객이 여권/PNR 정보 입력 시 | CRM 웹훅 미구현 |
| Payment 실패 | PG 결제 실패 | CRM 알림 없음 |
| 자동 환불 실패 | Reservation 생성 실패로 인한 자동 환불 시도 실패 | 관리자 수동 처리, CRM 알림 없음 |

---

## 7. CRM → GMcruise 역방향 DB 쓰기 허용 범위

GMcruise와 mabiz-CRM은 동일한 Neon PostgreSQL DB를 공유합니다. CRM에서 GMcruise 테이블에 직접 접근할 때 아래 범위를 반드시 준수하세요.

> **공유 DB 금지 사항**: `prisma migrate`, `prisma db push`, `DROP TABLE`, `ALTER TABLE`은 CRM 측에서 절대 실행 금지입니다. 스키마 변경 권한은 GMcruise 측에만 있습니다.

### 쓰기 허용 테이블 및 컬럼

| 테이블 | 허용 작업 | 허용 컬럼 | 제약 |
|--------|----------|----------|------|
| `AffiliateSale` | UPDATE | `status` | 허용값: `APPROVED`, `REJECTED`, `REFUNDED` |
| `ProductInquiry` | UPDATE | `status` | 허용값: CRM에서 정의된 상태값 |
| `SystemConfig` | INSERT / UPDATE | `configKey`, `configValue` | `configKey`는 반드시 CRM 전용 네임스페이스 접두사 포함 (예: `crm.xxx`) |

### 읽기 전용 테이블 (쓰기 금지)

`AffiliateSale`(status 외 컬럼), `AffiliateLead`, `AffiliateProfile`, `User`, `Payment`, `Reservation`, `Trip`, `Traveler`, `CruiseProduct`, `CommissionLedger`, `MabizSyncDLQ`, 그 외 모든 테이블

### SystemConfig 네임스페이스 규칙

```sql
-- CRM에서 쓸 수 있는 예시
INSERT INTO "SystemConfig" ("configKey", "configValue", "updatedAt")
VALUES ('crm.lastSyncAt', '"2024-03-15T09:00:00.000Z"', now())
ON CONFLICT ("configKey") DO UPDATE SET "configValue" = EXCLUDED."configValue";

-- 금지 — GMcruise 네임스페이스 침범
UPDATE "SystemConfig" SET "configValue" = '...' WHERE "configKey" = 'site.maintenanceMode';
```

---

## 8. 환경변수 전체 목록

GMcruise Vercel 환경변수에 설정된 항목입니다. CRM 개발자는 이 값들의 수신 측(CRM 서버)에 동일한 값을 설정해야 합니다.

| 환경변수 | 용도 | 인증 방식 |
|---------|------|----------|
| `MABIZ_PURCHASE_WEBHOOK_URL` | 결제 완료 수신 URL | Bearer |
| `MABIZ_PURCHASE_WEBHOOK_SECRET` | 결제 완료 Bearer 토큰 | Bearer |
| `MABIZ_REFUND_WEBHOOK_URL` | 환불 수신 URL | Bearer |
| `MABIZ_REFUND_WEBHOOK_SECRET` | 환불 Bearer 토큰 | Bearer |
| `MABIZ_INQUIRY_WEBHOOK_URL` | 일반 문의 수신 URL | Bearer |
| `MABIZ_INQUIRY_WEBHOOK_SECRET` | 일반 문의 Bearer 토큰 | Bearer |
| `MABIZ_GOLD_INQUIRY_WEBHOOK_URL` | 골드 문의 수신 URL | Bearer |
| `MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET` | 골드 문의 Bearer 토큰 | Bearer |
| `MABIZ_PARTNER_SIGNUP_WEBHOOK_URL` | 파트너 가입 수신 URL | Bearer |
| `MABIZ_PARTNER_SIGNUP_WEBHOOK_SECRET` | 파트너 가입 Bearer 토큰 | Bearer |
| `MABIZ_NEWS_WEBHOOK_URL` | 뉴스 동기화 수신 URL | Bearer |
| `MABIZ_NEWS_WEBHOOK_SECRET` | 뉴스 동기화 Bearer 토큰 | Bearer |
| `PARTNER_CONTRACT_WEBHOOK_SECRET` | 전자서명 HMAC 키 | HMAC-SHA256 |

> `PARTNER_CONTRACT_WEBHOOK_SECRET`의 전송 URL은 `https://mabizcruisedot.com/api/webhooks/gmcruise/contract-signed`로 하드코딩되어 있습니다. URL 환경변수가 없습니다.

---

## 9. 빠른 구현 체크리스트

CRM 개발자가 연동을 완료하기 위해 구현해야 할 항목입니다.

```
[ ] Bearer 인증 미들웨어 구현 (7개 이벤트 공용)
[ ] HMAC-SHA256 검증 미들웨어 구현 (ContractSigned 전용)
[ ] eventId 멱등성 테이블 생성 및 검사 로직 구현
[ ] X-Timestamp 유효성 검사 구현 (5분 허용, ContractSigned)
[ ] Purchase 수신 엔드포인트 구현
[ ] Refund 수신 엔드포인트 구현
[ ] Inquiry 수신 엔드포인트 구현
[ ] GoldInquiry 수신 엔드포인트 구현 (골드 그룹 자동 배정 로직 포함)
[ ] PartnerSignup 수신 엔드포인트 구현
[ ] ContractSigned 수신 엔드포인트 구현 (대리점 자동 생성 로직 포함)
[ ] News (create/deactivate) 수신 엔드포인트 구현
[ ] 모든 엔드포인트에서 200 외 응답 코드를 올바르게 반환하는지 확인
[ ] GMcruise AffiliateSale.status, ProductInquiry.status 업데이트 로직 구현
[ ] SystemConfig 쓰기 시 crm.* 네임스페이스 준수 확인
```
