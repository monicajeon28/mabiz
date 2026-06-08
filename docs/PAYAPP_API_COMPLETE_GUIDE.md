# PayApp API 완전 연동 가이드 (마비즈 CRM)

## 1. 기본 개요

### 1.1 PayApp이란?
PayApp은 한국의 중소 사업자/크루즈 업체를 위한 **결제 게이트웨이 서비스**입니다. 신용카드, 휴대폰 결제, 간편결제(카카오페이, 네이버페이), 가상계좌 등 다양한 결제수단을 통합 지원합니다.

마비즈 CRM에서는 **B2B 결제 전용**(크루즈 여행 상품 결제)으로 사용되며, 별도의 크루즈닷몰(B2C) 결제 시스템과 완전 분리되어 있습니다.

**핵심 특징:**
- FORM POST 방식 (JSON 미지원)
- 응답 형식: `KEY=VALUE` Query String
- 웹훅 기반 결제 통보 (Webhook FeedbackURL)
- 결제 요청 시 `mulNo` 반환 → 추후 취소/환불 시 필수
- HMAC-SHA256 기반 무결성 검증 지원

### 1.2 인증 방식

#### 환경변수 (필수 3가지)
```
PAYAPP_USERID = "mabiz" (또는 할당받은 사업자ID)
PAYAPP_LINKKEY = "..." (HMAC 검증용 비밀키)
PAYAPP_LINKVAL = "..." (웹훅 linkval 파라미터 — 환경변수 일치 시에만 수락)
```

#### Bearer Token (선택)
웹훅 요청에 추가 보안 계층 필요 시:
```
PAYAPP_WEBHOOK_TOKEN = "32자 이상의 강력한 토큰"
Authorization: Bearer <PAYAPP_WEBHOOK_TOKEN>
```

### 1.3 보안 가이드

| 계층 | 검증 방식 | 필수 여부 | 환경변수 |
|------|---------|---------|---------|
| **네트워크** | IP 화이트리스트 | 선택 | PAYAPP_ALLOWED_IPS |
| **앱 수준** | linkval 검증 | **필수** | PAYAPP_LINKVAL |
| **요청 무결성** | HMAC-SHA256 | **필수** | PAYAPP_LINKKEY |
| **인증** | Bearer Token | 선택 | PAYAPP_WEBHOOK_TOKEN |

**보안 최소 기준:**
- [ ] linkval 환경변수 설정 및 웹훅 검증
- [ ] HMAC-SHA256 검증 활성화 (PAYAPP_LINKKEY 필수)
- [ ] DLQ(Dead Letter Queue)에 웹훅 실패 기록
- [ ] 민감정보(전화번호, 주문번호) 마스킹 로깅

---

## 2. 결제 요청 API

### 2.1 일반 결제 (일회성)

#### 엔드포인트
```
POST /api/payapp/request
Content-Type: application/json
```

#### 요청 파라미터
```json
{
  "type": "onetime",
  "goodname": "설악산 4박5일 크루즈",
  "price": 2980000,
  "customerName": "이순신",
  "customerPhone": "01012345678",
  "customerEmail": "lee@example.com",
  "landingPageId": "lp_001"
}
```

| 필드 | 타입 | 설명 | 제약사항 |
|------|------|------|---------|
| `type` | string | 결제 유형: `"onetime"` 또는 `"subscription"` | 기본값: "onetime" |
| `goodname` | string | 상품명 (결제 내역서에 표시) | 필수, 최대 100자 |
| `price` | number | 결제 금액 (원) | 필수, 100 이상, 1억 이하 |
| `customerName` | string | 구매자 이름 | 필수, 최대 20자 |
| `customerPhone` | string | 구매자 전화번호 | 필수, 숫자만 (하이픈 자동 제거) |
| `customerEmail` | string | 구매자 이메일 | 선택 |
| `landingPageId` | string | 랜딩페이지 ID (추적용) | 선택 |

#### 응답 (성공)
```json
{
  "ok": true,
  "type": "onetime",
  "orderId": "pay_mabiz00_1685123456789",
  "payUrl": "https://payapp.kr/payment?key=abc123..."
}
```

