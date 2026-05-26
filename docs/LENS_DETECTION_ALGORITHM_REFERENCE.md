# 렌즈 감지 알고리즘 레퍼런스

**목적**: 개발자가 렌즈 감지 규칙을 쉽게 이해하고 추가/수정할 수 있도록 하는 기술 가이드

**대상**: Backend 개발자, Data Scientist

---

## 1. 전체 플로우

```
Contact 데이터 수집
    ↓
getContactLensData() → ContactLensData 객체 생성
    ↓
for lens in L0..L10:
    score = 0
    signals = []
    ↓
    // 신호별 규칙 적용
    if (조건1) score += points1; signals.push(signal1);
    if (조건2) score += points2; signals.push(signal2);
    ...
    ↓
    allScores[lens] = { score, signals, threshold: 5 }
    ↓
Primary Lens = max(allScores by score)
Confidence Score = min(100, primaryLens.score)
    ↓
return {
    primaryLens: "L0",
    confidenceScore: 20,
    allScores: { L0: 20, L1: 5, L2: 0, ... },
    detectedSignals: { L0: ["signal1", "signal2"], ... }
}
```

---

## 2. 렌즈별 규칙 상세 (점수 + 신호)

### L0: 부재중 고객 (Reactivation)

**심리**: 예전에 좋았던 경험인데 바빴거나 깜빡했음 → 감정적 재연결 필요

| # | 조건 | 점수 | Signal | 비고 |
|----|------|------|--------|------|
| 1 | daysSince(lastContactedAt) > 365 | 15 | `inactive_1y_plus` | 1년 이상 연락 없음 |
| 2 | daysSince(lastContactedAt) 180-365 | 10 | `inactive_6_12m` | 6-12개월 미연락 |
| 3 | daysSince(lastContactedAt) 90-180 | 5 | `inactive_3_6m` | 3-6개월 미연락 |
| 4 | daysSince(lastCruiseDate) > 365 | 8 | `last_purchase_1y_ago` | 1년 전 크루즈 |
| 5 | cruiseCount >= 1 | 3 | `cruise_experience_N_trips` | 과거 구매 이력 있음 |
| 6 | vipStatus in [GOLD, SILVER] | 5 | `vip_status_*` | VIP 고객 가치 |

**Threshold**: 5점  
**Example**: 부재 1y+ (15) + VIP (5) = 20점 → 신뢰도 20% → L0 감지

**코드**:
```typescript
private detectL0Reactivation(data: ContactLensData): LensScore {
  const signals: string[] = [];
  let score = 0;

  // Rule 1: 부재 기간별
  if (!data.lastContactedAt) {
    const daysSinceCreation = this.daysSince(data.createdAt);
    if (daysSinceCreation > 365) {
      score += 15;
      signals.push("inactive_1y_plus");
    } else if (daysSinceCreation > 180) {
      score += 10;
      signals.push("inactive_6_12m");
    } else if (daysSinceCreation > 90) {
      score += 5;
      signals.push("inactive_3_6m");
    }
  } else {
    const daysSinceLastContact = this.daysSince(data.lastContactedAt);
    if (daysSinceLastContact > 365) {
      score += 15;
      signals.push("no_contact_1y_plus");
    } else if (daysSinceLastContact > 180) {
      score += 10;
      signals.push("no_contact_6_12m");
    } else if (daysSinceLastContact > 90) {
      score += 5;
      signals.push("no_contact_3_6m");
    }
  }

  // Rule 4: 과거 구매
  if (data.purchasedAt) {
    const daysSinceLastPurchase = this.daysSince(data.purchasedAt);
    if (daysSinceLastPurchase > 365) {
      score += 8;
      signals.push("last_purchase_1y_ago");
    } else if (daysSinceLastPurchase > 180) {
      score += 4;
      signals.push("last_purchase_6m_ago");
    }
  }

  // Rule 5: 크루즈 경험
  if (data.cruiseCount > 0) {
    score += 3;
    signals.push(`cruise_experience_${data.cruiseCount}_trips`);
  }

  // Rule 6: VIP 가점
  if (data.vipStatus) {
    score += 5;
    signals.push(`vip_status_${data.vipStatus}`);
  }

  return { score, signals, threshold: 5 };
}
```

---

### L1: 가격이의 (Price Objection)

**심리**: "이건 너무 비싸요" → 가치 재정의 필요

