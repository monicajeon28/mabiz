# Affiliate Tracking System (어필리에이트 추적 시스템)

**작성일**: 2026-05-26  
**버전**: 1.0  
**대상**: 마비즈 CRM Affiliate Marketing 시스템

---

## 🎯 1. 추적 목표

### 1.1 핵심 지표 (Key Attribution Metrics)

```
Lead Source → Click → Landing → Inquiry → Booking → Completion
     ↓         ↓       ↓         ↓         ↓         ↓
   추적시작   attribution   lead gen  conversion  upsell  fulfillment
```

### 1.2 기본 원칙

```
1. 정확성 (Accuracy)
   - 클릭 추적 정확도 99%+
   - 거중복 방지 (De-duplication)
   
2. 귀속성 (Attribution)
   - First Click vs. Last Click vs. Multi-touch
   - 기여도 가중치 설정
   
3. 투명성 (Transparency)
   - 실시간 대시보드
   - 파트너 자가 검증
   
4. 보안 (Security)
   - HTTPS Only
   - API 토큰 기반 인증
   - 감사 로그 자동 기록
```

---

## 🔗 2. 추적 방식 3가지

### 2.1 URL Parameter (쿼리 문자열)

**정의**: URL에 파트너 ID를 매개변수로 포함

**포맷**:
```
https://mabiz.com/booking?affiliate=PARTNER123&campaign=SUMMER&source=facebook
```

**mabiz 스키마**:
```prisma
model ShortLink {
  id              String    @id @default(cuid())
  organizationId  String
  code            String    @unique  // 짧은 링크 코드
  originalUrl     String
  affiliateCode   String?
  campaignId      String?
  source          String?   // 'facebook' | 'instagram' | 'email' | ...
  medium          String?   // 'paid' | 'organic' | 'referral' | ...
  trackingParams  Json?     // { utm_campaign, utm_source, ... }
  clickCount      Int       @default(0)
  lastClickedAt   DateTime?
  createdAt       DateTime  @default(now())
  
  @@index([affiliateCode, createdAt])
  @@index([clickCount])
}
```

**파라미터 의미**:

| 파라미터 | 의미 | 예시 |
|---------|------|------|
| affiliate | 파트너 ID | PARTNER123 |
| campaign | 캠페인명 | SUMMER_2026 |
| source | 트래픽 소스 | facebook, instagram |
| medium | 마케팅 수단 | cpc, email, referral |
| content | 광고 콘텐츠 ID | ad_123 |

**생성 방식**:
```typescript
function generateAffiliateLink(
  baseUrl: string,
  affiliateCode: string,
  campaignId: string,
  source: string
): string {
  const params = new URLSearchParams({
    affiliate: affiliateCode,
    campaign: campaignId,
    source: source,
    timestamp: Date.now().toString(),
    nonce: generateRandomId(),
  });
  
  return `${baseUrl}?${params.toString()}`;
}
```

**장점**:
- 구현 간단
- 제3자 쿠키 불필요
- 모바일 친화

**단점**:
- 사용자가 링크 변경 가능
- 리다이렉트 필요
- QR 코드 변환 시 파라미터 손실 가능

**사용 사례**:
- SNS 공유 링크
- 이메일 캠페인
- QR 코드

---

### 2.2 First-Party Cookie

**정의**: 웹사이트 도메인에 저장된 쿠키

**mabiz 구현**:
```typescript
// 파트너 링크 클릭 시
function handleAffiliateClick(affiliateCode: string, campaignId: string) {
  // 1. 쿠키 저장 (30일)
  const cookieData = {
    affiliateCode,
    campaignId,
    clickedAt: new Date().toISOString(),
    deviceId: generateDeviceId(),
    sessionId: generateSessionId(),
  };
  
  setCookie('aff_tracking', JSON.stringify(cookieData), {
    maxAge: 30 * 24 * 60 * 60,
    secure: true,
    sameSite: 'Lax',
    domain: '.mabiz.com',
  });
  
  // 2. 서버에 기록
  await trackAffiliateLinkEvent({
    affiliateCode,
    eventType: 'CLICK',
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  });
  
  // 3. 방문자 추적
  await logVisitor({
    affiliateCode,
    source: 'organic',
    timestamp: new Date(),
  });
}
```

**쿠키 구조**:
```json
{
  "affiliateCode": "PARTNER123",
  "campaignId": "SUMMER_2026",
  "source": "facebook",
  "clickedAt": "2026-05-26T10:30:00Z",
  "deviceId": "device_abc123",
  "sessionId": "session_xyz789",
  "clickId": "click_12345",
  "touchpoints": [
    {
      "timestamp": "2026-05-26T10:30:00Z",
      "page": "/",
      "action": "view"
    },
    {
      "timestamp": "2026-05-26T10:35:00Z",
      "page": "/booking",
      "action": "form_start"
    }
  ]
}
```