**클라이언트 처리:**
```typescript
// 1. 응답에서 payUrl 획득
const { payUrl } = response;

// 2. 새 탭으로 결제 페이지 열기 (팝업 차단 회피)
window.open(payUrl, '_blank', 'width=450,height=650');

// 3. 또는 리다이렉트
window.location.href = payUrl;
```

#### 응답 (실패)
```json
{
  "ok": false,
  "message": "환경변수 오류" 또는 "PayApp API 오류"
}
```

### 2.2 데이터베이스 자동 저장

결제 요청 성공 시 **PayAppPayment** 테이블에 자동 저장:
```sql
INSERT INTO PayAppPayment (
  orderId,           -- "pay_mabiz00_1685123456789"
  organizationId,    -- 조직 ID (auth context에서)
  amount,            -- 원금 (취소 검증용)
  customerName,
  customerPhone,
  customerEmail,
  productName,
  mulNo,             -- PayApp에서 반환한 결제 번호
  status,            -- "pending" (결제 완료까지)
  landingPageId,     -- 추적용
  createdAt
)
```

### 2.3 returnUrl 화이트리스트

결제 완료 후 사용자가 돌아올 수 있는 도메인:
```typescript
const ALLOWED_COMPLETION_DOMAINS = [
  'mabizcruisedot.com',
  'cruisedot.co.kr',
  'localhost:3000', // 개발 환경
];
```

**요청 시 returnUrl 예시:**
```
returnUrl=https://mabizcruisedot.com/payment-complete?orderId=pay_mabiz00_1685123456789
```

### 2.4 payUrl 검증

PayApp 응답의 `payUrl`은 반드시 `https://payapp.kr` 도메인이어야 합니다:
```typescript
if (!result.payUrl?.startsWith('https://payapp.kr')) {
  logger.warn('[PayApp] 의심 payUrl', { payUrl: result.payUrl });
  return NextResponse.json({ ok: false }, { status: 502 });
}
```

---

## 3. 결제통보 (Webhook)

### 3.1 HMAC 필수 검증

PayApp의 가장 중요한 보안 메커니즘은 **HMAC-SHA256** 무결성 검증입니다.

#### HMAC 계산 방식

PayApp이 요청을 보낼 때:
1. 모든 파라미터를 **알파벳순으로 정렬**
2. `KEY=VALUE` 형식으로 `&` 연결
3. HMAC-SHA256(정렬된 문자, PAYAPP_LINKKEY) 계산
4. 결과 16진수를 요청 본문에 `hmac` 파라미터로 포함

**예시:**
```
파라미터: {
  mul_no: "12345",
  order_id: "pay_mabiz_001",
  pay_state: "4",
  price: "100000"
}

정렬: order_id=pay_mabiz_001&mul_no=12345&pay_state=4&price=100000

HMAC: createHmac('sha256', linkkey)
      .update(정렬된문자)
      .digest('hex')
      // → "a1b2c3d4e5f6..."
```

#### TypeScript 검증 구현
```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export function validateFeedbackWithHMAC(
  params: Record<string, string>,
  receivedHmac: string
): boolean {
  const linkkey = process.env.PAYAPP_LINKKEY;
  if (!linkkey) {
    logger.error('[PayApp] PAYAPP_LINKKEY 미설정');
    return false;
  }

  // 1. HMAC 제외 파라미터만 정렬
  const sorted = Object.entries(params)
    .filter(([k]) => k !== 'hmac')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  // 2. HMAC 계산
  const expected = createHmac('sha256', linkkey)
    .update(sorted)
    .digest('hex');

  // 3. Timing-Safe 비교 (타이밍 공격 방지)
  try {
    const eBuf = Buffer.from(expected, 'utf8');
    const rBuf = Buffer.from(receivedHmac, 'utf8');
    if (eBuf.length !== rBuf.length) return false;
    return timingSafeEqual(eBuf, rBuf);
  } catch {
    return false;
  }
}
```

### 3.2 linkval 검증 (필수)

HMAC 외에 추가 검증: `linkval` 파라미터가 환경변수와 일치하는지 확인합니다.

