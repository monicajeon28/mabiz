# Affiliate Partner Segmentation & Tiering (2026-05-26)

## 1. 개요: Partner Tier 시스템

파트너의 성과, 잠재력, 신뢰도에 따라 3개 계층으로 분류하고, 각 계층별로 다른 Commission 배분과 인센티브를 제공합니다.

### 1.1 3가지 Tier 정의

```
Top Performer Tier (엘리트 10%)
├── 월 수익 $30K+ 또는 연간 $300K+
├── 전환율 35% 이상
├── Partner Retention 95%+
├── Commission Rate: Base + 5% Bonus
├── 월 인센티브: $3K-10K (성과급)
└── 특혜: 전담 매니저, 월 CEO 미팅, 해외 컨퍼런스 초대

Standard Tier (준수한 성과, 60%)
├── 월 수익 $5K-30K 또는 연간 $60K-300K
├── 전환율 15-35%
├── Partner Retention 70-95%
├── Commission Rate: Base
├── 월 인센티브: 분기별 보너스 ($500-2K)
└── 특혜: 월 1회 그룹 웨비나, 마케팅 자료 지원

Growth Tier (신입/저성과, 30%)
├── 월 수익 <$5K 또는 연간 <$60K
├── 전환율 <15%
├── Partner Retention <70%
├── Commission Rate: Base - 2% (진입 단계)
├── 월 인센티브: 목표 달성 시만 지급 ($100-500)
└── 특혜: 전담 멘토, 주간 그룹 커뮤니티, 체계적 교육
```

---

## 2. Tier 판정 기준

### 2.1 자동 분류 로직 (월 1회 재평가)

```typescript
interface PartnerTierEvaluationCriteria {
  // 1. 성과 메트릭 (가중치: 40%)
  monthlyRevenue: number; // 월 수익
  annualRevenue: number; // 연간 수익
  conversionRate: number; // 전환율 (%)
  
  // 2. 참여도 (가중치: 30%)
  contactsReachedLastMonth: number; // 지난 달 접촉 고객
  smsComplianceRate: number; // SMS 발송 준수율 (%)
  weeklyActivityScore: number; // 활동도 0-100
  
  // 3. 신뢰도 (가중치: 20%)
  partnerRetention: number; // 고객 유지율 (%)
  chargebackRate: number; // 환불율 (%)
  onTimePaymentRate: number; // 적기 지급률 (%)
  
  // 4. 잠재력 (가중치: 10%)
  trendingRevenue: number; // 6개월 성장률 (%)
  completedTrainings: number; // 완료한 교육 수
  communityEngagement: number; // 커뮤니티 참여도 0-100
}

function calculateTierScore(criteria: PartnerTierEvaluationCriteria): {
  tier: "TOP" | "STANDARD" | "GROWTH";
  score: number; // 0-100
  nextTierGap: number; // 다음 tier까지의 점수 차이
} {
  const performanceScore = calculatePerformanceScore(criteria) * 0.4;
  const engagementScore = calculateEngagementScore(criteria) * 0.3;
  const trustScore = calculateTrustScore(criteria) * 0.2;
  const potentialScore = calculatePotentialScore(criteria) * 0.1;
  
  const totalScore = performanceScore + engagementScore + trustScore + potentialScore;
  
  let tier: "TOP" | "STANDARD" | "GROWTH";
  if (totalScore >= 80) tier = "TOP";
  else if (totalScore >= 50) tier = "STANDARD";
  else tier = "GROWTH";
  
  return { tier, score: totalScore, nextTierGap: getTierThreshold(tier) - totalScore };
}
```

### 2.2 구체적 산점

**Performance Score (0-100)**:
```
monthlyRevenue 기준:
  < $5K: 20점
  $5K-$15K: 40점
  $15K-$30K: 60점
  > $30K: 80점

conversionRate 기준:
  < 5%: 10점
  5-15%: 30점
  15-35%: 60점
  > 35%: 80점

최종 = (monthlyRevenue_points * 0.6 + conversionRate_points * 0.4)
```

