# 크루즈닷몰 결제 ↔ CRM 수당 추적 데이터 흐름 분석

**작성일**: 2026-05-21  
**범위**: 웰컴페이먼츠(B2C)/페이앱(B2B) 결제 웹훅 → 수당 계산 및 환불 처리

---

## 1. 아키텍처 개요

### 1.1 결제 채널 분리 (B2C ↔ B2B)

| 항목 | B2C (크루즈닷몰) | B2B (페이앱) |
|------|-----------------|-----------|
| **결제사** | 웰컴페이먼츠 | PayApp |
| **CRM 테이블** | `AffiliateSale` (공유) | `PayAppPayment` (독립) |
| **수당 관리** | `AffiliateSale.commissionAmount` | N/A (B2B 수당 없음) |
| **웹훅 엔드포인트** | `/api/webhooks/purchase` | `/api/webhooks/payapp` |
| **환불 엔드포인트** | `/api/webhooks/refund` | PayApp 웹훅 통합 처리 |
| **조직 특정** | affiliateCode 또는 organizationId | 랜딩페이지 slug |

### 1.2 데이터 흐름 타임라인

```
[결제 발생]
    ↓
┌─────────────────────────────────────────┐
│ B2C: 크루즈닷몰 웰컴페이먼츠           │
│ B2B: PayApp → CRM 랜딩페이지          │
└────────────────────┬────────────────────┘
                     ↓
          [웹훅 → CRM 수신]
                     ↓
          [Contact 생성/업데이트]
                     ↓
          [AffiliateSale 기록]
                     ↓
          [1단계] saleAmount ✓, commissionRate = null
                     ↓
         [관리자 승인 → 2단계]
                     ↓
          [2단계] commissionRate ✓, commissionAmount 계산
                     ↓
        [정산 주기 (월/분기)]
                     ↓
          [수당 지급 처리]
```

---

## 2. 결제 흐름: 웹훅 이벤트 체인

### 2.1 B2C: POST /api/webhooks/purchase

**호출자**: 크루즈닷몰 (cruisedot.co.kr)  
**인증**: `Authorization: Bearer MABIZ_PURCHASE_WEBHOOK_SECRET` (Bearer 토큰)

#### 입력 필드
```json
{
  "phone": "010-1234-5678",              // 필수
  "name": "김영희",                       // 필수
  "orderId": "ORDER_20260521_001",       // 필수 (유일키)
  "affiliateCode": "AFFILIATE_A",        // 선택 (없으면 organizationId로 특정)
  "organizationId": "org_xxx",           // 선택
  "saleAmount": 3000000,                 // 필수 (판매액)
  "commissionRate": null,                // 1단계: null, 2단계: 10.0
  "commissionAmount": null,              // 1단계: null, 2단계: 300000
  "productName": "발틱 크루즈",
  "departureDate": "2026-06-15",
  "customerEmail": "kim@example.com",
  "saleId": 12345,                       // 크루즈닷몰 sales.id
  "cruiseLine": "MSC",
  "shipName": "MSC Meraviglia",
  "nights": 7,
  "days": 8,
  "basePrice": 2800000,
  "headcount": 2,
  "cabinType": "balcony",
  "eventId": "evt_abc123"                // 멱등성 추적
}
```

#### 처리 로직

1. **멱등성 검증** (eventId 기준)
   ```sql
   SELECT eventId FROM ProcessedWebhookEvent WHERE eventId = ?
   ```
   - 중복 수신 시 즉시 SUCCESS 반환 (`duplicate: true`)

2. **조직(Organization) 특정** (3순위)
   - 1순위: `organizationId` 파라미터
   - 2순위: `affiliateCode` → `Contact` / `AffiliateSale` 역추적
   - 3순위: `DEFAULT_ORGANIZATION_ID` 환경변수

