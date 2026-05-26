# Affiliate Integration Architecture (어필리에이트 통합 아키텍처)

**작성일**: 2026-05-26  
**버전**: 1.0  
**대상**: 마비즈 CRM Affiliate Marketing 시스템

---

## 🏗️ 1. 시스템 아키텍처 개요

### 1.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    Affiliate Marketing Ecosystem                 │
├─────────────────────────────────────────────────────────────────┤
│
│  파트너 채널               mabiz Platform            백엔드 시스템
│  ────────────────────────────────────────────────────────────────
│
│  ┌──────────┐                                   ┌──────────────┐
│  │ SNS 링크  │──────┐                           │ Analytics DB │
│  │(Facebook)│      │                           └──────────────┘
│  └──────────┘      │        ┌─────────────┐
│                    ├───────>│  ShortLink  │      ┌──────────────┐
│  ┌──────────┐      │        │   API       │─────>│ Tracking API │
│  │ QR 코드   │──────┤        └─────────────┘      └──────────────┘
│  └──────────┘      │
│                    │        ┌─────────────┐      ┌──────────────┐
│  ┌──────────┐      └───────>│  Landing    │─────>│ Contact Gen  │
│  │ 이메일    │               │  Page       │      └──────────────┘
│  └──────────┘               └─────────────┘
│                                    │               ┌──────────────┐
│  ┌──────────┐                     │              │ Auth & Token  │
│  │ 직판      │────────────────────┤              │ Management   │
│  └──────────┘                     │              └──────────────┘
│                                   │
│                              ┌────▼────────┐      ┌──────────────┐
│                              │  Contact    │─────>│ Commission   │
│                              │  Create     │      │ Calculation  │
│                              └─────────────┘      └──────────────┘
│
│                                                    ┌──────────────┐
│                                                    │ Partner      │
│  Postback URL ────────────────────────────────────>│ Dashboard API│
│  (B2B Integration)                                └──────────────┘
│
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 핵심 컴포넌트

| 컴포넌트 | 역할 | 기술스택 |
|---------|------|---------|
| **Tracking Engine** | 클릭, 전환 추적 | Node.js, Redis |
| **Commission Service** | 수당 계산 및 정산 | Node.js, Postgres |
| **Fraud Detection** | 사기 탐지 | ML Models, Rules Engine |
| **Partner Dashboard** | 파트너 수익 조회 | Next.js, React |
| **Admin Portal** | 관리자 대시보드 | Next.js, React |
| **Webhook Handler** | Postback 처리 | Express.js |
| **Analytics** | 성과 분석 | BigQuery, Looker |

---

## 🔌 2. API 엔드포인트 설계

### 2.1 Partner API (파트너용)

#### GET `/api/affiliate/links/generate`

**목적**: 추적 가능한 링크 생성

```
GET /api/affiliate/links/generate?campaign=SUMMER_2026&source=facebook&product=cruise_suite

Headers:
  Authorization: Bearer PARTNER_TOKEN_abc123

Response:
{
  "shortUrl": "https://mabiz.link/abc123xyz",
  "fullUrl": "https://booking.mabiz.com/?aff=PARTNER001&campaign=SUMMER_2026&source=facebook&link_id=abc123xyz",
  "linkId": "abc123xyz",
  "qrCode": "https://api.mabiz.com/qr/abc123xyz.png",
  "expiresAt": "2026-12-31T23:59:59Z",
  "trackingParams": {
    "affiliate": "PARTNER001",
    "campaign": "SUMMER_2026",
    "source": "facebook",
    "utm_campaign": "SUMMER_2026",
    "utm_source": "facebook"
  }
}
```

