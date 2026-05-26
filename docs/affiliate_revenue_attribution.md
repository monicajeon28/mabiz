# Affiliate Revenue Attribution Models (2026-05-26)

## 1. 개요: Multi-Touch Attribution

고객이 여러 채널을 거쳐 구매에 이르는 경로를 추적하고 각 채널에 정확히 수익을 배분합니다.

### 1.1 핵심 문제

**고객 여정 예시**:
```
Day 0: Facebook 광고 클릭 → Partner A 접촉
Day 3: 이메일 클릭 → Partner B 확인
Day 7: 직접 방문 → Partner A 재접촉
Day 10: 구매 (총액 $3,000)
```

**질문**: $3,000 중 Partner A와 B에게 각각 얼마를 배분할 것인가?

- **First-Touch**: Partner A 100% ($3,000)
- **Last-Touch**: Partner A 100% ($3,000) ← 가장 가까운 접촉
- **Linear**: Partner A 50%, Partner B 50% ($1,500 each)
- **Time-Decay**: Partner A 70%, Partner B 30% (최근 접촉이 더 중요)
- **Data-Driven**: ML 기반 최적 배분

---

## 2. 5가지 Attribution 모델

### 2.1 Model A: First-Touch (첫 접촉 기여도)

**규칙**: 고객의 첫 번째 접촉 채널이 100% 수익 소유권

**장점**:
- 구현 간단
- 새로운 고객 획득 평가에 좋음

**단점**:
- 실제 구매 결정에 영향을 미친 채널 무시
- Partner B의 노력 무시

**수식**:
```
firstTouchPartner.commission = totalRevenue * commissionRate
```

**예시**: Partner A가 첫 접촉 → Partner A가 $3,000 × 10% = $300 독점

---

### 2.2 Model B: Last-Touch (마지막 접촉 기여도)

**규칙**: 구매 직전 마지막 접촉 채널이 100% 수익 소유권

**장점**:
- 구매 직전의 영향력 측정 (가장 실용적)
- 현재 CRM 시스템에서 이미 사용 중

**단점**:
- 인지 단계 (Awareness) 채널 무시
- Direct 접속이 유리 (최후 결정)

**수식**:
```
lastTouchPartner.commission = totalRevenue * commissionRate
```

**예시**: Partner A가 마지막 접촉 → Partner A가 $3,000 × 10% = $300 독점

---

### 2.3 Model C: Linear (선형 배분)

**규칙**: 모든 접촉 채널에 동일하게 기여도 배분

**장점**:
- 공정한 배분
- 모든 파트너에게 인센티브 제공

**단점**:
- 실제 영향력 차이 무시
- 불필요한 터치포인트에도 보상

**수식**:
```
commission = totalRevenue * commissionRate / touchpointCount
```

**예시**: 2개 터치포인트 → 각 $3,000 × 10% / 2 = $150

---

### 2.4 Model D: Time-Decay (시간 감쇠 모델)

**규칙**: 구매에 가까울수록 더 높은 가중치

**공식**:
```
weight(i) = exp(-lambda * (T - t_i) / T)
    T: 총 시간 (구매까지)
    t_i: i번째 접촉 시간
    lambda: 감쇠율 (보통 2.5-5)

commission(i) = totalRevenue * commissionRate * weight(i) / sum(weights)
```

**예시** (lambda=2.5):
```
Day 0 (Partner A): weight = exp(-2.5 * 10/10) = 0.08 (8%)
Day 3 (Partner B): weight = exp(-2.5 * 7/10) = 0.19 (19%)
Day 7 (Partner A): weight = exp(-2.5 * 3/10) = 0.47 (47%)
Day 10 (Direct): weight = exp(-2.5 * 0/10) = 1.00 (100%)

정규화:
Partner A (합산): (0.08 + 0.47) / 2.54 = 0.217 (21.7%)
Partner B: 0.19 / 2.54 = 0.075 (7.5%)

Commission:
Partner A: $3,000 × 10% × 0.217 = $65
Partner B: $3,000 × 10% × 0.075 = $22.5
```

**장점**:
- 현실적인 영향력 반영
- 최근 터치를 높게 평가

