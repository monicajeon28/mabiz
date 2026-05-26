# Affiliate Commission Models (어필리에이트 수당 체계)

**작성일**: 2026-05-26  
**버전**: 1.0  
**대상**: 마비즈 CRM Affiliate Marketing 시스템

---

## 📊 1. 수당 모델 개요

### 1.1 기본 구조

```
판매액 → 카드수수료 제외 → 순수익 → 분배 구조

예시:
  판매액: ₩10,000,000
  - 카드수수료 (2.3%): ₩230,000
  ─────────────────────
  순판매액: ₩9,770,000
  
  분배:
  - HQ (본사): ₩4,885,000 (50%)
  - 지사: ₩1,955,000 (20%)
  - 판매자: ₩2,930,000 (30%)
```

### 1.2 mabiz-crm 상수 정의

**파일**: `src/lib/constants/affiliate.ts`

```typescript
export const CARD_FEE_RATE_PCT = 2.3;           // 카드수수료 (%)
export const CARD_FEE_RATE = CARD_FEE_RATE_PCT / 100;  // 0.023
export const FREE_AGENT_COMMISSION_RATE = 3.0;  // 자유판매원 기본 수당율 (%)
```

---

## 💰 2. 수당 모델 4가지

### 모델 1: Flat Commission (고정 수당율)

**정의**: 모든 판매에 동일한 수당율 적용

**공식**:
```
수당 = 판매액 × 수당율 %
```

**예시** (자유판매원 3% 기준):
```
판매액 ₩10M × 3% = ₩300K (수당)

예외:
- 홍보: 2%
- 그룹: 3%
- 골드: 5%
```

**장점**:
- 계산 단순
- 투명성 높음
- 운영비 저

**단점**:
- 대금액 거래 유인 부족
- 파트너 차별화 불가

**사용 사례**:
- 초보 파트너
- 소액 거래

---

### 모델 2: Tiered Commission (단계별 수당율)

**정의**: 누적 판매액에 따라 수당율 단계적 상향

**구조**:
```
Tier 1 (0-5M):     2.0%
Tier 2 (5M-10M):   3.0%
Tier 3 (10M-50M):  4.0%
Tier 4 (50M+):     5.0%
```

**계산 방식**: 

**방식 A - 누적액 기준 (전체에 적용)**
```
월 누적 ₩15M 달성:
= 5M × 2% + 5M × 3% + 5M × 4%
= ₩100K + ₩150K + ₩200K
= ₩450K
```

**방식 B - 구간별 기준 (해당 구간만 적용)**
```
₩15M 판매 중:
- ₩5M까지: 2%
- 초과분(₩10M): 4% (Tier 3 적용)
= ₩100K + ₩400K = ₩500K
```

**mabiz 스키마**:
```prisma
model AffiliateCommissionTier {
  id                    Int
  affiliateProductId    Int
  cabinType             String
  saleAmount            Int           // 판매액
  freeAgentShareAmount  Int           // 수당액
  freeAgentShareRate    Float         // 수당율 (%)
  agentType             String        // "FREE_AGENT" | "EMPLOYEE"
  createdAt             DateTime
}
```

**실제 데이터 예시**:
| affiliateProductId | cabinType | saleAmount | shareRate | shareAmount |
|-------------------|-----------|-----------|-----------|-------------|
| 1 | SUITE | 50,000,000 | 5.0% | 2,500,000 |
| 1 | BALCONY | 30,000,000 | 3.0% | 900,000 |
| 2 | INTERIOR | 20,000,000 | 2.0% | 400,000 |

**장점**:
- 매출 증대 동기 부여
- 성과주의 강화
- 파트너 차별화 가능

**단점**:
- 계산 복잡
- 경쟁 심화

---

### 모델 3: Revenue Share (수익 분배)

**정의**: 실제 이익에 따른 분배

**공식**:
```
수당 = (판매액 - 원가 - 카드수수료) × 분배율 %
```