```typescript
export function validateFeedback(linkval: string): boolean {
  const config = getConfig(); // PAYAPP_LINKVAL 로드
  const a = Buffer.from(linkval || '', 'utf8');
  const b = Buffer.from(config.linkval || '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

**이유:**
- PayApp이 **환경변수를 알지 못하면 웹훅을 보낼 수 없도록** 강제
- HMAC은 요청 내용 검증, linkval은 출처 검증

### 3.3 Bearer Token 검증 (선택)

추가 인증 계층 필요 시:
```typescript
const payappToken = process.env.PAYAPP_WEBHOOK_TOKEN;
const authHeader = req.headers.get("authorization") ?? "";

if (payappToken) {
  // 헤더 누락 → 거절
  if (!authHeader) {
    return new Response("FAIL", { status: 401 });
  }

  // Bearer 형식 확인
  if (!authHeader.startsWith("Bearer ")) {
    return new Response("FAIL", { status: 401 });
  }

  // 토큰 길이 검증 (최소 32자, 강력한 토큰 강제)
  const token = authHeader.slice(7);
  if (token.length < 32) {
    return new Response("FAIL", { status: 403 });
  }

  // 토큰 일치 확인 (Timing-Safe)
  if (!timingSafeEqual(
    Buffer.from(token),
    Buffer.from(payappToken)
  )) {
    return new Response("FAIL", { status: 401 });
  }
}
```

### 3.4 웹훅 엔드포인트

```
POST /api/webhooks/payapp
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

**응답 (필수):**
```
SUCCESS
```

PayApp이 `SUCCESS` 텍스트를 수신하면 웹훅 완료로 처리합니다. 아닌 경우 최대 10회까지 재시도합니다.

### 3.5 민감정보 마스킹 (중요)

로깅에서 개인정보 보호:

```typescript
function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 4) return 'none';
  return `${phone.slice(0, 2)}***${phone.slice(-2)}`;
  // "01012345678" → "01***78"
}

function maskOrderId(orderId: string | null): string {
  if (!orderId || orderId.length < 6) return 'none';
  return `${orderId.slice(0, 3)}***${orderId.slice(-3)}`;
  // "pay_mabiz_123456" → "pay***456"
}

// DLQ 저장 시에도 적용
const maskedPayload = {
  ...payloadObj,
  recvphone: maskPhone(payloadObj.recvphone),
  var1: maskOrderId(payloadObj.var1), // orderId
};
```

### 3.6 pay_state 코드 해석

PayApp 웹훅의 `pay_state` 파라미터:

| pay_state | 상태 | 설명 |
|----------|------|------|
| `1` | `requested` | 결제 요청됨 (결제 페이지 로딩) |
| `4` | `paid` | ✅ **결제 완료** (가장 중요) |
| `8` | `cancelled` | 전체 취소 (요청 취소) |
| `9` | `cancelled` | 승인 취소 (PayApp 관리자) |
| `16` | `cancelled` | 요청 취소 |
| `32` | `cancelled` | 요청 취소 |
| `64` | `cancelled` | 승인 취소 |
| `10` | `waiting` | 🕐 가상계좌 입금 대기 |
| `70` | `partial_refunded` | 부분 환불됨 |
| `71` | `partial_refunded` | 부분 환불됨 |

### 3.7 pay_type 코드 해석

결제수단 분류:

| pay_type | 수단 | 현금 처리 |
|----------|------|---------|
| `1` | 신용카드 | ❌ |
| `2` | 휴대폰 | ✅ |
| `4` | Face (본인인증) | ❌ |
| `6` | 계좌이체 | ✅ |
| `7` | 가상계좌 | ✅ |
| `15` | 카카오페이 | ❌ |
| `16` | 네이버페이 | ❌ |
| `17` | 정기결제 | ❌ |
| `21` | 스마일페이 | ❌ |
| `23` | Apple Pay | ❌ |

**현금성 결제 판정:** `bank_transfer`, `virtual_account`, `phone` → 현금영수증 자동 발행

---

## 4. 결제 취소 API

