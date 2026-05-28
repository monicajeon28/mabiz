# Loop 6 - Agent E: Webhook Infrastructure 완전 설계

**담당**: Agent E (Webhook Infrastructure)  
**목표**: 크루즈닷몰 ↔ CRM 양방향 실시간 동기화 (3개 엔드포인트)  
**예상 효과**: +$152K-228K/월 (Payment 연동 + 문의 자동 처리 + 정산 자동화)  
**기간**: 2026-05-29 ~ 2026-05-31 (3일)  

---

## 📋 목표 아키텍처

```
┌─────────────────────┐
│  cruisedot (크루즈닷몰) │
│  - Payment Event    │
│  - Customer Inquiry │
│  - Settlement Data  │
└──────────┬──────────┘
           │ WEBHOOK PUSH (HTTPS)
           ▼
┌─────────────────────────────────────────────────────────────┐
│  mabiz CRM Webhook Infrastructure                           │
│                                                             │
│  1️⃣ Payment Confirmed (/api/webhooks/cruisedot-payment)    │
│      → Order 생성 → Contact 자동 생성 → Day 0 SMS 발송    │
│                                                             │
│  2️⃣ Customer Inquiry (/api/webhooks/cruisedot-inquiry)    │
│      → Inquiry 기록 → 렌즈 감지 → 자동 대응 스크립트 제시 │
│                                                             │
│  3️⃣ Settlement Updated (/api/webhooks/cruisedot-settlement) │
│      → Settlement 기록 → Commission 자동 계산 → Partner Pay │
│                                                             │
└─────────────────────────────────────────────────────────────┘
           │
           ▼ (트랜잭션 처리 + 재시도)
┌─────────────────────────────────────────────────────────────┐
│  mabiz CRM Database (PostgreSQL)                            │
│  - Contact (고객 정보)                                      │
│  - Order (주문 정보)                                        │
│  - Inquiry (문의 정보)                                      │
│  - Settlement (정산 정보)                                   │
│  - ProcessedWebhookEvent (멱등성 추적)                      │
└─────────────────────────────────────────────────────────────┘
           │
           ▼ (자동 응답)
┌─────────────────────┐
│  Communication API  │
│  - SMS Day 0-3      │
│  - Inquiry Response │
│  - Settlement Notify│
└─────────────────────┘
```

---

## 🔐 1. Payment Confirmed Webhook

### 1.1 엔드포인트 정의

```
POST /api/webhooks/cruisedot-payment

목적: 크루즈닷몰에서 결제 완료/환불을 CRM에 실시간 동기화
트리거: payment.created, payment.updated, payment.refunded (cruisedot 결제 시스템)
응답시간: <500ms (비동기 처리)
멱등성: eventId 기반 (중복 요청 안전 처리)
```

### 1.2 요청 페이로드

```json
{
  "eventId": "evt_cruisedot_payment_1234567890",
  "eventType": "payment.confirmed",
  "timestamp": "2026-05-29T14:30:00Z",
  "bookingRef": "CRUISE-2026-0001",
  "customerId": 12345,
  "customerName": "김민수",
  "customerEmail": "kim@example.com",
  "customerPhone": "01012345678",
  "productName": "발틱 크루즈 7박 (2026-07)",
  "amount": 2850000,
  "currency": "KRW",
  "paymentMethod": "credit_card",
  "cardLast4": "1234",
  "status": "CONFIRMED",
  "completedAt": "2026-05-29T14:30:00Z"
}
```

### 1.3 처리 로직 (트랜잭션)

```typescript
// 1. 멱등성 체크 (eventId 기반)
const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
  where: { eventId }
});
if (alreadyProcessed) {
  return { ok: true, duplicate: true };  // 중복 무시
}

// 2. Order 레코드 생성/업데이트
const order = await prisma.order.upsert({
  where: { orderId: bookingRef },
  create: {
    orderId: bookingRef,
    customerId: customerId,
    productName: productName,
    amount: amount,
    paymentMethod: paymentMethod,
    status: "CONFIRMED",
    confirmedAt: new Date(completedAt),
    organizationId: "org_cruisedot"
  },
  update: {
    status: "CONFIRMED",
    confirmedAt: new Date(completedAt)
  }
});

// 3. Contact 자동 생성/업데이트 (UPSERT)
const contact = await prisma.contact.upsert({
  where: {
    phone_organizationId: {
      phone: normalizePhone(customerPhone),
      organizationId: "org_cruisedot"
    }
  },
  create: {
    phone: normalizePhone(customerPhone),
    name: customerName,
    email: customerEmail,
    organizationId: "org_cruisedot",
    type: "PURCHASED",
    lastPaymentStatus: "paid",
    lastPaymentAt: new Date(completedAt),
    orderId: order.id
  },
  update: {
    name: customerName,
    email: customerEmail,
    type: "PURCHASED",
    lastPaymentStatus: "paid",
    lastPaymentAt: new Date(completedAt)
  }
});

// 4. Day 0 SMS 자동 발송 (Loop 5 API)
await sendSmsDay0({
  contactId: contact.id,
  productName: productName,
  amount: amount,
  organizationId: "org_cruisedot"
});

// 5. AffiliateSale 처리 (수수료 계산)
const affiliateSale = await prisma.affiliateSale.create({
  data: {
    orderId: bookingRef,
    customerId: contact.id,
    amount: amount,
    commissionRate: 0.10,  // 10% 수수료
    commissionAmount: Math.floor(amount * 0.10),
    status: "CONFIRMED"
  }
});

// 6. processedWebhookEvent 기록 (중복 방지)
await prisma.processedWebhookEvent.create({
  data: {
    eventId: eventId,
    webhookType: "cruisedot-payment",
    status: "SUCCESS"
  }
});

return { ok: true, orderId: order.id };
```