**구현**:
```typescript
// src/app/api/affiliate/links/generate/route.ts
export async function GET(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const partner = await validatePartnerToken(token);
  if (!partner) return new Response('Unauthorized', { status: 401 });
  
  const { campaign, source, product } = Object.fromEntries(
    new URL(request.url).searchParams
  );
  
  // 1. ShortLink 생성
  const code = generateRandomCode(8);
  const shortLink = await prisma.shortLink.create({
    data: {
      organizationId: partner.organizationId,
      code,
      originalUrl: buildOriginalUrl({ campaign, source, product }),
      affiliateCode: partner.code,
      campaignId: campaign,
      source,
      trackingParams: { product },
    },
  });
  
  // 2. QR 코드 생성
  const qrUrl = await generateQRCode(shortLink.code);
  
  return Response.json({
    shortUrl: `https://mabiz.link/${shortLink.code}`,
    fullUrl: shortLink.originalUrl,
    linkId: shortLink.id,
    qrCode: qrUrl,
    expiresAt: addMonths(new Date(), 6),
  });
}
```

#### GET `/api/affiliate/dashboard/summary`

**위 참고**: `affiliate_partner_dashboard.md` - 섹션 3.1

#### POST `/api/affiliate/sales/postback`

**목적**: B2B 파트너의 판매 데이터 전송

```
POST /api/affiliate/sales/postback
Authorization: Bearer PARTNER_TOKEN_def456
X-Affiliate-Signature: hmac_sha256_signature

{
  "externalOrderId": "ORD_20260526_001",
  "affiliateCode": "PARTNER001",
  "customerId": "CUST_123",
  "customerPhone": "010-1234-5678",
  "saleAmount": 50000000,
  "currency": "KRW",
  "productCode": "CRUISE_SUITE",
  "productName": "크루즈 스위트룸",
  "status": "COMPLETED",
  "saleDate": "2026-05-26T10:30:00Z",
  "travelCompletedAt": "2026-07-15T23:59:59Z",
  "metadata": {
    "cabinType": "SUITE",
    "passengers": 2,
    "departureDate": "2026-07-01",
    "destinationCode": "ASIA_CRUISE",
  }
}