**예시**:
```
판매액:        ₩10,000,000
원가:          ₩6,000,000
카드수수료:     ₩230,000
─────────────────────────
순이익:        ₩3,770,000

분배:
- 자유판매원: ₩3,770,000 × 30% = ₩1,131,000
```

**mabiz 스키마**:
```prisma
model public_AffiliateSale {
  saleAmount              Int
  costAmount              Int
  netRevenue              Int
  branchCommission        Int
  salesCommission         Int
  withholdingAmount       Int        // 원천징수
  status                  String     // "PENDING" | "CONFIRMED" | "SETTLED" | "PAID"
}
```

**원천징수 규칙**:
```typescript
// 한국 프리랜서 원천징수 3.3%
withholdingAmount = commissionAmount × 0.033

// 순지급액
netPayout = commissionAmount - withholdingAmount
```

**실제 계산 프로세스**:
```
1. 판매 확정 (CONFIRMED)
   → 순수익 계산
   → 분배율 적용
   
2. 정산 대기 (SETTLED)
   → 원천징수 계산 (3.3%)
   → 지급액 최종 결정
   
3. 지급 완료 (PAID)
   → 계좌 송금
   → AffiliateLedger 기록
```

**장점**:
- 리스크 공유
- 품질 인센티브
- 파트너 충성도 높음

**단점**:
- 계산 복잡
- 파트너 이의 가능성

---

### 모델 4: CPA (Cost Per Action)

**정의**: 구체적 액션(예약, 완료)당 고정액 지급

**구조**:
```
액션 타입별 단가:
- 문의 생성: ₩10,000
- 예약 확정: ₩50,000
- 여행 완료: ₩100,000
```

**계산**:
```
수당 = Σ (액션 카운트 × 액션 단가)

예시:
문의 3건 × ₩10K + 예약 2건 × ₩50K + 완료 1건 × ₩100K
= ₩30K + ₩100K + ₩100K = ₩230K
```

**mabiz 스키마**:
```prisma
model GmAffiliateLead {
  id               Int
  status           String      // "NEW" | "CONTACTED" | "BOOKED" | "COMPLETED"
  leadCreatedAt    DateTime    // 액션 발생 시점
  paidAt           DateTime?   // 수당 지급 확정
}

model AffiliateInteraction {
  leadId           Int
  interactionType  String      // "INQUIRY" | "BOOKING" | "COMPLETION"
  occurredAt       DateTime
}
```

**지급 트리거**:
```typescript
// 여행 완료 후 14일 이내 수당 지급
const cpaPaymentWindow = 14; // days
const eligibleAt = completionDate + cpaPaymentWindow;
```

**장점**:
- 명확한 성과 연계
- 사기 방지 용이
- 초보 파트너 유입 쉬움

**단점**:
- 저가 상품 유인 부족
- 거래액 무관

---

## 🔧 3. 수당 계산 엔진 (Database 설계)

### 3.1 AffiliateLedger (수당 원장)

```prisma
model AffiliateLedger {
  id                Int          @id @default(autoincrement())
  saleId            Int          // 판매 ID
  profileId         Int          // 파트너 프로필 ID
  type              String       // "COMMISSION" | "BONUS" | "CHARGEBACK"
  amount            Int          // 수당액 (원)
  withholdingAmount Int          // 원천징수 (3.3%)
  netAmount         Int          // 순 지급액
  isSettled         Boolean      // 정산 완료 여부
  settledAt         DateTime?    // 정산 완료일
  description       String?      // 비고
  metadata          Json?        // 추가 정보
  createdAt         DateTime
  
  @@index([isSettled, profileId, createdAt])
}
```

### 3.2 실시간 계산 로직

**파일**: `src/lib/affiliate-commission.ts` (신규)