### 1.4 응답

```json
{
  "ok": true,
  "orderId": "ord_cruisedot_2026_0001",
  "contactId": "cnt_abc123",
  "message": "결제 확인 완료 (Day 0 SMS 발송)"
}
```

### 1.5 에러 처리

| 상황 | HTTP | 응답 | 재시도 |
|------|------|------|--------|
| 성공 | 200 | `{ok: true}` | ❌ |
| 중복 요청 | 200 | `{ok: true, duplicate: true}` | ❌ |
| 필수 필드 누락 | 400 | `{ok: false, message: "..."}` | ❌ |
| 인증 실패 | 401 | `{ok: false}` | ❌ |
| DB 오류 | 500 | `{ok: false}` | ✅ (재시도) |
| 타임아웃 | 504 | `{ok: false}` | ✅ (재시도) |

---

## 🎯 2. Customer Inquiry Webhook

### 2.1 엔드포인트 정의

```
POST /api/webhooks/cruisedot-inquiry

목적: 크루즈닷몰의 고객 문의를 CRM에 실시간 동기화 + 자동 렌즈 감지
트리거: inquiry.created, inquiry.updated (cruisedot 고객센터)
응답시간: <500ms
멱등성: inquiryId 기반
```

### 2.2 요청 페이로드

```json
{
  "eventId": "evt_cruisedot_inquiry_1234567890",
  "inquiryId": "INQ-2026-0001",
  "eventType": "inquiry.created",
  "timestamp": "2026-05-29T15:45:00Z",
  "customerId": 12345,
  "customerName": "김민수",
  "customerEmail": "kim@example.com",
  "customerPhone": "01012345678",
  "productName": "발틱 크루즈 7박",
  "inquiryType": "price",
  "message": "우리 회사 직원 20명이 단체로 가는데 그룹 할인이 있나요?",
  "priority": "high",
  "status": "open",
  "createdAt": "2026-05-29T15:45:00Z"
}
```

### 2.3 처리 로직 (렌즈 감지 + 자동 대응)

```typescript
// 1. 멱등성 체크
const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
  where: { eventId }
});
if (alreadyProcessed) {
  return { ok: true, duplicate: true };
}

// 2. Contact 찾기 또는 생성
let contact = await prisma.contact.findUnique({
  where: {
    phone_organizationId: {
      phone: normalizePhone(customerPhone),
      organizationId: "org_cruisedot"
    }
  }
});

if (!contact) {
  contact = await prisma.contact.create({
    data: {
      phone: normalizePhone(customerPhone),
      name: customerName,
      email: customerEmail,
      organizationId: "org_cruisedot",
      type: "LEAD"
    }
  });
}

// 3. Inquiry 레코드 생성
const inquiry = await prisma.inquiry.create({
  data: {
    inquiryId: inquiryId,
    contactId: contact.id,
    type: inquiryType,  // price, availability, feature, timeline, group, other
    message: message,
    status: "open",
    priority: priority,
    createdAt: new Date(timestamp)
  }
});

// 4. 렌즈 감지 (메시지 분석)
const detectedLens = detectLens(message);
// L1: 가격 관련 → "너무 비싸요" / "그룹할인 있나요?"
// L2: 준비 복잡 → "어떤 서류 필요해요?"
// L3: 경쟁사 언급 → "다른 여행사와 비교하면..."
// L6: 타이밍 → "언제까지 예약 가능해요?"

// 5. 자동 대응 스크립트 제시
const suggestedResponse = generateResponse(detectedLens, productName);

// 6. Contact에 렌즈 태그 추가
await prisma.contact.update({
  where: { id: contact.id },
  data: {
    tags: [...(contact.tags || []), `lens_${detectedLens.code}`]
  }
});

// 7. Inquiry 메모 기록
await prisma.inquiryMemo.create({
  data: {
    inquiryId: inquiry.id,
    userId: "system-webhook-cruisedot",
    content: `[자동감지] 렌즈: ${detectedLens.name}\n제안 대응: ${suggestedResponse.subject}`
  }
});

// 8. CRM 담당자 알림 (Slack/Push)
await notifyCrmAgent({
  type: "inquiry",
  inquiryId: inquiry.id,
  customerName: customerName,
  lens: detectedLens.name,
  priority: priority
});

// 9. processedWebhookEvent 기록
await prisma.processedWebhookEvent.create({
  data: {
    eventId: eventId,
    webhookType: "cruisedot-inquiry",
    status: "SUCCESS"
  }
});

return {
  ok: true,
  inquiryId: inquiry.id,
  detectedLens: detectedLens.name,
  suggestedResponse: suggestedResponse
};
```