| # | 조건 | 점수 | Signal | 비고 |
|----|------|------|--------|------|
| 1 | tags 포함 ["비싸", "가격", "할인", "저렴"] | 10 | `price_related_tags_*` | 태그에 명시적 언급 |
| 2 | decisionLevel <= 1 | 5 | `low_decision_level` | 관심도 낮음 = 가격 민감 |

**Threshold**: 5점

**코드**:
```typescript
private detectL1PriceObjection(data: ContactLensData): LensScore {
  const signals: string[] = [];
  let score = 0;

  const priceKeywords = ["비싸", "비용", "가격", "cheap", "expensive", "cost", "discount", "할인", "저렴"];
  const priceTags = data.tags.filter((tag) =>
    priceKeywords.some((kw) => tag.toLowerCase().includes(kw))
  );

  if (priceTags.length > 0) {
    score += 10;
    signals.push(`price_related_tags_${priceTags.join("_")}`);
  }

  if (data.lensMetadata?.decisionLevel === 0 || data.lensMetadata?.decisionLevel === 1) {
    score += 5;
    signals.push("low_decision_level");
  }

  return { score, signals, threshold: 5 };
}
```

---

### L6: 타이밍/손실회피 (Timing/Loss Aversion)

**심리**: "지금 결정해야 할 것 같은데..." → 긴박감 + 희소성 활용

| # | 조건 | 점수 | Signal | 비고 |
|----|------|------|--------|------|
| 1 | daysSince(lastContactedAt) <= 7 | 10 | `recent_contact_Xd_ago` | 최근 활동 (매우 뜨거움) |
| 2 | daysSince(lastContactedAt) <= 30 | 5 | `recent_contact_Xw_ago` | 최근 관심 있음 |
| 3 | decisionLevel >= 7 | 10 | `high_decision_level_ready_to_purchase` | 결정 직전 |
| 4 | decisionLevel >= 4 | 5 | `medium_decision_level` | 결정 중 |
| 5 | tags 포함 ["urgent", "time", "limited", "soon", "expire"] | 5 | `time_sensitive_interest` | 시간 민감 |

**Threshold**: 5점  
**Example**: 최근 연락 (10) + 높은 Decision (10) = 20점 → 신뢰도 20% → L6 감지 → "지금 20% 할인!"

**코드**:
```typescript
private detectL6Timing(data: ContactLensData): LensScore {
  const signals: string[] = [];
  let score = 0;

  if (data.lastContactedAt) {
    const daysSinceLastContact = this.daysSince(data.lastContactedAt);
    if (daysSinceLastContact <= 7) {
      score += 10;
      signals.push(`recent_contact_${daysSinceLastContact}d_ago`);
    } else if (daysSinceLastContact <= 30) {
      score += 5;
      signals.push(`recent_contact_${Math.floor(daysSinceLastContact / 7)}w_ago`);
    }
  }

  if (data.lensMetadata?.decisionLevel >= 7) {
    score += 10;
    signals.push("high_decision_level_ready_to_purchase");
  } else if (data.lensMetadata?.decisionLevel >= 4) {
    score += 5;
    signals.push("medium_decision_level");
  }

  const timeSensitiveTags = data.tags.filter((tag) =>
    ["urgent", "time", "limited", "soon", "expire"].some((kw) => tag.includes(kw))
  );
  if (timeSensitiveTags.length > 0) {
    score += 5;
    signals.push("time_sensitive_interest");
  }

  return { score, signals, threshold: 5 };
}
```

---

### L10: 즉시구매 (Immediate Purchase/Closing)

**심리**: "이제 바로 결정할 순간" → 클로징 CTA 강화

| # | 조건 | 점수 | Signal | 비고 |
|----|------|------|--------|------|
| 1 | decisionLevel >= 8 | 15 | `very_high_decision_level_*` | 구매 확정 직전 |
| 2 | decisionLevel >= 6 | 10 | `high_decision_level_*` | 높은 구매 의지 |
| 3 | daysSince(lastContactedAt) <= 3 | 10 | `very_recent_contact_Xd_ago` | 매우 최근 활동 |
| 4 | readinessScore >= 70 | 10 | `high_readiness_*` | 준비 완료 신호 |

**Threshold**: 5점  
**Example**: Decision 9 (15) + 최근 1d (10) + Readiness 80 (10) = 35점 → 신뢰도 35% → L10 감지 → "지금 예약 시 10% 추가!"

