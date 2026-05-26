# Affiliate + CRM Integration Framework (2026-05-26)

## 1. 개요: Affiliate-Contact 양방향 링크

마비즈 CRM은 Affiliate Partner와 Customer Contact의 양방향 관계를 지원합니다.

### 1.1 핵심 관계도

```
Contact (고객)
├── partnerId (String, nullable) ──> Partner (제휴 파트너)
│   ├── id, organizationId, name, email, phone
│   ├── commissionRate (소수점 2자리)
│   ├── totalRevenue (누적 매출, BigInt)
│   └── status ("ACTIVE", "INACTIVE", "SUSPENDED")
│
└── affiliateCode (String, 소속 코드)
    └── AffiliateSale (판매 기록)
        ├── saleAmount, commissionRate, commissionAmount
        ├── status ("PENDING", "APPROVED", "CONFIRMED", "REFUNDED")
        ├── externalOrderCode (외부 주문번호)
        └── sourceWebhook (어느 플랫폼에서 온 매출인지)
```

### 1.2 기존 Affiliate 모델 (비수정)
- **AffiliateSale**: 외부 플랫폼(GMcruise)에서 온 매출 기록
  - affiliateCode, affiliateUserId, saleAmount, commissionAmount
  - status: PENDING → APPROVED → CONFIRMED → REFUNDED
  - refundedAmount, cancelledAt, paidAt
- **Partner**: 직판 파트너 (Contact과 직접 링크)
  - Contact.partnerId → Partner.id
  - commissionRate (퍼센트, Decimal 5.2)
  - totalRevenue (합계)

### 1.3 새로운 추가 필드 (Contact 모델)

**이미 schema.prisma에 존재**:
```sql
Contact.partnerId (String?) → Partner.id  -- 직판 파트너 링크
Contact.affiliateCode (String?) -- 거래처별 고유 코드
```

---

## 2. 다중 Affiliate 소스 통합

### 2.1 Commission Structure (다중 채널)

각 접촉 채널별로 **다른 commission rate** 적용:

| 채널 | 소스 | Commission | Contact 필드 | 참고 |
|------|------|-----------|-------------|------|
| **Platform** | GMcruise | 5-8% | `affiliateCode` | AffiliateSale 기록 |
| **Direct Partner** | Partner CRM | 10-15% | `partnerId` | Partner 모델 직접 링크 |
| **Referral** | 기존 고객 추천 | 3-5% | `sourceOrgId` | Contact 원본 조직 |
| **B2B** | B2B Landing | 12-20% | `b2bLandingId` (추가 필드) | B2BLandingPage |
| **Organic/Direct** | 자사 채널 | 0% | `channel = "direct"` | Commission 없음 |

**구현 방식**:
```typescript
interface AffiliateCommissionConfig {
  source: "platform" | "partner" | "referral" | "b2b" | "organic";
  baseRate: number; // 기본 commission %
  tierMultiplier: number; // Tier별 추가 배수 (1.0x ~ 1.5x)
  capped?: boolean; // 최대 상한선 존재 여부
  cappedAt?: number; // 최대 commission 금액
}
```

### 2.2 Contact 필드 추가 (향후 마이그레이션)

```sql
ALTER TABLE Contact ADD COLUMN affiliateSource VARCHAR(20) DEFAULT 'organic';
ALTER TABLE Contact ADD COLUMN b2bLandingId STRING;
ALTER TABLE Contact ADD COLUMN affiliateTier VARCHAR(20) DEFAULT 'standard'; -- "standard" | "premier" | "elite"
ALTER TABLE Contact ADD COLUMN commissionSchedule JSON; -- [{ date, amount, source, status }]
```

---

## 3. Contact → Affiliate 양방향 추적

### 3.1 Forward Attribution (Contact → Affiliate)

```typescript
interface ContactAffiliateAttribution {
  contactId: string;
  partnerId?: string; // 직판 파트너
  affiliateCode?: string; // 플랫폼 제휴
  sourceOrgId?: string; // 추천자 조직
  
  // 접촉 채널
  channel: "direct" | "platform" | "partner_crm" | "referral" | "b2b" | "organic";
  
  // 첫 접촉 시간
  firstTouchedAt: DateTime;
  
  // 마지막 접촉 시간
  lastTouchedAt: DateTime;
  
  // 접촉 경로
  touchpointCount: number;
  
  // 최종 구매 시간
  convertedAt?: DateTime;
  
  // 기여 수익
  attributedRevenue: number;
  attributedCommission: number;
}
```

### 3.2 Reverse Attribution (Affiliate → Contact)