Response:
{
  "success": true,
  "saleId": "sale_abc123",
  "status": "CONFIRMED",
  "commissionAmount": 1250000,
  "message": "Sale recorded successfully"
}
```

**구현**:
```typescript
// src/app/api/affiliate/sales/postback/route.ts
export async function POST(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const signature = request.headers.get('X-Affiliate-Signature');
    
    // 1. 파트너 검증
    const partner = await validatePartnerToken(token);
    if (!partner) throw new Error('Invalid token');
    
    // 2. 서명 검증
    const body = await request.text();
    const expectedSignature = crypto
      .createHmac('sha256', partner.webhookSecret)
      .update(body)
      .digest('hex');
    if (signature !== expectedSignature) throw new Error('Invalid signature');
    
    const payload = JSON.parse(body);
    
    // 3. 중복 체크
    const existing = await prisma.affiliateSale.findUnique({
      where: { orderId: payload.externalOrderId },
    });
    if (existing) throw new Error('Duplicate order ID');
    
    // 4. 사기 탐지
    const fraudScore = await detectAffiliateFraud({
      saleId: payload.externalOrderId,
      affiliateCode: partner.code,
      customerId: payload.customerId,
      saleAmount: payload.saleAmount,
      orderId: payload.externalOrderId,
      ipAddress: request.headers.get('x-forwarded-for') || '',
      userAgent: request.headers.get('user-agent') || '',
      deviceId: 'postback_api',
      saleTimestamp: new Date(),
    });
    
    // 5. Sales 기록
    const sale = await prisma.affiliateSale.create({
      data: {
        organizationId: partner.organizationId,
        affiliateCode: partner.code,
        orderId: payload.externalOrderId,
        productName: payload.productName,
        saleAmount: payload.saleAmount,
        status: fraudScore.recommendation === 'APPROVE' ? 'CONFIRMED' : 'PENDING_REVIEW',
        sourceWebhook: 'POSTBACK_API',
        customerPhone: payload.customerPhone,
        travelCompletedAt: new Date(payload.travelCompletedAt),
      },
    });
    
    // 6. 수당 계산
    const commission = calculateCommission(payload.saleAmount, partner.commissionRate);
    
    // 7. 응답
    return Response.json({
      success: true,
      saleId: sale.id,
      status: sale.status,
      commissionAmount: commission.gross,
    });
    
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}
```

### 2.2 Admin API (관리자용)

#### GET `/api/admin/affiliates?status=all&limit=50`

**목적**: 파트너 목록 조회

```
Response:
{
  "success": true,
  "data": [
    {
      "id": "partner_001",
      "code": "PARTNER001",
      "name": "김파트너",
      "email": "partner@example.com",
      "status": "ACTIVE",
      "monthlyRevenue": 50000000,
      "monthlyCommission": 1250000,
      "totalCommissionPaid": 7500000,
      "joiningDate": "2024-01-15",
      "lastActivityAt": "2026-05-26T10:30:00Z",
      "riskScore": 15,
      "suspensionStatus": null,
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 125 }
}
```

#### POST `/api/admin/affiliates/{id}/suspend`

**목적**: 파트너 계정 정지

```
POST /api/admin/affiliates/partner_001/suspend
Authorization: Bearer ADMIN_TOKEN

{
  "reason": "HIGH_FRAUD_SCORE",
  "duration": 30,  // 30일
  "message": "부정거래 의심으로 인한 계정 정지"
}

Response:
{
  "success": true,
  "partnerId": "partner_001",
  "suspendedAt": "2026-05-26T15:00:00Z",
  "unsuspendAt": "2026-06-25T15:00:00Z"
}
```

---

## 🔐 3. 인증 및 보안

### 3.1 Partner Token 발급

```typescript
interface PartnerToken {
  partnerId: string;
  code: string;
  secret: string;
  expiresAt: Date;
  scopes: string[];  // 'read:sales' | 'read:dashboard' | 'write:postback' | ...
}

// 토큰 생성
export async function generatePartnerToken(partnerId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  await prisma.partnerToken.create({
    data: {
      partnerId,
      token: hashedToken,
      expiresAt: addDays(new Date(), 90),
      scopes: ['read:sales', 'read:dashboard', 'write:postback'],
    },
  });
  
  return token;  // 한 번만 노출
}

// 토큰 검증
export async function validatePartnerToken(token: string) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  const record = await prisma.partnerToken.findFirst({
    where: {
      token: hashedToken,
      expiresAt: { gt: new Date() },
    },
    include: { partner: true },
  });
  
  return record?.partner || null;
}
```

### 3.2 Rate Limiting

```typescript
// 파트너당 API 호출 제한
const RATE_LIMITS = {
  'GET /api/affiliate/links/generate': { requests: 100, window: 3600 },  // 시간당 100회
  'POST /api/affiliate/sales/postback': { requests: 1000, window: 3600 }, // 시간당 1000회
  'GET /api/affiliate/dashboard': { requests: 60, window: 60 },           // 분당 60회
};

export function createRateLimiter() {
  return rateLimit({
    keyGenerator: (req) => req.headers.get('Authorization'),
    skip: (req) => req.headers.get('Authorization')?.startsWith('Bearer ADMIN'),
    handlers: {
      onLimit: (req) => new Response('Rate limit exceeded', { status: 429 }),
    },
  });
}
```

### 3.3 Webhook Signature Verification

```typescript
/**
 * Postback 서명 검증
 * 
 * 파트너 서버 → mabiz API
 * 모든 요청에 HMAC SHA256 서명 포함
 */
export function verifyPostbackSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## 📊 4. 데이터 흐름 및 이벤트

### 4.1 Contact Creation 흐름