**코드**:
```typescript
private detectL10ImmediatePurchase(data: ContactLensData): LensScore {
  const signals: string[] = [];
  let score = 0;

  if (data.lensMetadata?.decisionLevel >= 8) {
    score += 15;
    signals.push(`very_high_decision_level_${data.lensMetadata.decisionLevel}`);
  } else if (data.lensMetadata?.decisionLevel >= 6) {
    score += 10;
    signals.push(`high_decision_level_${data.lensMetadata.decisionLevel}`);
  }

  if (data.lastContactedAt) {
    const daysSinceLastContact = this.daysSince(data.lastContactedAt);
    if (daysSinceLastContact <= 3) {
      score += 10;
      signals.push(`very_recent_contact_${daysSinceLastContact}d_ago`);
    }
  }

  if (data.lensMetadata?.readinessScore >= 70) {
    score += 10;
    signals.push(`high_readiness_${data.lensMetadata.readinessScore}`);
  }

  return { score, signals, threshold: 5 };
}
```

---

## 3. 점수 계산 원칙

### 원칙 1: 신호 누적 가능
같은 렌즈에서 여러 신호가 감지되면 점수 누적

```
L0:
  - 부재 1y+ (15점)
  - 과거 구매 1y+ (8점)
  - VIP (5점)
  = 28점 총합 → 신뢰도 28%
```

### 원칙 2: Threshold 공통 (5점)
모든 렌즈의 감지 기준: 5점 이상

### 원칙 3: Primary Lens 선택
```
allScores = {
  L0: 28,
  L1: 5,
  L6: 20,
  L10: 0
}

최고 점수: L0 (28점)
→ primaryLens = "L0"
→ confidenceScore = 28% (min(100, 28) = 28)
```

### 원칙 4: Confidence Score
점수가 높을수록 신뢰도 높음
- 5점 = 5% (최소)
- 50점 = 50%
- 100점 이상 = 100% (캡핑)

---

## 4. 데이터 포인트 계산

```typescript
private countDataPoints(data: ContactLensData): number {
  let count = 0;
  if (data.lastContactedAt) count++;
  if (data.purchasedAt) count++;
  if (data.lastCruiseDate) count++;
  if (data.cruiseCount > 0) count++;
  if (data.competitorMentioned) count++;
  if (data.anxietyScore > 0) count++;
  if (data.healthConcerns) count++;
  if (data.selfProjectionScore > 0) count++;
  if (data.familyComposition) count++;
  if (data.ltvTotal > 0) count++;
  if (data.tags && data.tags.length > 0) count++;
  if (data.lensMetadata) count++;
  return count;
}
```

**의미**: Contact가 가진 속성의 개수 (점수 계산에 사용된 데이터의 질 지표)

---

## 5. 신호 명명 규칙

### 패턴
```
[렌즈타입]_[신호명]_[값]

예시:
- inactive_1y_plus        (부재 1년 이상)
- price_related_tags_비싸_할인  (가격 태그)
- recent_contact_7d_ago   (7일 전 연락)
- high_decision_level_9   (Decision Level 9)
```

### 용도
- 신호 저장 (ContactLensClassification.tags)
- 로깅 및 모니터링
- A/B 테스트 분석 (어떤 신호가 더 전환율 높은가)

---

## 6. 확장: 새로운 렌즈 추가

### 예시: L11 추가 (신뢰 기반 고객)

**Step 1**: 감지 규칙 정의
```typescript
private detectL11TrustBased(data: ContactLensData): LensScore {
  const signals: string[] = [];
  let score = 0;

  // Rule 1: 추천으로 온 고객
  if (data.tags.includes("recommended")) {
    score += 10;
    signals.push("recommended_customer");
  }

  // Rule 2: 장기 고객 (2년+)
  if (data.cruiseCount >= 3) {
    score += 8;
    signals.push(`long_term_customer_${data.cruiseCount}_trips`);
  }

  // Rule 3: 높은 만족도
  if (data.lastSatisfactionScore && data.lastSatisfactionScore >= 9) {
    score += 10;
    signals.push(`high_satisfaction_${data.lastSatisfactionScore}`);
  }

  return { score, signals, threshold: 5 };
}
```