**Engagement Score (0-100)**:
```
contactsReachedLastMonth 기준:
  < 10: 10점
  10-50: 30점
  50-200: 60점
  > 200: 80점

smsComplianceRate 기준:
  < 50%: 10점
  50-75%: 40점
  75-95%: 70점
  > 95%: 90점

weeklyActivityScore: 직접 측정 (0-100)

최종 = (contacts_points * 0.3 + compliance_points * 0.4 + activity_score * 0.3)
```

**Trust Score (0-100)**:
```
partnerRetention 기준:
  < 50%: 10점
  50-70%: 40점
  70-95%: 70점
  > 95%: 90점

chargebackRate 기준:
  > 10%: 10점
  5-10%: 40점
  1-5%: 70점
  < 1%: 90점

onTimePaymentRate 기준:
  < 80%: 20점
  80-95%: 50점
  > 95%: 90점

최종 = (retention_points * 0.4 + chargeback_points * 0.4 + payment_points * 0.2)
```

**Potential Score (0-100)**:
```
trendingRevenue 기준 (6개월 성장률):
  < -10%: 10점 (하락)
  -10% ~ 0%: 30점 (정체)
  0-20%: 60점 (성장)
  > 20%: 80점 (빠른 성장)

completedTrainings 기준:
  0: 20점
  1-3: 40점
  4-7: 60점
  8+: 80점

communityEngagement 기준:
  < 20: 10점
  20-50: 40점
  50-80: 70점
  > 80: 90점

최종 = (trending_points * 0.5 + trainings_points * 0.3 + engagement_points * 0.2)
```

---

## 3. Tier별 Commission 배분 구조

### 3.1 Base Commission Rate

```
Product Type별 기본 Commission:
┌──────────────┬────────────┬───────────┬─────────┐
│ Product      │ Top Tier   │ Standard  │ Growth  │
├──────────────┼────────────┼───────────┼─────────┤
│ Cruise (높음)│ 15%+2%     │ 12%       │ 10%-2%  │
│ Hotel        │ 12%+2%     │ 10%       │ 8%-2%   │
│ Tour         │ 10%+2%     │ 8%        │ 6%-2%   │
│ Activity     │ 8%+2%      │ 6%        │ 4%-2%   │
└──────────────┴────────────┴───────────┴─────────┘

Top Tier 보너스:
  - Base + 2% (전 제품)
  - 분기 목표 달성 시 추가 1-3%
  - 연간 수익 $300K 이상 시 추가 0.5%
```

### 3.2 Performance Bonus (월별)

```
Top Tier (총 수익의 15-20%):
  - 월 $30K 달성: 기본 commission 외 추가 10% 지급
  - 월 $50K 달성: 추가 15%
  - 월 $100K 달성: 추가 20%
  - 연간 $300K 달성: 보너스 $30K

Standard Tier (총 수익의 5-10%):
  - 월 $20K 달성: 기본 commission 외 추가 3% 지급
  - 월 $30K 달성: 추가 5%
  - 분기별 목표 달성 시 $500-2K 일시금
  - 6개월 연속 성장 시 Tier Up 검토

Growth Tier (총 수익의 2-5%):
  - 월 $10K 달성: 추가 $100 보너스
  - 월 $20K 달성: 추가 $300 보너스
  - 3개월 연속 10% 성장: Tier Up 검토
  - 교육 완료: 추가 $50-500
```

---

## 4. 자동 Tier 재분류 로직

### 4.1 재평가 주기 및 트리거