```
1. 링크 클릭
   ShortLink 조회 → AffiliateLinkEvent 기록 → 쿠키 저장

2. 랜딩페이지 방문
   Session 생성 → TouchPoint 기록

3. 문의 양식 제출
   Contact 생성
   ├─ partnerId = 파트너 ID
   ├─ affiliateCode = 파트너 코드
   ├─ affiliateClickedAt = 클릭 시각
   └─ affiliateSourceId = 링크 ID

4. 예약 확정
   Contact.status = BOOKING_CONFIRMED
   → Commission 계산 시작

5. 여행 완료
   Contact.status = COMPLETED
   → Commission 최종 확정
   → Payment 처리
```

### 4.2 Event-Driven Architecture

```typescript
// Event Publisher
export async function publishAffiliateEvent(
  event: AffiliateEvent
) {
  await eventBus.publish('affiliate', {
    type: event.type,  // 'CLICK' | 'INQUIRY' | 'BOOKING' | 'COMPLETION' | 'REFUND'
    data: event.data,
    timestamp: new Date(),
  });
}

// Event Subscribers
eventBus.subscribe('affiliate', async (event) => {
  switch (event.type) {
    case 'CLICK':
      await handleAffiliateClick(event.data);
      break;
    case 'INQUIRY':
      await handleAffiliateInquiry(event.data);
      break;
    case 'BOOKING':
      await handleAffiliateBooking(event.data);
      // 수당 계산 트리거
      break;
    case 'COMPLETION':
      await handleAffiliateCompletion(event.data);
      // 수당 최종 확정
      break;
    case 'REFUND':
      await handleAffiliateRefund(event.data);
      // 수당 환수
      break;
  }
});
```

---

## 💾 5. 데이터베이스 설계 (정규화)

### 5.1 Affiliate 관련 테이블 매핑

```
┌─────────────────────────────────────┐
│ Partner (파트너 기본 정보)          │
├─────────────────────────────────────┤
│ id (PK)                             │
│ organizationId (FK)                 │
│ code (UNIQUE)                       │
│ name, email, phone                  │
│ bankAccount, bankName               │
│ commissionRate                      │
│ status ('ACTIVE' | 'SUSPENDED')     │
│ totalRevenue, totalCommission       │
└──────────────┬──────────────────────┘
               │ 1:N
               └──────────────────────────────┐
                                              │
┌─────────────────────────────────────┐      │
│ ShortLink                           │<─────┘
├─────────────────────────────────────┤
│ id (PK)                             │
│ code (UNIQUE)                       │
│ affiliateCode (FK)                  │
│ originalUrl                         │
│ campaignId, source                  │
│ clickCount                          │
│ lastClickedAt                       │
└──────────────┬──────────────────────┘
               │ 1:N
               └──────────────────────────────┐
                                              │
┌─────────────────────────────────────┐      │
│ AffiliateLinkEvent                  │<─────┘
├─────────────────────────────────────┤
│ id (PK)                             │
│ linkId (FK)                         │
│ eventType ('CLICK', 'IMPRESSION')   │
│ metadata (IP, UA, ...)              │
│ createdAt                           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Contact                             │
├─────────────────────────────────────┤
│ id (PK)                             │
│ partnerId (FK)                      │
│ affiliateCode                       │
│ affiliateClickedAt                  │
│ affiliateCookie                     │
│ type ('LEAD' | 'CUSTOMER')          │
│ status                              │
└──────────────┬──────────────────────┘
               │ 1:N
               └──────────────────────────────┐
                                              │
┌─────────────────────────────────────┐      │
│ AffiliateSale                       │<─────┘
├─────────────────────────────────────┤
│ id (PK)                             │
│ affiliateCode (FK)                  │
│ customerId (FK)                     │
│ orderId (UNIQUE)                    │
│ saleAmount, commissionRate          │
│ commissionAmount, netAmount         │
│ status ('PENDING'|'CONFIRMED'|...)  │
│ refundedAt, cancelledAt             │
│ paidAt                              │
└──────────────┬──────────────────────┘
               │ 1:N
               └──────────────────────────────┐
                                              │
┌─────────────────────────────────────┐      │
│ AffiliateLedger                     │<─────┘
├─────────────────────────────────────┤
│ id (PK)                             │
│ saleId (FK)                         │
│ type ('COMMISSION' | 'CHARGEBACK')  │
│ amount, withholdingAmount           │
│ netAmount                           │
│ isSettled, settledAt                │
│ createdAt                           │
└─────────────────────────────────────┘
```