```typescript
interface AffiliateContactRelationship {
  partnerId: string;
  contactId: string;
  
  // 언제 이 partner가 이 contact을 가져왔나
  acquiredAt: DateTime;
  
  // Partner가 이 contact에 얼마나 투자했나
  investedCost: number; // 광고, 시간 등
  
  // 전환 상태
  status: "lead" | "qualified" | "negotiating" | "converted" | "churn";
  
  // Contact의 LTV (생명주기 가치)
  lifetimeValue: number;
  
  // ROI = LTV / investedCost (음수면 손실)
  roi: number;
}
```

---

## 4. API 설계

### 4.1 Contact 조회 시 Affiliate 정보 포함

```typescript
GET /api/contacts/{id}
→ Response 포함:
{
  id, name, phone, email,
  partnerId, partner: { id, name, commissionRate },
  affiliateCode,
  channel,
  commissionHistory: [
    { date, amount, source, status, paymentMethod }
  ]
}
```

### 4.2 Partner 조회 시 Contact 목록

```typescript
GET /api/partners/{id}/contacts
?status=lead|converted|churn
?yearMonth=2026-05
→ Response:
{
  partnerId,
  contactsCount: 125,
  contacts: [
    {
      id, name, phone,
      status, convertedAt, revenue, commission
    }
  ]
}
```

### 4.3 Commission Ledger 조회

```typescript
GET /api/commission-ledger
?partnerId={id}
?yearMonth={YYYY-MM}
?status=pending|approved|paid|rejected
→ Response:
{
  total: 125,
  totalAmount: 2500000,
  entries: [
    {
      id, contactId, saleAmount, commissionRate, commissionAmount,
      status, approvedAt, paidAt, paymentMethod
    }
  ]
}
```

### 4.4 Partner와 Contact 링크/언링크

```typescript
// Contact를 특정 Partner에 할당
POST /api/contacts/{contactId}/assign-partner
{
  partnerId: string;
  reason: "direct_acquisition" | "referral" | "platform" | "b2b";
  investedCost?: number;
}

// Contact와 Partner 링크 해제
DELETE /api/contacts/{contactId}/partner/{partnerId}
{
  reason: "churn" | "transfer" | "correction";
}

// Partner에 여러 Contact 일괄 할당
POST /api/partners/{partnerId}/contacts/bulk-assign
{
  contactIds: [string[]];
  reason: string;
}
```

---

## 5. 자동화 규칙 (Workflow)

### 5.1 Contact 생성 시 자동 Affiliate 분류

```typescript
// Contact 생성 시 (또는 import 시)
if (contact.affiliateCode) {
  // 1. Partner lookup
  const partner = await Partner.findOne({ affiliateCode: contact.affiliateCode });
  contact.partnerId = partner?.id;
  
  // 2. Commission rate 설정
  const commRate = getCommissionRate(partner.tier, product.type);
  contact.commissionSchedule = [{
    date: now(),
    rate: commRate,
    source: "partner"
  }];
}

if (contact.sourceOrgId && contact.type === "REFERRAL") {
  // Referral 고객: 기여도 50% split
  contact.affiliateSource = "referral";
}
```

### 5.2 Contact 구매 시 자동 Commission 생성

```typescript
// Contact.purchasedAt 또는 reservation.confirmedAt 발생 시
ON contact.purchasedAt SET:
  1. Contact에서 partnerId 조회
  2. Partner의 commissionRate 확인
  3. CommissionLedger 항목 생성
     {
       partnerId,
       contactId,
       saleAmount,
       commissionRate,
       commissionAmount = saleAmount * commissionRate / 100,
       status: "PENDING",
       approvedAt: null,
       paidAt: null
     }
  4. Partner.totalRevenue += saleAmount
  5. PartnerMetrics.revenue += commissionAmount
```

### 5.3 Commission Approval → Payment Workflow

```
Commission 생성 (PENDING)
  ↓
Admin 검토 (평균 3일)
  ↓
APPROVED (approvedAt 기록)
  ↓
자동 지급 (매달 15일)
  ↓
PAID (paidAt 기록, paymentMethod 저장)
```

---

## 6. Contact - Partner - Commission 통합 쿼리

### 6.1 파트너별 월 성과 조회

```sql
SELECT 
  p.id,
  p.name,
  COUNT(DISTINCT c.id) as contact_count,
  COUNT(DISTINCT CASE WHEN c.purchasedAt IS NOT NULL THEN c.id END) as converted_count,
  COALESCE(SUM(cl.saleAmount), 0) as total_sales,
  COALESCE(SUM(cl.commissionAmount), 0) as total_commission,
  COALESCE(SUM(cl.commissionAmount) FILTER (WHERE cl.status = 'PENDING'), 0) as pending_commission,
  COALESCE(SUM(cl.commissionAmount) FILTER (WHERE cl.status = 'PAID'), 0) as paid_commission
FROM Partner p
LEFT JOIN Contact c ON p.id = c.partnerId
LEFT JOIN CommissionLedger cl ON c.id = cl.contactId
WHERE p.organizationId = $1
  AND EXTRACT(YEAR FROM c.createdAt) = 2026
  AND EXTRACT(MONTH FROM c.createdAt) = 5
GROUP BY p.id, p.name
ORDER BY total_commission DESC;
```