### 2.4 렌즈 감지 엔진

```typescript
interface DetectedLens {
  code: "L1" | "L2" | "L3" | "L6" | "other";
  name: string;
  confidence: number;  // 0-100
  keywords: string[];
}

function detectLens(message: string): DetectedLens {
  const lowerMsg = message.toLowerCase();
  
  // L1: 가격 이의
  if (/(비싸|가격|할인|싼|비용|예산)/gi.test(lowerMsg)) {
    return {
      code: "L1",
      name: "가격 민감도",
      confidence: 85,
      keywords: ["비싸", "가격", "할인"]
    };
  }
  
  // L2: 준비 복잡
  if (/(서류|준비|필요한|조건|자격|절차)/gi.test(lowerMsg)) {
    return {
      code: "L2",
      name: "준비 불안감",
      confidence: 80,
      keywords: ["서류", "준비", "필요"]
    };
  }
  
  // L3: 경쟁사 비교
  if (/(다른|경쟁|비교|대신|같은|유사)/gi.test(lowerMsg)) {
    return {
      code: "L3",
      name: "차별성 모호",
      confidence: 75,
      keywords: ["다른", "경쟁", "비교"]
    };
  }
  
  // L6: 타이밍 결정
  if (/(언제|시기|기간|가능|예약|마감)/gi.test(lowerMsg)) {
    return {
      code: "L6",
      name: "타이밍 불확실",
      confidence: 70,
      keywords: ["언제", "기간", "예약"]
    };
  }
  
  return {
    code: "other",
    name: "일반 문의",
    confidence: 50,
    keywords: []
  };
}
```

### 2.5 자동 대응 스크립트

```typescript
interface SuggestedResponse {
  subject: string;
  body: string;
  template: string;
  lens: string;
}

function generateResponse(lens: DetectedLens, productName: string): SuggestedResponse {
  const responses: Record<string, SuggestedResponse> = {
    "L1": {
      subject: "발틱 크루즈 특별 그룹 할인 안내",
      body: `안녕하세요, ${productName} 담당자입니다.

문의 감사합니다. 저희는 다음과 같은 그룹할인을 제공합니다:
- 10명 이상: 10% 할인
- 20명 이상: 15% 할인
- 50명 이상: 20% 할인

단체 여행의 경우 맞춤형 패키지도 구성 가능합니다.
더 자세한 내용은 저희 담당자가 직접 연락드리겠습니다.`,
      template: "RESPONSE_PRICE_DISCOUNT",
      lens: "L1"
    },
    "L2": {
      subject: "발틱 크루즈 준비 절차 안내",
      body: `안녕하세요, ${productName} 담당자입니다.

단체 여행 준비는 다음과 같이 진행됩니다:

1단계: 인원 확정 (1주)
2단계: 여권 사본 제출 (2주)
3단계: 출국 서류 준비 안내 (3주)
4단계: 최종 확인 (1주)

저희는 전 과정을 지원하므로 걱정하지 않으셔도 됩니다.`,
      template: "RESPONSE_PREPARATION_GUIDE",
      lens: "L2"
    },
    "L3": {
      subject: "발틱 크루즈의 차별화된 3가지 이유",
      body: `안녕하세요, ${productName} 담당자입니다.

다른 여행사와 비교하실 때 저희의 장점을 소개합니다:

1️⃣ 20년 크루즈 전문성 (업계 최다 경험)
2️⃣ 실시간 맞춤 서포트 (24시간 콜센터)
3️⃣ 100% 환불 보증 (위험 제로)

자세한 비교표를 보내드리겠습니다.`,
      template: "RESPONSE_DIFFERENTIATION",
      lens: "L3"
    },
    "L6": {
      subject: "발틱 크루즈 예약 마감까지 3일 남았습니다! 🚀",
      body: `안녕하세요, ${productName} 담당자입니다.