**Step 2**: detectLens()에 추가
```typescript
async detectLens(contactId: string, organizationId: string): Promise<LensDetectionResult> {
  // ... 기존 코드 ...
  
  const allScores = {
    L0: this.detectL0Reactivation(lensData),
    L1: this.detectL1PriceObjection(lensData),
    // ...
    L10: this.detectL10ImmediatePurchase(lensData),
    L11: this.detectL11TrustBased(lensData),  // ← 추가
  };
  
  // ... 나머지 코드 ...
}
```

**Step 3**: Day 0-3 메시지 템플릿 생성
```
L11 Day 0: "신뢰하는 고객님만을 위한 프리미엄 선택 감사합니다"
L11 Day 1: "고객님 같은 분들이 선택한 이유"
L11 Day 2: "VIP 로열 멤버십 업그레이드 혜택"
L11 Day 3: "감사의 마음으로 특별 이벤트 초대"
```

---

## 7. 성능 최적화

### 캐시 전략
```typescript
// Redis에서 조회 (매우 빠름)
const cacheKey = `lens:${organizationId}:${contactId}`;
const cached = await redis.get(cacheKey);  // O(1) ~ 10ms

if (cached) {
  return JSON.parse(cached);  // 캐시 hit
}

// Cache miss 시 재계산 (느림)
const result = await engine.detectLens(...);  // 100-200ms
await redis.set(cacheKey, JSON.stringify(result), { ex: 86400 });  // 24h TTL
```

### Batch 처리
```typescript
// 1개씩 처리 (비효율)
for (const contactId of contactIds) {
  await detectLens(contactId);  // API 호출 1000번
}

// Batch 처리 (효율)
for (const batch of batches) {
  await Promise.all(
    batch.map(contactId => detectLens(contactId))
  );  // 병렬 처리
}
```

---

## 8. 테스트 전략

### 유닛 테스트 (규칙 검증)
```typescript
describe('L0 Reactivation Detection', () => {
  it('should add 15 points for 1y+ inactive', () => {
    const contact = {
      lastContactedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
    };
    const result = engine.detectL0Reactivation(contact);
    expect(result.score).toBeGreaterThanOrEqual(15);
    expect(result.signals).toContain('inactive_1y_plus');
  });
});
```

### E2E 테스트 (전체 플로우)
```typescript
it('should detect L0 and save classification', async () => {
  const contact = await db.contact.create({ ... });
  
  const result = await engine.detectLens(contact.id, org.id);
  expect(result.primaryLens).toBe('L0');
  
  const classification = await db.contactLensClassification.findFirst({
    where: { contactId: contact.id }
  });
  expect(classification.lensType).toBe('L0');
});
```

---

## 9. 모니터링 메트릭

### 렌즈별 성과 추적
```typescript
// Dashboard API에서 자동 계산
{
  L0: {
    contactCount: 120,
    convertedCount: 74,
    conversionRate: 0.62,
    avgLTV: 1200,
    totalRevenue: 89600,
    expectedRevenue: 145000,
    weeklyTrend: [0.60, 0.62, 0.61, 0.62]
  }
}
```

### 자동 최적화 권장
```
L1 (가격이의) 개선 필요:
- 현재 전환율: 42% (예상: 30%)
- 최고 렌즈와의 격차: 95% - 42% = 53%
- 추천: "할인율 조정으로 +8% 수익 증대 가능"
```

---

## 10. 문제 해결

### 문제: 특정 고객이 잘못된 렌즈로 분류됨

**진단**:
1. 신호 확인: `detection.detectedSignals` 확인
2. 점수 확인: 왜 이 렌즈가 최고 점수인가?
3. 규칙 검증: 규칙이 이 고객 유형에 맞나?

**해결**:
1. 규칙 가중치 조정 (예: L1 태그 점수 10 → 5)
2. 새로운 신호 추가 (예: "예상 금액" 필드)
3. Primary Lens 선택 로직 변경

**예시**:
```typescript
// Before
if (priceTags.length > 0) {
  score += 10;  // 너무 높음?
}

// After
if (priceTags.length > 0) {
  score += 5;   // 더 보수적으로
  // 하지만 다른 신호로 보상 (예: decision level)
}
```

---

## 11. 참고 자료

- **메인 서비스**: `src/lib/services/lens-detection-engine.ts`
- **API**: `src/app/api/contacts/detect-lens/route.ts`
- **명세**: `docs/LENS_DETECTION_ENGINE_SPEC.md`

---

**버전**: 1.0  
**마지막 업데이트**: 2026-05-27  
**작성자**: AI Agent