### 5.2 인덱스 전략

```prisma
// Performance critical indexes
model AffiliateSale {
  @@index([affiliateCode, createdAt])
  @@index([status])
  @@index([saleAmount])
  @@unique([orderId])
}

model AffiliateLedger {
  @@index([isSettled, profileId, createdAt])
  @@index([saleId])
}

model ShortLink {
  @@index([affiliateCode, createdAt])
  @@index([clickCount])
}
```

---

## 🚀 6. 배포 및 모니터링

### 6.1 환경 변수 설정

```bash
# .env.production
# Affiliate API
AFFILIATE_API_RATE_LIMIT=1000
AFFILIATE_TOKEN_EXPIRES_DAYS=90
AFFILIATE_WEBHOOK_TIMEOUT_MS=10000

# Fraud Detection
FRAUD_DETECTION_ENABLED=true
FRAUD_CRITICAL_THRESHOLD=85
FRAUD_CHECK_TIMEOUT_MS=5000

# External Services
MAXMIND_ACCOUNT_ID=123456
MAXMIND_LICENSE_KEY=xxx
IP_REPUTATION_SERVICE_URL=https://api.ipreputation.com

# Analytics
BIGQUERY_PROJECT_ID=mabiz-crm
BIGQUERY_DATASET=affiliate_analytics
```

### 6.2 모니터링 메트릭

```typescript
// Prometheus 메트릭
const metrics = {
  affiliateLinkClicks: new Counter({
    name: 'affiliate_link_clicks_total',
    help: 'Total affiliate link clicks',
    labelNames: ['affiliateCode', 'source'],
  }),
  
  affiliateSalesCreated: new Counter({
    name: 'affiliate_sales_created_total',
    help: 'Total affiliate sales created',
    labelNames: ['affiliateCode', 'status'],
  }),
  
  fraudDetectionDuration: new Histogram({
    name: 'affiliate_fraud_detection_duration_ms',
    help: 'Fraud detection latency',
    buckets: [10, 50, 100, 500, 1000, 5000],
  }),
  
  commissionCalculationDuration: new Histogram({
    name: 'affiliate_commission_calculation_duration_ms',
    help: 'Commission calculation latency',
    buckets: [5, 20, 50, 100, 500],
  }),
};
```

### 6.3 로깅 전략

```typescript
// Winston Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'affiliate.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// 로그 레벨별 기록
logger.info('[AFFILIATE_CLICK]', { affiliateCode, linkId, timestamp });
logger.warn('[FRAUD_DETECTED]', { saleId, riskScore, signals });
logger.error('[COMMISSION_ERROR]', { saleId, error });
```

---

## ✅ 7. 배포 체크리스트

- [ ] API 엔드포인트 12개 구현 및 테스트
- [ ] 파트너 토큰 발급 시스템
- [ ] Rate Limiting 설정
- [ ] Webhook Signature 검증
- [ ] 사기 탐지 엔진 통합
- [ ] 수당 계산 로직 검증
- [ ] 데이터베이스 인덱스 최적화
- [ ] 모니터링 대시보드 구성
- [ ] 로깅 시스템 확인
- [ ] 부하 테스트 (1000 QPS)
- [ ] 보안 감사 (OWASP Top 10)
- [ ] 파트너 문서화
- [ ] SLA 정의 (99.9% uptime)

---

## 📚 Reference

- [[affiliate_commission_models.md]] - 수당 모델
- [[affiliate_tracking_system.md]] - 추적 시스템
- [[affiliate_partner_dashboard.md]] - 파트너 대시보드
- [[affiliate_fraud_detection.md]] - 사기 탐지