**저장 위치**:
```
브라우저 쿠키 → 서버 검증 → Contact 레코드에 partnerId 저장
```

**mabiz 스키마**:
```prisma
model Contact {
  id                  String    @id @default(cuid())
  organizationId      String
  partnerId           String?   // 어필리에이트 파트너 ID
  affiliateCode       String?   // 파트너 코드
  affiliateSourceId   String?   // 링크/캠페인 ID
  affiliateClickedAt  DateTime? // 초기 클릭 시각
  affiliateCookie     String?   // 쿠키 식별자
  
  // ... 기타 필드
  
  @@index([affiliateCode])
  @@index([partnerId])
  @@index([affiliateClickedAt])
}
```

**장점**:
- 보안성 높음 (HTTPS 전송)
- 도메인 내 추적 정확
- 사용자 변조 어려움

**단점**:
- Cross-domain 추적 불가
- Safari 개인정보 보호 모드 제한
- 유럽 GDPR 동의 필요

**쿠키 보안**:
```typescript
// 쿠키 암호화
import crypto from 'crypto';

function encryptTrackingData(data: object): string {
  const json = JSON.stringify(data);
  const cipher = crypto.createCipher('aes-256-cbc', process.env.TRACKING_KEY);
  return cipher.update(json, 'utf8', 'hex') + cipher.final('hex');
}

function decryptTrackingData(encrypted: string): object {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.TRACKING_KEY);
  const json = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  return JSON.parse(json);
}
```

---

### 2.3 Postback URL (서버-투-서버)

**정의**: 파트너 서버에서 판매 발생시 직접 콜백

**플로우**:
```
파트너 서버 → 감지 → mabiz 서버 → Sales 기록
     (매출 발생)    (확인 호출)   (수당 계산)
```

**mabiz API**:
```
POST /api/affiliate/sales/postback
Authorization: Bearer PARTNER_TOKEN
Content-Type: application/json

{
  "externalOrderId": "ORD_12345",
  "affiliateCode": "PARTNER123",
  "saleAmount": 10000000,
  "currency": "KRW",
  "status": "COMPLETED",
  "travelCompletedAt": "2026-06-15T00:00:00Z",
  "metadata": {
    "cabinType": "SUITE",
    "passengers": 2,
    "departure": "2026-07-01"
  }
}
```

**검증 프로세스**:
```typescript
export async function handleAffiliatePostback(req: Request) {
  // 1. 토큰 검증
  const token = req.headers.authorization?.replace('Bearer ', '');
  const partner = await validatePartnerToken(token);
  if (!partner) throw new UnauthorizedError();
  
  // 2. 서명 검증 (HMAC)
  const signature = req.headers['x-affiliate-signature'];
  const calculated = crypto
    .createHmac('sha256', partner.webhookSecret)
    .update(req.body)
    .digest('hex');
  if (signature !== calculated) throw new BadRequestError('Invalid signature');
  
  // 3. 중복 방지
  const exists = await checkDuplicate(req.body.externalOrderId);
  if (exists) throw new ConflictError('Duplicate order ID');
  
  // 4. Sales 기록 생성
  const sale = await createAffiliateSale({
    organizationId: partner.organizationId,
    affiliateCode: partner.code,
    orderID: req.body.externalOrderId,
    saleAmount: req.body.saleAmount,
    status: 'PENDING',
  });
  
  // 5. 응답
  return { success: true, saleId: sale.id };
}
```

**mabiz 스키마**:
```prisma
model AffiliateSale {
  id                String       @id @default(cuid())
  organizationId    String
  affiliateCode     String
  orderId           String       @unique
  productName       String
  saleAmount        Int
  commissionRate    Int
  commissionAmount  Int
  status            String       // "PENDING" | "CONFIRMED" | "PAID" | "REFUNDED"
  refundedAt        DateTime?
  cancelledAt       DateTime?
  travelCompletedAt DateTime?
  paidAt            DateTime?
  sourceWebhook     String?      // Postback 소스 식별
  createdAt         DateTime     @default(now())
  
  @@index([affiliateCode, createdAt])
  @@index([status])
}
```

**장점**:
- 정확도 매우 높음
- 리얼타임 추적
- 브라우저 의존 없음

**단점**:
- 파트너 구현 필요
- 로그인 후 구매 추적 불가
- API 보안 관리 복잡

---