### 4.1 전액 취소

결제 후 지정된 기간 내 즉시 취소 가능.

```typescript
export async function cancelPayment(params: {
  mulNo: string;              // PayApp 결제번호 (필수)
  cancelmemo: string;         // 취소 사유
  partcancel?: boolean;       // false = 전액취소
}): Promise<{ ok: boolean; error?: string }>
```

**요청 예시:**
```json
POST /api/payapp/refund
{
  "paymentId": "rec_123abc",
  "reason": "고객 요청"
}
```

**응답:**
```json
{
  "ok": true,
  "refundAmount": 2980000,
  "totalRefunded": 2980000
}
```

### 4.2 부분 취소

일부만 환불.

```typescript
export async function cancelPayment(params: {
  mulNo: string;
  cancelmemo: string;
  partcancel: true;           // 부분취소 활성화
  cancelprice: number;        // 환불할 금액
}): Promise<{ ok: boolean; error?: string }>
```

**요청 예시:**
```json
POST /api/payapp/refund
{
  "paymentId": "rec_123abc",
  "reason": "부분 환불",
  "partcancel": true,
  "cancelprice": 500000
}
```

**환불액 검증 (필수):**
```typescript
// P1-7: 환불액이 원금을 초과하면 거절
if (partialAmount > original.amount) {
  logger.warn('부분취소 환불액 > 원금', {
    originalAmount: original.amount,
    partialAmount,
  });
  return new Response('FAIL', { status: 400 });
}
```

### 4.3 D+5 경과 또는 정산 완료 후 취소

일정 기간 경과 후 특별 취소 API 사용:

```typescript
export async function requestCancelAfterSettlement(params: {
  mulNo: string;
  cancelmemo: string;
  dpname?: string;              // 입금 담당자명
  partcancel?: boolean;
  cancelprice?: number;
}): Promise<{ ok: boolean; error?: string }>
```

### 4.4 AffiliateSale 수당 취소 (자동)

결제 취소 시 어필리에이트 수당도 자동 취소:

```typescript
// 트랜잭션 내에서 원자적 처리
await prisma.$transaction(async (tx) => {
  // 1. PayAppPayment 상태 업데이트
  await tx.payAppPayment.updateMany({
    where: { orderId, status: { not: 'cancelled' } },
    data: {
      status: 'cancelled',
      refundedAt: new Date(),
    },
  });

  // 2. AffiliateSale 수당 취소 (100% 완전 취소)
  await tx.affiliateSale.update({
    where: { orderId },
    data: {
      commissionAmount: 0,      // ★ 수당 0으로 설정
      status: 'REFUNDED',
      cancelReason: 'PAYMENT_CANCELLED_PAYAPP',
    },
  });
});
```

---

## 5. 정기결제 (구독)

### 5.1 정기결제 등록

월 단위 반복 결제.

```typescript
export async function requestSubscription(params: {
  goodname: string;
  goodprice: number;
  recvphone: string;
  cycleDay: number;             // 매월 결제일 (1~31, 90=말일)
  expireDate: string;           // "yyyy-mm-dd"
  feedbackurl?: string;
  var1?: string;
  var2?: string;
  recvemail?: string;
  returnurl?: string;
}): Promise<{ ok: boolean; rebillNo?: string; payUrl?: string; error?: string }>
```

**요청 예시:**
```json
POST /api/payapp/request
{
  "type": "subscription",
  "goodname": "크루즈 월간 구독",
  "price": 99000,
  "customerName": "이순신",
  "customerPhone": "01012345678",
  "cycleDay": 15,
  "expireDate": "2025-12-31"
}
```

**응답:**
```json
{
  "ok": true,
  "type": "subscription",
  "subscriptionId": "sub_abc123",
  "payUrl": "https://payapp.kr/subscription?key=..."
}
```

### 5.2 정기결제 수명 관리

```typescript
// 일시정지
export async function pauseSubscription(rebillNo: string): Promise<{ ok: boolean; error?: string }>

// 재시작
export async function resumeSubscription(rebillNo: string): Promise<{ ok: boolean; error?: string }>

// 해지
export async function cancelSubscription(rebillNo: string): Promise<{ ok: boolean; error?: string }>
```