### 6.2 고객 획득 비용(CAC) vs 생명주기 가치(LTV)

```sql
SELECT 
  p.id,
  p.name,
  COALESCE(SUM(CASE 
    WHEN cl.status = 'PENDING' THEN cl.commissionAmount 
    WHEN cl.status IN ('APPROVED', 'PAID') THEN cl.commissionAmount 
    ELSE 0 
  END) / NULLIF(COUNT(DISTINCT c.id), 0), 0) as cac,
  COALESCE(AVG(c.ltvTotal), 0) as ltv,
  CASE 
    WHEN COALESCE(AVG(c.ltvTotal), 0) > 0 
    THEN ROUND(COALESCE(AVG(c.ltvTotal), 0) / NULLIF(
      SUM(CASE WHEN cl.status IN ('APPROVED', 'PAID') THEN cl.commissionAmount ELSE 0 END) 
      / NULLIF(COUNT(DISTINCT c.id), 0), 0
    ), 2)
    ELSE 0 
  END as roi_multiple
FROM Partner p
LEFT JOIN Contact c ON p.id = c.partnerId AND c.organizationId = $1
LEFT JOIN CommissionLedger cl ON c.id = cl.contactId
WHERE p.organizationId = $1
GROUP BY p.id, p.name
ORDER BY roi_multiple DESC;
```

---

## 7. 기대 효과 (Expected Impact)

| 메트릭 | 현재 | 목표 | 증가율 | 기간 |
|--------|------|------|--------|------|
| **Partner 수익 (월)** | $10K | $30K | +200% | 6개월 |
| **Affiliate 기여도 (매출%)** | 5% | 20% | +300% | 6개월 |
| **Commission Accuracy** | 85% | 99% | +16% | 3개월 |
| **Partner Retention** | 60% | 80% | +33% | 6개월 |
| **Commission 자동화율** | 20% | 95% | +375% | 3개월 |
| **Partner ROI** | 1.2x | 3.5x | +192% | 6개월 |
| **월 추가 수익 (한화)** | - | 2억 원 | - | 6개월 |

---

## 8. 데이터 무결성 체크

### 8.1 정기 감사 (주 1회)

```typescript
async function auditAffiliateIntegrity() {
  // 1. Orphaned Commission: Contact 없는 CommissionLedger 항목
  // 2. Duplicate Partner: 같은 이름, 이메일 중복
  // 3. Stale Partner: 1년 이상 활동 없는 Partner
  // 4. Commission Mismatch: saleAmount * rate !== commissionAmount
  // 5. Contact Partner Inconsistency: partnerId가 있는데 Partner 삭제됨
}
```

### 8.2 복구 프로세스

```typescript
// Commission이 누락된 경우
async function recoverMissingCommissions(contactId: string) {
  const contact = await Contact.findOne({ id: contactId });
  const sales = await Sale.find({ contactId });
  
  for (const sale of sales) {
    const existing = await CommissionLedger.findOne({
      contactId,
      saleId: sale.id
    });
    
    if (!existing && sale.status === "CONFIRMED") {
      await CommissionLedger.create({
        contactId,
        saleId: sale.id,
        commissionAmount: calculateCommission(sale, contact.partner),
        status: "PENDING"
      });
    }
  }
}
```

---

## 9. 파일 연계 구조

```
affiliate_crm_integration.md (현재 파일)
├── 1. 개요: 양방향 링크
├── 2. 다중 채널 Commission
├── 3. Attribution 추적
├── 4. API 설계
├── 5. 자동화 규칙
├── 6. 통합 쿼리
├── 7. 기대 효과
└── 8-9. 무결성 체크

affiliate_revenue_attribution.md
├── Multi-touch Attribution 모델
├── 채널별 가중치
├── First-touch vs Last-touch
├── Time Decay 모델
└── A/B 테스트 기반 최적화

affiliate_partner_segmentation.md
├── Tier 기준 (Top Performer, Standard, Growth)
├── 자동 재분류 로직
├── Tier별 Commission 배분
├── Incentive 구조
└── KPI 관리

affiliate_churn_prediction.md
├── Risk Score 산출 (4가지 신호)
├── Early Warning System
├── Retention Strategy
├── Intervention Workflow
└── 예측 정확도 검증

affiliate_partner_automation.md
├── Commission 자동 계산
├── 보너스 자동 지급
├── 이메일 자동화
├── 성과 리포팅
└── API 4개 (calculate, pay, notify, report)
```

---

**최종 검사**: Contact.partnerId + affiliateCode + commissionSchedule 필드 확인 (✅ 기존 존재)

**다음 단계**: affiliate_revenue_attribution.md 작성 → Multi-touch Attribution 모델