## 📊 3. Attribution Models (귀속 모델)

### 3.1 Last Click (마지막 클릭)

**정의**: 구매 직전 마지막 터치포인트에 100% 귀속

**예시**:
```
Facebook → Email → Direct → Purchase
            ↑       ↓
          추적      구매
            
결과: 모든 수당은 Direct(마지막)에 귀속 100%
```

**장점**: 구현 간단, 즉시 수익화

**단점**: 상위 단계 채널 가치 저평가

### 3.2 First Click (첫 클릭)

**정의**: 초기 인지 채널에 100% 귀속

```
Facebook → Email → Direct → Purchase
↑
전액 귀속

결과: 모든 수당은 Facebook에 귀속 100%
```

**장점**: 신규 고객 유입 인센티브

**단점**: 전환 채널 가치 무시

### 3.3 Multi-Touch (다중 터치)

**정의**: 여러 터치포인트에 가중치 배분

**가중치 예시**:
```
First Click:  40%
Middle Touch: 20%
Last Click:   40%

Facebook(1st)  → Email(middle) → Direct(last) → Purchase
    40%             20%             40%
```

**균등 분배 (Linear)**:
```
Facebook → Email → Direct → Purchase
   33%      33%      34%

3개 터치포인트 각각 균등 분배
```

**시간 감소 (Time Decay)**:
```
Facebook → Email → Direct → Purchase
   20%      30%      50%

최근 터치포인트에 더 높은 가중치
```

**mabiz 구현**:
```typescript
interface TouchPoint {
  timestamp: Date;
  source: string;
  medium: string;
  campaign: string;
}

function attributeRevenue(
  touchPoints: TouchPoint[],
  totalRevenue: number,
  model: 'first' | 'last' | 'linear' | 'time_decay'
): Map<string, number> {
  const attribution = new Map<string, number>();
  
  switch (model) {
    case 'first':
      attribution.set(touchPoints[0].source, totalRevenue);
      break;
      
    case 'last':
      attribution.set(touchPoints[touchPoints.length - 1].source, totalRevenue);
      break;
      
    case 'linear':
      const equalShare = totalRevenue / touchPoints.length;
      for (const tp of touchPoints) {
        attribution.set(tp.source, (attribution.get(tp.source) || 0) + equalShare);
      }
      break;
      
    case 'time_decay':
      const weights = calculateTimeDecayWeights(touchPoints);
      const weightSum = weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < touchPoints.length; i++) {
        const share = (weights[i] / weightSum) * totalRevenue;
        const source = touchPoints[i].source;
        attribution.set(source, (attribution.get(source) || 0) + share);
      }
      break;
  }
  
  return attribution;
}
```

---

## 🔍 4. 실시간 추적 대시보드

### 4.1 추적 이벤트 종류

| 이벤트 | 발생 조건 | 기록 정보 |
|--------|---------|---------|
| CLICK | 링크 클릭 | 타임스탬프, IP, 디바이스 |
| IMPRESSION | 배너/광고 노출 | 페이지, 위치, 노출 시간 |
| VISIT | 웹사이트 방문 | 세션 ID, 출처, 체류 시간 |
| INQUIRY | 문의 등록 | Contact 생성, 메시지 내용 |
| BOOKING | 예약 확정 | Order ID, 상품, 가격 |
| COMPLETION | 여행 완료 | 완료일, 최종 금액 |
| REFUND | 환불 요청 | 금액, 사유, 처리 상태 |

### 4.2 mafiz AffiliateLinkEvent 스키마

```prisma
model AffiliateLinkEvent {
  id          Int       @id @default(autoincrement())
  linkId      Int       // ShortLink ID
  actorId     Int?      // Partner ID
  eventType   String    // 'CLICK' | 'IMPRESSION' | 'BOOKING' | ...
  description String?
  metadata    Json?     // { ipAddress, userAgent, deviceId, ... }
  createdAt   DateTime  @default(now())
  
  @@index([linkId, createdAt])
}
```

### 4.3 실시간 메트릭 수집

```typescript
export async function trackEvent(event: TrackingEvent) {
  // 1. 이벤트 기록
  await prisma.affiliateLinkEvent.create({
    data: {
      linkId: event.linkId,
      eventType: event.type,
      metadata: {
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: new Date().toISOString(),
        geolocation: event.geo,
      },
    },
  });
  
  // 2. 실시간 메트릭 업데이트 (Redis)
  await redis.hincrby(`aff:link:${event.linkId}:daily`, event.type, 1);
  await redis.expire(`aff:link:${event.linkId}:daily`, 86400); // 24h
  
  // 3. 파트너 대시보드에 즉시 반영
  await publishToWebSocket(`partner:${event.partnerId}`, {
    event: 'metric_update',
    data: event,
  });
}
```