```typescript
/**
 * 수당 계산 엔진
 */

interface CommissionRequest {
  saleAmount: number;        // 판매액
  costAmount?: number;       // 원가 (Revenue Share용)
  agentType: 'FREE_AGENT' | 'EMPLOYEE';
  productType: string;       // 'CRUISE' | 'HOTEL'
  tier?: 'TIER1' | 'TIER2' | 'TIER3';
}

interface CommissionResult {
  grossCommission: number;   // 총 수당
  cardFee: number;          // 카드수수료
  withholdingTax: number;   // 원천징수
  netPayout: number;        // 순지급액
  model: string;            // 적용 모델
  breakdown: object;        // 상세 계산
}

/**
 * 1. Flat Commission 계산
 */
export function calculateFlatCommission(req: CommissionRequest): CommissionResult {
  const rate = req.agentType === 'FREE_AGENT' ? 0.03 : 0.05;
  const grossCommission = req.saleAmount * rate;
  const cardFee = req.saleAmount * CARD_FEE_RATE;
  const withholdingTax = grossCommission * 0.033;
  const netPayout = grossCommission - withholdingTax;
  
  return {
    grossCommission,
    cardFee,
    withholdingTax,
    netPayout,
    model: 'FLAT_COMMISSION',
    breakdown: { rate, agentType: req.agentType },
  };
}

/**
 * 2. Tiered Commission 계산
 */
export function calculateTieredCommission(
  monthlyTotal: number,
  currentSaleAmount: number
): CommissionResult {
  const tiers = [
    { min: 0, max: 5_000_000, rate: 0.02 },
    { min: 5_000_000, max: 10_000_000, rate: 0.03 },
    { min: 10_000_000, max: 50_000_000, rate: 0.04 },
    { min: 50_000_000, max: Infinity, rate: 0.05 },
  ];
  
  let grossCommission = 0;
  let cumulative = monthlyTotal;
  
  for (const tier of tiers) {
    if (cumulative >= tier.max) continue;
    
    const remaining = Math.min(currentSaleAmount, tier.max - cumulative);
    grossCommission += remaining * tier.rate;
    cumulative += remaining;
    
    if (cumulative >= monthlyTotal + currentSaleAmount) break;
  }
  
  const cardFee = currentSaleAmount * CARD_FEE_RATE;
  const withholdingTax = grossCommission * 0.033;
  const netPayout = grossCommission - withholdingTax;
  
  return {
    grossCommission,
    cardFee,
    withholdingTax,
    netPayout,
    model: 'TIERED_COMMISSION',
    breakdown: { monthlyTotal, currentSaleAmount },
  };
}

/**
 * 3. Revenue Share 계산
 */
export function calculateRevenueShare(req: CommissionRequest): CommissionResult {
  const cardFee = req.saleAmount * CARD_FEE_RATE;
  const grossProfit = (req.costAmount ?? 0) - cardFee;
  const shareRate = req.agentType === 'FREE_AGENT' ? 0.3 : 0.5;
  const grossCommission = grossProfit * shareRate;
  const withholdingTax = grossCommission * 0.033;
  const netPayout = grossCommission - withholdingTax;
  
  return {
    grossCommission,
    cardFee,
    withholdingTax,
    netPayout,
    model: 'REVENUE_SHARE',
    breakdown: { grossProfit, shareRate },
  };
}

/**
 * 4. CPA 계산
 */
export function calculateCPA(actions: { type: string; count: number }[]): CommissionResult {
  const rates = {
    INQUIRY: 10_000,
    BOOKING: 50_000,
    COMPLETION: 100_000,
  };
  
  let grossCommission = 0;
  for (const action of actions) {
    grossCommission += (rates[action.type] ?? 0) * action.count;
  }
  
  const withholdingTax = grossCommission * 0.033;
  const netPayout = grossCommission - withholdingTax;
  
  return {
    grossCommission,
    cardFee: 0,
    withholdingTax,
    netPayout,
    model: 'CPA',
    breakdown: { actions },
  };
}
```

---

## 🎯 4. 모델 선택 기준