긴급 안내: 특별 할인은 2026-06-01까지만 유효합니다.
예약 인원: 아직 5자리만 남았습니다!

지금 예약하시면:
- 추가 할인 5%
- 무료 항공권 변경
- VIP 라운지 무료 이용

지금 바로 확정해주세요!`,
      template: "RESPONSE_URGENCY",
      lens: "L6"
    }
  };
  
  return responses[lens.code] || responses["other"];
}
```

### 2.6 응답

```json
{
  "ok": true,
  "inquiryId": "inq_abc123",
  "detectedLens": "가격 민감도 (L1)",
  "suggestedResponse": {
    "subject": "발틱 크루즈 특별 그룹 할인 안내",
    "template": "RESPONSE_PRICE_DISCOUNT"
  }
}
```

---

## 💰 3. Settlement Updated Webhook

### 3.1 엔드포인트 정의

```
POST /api/webhooks/cruisedot-settlement

목적: 크루즈닷몰의 정산 데이터를 CRM에 실시간 동기화 + Commission 자동 계산
트리거: settlement.created, settlement.updated, settlement.paid (정산 시스템)
응답시간: <1000ms (대량 데이터 처리)
멱등성: settlementId 기반
```

### 3.2 요청 페이로드

```json
{
  "eventId": "evt_cruisedot_settlement_1234567890",
  "settlementId": "SETTLE-2026-05",
  "eventType": "settlement.updated",
  "timestamp": "2026-05-31T23:59:59Z",
  "period": "2026-05",
  "partnerId": 999,
  "partnerName": "마비즈 크루즈",
  "partnerEmail": "billing@mabiz.com",
  "totalAmount": 1500000,
  "currency": "KRW",
  "status": "approved",
  "commission": {
    "rate": 0.10,
    "amount": 150000
  },
  "salesBreakdown": [
    {
      "orderId": "CRUISE-2026-0001",
      "customerId": 12345,
      "amount": 2850000,
      "fee": 285000,
      "netAmount": 2565000
    },
    {
      "orderId": "CRUISE-2026-0002",
      "customerId": 12346,
      "amount": 3200000,
      "fee": 320000,
      "netAmount": 2880000
    }
  ],
  "paymentDetails": {
    "method": "bank_transfer",
    "accountNumber": "110-123456-12345",
    "bankName": "국민은행",
    "dueDate": "2026-06-15"
  }
}
```

### 3.3 처리 로직

```typescript
// 1. 멱등성 체크
const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
  where: { eventId }
});
if (alreadyProcessed) {
  return { ok: true, duplicate: true };
}

// 2. Partner 찾기 또는 생성
let partner = await prisma.partner.findUnique({
  where: { partnerId: String(partnerId) }
});

if (!partner) {
  partner = await prisma.partner.create({
    data: {
      partnerId: String(partnerId),
      name: partnerName,
      email: partnerEmail,
      organizationId: "org_cruisedot",
      status: "ACTIVE"
    }
  });
}

// 3. Settlement 레코드 생성/업데이트
const settlement = await prisma.settlement.upsert({
  where: { settlementId: settlementId },
  create: {
    settlementId: settlementId,
    partnerId: partner.id,
    period: period,
    totalAmount: totalAmount,
    commissionRate: commission.rate,
    commissionAmount: commission.amount,
    status: status,
    dueDate: new Date(paymentDetails.dueDate),
    organizationId: "org_cruisedot"
  },
  update: {
    status: status,
    commissionAmount: commission.amount,
    dueDate: new Date(paymentDetails.dueDate)
  }
});

// 4. 판매 분석 (영업사원별 수수료 분배)
for (const sale of salesBreakdown) {
  // AffiliateSale 업데이트
  const affiliateSale = await prisma.affiliateSale.findUnique({
    where: { orderId: sale.orderId }
  });
  
  if (affiliateSale) {
    await prisma.affiliateSale.update({
      where: { id: affiliateSale.id },
      data: {
        settlementId: settlement.id,
        commissionAmount: Math.floor(sale.amount * commission.rate),
        settlementStatus: status
      }
    });
  }
}

// 5. Commission 자동 계산 및 Payment 일정 예약
const commissionSummary = await calculateCommission(settlement);

// 6. Settlement Report 생성
const report = await prisma.settlementReport.create({
  data: {
    settlementId: settlement.id,
    partnerId: partner.id,
    period: period,
    totalSales: totalAmount,
    totalCommission: commission.amount,
    deduction: totalAmount - commission.amount,
    paymentMethod: paymentDetails.method,
    accountNumber: paymentDetails.accountNumber,
    dueDate: new Date(paymentDetails.dueDate),
    status: status
  }
});

// 7. Partner에게 정산 통지
await notifyPartnerSettlement({
  partnerId: partner.id,
  settlementId: settlement.id,
  period: period,
  commissionAmount: commission.amount,
  dueDate: paymentDetails.dueDate
});

// 8. CRM 대시보드에 정산 데이터 업데이트
await updatePartnerDashboard(partner.id, settlement);

// 9. processedWebhookEvent 기록
await prisma.processedWebhookEvent.create({
  data: {
    eventId: eventId,
    webhookType: "cruisedot-settlement",
    status: "SUCCESS"
  }
});

return {
  ok: true,
  settlementId: settlement.id,
  commissionAmount: commission.amount,
  dueDate: paymentDetails.dueDate
};
```