---

## 6. 현금영수증

### 6.1 자동 발행

결제 완료 시 **현금성 결제**(계좌이체, 가상계좌, 휴대폰)만 자동 발행:

```typescript
const cashPayTypes = ["bank_transfer", "virtual_account", "phone"];
if (cashPayTypes.includes(payType) && normalizedPhone && price > 0) {
  await issueCashReceipt({
    goodName: "크루즈 상품",
    buyerName: "이순신",
    buyerPhone: "01012345678",
    amount: 2980000,
  });
}
```

### 6.2 현금영수증 API

```typescript
export async function issueCashReceipt(params: {
  goodName: string;
  buyerName: string;
  buyerPhone: string;
  amount: number;
  tradTime?: string;           // "yyyyMMddHHmmss" (생략하면 현재시각)
  trCode?: '0' | '1';         // 0=소득공제, 1=지출증빙
}): Promise<{
  ok: boolean;
  cashstno?: string;
  cashsturl?: string;
  error?: string;
}>
```

**응답:**
```json
{
  "ok": true,
  "cashstno": "cs_12345",
  "cashsturl": "https://payapp.kr/cashreceipt/cs_12345"
}
```

### 6.3 현금영수증 취소

```typescript
export async function cancelCashReceipt(cashstno: string): Promise<{ ok: boolean; error?: string }>
```

### 6.4 VAT 자동 계산

현금영수증 발행 시 세금 자동 계산:
```typescript
const taxable = Math.round(amount / 1.1);  // 과세 금액
const vat = amount - taxable;               // 부가세
```

---

## 7. 회원 관리 API

### 7.1 회원 등록 (구독 전용)

정기결제 전에 고객을 회원으로 등록:

```
cmd=memberRegist
userid=<PAYAPP_USERID>
mem_id=<고객ID>
mem_name=<고객명>
mem_tel=<전화번호>
mem_email=<이메일>
```

### 7.2 회원 조회

```
cmd=memberSearch
userid=<PAYAPP_USERID>
mem_id=<고객ID>
```

---

## 8. 부계정 (SubMerchant) 관리

마비즈의 다중 조직 구조 지원:

```
cmd=subAccountRegist
userid=<PAYAPP_USERID>
sub_user_id=<부계정ID>
sub_user_name=<부계정명>
sub_user_tel=<전화번호>
```

**활용:**
- 어필리에이트별 독립 매출 추적
- 정산 자동화 (부계정별 수익 분리)

---

## 9. 앱 연동 (PayApp Mobile SDK)

웹뷰 기반 모바일 결제:

```
cmd=apppayment
userid=<PAYAPP_USERID>
goodname=<상품명>
price=<금액>
recvphone=<전화번호>
returnurl=<완료후돌아올페이지>
```

**응답:**
```
payurl=https://payapp.kr/apppayment?...
```

---

## 10. MCP (Multi Channel Payment)

여러 결제채널을 통합 관리하는 PayApp의 향상 기능:

```
cmd=mcppayment
userid=<PAYAPP_USERID>
channel=<채널코드>  # "kakao", "naver", "card" 등
...
```

---

## 11. 유캔사인 전자서명 통합

계약서 자동 서명:

```
cmd=esignRequest
userid=<PAYAPP_USERID>
document=<계약서PDF URL>
recvphone=<서명자전화번호>
```

**마비즈 활용:** 크루즈 상품 구매 계약서 자동 생성 + 전자서명

---

## 12. 블로그 페이

네이버 블로그에서 PayApp 결제 임베드:

```html
<script src="https://payapp.kr/plugin/blogpay.js"></script>
<div data-payapp-blog="true" data-product-id="..."></div>
```

---

## 13. API 응답 상태 코드

| state | 의미 |
|-------|------|
| `1` | ✅ 성공 |
| `0` | ❌ 실패 |
| `-1` | 오류 (errorMessage 참조) |

---

## 마비즈 아키텍처

### 13.1 결제 흐름 (5단계)