3. **Contact 트랜잭션 처리**
   ```typescript
   // Contact upsert (전화+조직으로 유일성)
   Contact.upsert({
     where: { phone_organizationId: { phone, organizationId } },
     create: {
       phone, name, email, productName, departureDate,
       bookingRef: orderId,
       affiliateCode,
       purchasedAt: new Date(),
       channel: "b2c",
     },
     update: { /* 선택적 갱신 */ }
   })
   
   // CruiseProduct upsert (productCode 기준)
   if (productCode && basePrice) {
     CruiseProduct.upsert({
       where: { productCode },
       create: {
         productCode, packageName, basePrice, startDate,
         cruiseLine, shipName, nights, days,
         saleStatus: "AVAILABLE",
       },
       update: { /* 선택적 갱신 */ }
     })
   }
   
   // AffiliateSale upsert (orderId 기준) ← 핵심
   if (orderId && saleAmount > 0) {
     AffiliateSale.upsert({
       where: { orderId },
       create: {
         organizationId, affiliateCode, productName,
         saleAmount,
         commissionRate: null,           // 1단계: 미확정
         commissionAmount: 0,
         status: "PENDING",
         sourceWebhook: "purchase",
       },
       update: {
         // 2단계 웹훅: commission 필드만 갱신 (판매액은 유지)
         commissionRate: ...,
         commissionAmount: ...,
         saleAmount: ... (만약 값이 있으면)
       }
     })
   }
   ```

4. **VIP 그룹 자동 배정** (선택적)
   ```typescript
   // "VIP" / "구매" / "출발" 키워드 포함 그룹 자동 할당 → 퍼널 트리거
   ```

5. **응답**
   ```json
   {
     "ok": true,
     "contactId": "contact_xyz",
     "funnelStarted": false
   }
   ```

#### 에러 처리

| 상태코드 | 상황 | 조치 |
|---------|------|------|
| 400 | phone/name 누락 | 클라이언트 오류 |
| 401 | 시크릿 검증 실패 | 보안 검증 재확인 |
| 422 | 조직 특정 불가 | affiliateCode 매핑 확인 |
| 500 | DB 트랜잭션 실패 | DLQ 큐 저장 → `/api/cron/retry-mabiz-dlq` 재시도 |

---

### 2.2 B2C: POST /api/webhooks/refund

**호출자**: 크루즈닷몰 (웰컴페이먼츠 환불 완료 후)  
**인증**: `Authorization: Bearer MABIZ_REFUND_WEBHOOK_SECRET`

#### 입력 필드
```json
{
  "orderId": "ORDER_20260521_001",       // 필수
  "buyerPhone": "010-1234-****",         // 선택 (마스킹됨)
  "buyerName": "김영희",
  "amount": 3000000,                     // 환불액 (필수)
  "refundAmount": 3000000,               // 하위호환성
  "reason": "고객 요청",
  "saleId": 12345,                       // 크루즈닷몰 sales.id
  "refundedAt": "2026-05-22T10:30:00Z",
  "organizationId": "org_xxx",           // 선택
  "eventId": "evt_def456"                // 멱등성 추적
}
```

#### 처리 로직

1. **멱등성 검증** (eventId)
   ```sql
   SELECT eventId FROM ProcessedWebhookEvent WHERE eventId = ?
   ```

2. **orderId → Contact 역추적**
   ```sql
   SELECT * FROM Contact 
   WHERE bookingRef = ? AND organizationId = ?
   ```

3. **Contact 상태 변경** (트랜잭션)
   ```typescript
   Contact.update({
     where: { id: contactId },
     data: {
       type: "REFUNDED",
       lastPaymentStatus: "refunded",
       lastRefundedAt: new Date(refundedAt),
       paymentStatusNote: `환불완료: ${amount.toLocaleString()}원`
     }
   })
   
   // 환불 메모 기록
   ContactMemo.create({
     data: {
       contactId,
       userId: "system-webhook",
       content: `[환불완료] ${amount}원\n사유: ${reason}\n주문번호: ${orderId}`
     }
   })
   ```

4. **⭐️ AffiliateSale 수당 100% 완전 취소** (P0 요구사항)
   ```typescript
   // orderId로 AffiliateSale 찾기
   const sale = AffiliateSale.findUnique({
     where: { orderId },
     select: {
       id, saleAmount, commissionAmount, commissionRate
     }
   })
   
   if (sale && sale.commissionAmount > 0) {
     // 100% 완전 취소 (비례 감액 아님)
     AffiliateSale.update({
       where: { id: sale.id },
       data: {
         refundedAmount: sale.saleAmount,
         refundedAt: new Date(refundedAt),
         commissionAmount: 0,              // ← 핵심: 0으로 완전 취소
         status: "REFUNDED",
         cancelReason: "CUSTOMER_REFUND_REQUEST"
       }
     })
   }
   ```