```typescript
// 월 1회 자동 재평가 (매달 1일 오전 2시)
async function autoEvaluatePartnerTiers() {
  const partners = await Partner.find({ status: "ACTIVE" });
  
  for (const partner of partners) {
    const criteria = await collectTierEvaluationCriteria(partner.id);
    const { tier: newTier, score } = calculateTierScore(criteria);
    const oldTier = partner.currentTier;
    
    // Tier 변경 시 자동 알림
    if (newTier !== oldTier) {
      await notifyPartnerTierChange(partner, oldTier, newTier, score);
      
      // Tier Up: 축하 이메일 + 인센티브 설명
      if (isUpgrade(oldTier, newTier)) {
        await sendTierUpgradeEmail(partner);
        await createUpgradeIncentiveOffer(partner);
      }
      
      // Tier Down: 경고 + 개선 계획 제시
      if (isDowngrade(oldTier, newTier)) {
        await sendTierDowngradeWarning(partner);
        await assignMentorSupport(partner);
      }
    }
  }
}

// 실시간 트리거: 특정 조건 충족 시 즉시 재평가
async function triggerImmediateTierReview(partnerId: string) {
  // Case 1: 월 수익 $30K 돌파 → 즉시 TOP Tier 상향 검토
  // Case 2: 전환율 35%+ → 즉시 TOP Tier 상향 검토
  // Case 3: 환불율 10% 초과 → 즉시 GROWTH Tier 하향 검토
  // Case 4: 3주 연속 0 활동 → 즉시 GROWTH Tier 하향 검토
}
```

### 4.2 Tier 변경 히스토리 추적

```typescript
model PartnerTierHistory {
  id: string;
  partnerId: string;
  
  // 변경 전후
  previousTier: "TOP" | "STANDARD" | "GROWTH";
  newTier: "TOP" | "STANDARD" | "GROWTH";
  
  // 점수
  evaluationScore: number;
  performanceScore: number;
  engagementScore: number;
  trustScore: number;
  potentialScore: number;
  
  // 변경 원인
  changeReason: string; // "Performance surge", "Churn risk", "Training completion", etc.
  triggeredBy: "AUTO_EVALUATION" | "MANUAL_REVIEW" | "SPECIAL_EVENT";
  reviewedBy?: string; // Manual review의 경우
  
  // Commission 영향
  previousCommissionRate: number;
  newCommissionRate: number;
  estimatedMonthlyImpact: number;
  
  changedAt: DateTime;
  effectiveFrom: DateTime;
}
```

---

## 5. Tier 상향 & 하향 진행 절차

### 5.1 Tier Up (승격) 절차

```
Step 1: 자격 충족 (자동 감지)
  - Top Tier: 점수 80+ (1개월 유지)
  - Standard → Top: 점수 80+ & 월 수익 $30K+

Step 2: 축하 통지 (자동 발송)
  - 이메일: "축하합니다! Top Tier 승격되셨습니다"
  - 포함 내용:
    * 새로운 commission rate (+2%)
    * 월 성과급 구조 설명
    * 전담 매니저 배정
    * CEO 월간 미팅 초대

Step 3: 인센티브 오퍼
  - 즉시 지급: $1K 축하금 (Top Tier)
  - 다음 분기: 추가 1% commission (첫 3개월)
  - 연간 해외 컨퍼런스 초대

Step 4: 성공 축하
  - Slack/WhatsApp 공지: 전사 공유
  - Community 랭킹 업데이트
  - 레퍼런스 사례 작성 제안
```

### 5.2 Tier Down (강등) 절차

```
Step 1: 경고 신호 감지 (자동)
  - 2주 연속 저성과
  - 전환율 15% 미만으로 하락
  - 환불율 10% 초과
  - 월 활동 50% 이상 감소

Step 2: 경고 알림 (1주일 유예)
  - 이메일: "파트너님의 성과 향상이 필요합니다"
  - 내용:
    * 현재 점수 및 부족한 부분
    * 30일 내 개선 계획 제시 요청
    * 전담 멘토 배정
    * 무료 교육 프로그램 안내

Step 3: 개선 계획 수립 (Partner)
  - 30일 내 개선 목표 설정
  - 주간 체크인 (매주 화요일)
  - 멘토로부터 1:1 코칭

Step 4: 최종 평가 (30일 후)
  - 개선 성공: Tier 유지, 보너스 제공 ($500)
  - 개선 실패: 강등 실행 (commission 2% 감소)
  - 지속 저조: 계약 재검토 (60일 유예)

Step 5: 강등 실행 (필요 시)
  - 이메일: "파트너 계약 조정 안내"
  - 새로운 commission rate 적용 (다음 월부터)
  - 재교육 프로그램 강제 (4주)
  - 주간 성과 리포팅 필수
```

---

## 6. 인센티브 구조 (월별)

### 6.1 Top Tier 인센티브