**단점**:
- lambda 선택이 임의적
- 계산 복잡도 증가

---

### 2.5 Model E: Data-Driven (머신러닝 기반)

**규칙**: 과거 데이터를 기반으로 각 터치포인트의 실제 영향력 계산

**방법**: Logistic Regression 또는 Shapley Value

**수식** (Shapley):
```
φ_i = 1/n! * Σ (v(S ∪ {i}) - v(S))
    S: 모든 부분집합
    v(S): S의 전환율
```

**예시**: 과거 데이터 분석 결과
```
Facebook 광고 (Channel A): Conversion Lift +35% → 35% 가중치
이메일 (Channel B): Conversion Lift +15% → 15% 가중치
Direct: Conversion Lift +50% → 50% 가중치

Commission:
Partner A (Facebook): $3,000 × 10% × 0.35 = $105
Partner B (Email): $3,000 × 10% × 0.15 = $45
Direct: $3,000 × 10% × 0.50 = $150
```

**장점**:
- 가장 정확함
- 실제 데이터 기반

**단점**:
- 충분한 데이터 필요 (최소 1년)
- 정기적 모델 재학습 필요

---

## 3. 마비즈 CRM 권장 전략

### 3.1 단계별 도입

| 단계 | 기간 | 모델 | 목표 | 준비 |
|------|------|------|------|------|
| **Phase 1** | 1-3개월 | Last-Touch | MVP 출시 | 기존 시스템 활용 |
| **Phase 2** | 3-6개월 | Time-Decay | 정확도 향상 | 터치포인트 로깅 |
| **Phase 3** | 6-12개월 | Data-Driven | 최고 정확도 | ML 모델 학습 |

### 3.2 Phase 1 (현재): Last-Touch 기반

```typescript
// Contact.purchasedAt 발생 시

async function attributeCommissionLastTouch(contactId: string) {
  const contact = await Contact.findOne({ id: contactId });
  
  // 1. 최근 30일 내 모든 터치포인트 조회
  const touchpoints = await ContactTouchPoint.find({
    contactId,
    touchedAt: { $gte: now() - 30days }
  }).sort({ touchedAt: -1 });
  
  if (!touchpoints.length) return; // 터치포인트 없음
  
  const lastTouchpoint = touchpoints[0]; // 가장 최근
  const partner = await Partner.findOne({ id: lastTouchpoint.partnerId });
  
  // 2. Commission 생성
  const saleAmount = contact.quotedPrice || 3000;
  const commissionAmount = saleAmount * partner.commissionRate / 100;
  
  await CommissionLedger.create({
    partnerId: partner.id,
    contactId,
    saleAmount,
    commissionRate: partner.commissionRate,
    commissionAmount,
    attributionModel: "last_touch",
    touchpointId: lastTouchpoint.id,
    status: "PENDING"
  });
}
```

### 3.3 Phase 2 (3-6개월): Time-Decay 모델

```typescript
async function attributeCommissionTimeDecay(contactId: string) {
  const contact = await Contact.findOne({ id: contactId });
  const touchpoints = await ContactTouchPoint.find({
    contactId,
    touchedAt: { $gte: contact.createdAt } // 생성 이후 모든 터치
  }).sort({ touchedAt: 1 });
  
  const T = (contact.purchasedAt - contact.createdAt) / 1000; // 초 단위
  const lambda = 2.5; // 감쇠 상수
  
  // 1. 가중치 계산
  const weights = touchpoints.map((tp, idx) => {
    const t_i = (tp.touchedAt - contact.createdAt) / 1000;
    const weight = Math.exp(-lambda * (T - t_i) / T);
    return { touchpointId: tp.id, partnerId: tp.partnerId, weight };
  });
  
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  
  // 2. Partner별 Commission 생성
  const partnerWeights = new Map();
  weights.forEach(w => {
    if (!partnerWeights.has(w.partnerId)) partnerWeights.set(w.partnerId, 0);
    partnerWeights.set(w.partnerId, partnerWeights.get(w.partnerId) + w.weight / totalWeight);
  });
  
  const saleAmount = contact.quotedPrice || 3000;
  
  for (const [partnerId, weight] of partnerWeights) {
    const partner = await Partner.findOne({ id: partnerId });
    const commissionAmount = saleAmount * partner.commissionRate / 100 * weight;
    
    await CommissionLedger.create({
      partnerId,
      contactId,
      saleAmount: Math.round(saleAmount * weight), // 배분된 매출액
      commissionRate: partner.commissionRate,
      commissionAmount,
      attributionModel: "time_decay",
      attributionWeight: weight,
      status: "PENDING"
    });
  }
}
```