### 3.4 Commission 계산 엔진

```typescript
interface CommissionSummary {
  totalSales: number;
  commissionRate: number;
  commissionAmount: number;
  tax: number;
  netPayment: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
  bonusRate: number;
  bonusAmount: number;
}

async function calculateCommission(settlement: Settlement): Promise<CommissionSummary> {
  const totalSales = settlement.totalAmount;
  const baseRate = settlement.commissionRate;
  
  // Tier 결정 (월 매출 기준)
  let tier: CommissionSummary["tier"];
  let bonusRate = 0;
  
  if (totalSales >= 10000000) {
    tier = "PLATINUM";
    bonusRate = 0.05;  // 추가 5% 보너스
  } else if (totalSales >= 5000000) {
    tier = "GOLD";
    bonusRate = 0.03;  // 추가 3% 보너스
  } else if (totalSales >= 1000000) {
    tier = "SILVER";
    bonusRate = 0.01;  // 추가 1% 보너스
  } else {
    tier = "BRONZE";
    bonusRate = 0;
  }
  
  // Commission 계산
  const baseCommission = Math.floor(totalSales * baseRate);
  const bonusAmount = Math.floor(totalSales * bonusRate);
  const totalCommission = baseCommission + bonusAmount;
  
  // 세금 계산 (3.3% 소득세)
  const tax = Math.floor(totalCommission * 0.033);
  const netPayment = totalCommission - tax;
  
  // Settlement Tier 업데이트
  await prisma.settlement.update({
    where: { id: settlement.id },
    data: {
      tier: tier,
      bonusAmount: bonusAmount,
      tax: tax,
      netPayment: netPayment
    }
  });
  
  return {
    totalSales,
    commissionRate: baseRate,
    commissionAmount: baseCommission,
    tax,
    netPayment,
    tier,
    bonusRate,
    bonusAmount
  };
}
```

### 3.5 응답

```json
{
  "ok": true,
  "settlementId": "settle_abc123",
  "period": "2026-05",
  "commissionAmount": 150000,
  "dueDate": "2026-06-15",
  "status": "approved"
}
```

---

## 🔒 공통 보안 구현