| 상황 | 추천 모델 | 이유 |
|------|---------|------|
| 초보 파트너 | CPA | 명확한 목표, 단순 계산 |
| 중급 파트너 | Tiered | 성과 인센티브, 공정성 |
| 고급 파트너 | Revenue Share | 이익 분배, 충성도 제고 |
| 대량 판매 | Flat | 시간 절약, 예측 가능 |
| 다중 상품 | Tiered + CPA | 유연성, 차별화 |

---

## 📈 5. 실제 사례

### 사례 1: 자유판매원 (월 ₩30M 판매)

**모델**: Tiered Commission

```
월 누적 판매: ₩30,000,000

Tier 분해:
- ₩0-5M:   5M × 2% = ₩100,000
- ₩5-10M:  5M × 3% = ₩150,000
- ₩10-50M: 20M × 4% = ₩800,000
───────────────────────
총 수당:  ₩1,050,000

원천징수 (3.3%): ₩34,650
───────────────────────
순 지급액: ₩1,015,350
```

### 사례 2: 그룹 판매 (₩50M, 원가 ₩30M)

**모델**: Revenue Share (50%)

```
판매액:        ₩50,000,000
원가:          ₩30,000,000
카드수수료:     ₩1,150,000
─────────────────────────
순이익:        ₩18,850,000

수당 (50%):    ₩9,425,000
원천징수:      ₩311,025
─────────────────────────
순 지급액:     ₩9,113,975
```

### 사례 3: CPA 모델 (신규 파트너)

**모델**: CPA

```
문의 10건 × ₩10,000  = ₩100,000
예약 3건 × ₩50,000   = ₩150,000
완료 1건 × ₩100,000  = ₩100,000
─────────────────────────────
총 수당:              ₩350,000

원천징수 (3.3%):      ₩11,550
─────────────────────────────
순 지급액:            ₩338,450
```

---

## 🔐 6. 사기 방지 & 검증

### 비정상 거래 감지

```typescript
interface FraudCheckResult {
  isValid: boolean;
  riskScore: number;
  warnings: string[];
}

export function validateCommissionTransaction(
  saleId: string,
  affId: string,
  amount: number
): FraudCheckResult {
  const warnings: string[] = [];
  let riskScore = 0;
  
  // 1. 동일 파트너 중복 판매
  if (sameDayDuplicateCount > 5) {
    warnings.push('Same-day duplicate sales detected');
    riskScore += 30;
  }
  
  // 2. 비정상적 높은 수당율
  if (commissionRate > maxAllowed) {
    warnings.push('Unusually high commission rate');
    riskScore += 25;
  }
  
  // 3. 환불/취소 비율 높음
  if (cancellationRate > 0.3) {
    warnings.push('High cancellation rate');
    riskScore += 20;
  }
  
  // 4. 단기 반복 거래
  if (transactionFrequency > dailyLimit) {
    warnings.push('Transaction frequency exceeded');
    riskScore += 15;
  }
  
  return {
    isValid: riskScore < 50,
    riskScore,
    warnings,
  };
}
```

---

## 💳 7. 지급 프로세스

```
1. 거래 발생 (PENDING)
   ↓ [지급 가능 확인]
2. 정산 대기 (SETTLED)
   ↓ [원천징수 계산]
3. 지급 예약 (SCHEDULED)
   ↓ [정산일 도래]
4. 지급 완료 (PAID)
   ↓
5. 원천징수 신고 (TAX_REPORTED)
```

### 지급 주기

| 구분 | 주기 | 최소액 | 수수료 |
|------|------|--------|--------|
| 주간 | 매주 금요일 | ₩100,000 | 무료 |
| 월간 | 매월 마지막 금요일 | ₩0 | 무료 |
| 즉시 | 요청시 | ₩500,000 | 2% |

---

## ✅ 체크리스트

- [ ] 커밋 메시지: feat(affiliate): Commission models - Flat/Tiered/RevShare/CPA
- [ ] 단위 테스트: 4개 모델 × 10 케이스
- [ ] 통합 테스트: End-to-end 정산 프로세스
- [ ] 문서: 파트너 가이드 + 계산 예시
- [ ] 모니터링: 월별 정산 정확도 (99% 이상)