5. **응답**
   ```json
   {
     "ok": true,
     "contactFound": true
   }
   ```

---

### 2.3 B2B: POST /api/webhooks/payapp

**호출자**: PayApp (결제/취소 통합 웹훅)  
**인증**: IP 화이트리스트 + linkval HMAC 검증

#### 지원 상태 (pay_state)

| pay_state | 상태 | 처리 |
|-----------|------|------|
| 4 | 결제완료 | Contact 생성, PayAppPayment 기록 |
| 8/9/16/32/64 | 취소 | PayAppPayment 상태 변경, **AffiliateSale 수당 취소** |
| 70/71 | 부분취소 | PayAppPayment 부분 환불 기록, **AffiliateSale 수당 비례감액** |
| 10 | 가상계좌 대기 | 상태 변경만 |

#### 결제완료 (pay_state=4) 처리

```typescript
// PayAppPayment 생성/업데이트
PayAppPayment.upsert({
  where: { orderId: orderId || `mul_${mulNo}` },
  create: {
    orderId, organizationId, amount: price,
    customerPhone, customerName, productName,
    mulNo, payType, cardName, status: "paid",
    paidAt: new Date(),
  },
  update: { status: "paid", paidAt: new Date() }
})

// Contact 생성
Contact.upsert({
  where: { phone_organizationId: { phone, organizationId } },
  create: {
    organizationId, name, phone, type: "CUSTOMER",
    channel: "b2b", purchasedAt: new Date()
  },
  update: { type: "CUSTOMER", channel: "b2b" }
})

// 현금영수증 자동 발행 (선택적, 은행이체/가상계좌 전용)
issueCashReceipt({ goodName, buyerName, buyerPhone, amount })
```

#### 취소 (pay_state=8,9,16,32,64) 처리

```typescript
// PayAppPayment 취소
PayAppPayment.updateMany({
  where: { orderId, status: { not: "cancelled" } },
  data: {
    status: "cancelled",
    refundedAt: new Date(canceldate),
    refundReason: cancelmemo || "PayApp 취소"
  }
})

// ⭐️ AffiliateSale 수당 완전 취소
const sale = AffiliateSale.findUnique({
  where: { orderId },
  select: { id, saleAmount, commissionAmount, commissionRate }
})

if (sale && sale.commissionAmount > 0) {
  AffiliateSale.update({
    where: { id: sale.id },
    data: {
      refundedAmount: sale.saleAmount,
      refundedAt: new Date(canceldate),
      commissionAmount: 0,                 // ← 100% 취소
      status: "REFUNDED",
      cancelReason: "PAYMENT_CANCELLED_PAYAPP"
    }
  })
}
```

#### 부분취소 (pay_state=70,71) 처리

```typescript
const partialAmount = origPrice - price;  // 원금 - 현금 = 환불액

// PayAppPayment 부분 환불 기록
PayAppPayment.update({
  where: { id: original.id },
  data: {
    status: "partial_refunded",
    refundAmount: (original.refundAmount ?? 0) + partialAmount,
    refundedAt: new Date(canceldate),
  }
})

// ⭐️ AffiliateSale 수당 비례감액 (새로운 기능)
const sale = AffiliateSale.findUnique({
  where: { orderId },
  select: { id, saleAmount, commissionAmount, commissionRate }
})

if (sale && sale.commissionAmount > 0 && partialAmount > 0) {
  // 환불액 비율만큼만 수당 감액 (전체 취소 아님)
  const refundRatio = partialAmount / sale.saleAmount;
  const deduction = Math.floor(sale.commissionAmount * refundRatio);
  
  AffiliateSale.update({
    where: { id: sale.id },
    data: {
      refundedAmount: { increment: partialAmount },
      commissionAmount: { decrement: deduction },  // ← 비례감액
      status: "PARTIAL_REFUNDED"
    }
  })
}
```

---

## 3. 테이블 스키마 및 필드 매핑

### 3.1 AffiliateSale (공유 테이블)