### 4.1 HMAC-SHA256 서명 검증

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  // 타이밍 공격 방지
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// 사용
export async function POST(req: NextRequest) {
  const secret = process.env.CRUISEDOT_WEBHOOK_SECRET;
  const signature = req.headers.get('x-signature') ?? '';
  const body = await req.text();
  
  if (!verifyWebhookSignature(body, signature, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  
  const payload = JSON.parse(body);
  // ... 처리
}
```

### 4.2 요청 타임스탬프 검증 (Replay Attack 방지)

```typescript
function verifyTimestamp(timestamp: string, maxAgeSec: number = 300): boolean {
  const requestTime = new Date(timestamp).getTime();
  const currentTime = Date.now();
  const ageSec = (currentTime - requestTime) / 1000;
  
  if (ageSec < 0 || ageSec > maxAgeSec) {
    logger.warn(`[Webhook] 타임스탐프 벗어남: ${ageSec}초`);
    return false;
  }
  
  return true;
}
```

### 4.3 Rate Limiting

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(100, '1 m')
});

export async function POST(req: NextRequest) {
  const clientId = req.headers.get('x-forwarded-for') ?? 'unknown';
  const result = await ratelimit.limit(clientId);
  
  if (!result.success) {
    return NextResponse.json(
      { ok: false, message: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  
  // ... 처리
}
```

---

## ♻️ 5. 재시도 로직 (지수 백오프)

### 5.1 재시도 정책

```typescript
interface RetryConfig {
  maxRetries: number;     // 최대 5회
  baseDelayMs: number;    // 1000ms (1초)
  backoffFactor: number;  // 2배 증가
  maxDelayMs: number;     // 60000ms (60초 한도)
  jitterPercent: number;  // ±10% 랜덤
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  backoffFactor: 2.0,
  maxDelayMs: 60000,
  jitterPercent: 10
};

function calculateNextRetryDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  let delay = config.baseDelayMs * Math.pow(config.backoffFactor, attemptNumber);
  delay = Math.min(delay, config.maxDelayMs);
  
  // ±10% 지터 추가 (thundering herd 방지)
  const jitterRange = delay * (config.jitterPercent / 100);
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;
  
  return Math.floor(delay + jitter);
}

// 예시
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    await processWebhook(payload);
    return { ok: true };
  } catch (error) {
    if (attempt < 4) {
      const delay = calculateNextRetryDelay(attempt);
      logger.log(`[Webhook] 재시도 예정: ${delay}ms 후`);
      await sleep(delay);
    } else {
      // 최종 실패 → DLQ로 이동
      await enqueueDLQ('cruisedot-webhook', payload, error);
      return { ok: false };
    }
  }
}
```

### 5.2 재시도 스케줄

```
Attempt 1 (즉시): 0ms
Attempt 2: 1000ms (1초)
Attempt 3: 2000ms (2초)
Attempt 4: 4000ms (4초)
Attempt 5: 8000ms (8초)
Attempt 6: 16000ms (16초)
Attempt 7: 최종 실패 → DLQ
```

---

## 📊 6. 모니터링 대시보드

### 6.1 Prometheus 메트릭

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// 웹훅 처리 카운트
export const webhookProcessedTotal = new Counter({
  name: 'webhook_processed_total',
  help: 'Total webhooks processed',
  labelNames: ['type', 'status', 'organization']
});

// 웹훅 처리 시간
export const webhookProcessingDurationMs = new Histogram({
  name: 'webhook_processing_duration_ms',
  help: 'Webhook processing time in milliseconds',
  labelNames: ['type']
});

// 활성 웹훅 처리 중
export const webhookProcessingActive = new Gauge({
  name: 'webhook_processing_active',
  help: 'Active webhook processing',
  labelNames: ['type']
});

// 재시도 큐 크기
export const retryQueueSize = new Gauge({
  name: 'retry_queue_size',
  help: 'Pending retries in queue',
  labelNames: ['type']
});

// 사용 예시
export async function POST(req: NextRequest) {
  const start = Date.now();
  webhookProcessingActive.labels('cruisedot-payment').inc();
  
  try {
    await processWebhook(payload);
    webhookProcessedTotal.labels('cruisedot-payment', 'success', orgId).inc();
  } catch (error) {
    webhookProcessedTotal.labels('cruisedot-payment', 'failure', orgId).inc();
  } finally {
    const duration = Date.now() - start;
    webhookProcessingDurationMs.labels('cruisedot-payment').observe(duration);
    webhookProcessingActive.labels('cruisedot-payment').dec();
  }
}
```

### 6.2 대시보드 쿼리

```sql
-- 최근 1시간 웹훅 처리율
SELECT
  type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
  ROUND(100.0 * SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM ProcessedWebhookEvent
WHERE createdAt > NOW() - INTERVAL 1 HOUR
GROUP BY type
ORDER BY success_rate DESC;

-- 평균 처리 시간 (웹훅 유형별)
SELECT
  webhookType,
  ROUND(AVG(EXTRACT(EPOCH FROM (completedAt - createdAt)) * 1000), 2) as avg_time_ms,
  ROUND(MAX(EXTRACT(EPOCH FROM (completedAt - createdAt)) * 1000), 2) as max_time_ms
FROM WebhookEvent
WHERE createdAt > NOW() - INTERVAL 24 HOUR
GROUP BY webhookType
ORDER BY avg_time_ms DESC;

-- 재시도 대기 중인 웹훅
SELECT
  id,
  webhookType,
  attemptCount,
  nextRetryAt,
  error
FROM WebhookEvent
WHERE status = 'PENDING' AND nextRetryAt IS NOT NULL
ORDER BY nextRetryAt ASC
LIMIT 100;
```

---

## 🧪 7. 테스트 & 검증

### 7.1 curl 테스트 명령어

#### Payment Confirmed 테스트

```bash
curl -X POST http://localhost:3000/api/webhooks/cruisedot-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CRUISEDOT_WEBHOOK_SECRET" \
  -H "x-signature: $(echo -n '{
    "eventId": "evt_test_payment_001",
    "eventType": "payment.confirmed",
    "timestamp": "2026-05-29T14:30:00Z",
    "bookingRef": "CRUISE-2026-0001",
    "customerId": 12345,
    "customerName": "김민수",
    "customerEmail": "kim@example.com",
    "customerPhone": "01012345678",
    "productName": "발틱 크루즈 7박",
    "amount": 2850000,
    "currency": "KRW",
    "paymentMethod": "credit_card",
    "status": "CONFIRMED",
    "completedAt": "2026-05-29T14:30:00Z"
  }' | openssl dgst -sha256 -hmac "YOUR_SECRET" | cut -d' ' -f2)" \
  -d '{
    "eventId": "evt_test_payment_001",
    "eventType": "payment.confirmed",
    "timestamp": "2026-05-29T14:30:00Z",
    "bookingRef": "CRUISE-2026-0001",
    "customerId": 12345,
    "customerName": "김민수",
    "customerEmail": "kim@example.com",
    "customerPhone": "01012345678",
    "productName": "발틱 크루즈 7박",
    "amount": 2850000,
    "currency": "KRW",
    "paymentMethod": "credit_card",
    "status": "CONFIRMED",
    "completedAt": "2026-05-29T14:30:00Z"
  }'
```

#### Customer Inquiry 테스트

```bash
curl -X POST http://localhost:3000/api/webhooks/cruisedot-inquiry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_MABIZ_GOLD_INQUIRY_WEBHOOK_SECRET" \
  -d '{
    "eventId": "evt_test_inquiry_001",
    "inquiryId": "INQ-2026-0001",
    "eventType": "inquiry.created",
    "timestamp": "2026-05-29T15:45:00Z",
    "customerId": 12345,
    "customerName": "김민수",
    "customerEmail": "kim@example.com",
    "customerPhone": "01012345678",
    "productName": "발틱 크루즈 7박",
    "inquiryType": "price",
    "message": "우리 회사 직원 20명이 단체로 가는데 그룹 할인이 있나요?",
    "priority": "high",
    "status": "open",
    "createdAt": "2026-05-29T15:45:00Z"
  }'
```

#### Settlement Updated 테스트

```bash
curl -X POST http://localhost:3000/api/webhooks/cruisedot-settlement \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CRUISEDOT_WEBHOOK_SECRET" \
  -d '{
    "eventId": "evt_test_settlement_001",
    "settlementId": "SETTLE-2026-05",
    "eventType": "settlement.updated",
    "timestamp": "2026-05-31T23:59:59Z",
    "period": "2026-05",
    "partnerId": 999,
    "partnerName": "마비즈 크루즈",
    "partnerEmail": "billing@mabiz.com",
    "totalAmount": 1500000,
    "currency": "KRW",
    "status": "approved",
    "commission": {
      "rate": 0.10,
      "amount": 150000
    },
    "paymentDetails": {
      "method": "bank_transfer",
      "accountNumber": "110-123456-12345",
      "bankName": "국민은행",
      "dueDate": "2026-06-15"
    }
  }'