---

## 🛡️ 5. 데이터 무결성 & 중복 제거

### 5.1 중복 거래 감지

```typescript
export async function detectDuplicateTransaction(
  orderId: string,
  affiliateCode: string,
  saleAmount: number,
  timeWindow: number = 3600 // 1시간
): Promise<boolean> {
  const recent = await prisma.affiliateSale.findMany({
    where: {
      affiliateCode,
      saleAmount,
      createdAt: {
        gte: new Date(Date.now() - timeWindow * 1000),
      },
    },
  });
  
  return recent.length > 0;
}
```

### 5.2 봇 트래픽 필터링

```typescript
function isBotTraffic(userAgent: string, ipAddress: string): boolean {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /httpie/i,
  ];
  
  // User-Agent 검사
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    return true;
  }
  
  // IP 평판 검사
  if (knownBotIPs.includes(ipAddress)) {
    return true;
  }
  
  return false;
}
```

### 5.3 Lookback Window (귀속 기간)

```
30일 Lookback Window:
오늘로부터 30일 이전의 클릭만 인정

예시:
5월 25일 클릭 → 6월 5일 구매 (11일 경과) ✅ 인정
5월 1일 클릭 → 6월 5일 구매 (35일 경과) ❌ 제외
```

**mabiz 구현**:
```typescript
const LOOKBACK_DAYS = 30;

export function isWithinAttributionWindow(clickDate: Date): boolean {
  const now = new Date();
  const daysSince = (now.getTime() - clickDate.getTime()) / (24 * 60 * 60 * 1000);
  return daysSince <= LOOKBACK_DAYS;
}
```

---

## 📱 6. 크로스 디바이스 추적

### 6.1 Device ID 기반

```typescript
function generateDeviceId(fingerprint: {
  userAgent: string;
  language: string;
  timezone: string;
  colorDepth: number;
}): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(fingerprint))
    .digest('hex');
  
  return `device_${hash.substring(0, 12)}`;
}
```

### 6.2 Login ID 기반

```
Device A (익명) → 링크 클릭 → 쿠키 저장
                              ↓
Device B (로그인) → 구매 → 동일 사용자 확인 ✅
```

**cross-device 매칭**:
```typescript
export async function matchCrossDeviceConversion(
  loginUserId: string,
  deviceId: string,
  saleAmount: number
): Promise<Attribution> {
  // 1. 사용자의 모든 디바이스 찾기
  const userDevices = await getUserDevices(loginUserId);
  
  // 2. 30일 이내 클릭 이력 확인
  const attributedClick = await findAttributedClick(
    userDevices,
    30
  );
  
  if (attributedClick) {
    // 3. 크로스디바이스 수당 기록
    return {
      affiliateCode: attributedClick.affiliateCode,
      saleAmount,
      crossDevice: true,
      attribution: 'cross_device',
    };
  }
  
  return null;
}
```

---

## ✅ 7. 데이터 정확성 검증

### 7.1 월별 대사(Reconciliation)

```typescript
export async function reconciliateMonthlyData(year: number, month: number) {
  // 1. Affiliate 판매액 합산
  const salesTotal = await prisma.affiliateSale.aggregate({
    _sum: { saleAmount: true },
    where: {
      createdAt: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    },
  });
  
  // 2. Partner 수익 합산
  const partnerPayouts = await prisma.affiliateLedger.aggregate({
    _sum: { netAmount: true },
    where: {
      createdAt: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    },
  });
  
  // 3. 차이 분석
  const variance = salesTotal._sum.saleAmount - partnerPayouts._sum.netAmount;
  
  if (Math.abs(variance) > VARIANCE_THRESHOLD) {
    // 4. 알림 발송
    await notifyFinanceTeam({
      month: `${year}-${month}`,
      variance,
      action: 'MANUAL_REVIEW_REQUIRED',
    });
  }
}
```

---

## 🎯 Summary: 추적 방식 선택

| 상황 | 추천 방식 | 이유 |
|------|---------|------|
| SNS 공유 | URL Param | QR 가능, 간단 |
| 대규모 캠프 | First-Party Cookie | 정확성 높음 |
| B2B 통합 | Postback URL | 자동화, 실시간 |
| 멀티채널 | 혼합 | 채널별 최적화 |

---

## 📚 Reference

- [[affiliate_commission_models.md]] - 수당 계산 모델
- [[affiliate_fraud_detection.md]] - 사기 탐지
- [[affiliate_integration_architecture.md]] - 기술 아키텍처