```
┌─────────────────────────────────────────┐
│ 1. 클라이언트 결제 요청                  │
│    POST /api/payapp/request              │
│    {goodname, price, customer...}       │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 2. 마비즈 서버: PayAppPayment 생성       │
│    status = "pending"                    │
│    (orderId, mulNo 저장)                 │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 3. PayApp API 호출 (payrequest)          │
│    응답: payUrl + mulNo                  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 4. 클라이언트: PayApp 결제 페이지        │
│    window.open(payUrl)                  │
│    (고객 카드번호 입력)                  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 5. PayApp → 마비즈 웹훅                  │
│    POST /api/webhooks/payapp             │
│    pay_state=4 (완료)                    │
│    HMAC + linkval 검증                   │
│    PayAppPayment.status = "paid"        │
│    Contact 자동 생성                     │
│    AffiliateSale.status = "COMPLETED"   │
└─────────────────────────────────────────┘
```

### 13.2 환불 흐름 (2단계)

```
┌──────────────────────────────────────────┐
│ 1. 마비즈 관리자 환불 요청                │
│    POST /api/payapp/refund               │
│    {paymentId, reason, partcancel?}     │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│ 2a. PayApp API (paycancel)               │
│     mulNo 기반 취소 요청                  │
│     응답: state=1 (성공)                 │
│                                          │
│ 2b. DB 트랜잭션 (원자적)                 │
│     - PayAppPayment: status="refunded"  │
│     - AffiliateSale: commissionAmount=0 │
│     - metadata: refund_history 추가      │
│     - Contact: 알림 생성                 │
└──────────────────────────────────────────┘
```

### 13.3 모니터링 체크리스트

배포 전 다음을 확인하세요:

- [ ] **환경변수:**
  - [ ] PAYAPP_USERID 설정
  - [ ] PAYAPP_LINKKEY 설정 (HMAC 검증용)
  - [ ] PAYAPP_LINKVAL 설정 (웹훅 인증용)
  - [ ] PAYAPP_WEBHOOK_TOKEN 설정 (선택, 권장)
  - [ ] PAYAPP_ALLOWED_IPS 설정 (선택)

- [ ] **웹훅 검증:**
  - [ ] linkval 검증 활성화
  - [ ] HMAC-SHA256 검증 활성화
  - [ ] Bearer Token 검증 활성화 (토큰 설정 시)
  - [ ] 요청 IP 로깅 (requestIP 저장)

- [ ] **데이터베이스:**
  - [ ] PayAppPayment 테이블 스키마 확인
  - [ ] AffiliateSale 테이블 FK 관계 확인 (orderId)
  - [ ] Contact 테이블 유니크 제약 (phone + organizationId)

- [ ] **보안:**
  - [ ] 민감정보 마스킹 로깅 (phone, orderId)
  - [ ] DLQ 구현 (웹훅 실패 추적)
  - [ ] Content-Length 제한 (1MB 이하)
  - [ ] User-Agent 길이 제한 (500자 이하)

- [ ] **에러 처리:**
  - [ ] PayApp API 오류 메시지 로깅
  - [ ] 웹훅 재시도 로직 (MAX_RETRIES)
  - [ ] 타이밍 공격 방지 (timingSafeEqual 사용)

- [ ] **테스트:**
  - [ ] 테스트 환경에서 결제 요청 테스트
  - [ ] 웹훅 검증 테스트 (curl -X POST)
  - [ ] 환불 프로세스 테스트
  - [ ] 부분 환불 테스트
  - [ ] AffiliateSale 수당 취소 확인

---

## 14. 문제 해결

### 오류: "PAYAPP_LINKKEY 미설정"
```
에러: [PayApp Webhook] PAYAPP_LINKKEY 미설정 — HMAC 검증 불가
해결:
1. .env.local에 PAYAPP_LINKKEY="..." 추가
2. 프로세스 재시작 (npm run dev)
3. 상태 코드 503 응답 → PayApp은 최대 10회 재시도
```