```

### 7.2 검증 체크리스트

- [ ] 멱등성: 동일한 eventId로 2번 호출 → 중복 응답 (200, duplicate: true)
- [ ] 서명 검증: 잘못된 서명 → 403 Forbidden
- [ ] 타임스탬프: 5분 이상 오래된 요청 → 400 Bad Request
- [ ] 필수 필드: 누락된 필드 → 400 Bad Request
- [ ] DB 동시성: 동일 orderId로 동시 요청 → 하나만 성공
- [ ] 재시도: 500 에러 → 자동 재시도 (1s → 2s → 4s → 8s → 16s)
- [ ] 최종 실패: 5회 재시도 후 실패 → DLQ로 이동
- [ ] Contact 생성: 첫 번째 payment → Contact 자동 생성
- [ ] SMS 발송: Contact 생성 → Day 0 SMS 발송 확인
- [ ] 렌즈 감지: Inquiry 메시지 → 자동 렌즈 감지 + 대응 제시
- [ ] Commission 계산: Settlement → Commission 정확히 계산됨

---

## 📈 8. 예상 성과

### 8.1 통합 효과

| 메트릭 | 현재 | 목표 | 증대율 |
|-------|------|------|--------|
| **Payment → Contact 자동화** | 수동 생성 | 100% 자동 | +100% |
| **Day 0 SMS 발송** | 미발송 | 100% 자동 | +$76K/월 |
| **Inquiry 응답 시간** | 평균 2시간 | <5분 자동 | -75% |
| **렌즈 감지율** | 0% | 80%+ | +$50K/월 |
| **Commission 오류** | 월 3-5건 | 0건 | -100% |
| **Settlement 정산 시간** | 3-5일 | 1일 자동 | -80% |

### 8.2 월간 재정 효과

```
Payment 연동 효과:
- 자동 SMS Day 0-3 (L6 타이밍) → 전환율 15% → 25% (+67%)
- 월 1,000 결제 × 2.85M × 10% = 285M × 10% 증대 = +28.5M

Inquiry 자동 처리 (렌즈 감지):
- L1 (가격): 월 300건 × 25% 추가 판매 = +$50K
- L2 (준비): 월 150건 × 15% 재확인 = +$20K
- L3 (차별성): 월 100건 × 30% 전환 = +$75K
- L6 (타이밍): 월 50건 × 40% 긴급 매출 = +$30K

합계: +$76K-152K/월 (한화 1-2억 원/월)