```
기본 Commission: 15% (최대 2% 추가 가능)

성과급 (월):
  - $30K-50K: +$1,500
  - $50K-100K: +$3,000
  - >$100K: +$5,000+

분기 보너스:
  - Q1/Q2/Q3/Q4 목표 달성: $5K-10K
  - 연간 $300K 달성: $30K 일시금

비금전 혜택:
  - 전담 매니저 (연간 $20K 가치)
  - 월 CEO 미팅
  - 해외 컨퍼런스 초대 (2회/년, $10K 가치)
  - VIP 마케팅 자료
  - 우선 신제품 테스트 기회

예상 월 수입:
  = 기본 commission (15%) + 성과급 (5%) + 분기 평균 (2.5%)
  = 평균 $30K × (15% + 7.5%) = $6,750/월
  = 연간 $81K (commission) + 인센티브 $30K+ = $111K+
```

### 6.2 Standard Tier 인센티브

```
기본 Commission: 10-12%

성과급 (분기):
  - 분기 $40K 달성: $2,000
  - 분기 $60K 달성: $3,500
  - 분기 $80K+ 달성: $5,000

월별 보너스:
  - 월 $15K+ 달성: +1% commission (그 달만)
  - 월 전환율 30%+: +$500 보너스

교육 보너스:
  - 월 교육 완료: $100-300
  - 월 2회 이상 커뮤니티 참여: $200

예상 월 수입:
  = $20K × 10% + 분기 보너스 $1,000/월 평균 + 월별 추가 $300
  = $2,000 + $1,000 + $300 = $3,300/월
  = 연간 $39.6K+ (commission 만)
```

### 6.3 Growth Tier 인센티브

```
기본 Commission: 8-10% (-2% 진입 할인)

성과급:
  - 월 $10K 달성: +$100
  - 월 $15K 달성: +$300
  - 월 $20K 달성: +$500

교육 보너스:
  - 주간 그룹 코칭 참석: $50/회
  - 월 교육 완료: $100-200
  - 멘토 세션 참석: $50/회

Tier Up 인센티브:
  - 3개월 연속 10%+ 성장 시 Standard Tier 상향 → $1K 축하금

예상 월 수입:
  = $8K × 8% + 교육 보너스 $200/월 평균
  = $640 + $200 = $840/월
  = 연간 $10K+ (목표 달성 필요)
```

---

## 7. 기대 효과

| 메트릭 | 현재 | 목표 (6개월) | 목표 (12개월) | 증가율 |
|--------|------|-------------|--------------|--------|
| **Top Tier 파트너 수익** | $10K | $25K | $50K | +400% |
| **Standard Tier 평균 수익** | $5K | $12K | $20K | +300% |
| **Partner 평균 수익** | $8K | $15K | $25K | +212% |
| **Partner Retention** | 60% | 75% | 85% | +42% |
| **전환율 (평균)** | 12% | 18% | 25% | +108% |
| **Top Tier 비율** | 5% | 10% | 15% | +200% (파트너 수) |
| **Tier Up 비율** | 월 2% | 월 5% | 월 8% | +300% |
| **총 Affiliate 기여도** | $80K | $180K | $300K | +275% |

---

## 8. 구현 로드맵

### Phase 1 (1개월): 기초 구축
- [ ] Tier 분류 로직 구현 (SQL 쿼리)
- [ ] Partner.currentTier 필드 추가
- [ ] PartnerTierHistory 모델 생성
- [ ] 초기 모든 Partner에 Tier 할당

### Phase 2 (2개월): 자동화
- [ ] 월 1회 자동 재평가 (Cron Job)
- [ ] Tier 변경 감지 → 알림 자동 발송
- [ ] Commission Rate 자동 조정
- [ ] 인센티브 자동 계산 & 지급

### Phase 3 (3개월): 최적화
- [ ] A/B 테스트: Tier별 최적 Commission 배분율
- [ ] Partner Feedback 수집 → 기준 미세 조정
- [ ] Performance Dashboard 구축
- [ ] 월 리포팅 자동화

---

**다음 파일**: affiliate_churn_prediction.md → Risk Score & Early Warning