```prisma
model AffiliateSale {
  id                String    @id @default(cuid())
  organizationId    String    // CRM 조직 ID
  affiliateCode     String    // 파트너 코드
  affiliateUserId   String?   // 파트너 사용자 ID
  productName       String    // "발틱 크루즈" 등
  
  // ★ 금액 필드 (2026-05-16 필드명 확정)
  saleAmount        Int       // 판매액 (필수, 웹훅에서 받음)
  commissionRate    Int?      // 수당율 % (1단계: null)
  commissionAmount  Int       // 수당액 (1단계: 0, 2단계: 계산됨)
  
  // 환불 추적
  refundedAmount    Int       // 환불액 (0 기본값)
  refundedAt        DateTime? // 환불 일시
  
  // 상태 관리
  status            String    // PENDING|APPROVED|REFUNDED|PARTIAL_REFUNDED
  cancelReason      String?   // 취소 사유
  cancelledAt       DateTime? // 취소 일시
  
  // 외부 연동
  orderId           String?   @unique  // 크루즈닷몰 orderCode
  sourceWebhook     String?   // "purchase"|"cruise-purchase"|"payapp"
  saleId            Int?      // 크루즈닷몰 sales.id
  cruiseSaleId      Int?      // 중복?
  
  // 고객 정보
  customerPhone     String?   // "010-****" (마스킹)
  headcount         Int?      // 인원수
  cabinType         String?   // "balcony", "inside" 등
  
  // 여행 완료 추적
  travelCompletedAt DateTime?
  paidAt            DateTime?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@index([organizationId])
  @@index([affiliateCode])
  @@index([status])
  @@index([refundedAt])
  @@map("CrmAffiliateSale")
}
```

#### 필드 설명

| 필드 | 타입 | 설명 | 예시 |
|-----|------|------|------|
| `saleAmount` | Int | 판매액 | 3,000,000 |
| `commissionRate` | Int\|null | 수당율 (%) | null(1단계) / 10(2단계) |
| `commissionAmount` | Int | 수당액 (계산됨) | 0(1단계) / 300,000(2단계) |
| `refundedAmount` | Int | 환불액 누적 | 0 / 3,000,000 |
| `status` | String | 상태 | PENDING / APPROVED / REFUNDED |
| `cancelReason` | String | 취소 사유 | CUSTOMER_REFUND_REQUEST / PAYMENT_CANCELLED_PAYAPP |

### 3.2 Contact (B2C 구매자 추적)

```prisma
model Contact {
  id                    String
  phone                 String
  organizationId        String
  name                  String
  email                 String?
  
  // 구매 정보
  type                  String        // CUSTOMER|REFUNDED|...
  bookingRef            String?       // orderId 저장
  productName           String?
  departureDate         DateTime?
  purchasedAt           DateTime?
  
  // 결제 상태
  lastPaymentStatus     String?       // "paid"|"refunded"|...
  lastRefundedAt        DateTime?
  paymentStatusNote     String?       // "환불완료: 3,000,000원"
  
  // 파트너 추적
  affiliateCode         String?
  
  channel               String        // "b2c" for 크루즈닷몰
  
  @@unique([phone, organizationId])
  @@index([organizationId])
  @@index([bookingRef])
}
```

### 3.3 PayAppPayment (B2B 결제 기록)

```prisma
model PayAppPayment {
  id                String
  organizationId    String?
  orderId           String?  @unique
  mulNo             String?  // 정기결제 회차
  
  amount            Int      // 결제액
  refundAmount      Int?     // 환불액
  
  customerPhone     String
  customerName      String
  productName       String?
  
  payType           String   // "card"|"bank_transfer"|...
  cardName          String?  // "삼성카드" 등
  cstUrl            String?  // 가맹점 URL
  
  status            String   // "paid"|"cancelled"|"partial_refunded"|...
  paidAt            DateTime?
  refundedAt        DateTime?
  refundReason      String?
  
  landingPageId     String?  // CRM 랜딩페이지 slug
  metadata          Json?    // 현금영수증 등 추가 정보
  
  @@index([organizationId])
  @@index([orderId])
  @@index([mulNo])
}
```

### 3.4 ProcessedWebhookEvent (멱등성 추적)

```prisma
model ProcessedWebhookEvent {
  eventId       String  @id     // 웹훅 제공자의 이벤트 ID
  webhookType   String          // "purchase"|"refund"|"payapp"
  createdAt     DateTime @default(now())
}
```

---

## 4. 데이터 흐름: 필드 매핑

### 4.1 결제 → 판매 기록 (1단계)