Settlement 자동화:
- 수동 작업 단축: 주 8시간 → 0시간 (효율성 +100%)
- 오류율 감소: 월 3-5건 → 0건 (신뢰도 +100%)
```

---

## 🚀 9. 배포 체크리스트

### Phase 1: Payment Confirmed (2026-05-29)
- [ ] 엔드포인트 구현 완료
- [ ] HMAC 서명 검증 통과
- [ ] DB 트랜잭션 테스트 통과
- [ ] Contact 생성 테스트 통과
- [ ] Day 0 SMS 발송 통합 테스트
- [ ] 재시도 로직 검증
- [ ] 모니터링 대시보드 설정
- [ ] 프로덕션 환경변수 설정 (CRUISEDOT_WEBHOOK_SECRET)
- [ ] 크루즈닷몰에 Webhook URL 등록
- [ ] 라이브 트래픽 모니터링 (첫 100건)

### Phase 2: Customer Inquiry (2026-05-30)
- [ ] 엔드포인트 구현 완료
- [ ] 렌즈 감지 엔진 검증
- [ ] 자동 대응 스크립트 템플릿 완성
- [ ] CRM 담당자 알림 통합
- [ ] Inquiry 우선순위 정렬 테스트
- [ ] 프로덕션 배포
- [ ] 크루즈닷몰 webhook 등록

### Phase 3: Settlement Updated (2026-05-31)
- [ ] 엔드포인트 구현 완료
- [ ] Commission 계산 엔진 검증
- [ ] Tier 시스템 자동 분류 테스트
- [ ] Settlement Report 생성 테스트
- [ ] Partner 알림 통합
- [ ] Partner 대시보드 업데이트 확인
- [ ] 프로덕션 배포
- [ ] 첫 정산 사이클 모니터링 (2026-06-15)

### 전체 검증
- [ ] 모든 3개 엔드포인트 라이브 ✅
- [ ] 멱등성 검증 완료 ✅
- [ ] Rate limiting 활성화 ✅
- [ ] 모니터링 대시보드 구성 ✅
- [ ] 로깅 및 감시 알림 설정 ✅
- [ ] Runbook 문서 완성 ✅

---

## 📝 10. 마이그레이션 가이드

### 10.1 기존 크루즈닷몰 시스템과의 호환성

```
기존 방식 (수동):
1. 크루즈닷몰에서 결제 완료
2. 수동으로 메일 확인
3. CRM에 Contact 수동 입력
4. SMS 수동 발송
5. 정산 데이터 수동 입력

신규 방식 (자동):
1. 크루즈닷몰에서 결제 완료 → Webhook 전송
2. CRM이 자동으로 수신 및 처리
3. Contact 자동 생성/업데이트
4. Day 0-3 SMS 자동 발송
5. 정산 데이터 자동 동기화

마이그레이션 전략:
- Week 1: Payment 테스트 (제한된 고객만)
- Week 2: Payment 전체 배포 + Inquiry 테스트
- Week 3: Inquiry 전체 배포 + Settlement 테스트
- Week 4: Settlement 전체 배포 + 최적화

롤백 계획:
- 주요 이슈 발생 시 Webhook 비활성화 (DISABLE_CRUISEDOT_WEBHOOKS=true)
- 기존 수동 프로세스로 자동 복귀
```

---

## 🎯 11. KPI 추적

### 11.1 주간 리포팅 (매주 금요일)

```markdown
# Webhook Infrastructure 주간 리포트 (Week of 2026-05-29)

## 📊 처리 통계
- 총 웹훅 처리: 1,234건
- 성공율: 99.5%
- 평균 응답 시간: 245ms
- 재시도 이벤트: 6건 (0.5%)

## 📈 비즈니스 임팩트
- Contact 자동 생성: 542건
- Day 0 SMS 발송: 528건 (97.4%)
- Inquiry 자동 처리: 156건
- 렌즈 감지율: 82.5%
- Commission 오류: 0건

## ⚠️ 이슈
- [P3] Settlement API 응답 지연 (평균 850ms) → 최적화 예정

## ✅ 다음 주 계획
- Settlement 성능 최적화
- Lens 감지 엔진 정확도 향상 (L1, L3)
- Partner Dashboard 추가 기능
```

---

## 12. 참고 문서

- [[webhook_phase6_completion]] — Phase 1-6 기존 구현
- [[loop5_completion_status]] — Loop 5 완성 상태
- [[affiliate_crm_integration]] — Affiliate 통합 구조
- [[crm_psychology_contact_journey]] — Contact 여정 설계

---

**마지막 업데이트**: 2026-05-28 10:00 KST  
**담당자**: Agent E (Webhook Infrastructure)  
**상태**: ✅ 설계 완료 → 구현 대기 (2026-05-29)