### 3.4 Phase 3 (6-12개월): Data-Driven 모델

```typescript
async function attributeCommissionDataDriven(contactId: string) {
  const contact = await Contact.findOne({ id: contactId });
  const touchpoints = await ContactTouchPoint.find({ contactId });
  
  // 1. 각 파트너별 과거 전환율 계산
  const partnerLifts = await calculatePartnerConversionLifts();
  // {
  //   partnerId: lift% (0-100)
  // }
  
  // 2. 각 파트너의 기여도 계산
  const totalLift = Object.values(partnerLifts).reduce((a, b) => a + b, 0);
  const saleAmount = contact.quotedPrice || 3000;
  
  for (const [partnerId, lift] of Object.entries(partnerLifts)) {
    const partner = await Partner.findOne({ id: partnerId });
    const weight = lift / totalLift;
    const commissionAmount = saleAmount * partner.commissionRate / 100 * weight;
    
    await CommissionLedger.create({
      partnerId,
      contactId,
      saleAmount: Math.round(saleAmount * weight),
      commissionRate: partner.commissionRate,
      commissionAmount,
      attributionModel: "data_driven",
      attributionWeight: weight,
      modelVersion: "v1_20260526",
      status: "PENDING"
    });
  }
}

// 과거 데이터 기반 전환율 계산
async function calculatePartnerConversionLifts() {
  const lookback = 180; // 6개월 데이터
  
  // 1. Control: Partner 접촉 없이 구매한 고객
  const controlConversionRate = await Contact.count({
    purchasedAt: { $ne: null },
    partnerId: null,
    createdAt: { $gte: now() - lookback * 24 * 3600 }
  }) / await Contact.count({
    partnerId: null,
    createdAt: { $gte: now() - lookback * 24 * 3600 }
  });
  
  // 2. Treatment: 각 Partner 접촉 후 구매한 고객
  const partnerLifts = {};
  for (const partner of await Partner.find({})) {
    const conversionRate = await Contact.count({
      purchasedAt: { $ne: null },
      partnerId: partner.id,
      createdAt: { $gte: now() - lookback * 24 * 3600 }
    }) / await Contact.count({
      partnerId: partner.id,
      createdAt: { $gte: now() - lookback * 24 * 3600 }
    });
    
    partnerLifts[partner.id] = (conversionRate - controlConversionRate) * 100;
  }
  
  return partnerLifts;
}
```

---

## 4. 터치포인트 로깅 (필수)

모든 Partner-Contact 상호작용을 기록해야 Attribution이 정확합니다.

### 4.1 Contact Touch Point 모델

```typescript
interface ContactTouchPoint {
  id: string;
  contactId: string;
  partnerId: string;
  channel: "call" | "sms" | "email" | "landing_page" | "facebook" | "instagram" | "referral";
  touchedAt: DateTime;
  
  // 상호작용 상세
  action: "click" | "call_start" | "call_end" | "email_open" | "form_submit" | "page_view";
  metadata: {
    url?: string;
    utmSource?: string;
    utmCampaign?: string;
    duration?: number; // 초
  };
  
  // Attribution
  isFirstTouch: boolean;
  isLastTouch: boolean;
  createdAt: DateTime;
}
```

### 4.2 자동 로깅 트리거