| 웹훅 필드 | Contact | AffiliateSale | 설명 |
|----------|---------|---------------|------|
| `phone` | phone | customerPhone (마스킹) | 구매자 전화번호 |
| `name` | name | - | 구매자 이름 |
| `orderId` | bookingRef | orderId | 주문번호 (유일키) |
| `saleAmount` | - | saleAmount | 판매액 |
| `commissionRate` | - | null | 1단계: 미확정 |
| `commissionAmount` | - | 0 | 1단계: 0으로 초기화 |
| `productName` | productName | productName | 상품명 |
| `affiliateCode` | affiliateCode | affiliateCode | 파트너 코드 |
| `departureDate` | departureDate | - | 출발일 |

### 4.2 관리자 승인 (2단계 웹훅)

```json
{
  "orderId": "ORDER_20260521_001",
  "commissionRate": 10.0,              // ← 새로운 값
  "commissionAmount": 300000,          // ← 새로운 값
  "saleAmount": 3000000                // ← 갱신 (선택적)
}
```

**upsert 로직**:
```typescript
AffiliateSale.upsert({
  where: { orderId },
  update: {
    commissionRate: 10.0,           // ← 갱신됨
    commissionAmount: 300000,       // ← 갱신됨
    // saleAmount는 조건부 갱신 (값 > 0이면만)
  }
})
```

### 4.3 환불 처리

```
[환불 웹훅]
    ↓
AffiliateSale.update({
  refundedAmount: saleAmount,       // 전액 환불액 기록
  refundedAt: refundedAt,
  commissionAmount: 0,              // ← 수당 100% 취소
  status: "REFUNDED"                // 상태 변경
})
```

---

## 5. 검증 및 감시 쿼리

### 5.1 수당 계산 정합성 검증

```sql
-- 목적: 1단계 대기 중인 판매 (commissionRate가 null인 건들)
SELECT 
  a.id,
  a.orderId,
  a.saleAmount,
  a.commissionRate,
  a.status,
  a.createdAt,
  CURRENT_TIMESTAMP - a.createdAt AS wait_duration
FROM "CrmAffiliateSale" a
WHERE a."commissionRate" IS NULL
  AND a.status = 'PENDING'
  AND CURRENT_TIMESTAMP - a."createdAt" > INTERVAL '7 days'  -- 7일 이상 대기
ORDER BY a."createdAt" ASC;
```

**용도**: 관리자 미승인 건들 자동 알림

### 5.2 환불 정합성 검증

```sql
-- 목적: 환불됨(refundedAt 있음)인데 commissionAmount > 0인 이상 건
SELECT 
  a.id,
  a.orderId,
  a.saleAmount,
  a.commissionAmount,
  a.refundedAmount,
  a.refundedAt,
  a.status
FROM "CrmAffiliateSale" a
WHERE a."refundedAt" IS NOT NULL
  AND a."commissionAmount" > 0  -- ← 이상 (0이어야 함)
  AND a.status != 'REFUNDED'     -- 상태도 맞지 않음
ORDER BY a."refundedAt" DESC;
```

**용도**: 부분 환불만 처리되었으나 완전 취소 필요한 건들 식별

### 5.3 중복 주문 검증

```sql
-- 목적: 같은 orderId로 여러 행이 있는 경우
SELECT 
  a."orderId",
  COUNT(*) AS count,
  ARRAY_AGG(a.id) AS ids,
  ARRAY_AGG(a."saleAmount") AS amounts
FROM "CrmAffiliateSale" a
WHERE a."orderId" IS NOT NULL
GROUP BY a."orderId"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

**용도**: 데이터 무결성 검증 (orderId는 유일해야 함)

### 5.4 월별 수당 현황

```sql
-- 목적: 조직별/월별 수당 현황
SELECT 
  DATE_TRUNC('month', a."createdAt") AS month,
  o.name AS organization,
  COUNT(*) AS sale_count,
  SUM(a."saleAmount") AS total_sale,
  SUM(a."commissionAmount") AS total_commission,
  SUM(CASE WHEN a.status = 'REFUNDED' THEN a."commissionAmount" ELSE 0 END) 
    AS cancelled_commission,
  SUM(CASE WHEN a."commissionRate" IS NOT NULL THEN 1 ELSE 0 END) 
    AS approved_count,
  SUM(CASE WHEN a."commissionRate" IS NULL THEN 1 ELSE 0 END) 
    AS pending_count