### 오류: "linkval 불일치"
```
에러: [PayApp Webhook] linkval 불일치
원인: 환경변수 PAYAPP_LINKVAL가 PayApp 설정과 다름
해결:
1. PayApp 관리자 페이지에서 linkval 값 확인
2. .env.local에 정확히 입력
3. 공백/줄바꿈 주의
```

### 오류: "HMAC 검증 실패"
```
에러: [PayApp Webhook] HMAC 검증 실패
원인:
1. 파라미터 정렬 실수
2. PAYAPP_LINKKEY 불일치
3. 웹훅 요청 변조 (네트워크 오류)

디버깅:
// 웹훅 본문 로깅 (마스킹 포함)
logger.log('[Debug] HMAC 수신:', {
  received: hmacValue,
  expected: expectedHmac,
  params: JSON.stringify(sorted),
});
```

### 오류: "결제 금액 불일치"
```
에러: [PayApp Webhook] 금액 불일치 — 위조 의심
원인: 요청 시 금액과 웹훅 전달 금액이 다름
해결:
1. 결제 요청 전 금액 재확인
2. 만약 정상이면 유가정보요청(variance) 처리
3. status=400 (요청 거절) → PayApp 재시도
```

---

## 15. 코드 예제 (TypeScript)

### 예제 1: 결제 요청

```typescript
// src/app/api/payapp/request/route.ts
import { NextResponse } from 'next/server';
import { requestPayment } from '@/lib/payapp';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const body = await req.json();

  const { payUrl, mulNo, ok } = await requestPayment({
    goodname: body.productName,
    price: body.amount,
    recvphone: body.customerPhone,
    feedbackurl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/payapp`,
    var1: body.orderId,
    recvemail: body.customerEmail,
  });

  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  // DB 저장
  await prisma.payAppPayment.create({
    data: {
      orderId: body.orderId,
      mulNo,
      amount: body.amount,
      customerPhone: body.customerPhone,
      customerName: body.customerName,
      status: 'pending',
    },
  });

  return NextResponse.json({ ok: true, payUrl });
}
```

### 예제 2: 웹훅 검증

```typescript
// src/app/api/webhooks/payapp/route.ts
import { NextResponse } from 'next/server';
import { validateFeedback, validateFeedbackWithHMAC } from '@/lib/payapp';

export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);

  // Step 1: linkval 검증
  const linkval = params.get('linkval');
  if (!validateFeedback(linkval)) {
    return new Response('FAIL', { status: 403 });
  }

  // Step 2: HMAC 검증
  const hmac = params.get('hmac');
  const paramsObj = Object.fromEntries(params.entries());
  if (!validateFeedbackWithHMAC(paramsObj, hmac!)) {
    return new Response('FAIL', { status: 403 });
  }

  // Step 3: 결제 처리
  const payState = params.get('pay_state');
  if (payState === '4') {
    // 결제 완료
    await prisma.payAppPayment.update({
      where: { orderId: params.get('var1')! },
      data: { status: 'paid', paidAt: new Date() },
    });
  }

  return new Response('SUCCESS');
}
```

### 예제 3: 환불 요청

```typescript
// src/app/api/payapp/refund/route.ts
import { cancelPayment } from '@/lib/payapp';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const body = await req.json();
  const { paymentId, reason, partcancel } = body;

  const payment = await prisma.payAppPayment.findUnique({
    where: { id: paymentId },
  });

  const result = await cancelPayment({
    mulNo: payment.mulNo,
    cancelmemo: reason,
    partcancel,
    cancelprice: partcancel ? body.amount : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  // DB 업데이트
  await prisma.payAppPayment.update({
    where: { id: paymentId },
    data: {
      status: partcancel ? 'partial_refunded' : 'refunded',
      refundedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
```

---

## 참고 자료

- **PayApp 공식:** https://api.payapp.kr/oapi/apiLoad.html
- **마비즈 구현:**
  - `/src/lib/payapp.ts` — API 클라이언트
  - `/src/app/api/payapp/` — 결제 엔드포인트
  - `/src/app/api/webhooks/payapp/route.ts` — 웹훅 핸들러
- **보안 참고:** `timingSafeEqual`, HMAC-SHA256, DLQ 패턴