```typescript
// 1. Contact 전화 시작
ON callLog.startedAt SET:
  await ContactTouchPoint.create({
    contactId,
    partnerId: callLog.assignedPartnerId,
    channel: "call",
    touchedAt: callLog.startedAt,
    action: "call_start",
    metadata: { duration: callLog.durationSec }
  });

// 2. SMS 발송
ON sms.sentAt SET:
  await ContactTouchPoint.create({
    contactId,
    partnerId: sms.sentBy,
    channel: "sms",
    touchedAt: sms.sentAt,
    action: "sms_sent"
  });

// 3. 이메일 열기
ON emailOpen.timestamp SET:
  await ContactTouchPoint.create({
    contactId,
    partnerId: email.campaignOwnerId,
    channel: "email",
    touchedAt: emailOpen.timestamp,
    action: "email_open"
  });

// 4. Landing Page 방문
ON pageView.timestamp SET:
  await ContactTouchPoint.create({
    contactId,
    partnerId: page.createdBy,
    channel: "landing_page",
    touchedAt: pageView.timestamp,
    action: "page_view",
    metadata: { url: pageView.url, utmSource: pageView.utmSource }
  });
```

---

## 5. A/B 테스트를 통한 Attribution 검증

### 5.1 실험 설계

```
Control Group (10% 샘플):
- 특정 Partner의 SMS 미발송
- 구매율 X% 측정

Treatment Group (90% 샘플):
- 특정 Partner의 SMS 발송
- 구매율 Y% 측정

Partner 기여도 = (Y% - X%) * 100
```

### 5.2 구현

```typescript
async function runAttributionABTest(partnerId: string) {
  const lookback = 30; // 30일 테스트
  
  // 1. Control vs Treatment 분할
  const allContacts = await Contact.find({
    createdAt: { $gte: now() - lookback * 24 * 3600 }
  });
  
  const controlIds = allContacts.slice(0, Math.floor(allContacts.length * 0.1)).map(c => c.id);
  const treatmentIds = allContacts.slice(Math.floor(allContacts.length * 0.1)).map(c => c.id);
  
  // 2. Treatment: Partner의 SMS 발송
  for (const contactId of treatmentIds) {
    await sendPartnerSms(contactId, partnerId);
  }
  
  // 3. 30일 후 전환율 측정
  await sleep(lookback * 24 * 3600 * 1000);
  
  const controlConversion = await Contact.count({
    id: { $in: controlIds },
    purchasedAt: { $ne: null }
  }) / controlIds.length;
  
  const treatmentConversion = await Contact.count({
    id: { $in: treatmentIds },
    purchasedAt: { $ne: null }
  }) / treatmentIds.length;
  
  const lift = (treatmentConversion - controlConversion) / controlConversion * 100;
  
  return {
    partnerId,
    controlConversion,
    treatmentConversion,
    lift,
    statisticalSignificance: lift > 5 ? "YES" : "NO"
  };
}
```

---

## 6. 기대 효과

| 메트릭 | 현재 (Last-Touch) | 목표 (Time-Decay) | 최고 (Data-Driven) | 기간 |
|--------|-----------------|------------------|--------------------|------|
| **Attribution 정확도** | 70% | 85% | 95%+ | 12개월 |
| **Partner 만족도** | 65% | 80% | 92% | 12개월 |
| **Commission 분쟁** | 월 15건 | 월 5건 | 월 <1건 | 12개월 |
| **Partner Retention** | 60% | 75% | 85% | 12개월 |
| **예상 추가 수익** | - | +$20K/월 | +$45K/월 | 12개월 |

---

## 7. 구현 체크리스트

- [ ] Phase 1: LastTouch 모델 구현 (1개월)
  - [ ] CommissionLedger 테이블 생성
  - [ ] 구매 시 자동 commission 생성
  - [ ] Partner 조회 API 통합
- [ ] Phase 2: ContactTouchPoint 로깅 (2개월)
  - [ ] 모든 상호작용 자동 로깅
  - [ ] Time-Decay 계산 엔진
  - [ ] 히스토리 기반 데이터 마이그레이션
- [ ] Phase 3: Data-Driven 모델 (3개월)
  - [ ] ML 모델 학습 (6개월 데이터)
  - [ ] Shapley Value 계산
  - [ ] A/B 테스트 프레임워크
- [ ] 월별 Audit
  - [ ] Commission 정확도 검증
  - [ ] 모델 성능 추적
  - [ ] Partner Feedback 수집

---

**다음 파일**: affiliate_partner_segmentation.md → Tier 기반 Commission 배분