FROM "CrmAffiliateSale" a
JOIN "Organization" o ON o.id = a."organizationId"
WHERE a."createdAt" >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
GROUP BY DATE_TRUNC('month', a."createdAt"), o.name
ORDER BY DATE_TRUNC('month', a."createdAt") DESC, o.name;
```

---

## 6. 현재 구현 상태

### 6.1 완성된 기능 ✅

| 기능 | 상태 | 파일 | 비고 |
|-----|------|------|------|
| **1단계 웹훅** | ✅ | `/api/webhooks/purchase` | saleAmount 수신, commissionRate=null |
| **2단계 웹훅** | ✅ | `/api/webhooks/purchase` | upsert로 commissionRate/commissionAmount 갱신 |
| **환불 처리** | ✅ | `/api/webhooks/refund` | 100% 완전 취소 (commissionAmount → 0) |
| **부분환불** | ✅ | `/api/webhooks/payapp` | 비례감액 (새 기능) |
| **멱등성** | ✅ | `ProcessedWebhookEvent` | eventId 기반 중복 수신 방지 |
| **Contact 생성** | ✅ | 모든 웹훅 | phone_organizationId 유일성 |
| **CruiseProduct** | ✅ | `/api/webhooks/purchase` | productCode 기반 마스터 관리 |
| **DLQ 재시도** | ✅ | `/api/cron/retry-mabiz-dlq` | 실패 건 자동 재처리 |

### 6.2 개선 필요 사항 ⚠️

| 항목 | 현황 | 개선안 |
|-----|------|--------|
| **다단계 수당** | 미지원 | OVERRIDE_COMMISSION, BRANCH_COMMISSION 구조화 |
| **정산 주기** | 수동 | 자동 정산 배치 (월말 자동) |
| **부분환불 처리** | 비례감액만 | 부분환불 후 재환불 시나리오 |
| **수당 지급** | 미구현 | 은행 계좌 검증 → 자동 이체 |
| **감시 대시보드** | 미지원 | 월별 수당/환불/대기 건수 실시간 모니터링 |
| **API 검증** | Basic | Zod/Joi 스키마 추가 |
| **로깅** | Logger 기반 | 구조화된 로그 (JSON) 저장 |

---

## 7. 문제점 및 위험 사항

### 7.1 P0: 심각

| 문제 | 영향 | 해결책 |
|-----|------|--------|
| **수당 부분환불 미처리** | 환불 후 수당이 정상가보다 많음 | PayApp 부분환불 이후에도 AffiliateSale 계속 추적? |
| **정산 기간 불명확** | 파트너가 수당 시기를 모름 | 정산 주기 명시 (월말? 분기말?) |
| **affiliateCode ↔ organizationId 불일치** | 수당이 잘못된 조직에 기록됨 | 웹훅 발송 시 organizationId 직접 포함 요청 |

### 7.2 P1: 높음

| 문제 | 영향 | 해결책 |
|-----|------|--------|
| **commissionRate 영구 null** | 수당 계산 불가 | 자동 승인 정책 또는 기본값 설정 |
| **환불 후 재결제** | 중복 orderId 감지 못함 | orderId 재사용 정책 명확화 |
| **크루즈닷몰 ↔ CRM DB 동기화 지연** | 수당이 최대 N시간 늦음 | 실시간 조회 API 추가 |

### 7.3 P2: 중간

| 문제 | 영향 | 해결책 |
|-----|------|--------|
| **마스킹된 customerPhone** | 고객 특정 어려움 | Contact.phone으로 재매칭 |
| **정산 실패 재처리 없음** | 일부 파트너가 수당 미지급 | Retry 정책 + 수동 승인 프로세스 |

---

## 8. API 호출 예시

### 8.1 1단계: 결제 완료 웹훅 (크루즈닷몰 → CRM)

```bash
curl -X POST https://crm.example.com/api/webhooks/purchase \
  -H "Authorization: Bearer secret_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "010-1234-5678",
    "name": "김영희",
    "orderId": "ORDER_20260521_001",
    "affiliateCode": "AFFILIATE_A",
    "saleAmount": 3000000,
    "commissionRate": null,
    "productName": "발틱 크루즈",
    "eventId": "evt_abc123"
  }'

# 응답
{
  "ok": true,
  "contactId": "contact_xyz",
  "funnelStarted": false
}
```

### 8.2 2단계: 관리자 승인 웹훅 (크루즈닷몰 관리자 → CRM)

```bash
curl -X POST https://crm.example.com/api/webhooks/purchase \
  -H "Authorization: Bearer secret_abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_20260521_001",
    "affiliateCode": "AFFILIATE_A",
    "saleAmount": 3000000,
    "commissionRate": 10.0,
    "commissionAmount": 300000,
    "eventId": "evt_def456"
  }'

# 응답
{
  "ok": true,
  "contactId": "contact_xyz",
  "funnelStarted": false
}
```

### 8.3 환불 웹훅 (크루즈닷몰 → CRM)

```bash
curl -X POST https://crm.example.com/api/webhooks/refund \
  -H "Authorization: Bearer secret_xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_20260521_001",
    "buyerPhone": "010-1234-****",
    "amount": 3000000,
    "reason": "고객 요청",
    "refundedAt": "2026-05-22T10:30:00Z",
    "eventId": "evt_ghi789"
  }'

# 응답
{
  "ok": true,
  "contactFound": true
}
```

### 8.4 PayApp 취소 웹훅

```bash
curl -X POST https://crm.example.com/api/webhooks/payapp \
  -H "x-forwarded-for: 123.45.67.89" \
  --data-urlencode "pay_state=8" \
  --data-urlencode "var1=ORDER_20260521_002" \
  --data-urlencode "cancelmemo=고객 요청" \
  --data-urlencode "canceldate=2026-05-22T10:30:00Z" \
  --data-urlencode "linkval=abc123..."

# 응답
SUCCESS
```

---

## 9. 데이터 정정 SQL (긴급용)

### 9.1 수당 누락 복구

```sql
-- 상황: commissionRate가 정해졌으나 commissionAmount = 0인 경우
UPDATE "CrmAffiliateSale"
SET 
  "commissionAmount" = CAST("saleAmount" * "commissionRate" / 100.0 AS INT),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE 
  "commissionRate" IS NOT NULL 
  AND "commissionAmount" = 0
  AND "saleAmount" > 0
  AND "status" != 'REFUNDED';
```

### 9.2 환불 미처리 복구

```sql
-- 상황: refundedAt이 있는데 commissionAmount > 0
UPDATE "CrmAffiliateSale"
SET 
  "commissionAmount" = 0,
  "status" = 'REFUNDED',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE 
  "refundedAt" IS NOT NULL 
  AND "commissionAmount" > 0
  AND "status" != 'REFUNDED';
```

---

## 10. 환경 변수 (필수)

| 변수 | 값 | 설명 |
|-----|-----|------|
| `MABIZ_PURCHASE_WEBHOOK_SECRET` | secret_*** | /api/webhooks/purchase 인증 |
| `MABIZ_REFUND_WEBHOOK_SECRET` | secret_*** | /api/webhooks/refund 인증 |
| `CRUISE_PURCHASE_WEBHOOK_SECRET` | secret_*** | /api/webhooks/cruise-purchase 인증 |
| `PAYAPP_ALLOWED_IPS` | 123.45.67.89, ... | PayApp IP 화이트리스트 |
| `DEFAULT_ORGANIZATION_ID` | org_*** | 기본 조직 ID (fallback) |

---

## 11. 결론

### 핵심 데이터 흐름

```
[결제]
  ↓
[1단계 웹훅] saleAmount + Contact 생성
  ↓
[관리자 승인] commissionRate 결정
  ↓
[2단계 웹훅] commissionAmount 계산 및 저장
  ↓
[정산] (미구현) 월별 합산 및 지급
  ↓
[환불] 100% 취소 또는 비례감액
```

### 현황

- **결제 → 판매 기록**: ✅ 완성 (1,2단계 웹훅)
- **환불 처리**: ✅ 완성 (전액/부분 모두)
- **멱등성**: ✅ 완성 (eventId 기반)
- **정산**: ⏳ 미구현 (수동 처리 중)
- **지급**: ⏳ 미구현 (은행 이체 필요)

### 다음 단계

1. **정산 배치** 구현 (월말 자동 정산)
2. **수당 지급** 자동화 (은행 계좌 검증)
3. **모니터링 대시보드** (실시간 현황)
4. **부분환불 재처리** 정책 (환불 후 재결제)

---

**문서 버전**: 1.0  
**마지막 수정**: 2026-05-21  
**작성자**: Claude Code (분석)
